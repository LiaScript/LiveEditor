<script lang="ts">
import * as Y from "yjs";

import { IndexeddbPersistence } from "y-indexeddb";
import { MonacoBinding } from "y-monaco";
import {
  getProjectDoc,
  releaseProjectDoc,
  ProjectDoc,
  isTextFile,
  isImageFile,
  isVideoFile,
} from "../ts/ProjectDoc";
import { editor, KeyMod, KeyCode, languages, IDisposable } from "monaco-editor";
import * as Utils from "../ts/utils";
import type { EditorConfig } from "../ts/utils";
import EditorSettingsTab from "./EditorSettingsTab.vue";
import { navigateTo } from "../index";

// import * as MATHJS from "mathjs";
import { TableEditor, options, Point, Range } from "@susisu/mte-kernel";
import TextEditorInterface from "../ts/TextEditorInterface";

import Recorder from "./Recorder.vue";

var Emojis: { label: string; insertText: string; range: any }[] = [];
import("../ts/Emojis.ts").then((module) => {
  for (const [label, emoji] of module.Emojis) {
    Emojis.push({
      label: label + " " + emoji,
      insertText: emoji,
      range: null,
    });
  }
});

var Snippets: Array<{
  label: string;
  kind: languages.CompletionItemKind;
  documentation: string;
  insertText: string;
  range: any;
  command: { id: string };
}> = [];
import("../ts/Snippets.ts").then((module) => {
  for (const snippet of module.Snippets) {
    Snippets.push({
      label: snippet.label,
      kind: languages.CompletionItemKind.Text,
      documentation: snippet.documentation,
      insertText: snippet.insertText,
      range: null,
      command: {
        id: "editor.action.insertLineAfter",
      },
    });
  }
});

var Editor: any;
var tableEditor: any;
var provider;
var currentBinding: any = null;
var currentModel: any = null;
var isCtrlPressed = false;
var MATHJS;

let completionProviders: IDisposable[] = [];

import("mathjs").then((module) => {
  MATHJS = module;
});

function blobToUint8Array(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    // Define the onload event handler
    reader.onload = function (event) {
      const arrayBuffer = event.target?.result;
      if (!arrayBuffer || typeof arrayBuffer === "string") {
        reject("could not read file");
      } else {
        const uint8Array = new Uint8Array(arrayBuffer);
        resolve(uint8Array);
        return;
      }
    };

    // Define the onerror event handler
    reader.onerror = function (error) {
      reject(error);
    };

    // Read the Blob as an ArrayBuffer
    reader.readAsArrayBuffer(blob);
  });
}

export default {
  name: "Editor",
  components: { Recorder, EditorSettingsTab },
  inheritAttrs: false,
  props: ["storageId", "content", "connection", "toolbar"],

  data() {
    const config = Utils.loadConfig();

    return {
      lights: config.lights,
      user: config.user,
      editorConfig: { ...config.editor } as EditorConfig,
      recorder: { audio: false, webcam: false, desktop: false },

      activeTab: "start",

      online: null,
      upload: {
        image: null,
        audio: null,
        movie: null,
      },
      blob: null,
      projectDoc: null as ProjectDoc | null,
      activePath: "",
      activeMime: "",
      activeView: "text" as "text" | "image" | "video" | "binary",
      imageUrl: "",
      videoUrl: "",
    };
  },

  computed: {
    isTextActive(): boolean {
      if (this.toolbar === false) return false;
      return this.activeView === "text";
    },
    isMarkdownActive(): boolean {
      if (this.activeView !== "text") return false;
      if (this.activePath === "") return true;
      const ext = this.activePath.split(".").pop()?.toLowerCase();
      return ext === "md" || ext === "markdown" || ext === "lia";
    },
  },

  watch: {
    isMarkdownActive(val: boolean) {
      if (!val && this.activeTab !== "editor") {
        this.activeTab = "editor";
      }
    },
  },

  methods: {
    // Store an uploaded media file under its original name so it shows up in
    // the file explorer, and return the path to reference it in the markdown.
    // Falls back to the legacy hash/blob storage when no project doc exists.
    storeUpload(filename: string, data: Uint8Array, mime?: string): string {
      if (this.projectDoc) {
        return this.projectDoc.addUpload(filename, data, mime);
      }
      (this.blob as any)?.set(filename, data);
      return filename;
    },

    storeAudioFile(record) {
      if (record.blob) {
        const self = this;
        blobToUint8Array(record.blob)
          .then((uint8Array) => {
            const date = new Date();
            const filename = "recording-" + date.toISOString() + ".mp3";

            const path = self.storeUpload(filename, uint8Array as Uint8Array, "audio/mpeg");
            self.make("upload-audio", path);
          })
          .catch((error) => {
            console.warn("Error:", error);
          });
      } else {
        console.warn("could not load file: ", record);
      }
    },

    storeVideoFile(blob) {
      if (blob) {
        const self = this;
        blobToUint8Array(blob)
          .then((uint8Array) => {
            const date = new Date();
            const filename = "recording-" + date.toISOString() + ".webm";

            const path = self.storeUpload(filename, uint8Array as Uint8Array, "video/webm");
            self.make("upload-movie", path);
          })
          .catch((error) => {
            console.warn("Error:", error);
          });
      } else {
        console.warn("could not load file: ", blob);
      }
    },

    getValue() {
      if (Editor) {
        return Editor.getValue();
      }
    },

    // The preview always renders the main LiaScript course, regardless of which
    // file is currently active in the editor.
    getMainValue() {
      if (this.projectDoc) {
        return this.projectDoc.content.toString();
      }
      return this.getValue();
    },

    // ----- multi-file editing -------------------------------------------------

    languageFor(path: string): string {
      const ext = path.split(".").pop()?.toLowerCase() || "";
      const map: Record<string, string> = {
        md: "markdown", markdown: "markdown", lia: "markdown",
        js: "javascript", mjs: "javascript", cjs: "javascript", jsx: "javascript",
        ts: "typescript", tsx: "typescript", json: "json", jsonc: "json",
        css: "css", scss: "scss", less: "less", html: "html", htm: "html",
        xml: "xml", svg: "xml", yaml: "yaml", yml: "yaml",
        py: "python", rb: "ruby", php: "php", java: "java", c: "c", h: "c",
        cpp: "cpp", hpp: "cpp", cs: "csharp", go: "go", rs: "rust",
        sh: "shell", bash: "shell", zsh: "shell", sql: "sql", lua: "lua",
        r: "r", toml: "ini", ini: "ini", vue: "html",
      };
      return map[ext] || "plaintext";
    },

    setImage(url: string) {
      if (this.imageUrl && this.imageUrl !== url) {
        URL.revokeObjectURL(this.imageUrl);
      }
      this.imageUrl = url;
    },

    setVideo(url: string) {
      if (this.videoUrl && this.videoUrl !== url) {
        URL.revokeObjectURL(this.videoUrl);
      }
      this.videoUrl = url;
    },

    // Swap the Monaco model + collaborative binding to a different Y.Text.
    bindDoc(yText: any, language: string) {
      if (!Editor) return;
      if (currentBinding) {
        currentBinding.destroy();
        currentBinding = null;
      }
      const old = currentModel;
      currentModel = editor.createModel("", language);
      Editor.setModel(currentModel);
      currentBinding = new MonacoBinding(
        yText,
        currentModel,
        new Set([Editor]),
        provider ? provider.awareness : null
      );
      if (old) {
        try {
          old.dispose();
        } catch (e) {
          /* ignore */
        }
      }
    },

    // Open the main course document for editing.
    openMain() {
      if (!this.projectDoc) return;
      this.setImage("");
      this.setVideo("");
      this.activePath = "";
      this.activeMime = "";
      this.activeView = "text";
      this.bindDoc(this.projectDoc.content, "markdown");
      if (Editor) Editor.focus();
    },

    // Open a file from the explorer: text files become editable, images are
    // displayed, everything else shows a download hint.
    openPath(path: string, mime?: string) {
      if (!this.projectDoc) return;
      this.activePath = path;
      this.activeMime = mime || "";

      if (isImageFile(path, mime)) {
        const data = this.projectDoc.readFileData(path);
        this.setVideo("");
        this.setImage(
          data ? URL.createObjectURL(new Blob([data as BlobPart], { type: mime || "" })) : ""
        );
        this.activeView = "image";
        return;
      }

      if (isVideoFile(path, mime)) {
        const data = this.projectDoc.readFileData(path);
        this.setImage("");
        this.setVideo(
          data ? URL.createObjectURL(new Blob([data as BlobPart], { type: mime || "video/webm" })) : ""
        );
        this.activeView = "video";
        return;
      }

      if (isTextFile(path, mime)) {
        this.setImage("");
        this.setVideo("");
        this.activeView = "text";
        this.bindDoc(this.projectDoc.getText(path), this.languageFor(path));
        if (Editor) Editor.focus();
        return;
      }

      this.setImage("");
      this.setVideo("");
      this.activeView = "binary";
    },

    make(cmd: string, data: any = null) {
      if (!Editor) return;

      const position = Editor.getPosition();
      const selection = Editor.getSelection();
      const range = {
        startLineNumber: selection?.startLineNumber || 1,
        startColumn: selection?.startColumn || 1,
        endLineNumber: selection?.endLineNumber || 1,
        endColumn: selection?.endColumn || 1,
      };
      const line = Editor.getModel().getLineContent(position.lineNumber);
      const text = Editor.getModel().getValueInRange(selection);

      let op = { range, text: "" };
      let move = 0;

      switch (cmd) {
        case "animation": {
          if (text) {
            if (text.match(/\n\s*\n/g)) {
              op.text = "      {{1}}\n<section>\n\n" + text + "\n\n</section>\n";
            } else {
              op.text = "      {{1}}\n" + text;
            }
          } else {
            op.text = "      {{1}}\n";
          }
          break;
        }

        case "ascii": {
          if (text) {
            op.text = "```ascii\n" + text + "\n```\n";
          } else {
            op.text = `\`\`\` ascii
 +------+   +-----+   +-----+   +-----+
 |      |   |     |   |     |   |     |      .----.
 | Foo  +-->| Bar +---+ Baz |<--+ Moo |     (  🦖  )
 |  🦅  |   |     |   |     |   |     |      \`----'
 +--+---+   +-----+   +--+--+   +--o--+
     \\         A         |        \/
      \\        |         |       \/
       V       |         V      \/
 .-------------+---------------+-------.
 | Hello here and there and everywhere |
 '-------------------------------------'

"  https://github.com/andre-dietrich/elm-svgbob/  "
\`\`\`

`;
          }
          break;
        }

        case "audio": {
          if (text) {
            op.text = `?[](${text})`;
          } else {
            op.text = "?[](https://)";
          }
          move = 2;
          break;
        }

        case "bold": {
          op.text = "__" + text + "__";
          if (text === "") {
            move = 2;
          }
          break;
        }

        case "code": {
          if (text) {
            op.text = "```\n" + text + "\n```";
          } else {
            op.text = '``` js\nvar message="Hello World"\nconsole.log(message)\n```';
          }

          break;
        }

        case "code-inline": {
          op.text = "`" + text + "`";
          if (text === "") {
            move = 1;
          }
          break;
        }

        case "code-executable": {
          if (text) {
            op.text = `\`\`\`\`
${text}
\`\`\`
<script>@input <\/script>
`;
          } else {
            op.text = `\`\`\` js
var message = "Hello World"
console.log(message)
message.length
\`\`\`
<script>@input <\/script>
`;
          }

          break;
        }

        case "code-project": {
          op.text = `\`\`\` js     -EvalScript.js
let who = data.first_name + " " + data.last_name;

if(data.online) {
  who + " is online";
} else {
  who + " is NOT online";
}
\`\`\`
\`\`\` json    +Data.json
{
  "first_name" :  "Sammy",
  "last_name"  :  "Shark",
  "online"     :  true
}
\`\`\`
<script>
  // insert the JSON dataset into the local variable data
  let data = @input(1);

  // eval the script that uses this dataset
  eval(\`@input(0)\`);
<\/script>
`;

          op.range = {
            startLineNumber: position.lineNumber || 1,
            startColumn: 0,
            endLineNumber: position.lineNumber || 1,
            endColumn: 1,
          };

          break;
        }

        case "comment": {
          op.text = "    --{{1}}--\n" + text;
          break;
        }

        case "graph": {
          op.range = {
            startLineNumber: position.lineNumber || 1,
            startColumn: 0,
            endLineNumber: position.lineNumber || 1,
            endColumn: 1,
          };

          op.text = `                                    Multiline
    1.9 |
        |                 ***
      y |               *     *
      - | r r r r r r r*r r r r*r r r r r r r
      a |             *         *
      x |            *           *
      i | B B B B B * B B B B B B * B B B B B
      s |         *                 *
        | *  * *                       * *  *
     -1 +------------------------------------
        0              x-axis               1

`;
          break;
        }

        case "formula": {
          if (text) {
            op.text = "$$\n" + text + "\n$$\n";
          } else {
            op.text = `$$
   \\sum_{i=1}^{\\infty}{\\frac{1}{n^2}
        =\\frac{\\pi^2}{6}}

% For more information see: https://katex.org
$$

`;
          }

          break;
        }

        case "formula-inline": {
          op.text = "$" + text + "$";
          if (text === "") {
            move = 1;
          }
          break;
        }

        case "header": {
          op.range = {
            startLineNumber: position.lineNumber || 1,
            startColumn: 0,
            endLineNumber: position.lineNumber || 1,
            endColumn: 1,
          };

          op.text = "#" + (line.startsWith(" ") || line.startsWith("#") ? "" : " ");

          break;
        }

        case "image": {
          if (text) {
            op.text = `![](${text})`;
          } else {
            op.text = "![](https://)";
          }
          move = 2;
          break;
        }

        case "init": {
          for (const el of Snippets) {
            if (el.label === "lia-template") {
              Editor.setValue(el.insertText);

              break;
            }
          }

          break;
        }

        case "italic": {
          op.text = "_" + text + "_";
          if (text === "") {
            move = 1;
          }
          break;
        }

        case "keyboard": {
          op.text = `<kbd>${text}<\/kbd>`;
          if (text === "") {
            move = 5;
          }
          break;
        }

        case "line": {
          op = {
            range: {
              startLineNumber: position.lineNumber || 1,
              startColumn: 0,
              endLineNumber: position.lineNumber || 1,
              endColumn: 1,
            },
            text: "---\n\n",
          };

          break;
        }

        case "link": {
          op.text = "[](https://)";
          move = 1;
          break;
        }

        case "list-check": {
          op.text = "- [ ] " + text.replace(/\n/g, "\n- [ ] ");
          break;
        }

        case "list-ordered": {
          if (text) {
            const lines = text.split("\n");

            for (let i = 0; i < lines.length; i++) {
              lines[i] = i + 1 + ". " + lines[i];
            }

            op.text = lines.join("\n");
          } else {
            op.text = "1. ";
          }

          break;
        }

        case "list-unordered": {
          op.text = "* " + text.replace(/\n/g, "\n* ");
          break;
        }

        case "movie": {
          if (text) {
            op.text = `!?[](${text})`;
          } else {
            op.text = `!?[](https://)`;
          }
          move = 3;
          break;
        }

        case "oembed": {
          if (text) {
            op.text = `??[](${text})`;
          } else {
            op.text = "??[](https://)";
          }
          move = 3;
          break;
        }

        case "quiz-gap-text": {
          op = {
            range: {
              startLineNumber: position.lineNumber || 1,
              startColumn: 0,
              endLineNumber: position.lineNumber || 1,
              endColumn: 1,
            },
            text: `__I (learn) [[  have been learning  ]] English for seven years now.__
But last year I (not / work) [[ was not working ]] hard enough for English,
that's why my marks (not / be) _[[ were not ]]_ really that good then.
As I (pass / want) [[ want to pass ]] my English exam successfully next year,
I (study) ~[[ am going to study ]]~ harder this term.

`,
          };
          break;
        }

        case "quiz-input": {
          if (text) {
            op.text = "[[" + text + "]]";
          } else {
            op = {
              range: {
                startLineNumber: position.lineNumber || 1,
                startColumn: 0,
                endLineNumber: position.lineNumber || 1,
                endColumn: 1,
              },
              text: "[[solution]]",
            };
          }
          break;
        }

        case "quiz-matrix": {
          op = {
            range: {
              startLineNumber: position.lineNumber || 1,
              startColumn: 0,
              endLineNumber: position.lineNumber || 1,
              endColumn: 1,
            },
            text: `- [[male (der)] (female [die]) [neuter (das)]]
- [    [X]           [ ]             [ ]     ]  Mann - German for man
- [    ( )           (X)             ( )     ]  Frau - German for woman
- [    ( )           ( )             (X)     ]  Mädchen - German for girl

`,
          };
          break;
        }

        case "quiz-multiple-choice": {
          op.text = "- [[ ]] " + text.replace(/\n/g, "\n- [[ ]] ");
          break;
        }

        case "quiz-single-choice": {
          if (text) {
            op.text = "- [( )] " + text.replace(/\n/g, "\n- [( )] ");
          } else {
            op.text = "- [( )] not checked\n- [(X)] checked";
          }

          break;
        }

        case "quiz-selection": {
          if (text) {
            op.text = "[[(" + text + ") | __wrong__ ]]";
          } else {
            op.text = "[[ wrong | __wrong too__ | (solution) ]]";
          }
          break;
        }

        case "quote": {
          op.text = "> " + text.replace(/\n/g, "\n> ");
          break;
        }

        case "gfm-note": {
          op.text = "> [!NOTE]\n> " + (text ? text.replace(/\n/g, "\n> ") : "");
          break;
        }

        case "gfm-tip": {
          op.text = "> [!TIP]\n> " + (text ? text.replace(/\n/g, "\n> ") : "");
          break;
        }

        case "gfm-important": {
          op.text = "> [!IMPORTANT]\n> " + (text ? text.replace(/\n/g, "\n> ") : "");
          break;
        }

        case "gfm-warning": {
          op.text = "> [!WARNING]\n> " + (text ? text.replace(/\n/g, "\n> ") : "");
          break;
        }

        case "gfm-caution": {
          op.text = "> [!CAUTION]\n> " + (text ? text.replace(/\n/g, "\n> ") : "");
          break;
        }

        case "strikethrough": {
          op.text = "~" + text + "~";
          if (text === "") {
            move = 1;
          }
          break;
        }

        case "superscript": {
          op.text = "^" + text + "^";
          if (text === "") {
            move = 1;
          }
          break;
        }

        case "table": {
          op = {
            range: {
              startLineNumber: position.lineNumber || 1,
              startColumn: 0,
              endLineNumber: position.lineNumber || 1,
              endColumn: 1,
            },
            text:
              "| Column 1 | Column 2 | Column 3 |\n| -------- | :------: | -------: |\n| Text     |   Text   |     Text |\n\n",
          };

          break;
        }

        case "tts": {
          op.text = "    {{|>}}\n" + text;
          break;
        }

        case "underline": {
          op.text = "~~" + text + "~~";
          if (text === "") {
            move = 2;
          }
          break;
        }

        case "upload-audio": {
          if (data) {
            op.text = `?[](${data})`;
            move = 2;
          } else {
            this.upload.audio.click();
          }

          break;
        }

        case "upload-image": {
          if (data) {
            op.text = `![](${data})`;
            move = 2;
          } else {
            this.upload.image.click();
          }

          break;
        }

        case "upload-movie": {
          if (data) {
            op.text = `!?[](${data})`;
            move = 3;
          } else {
            this.upload.movie.click();
          }

          break;
        }

        case "mathjs-evaluate": {
          try {
            op.text = MATHJS.format(MATHJS.evaluate(text, {}));
          } catch (e) {
            op.text = text;
          }

          break;
        }

        case "mathjs-tex": {
          try {
            op.text = MATHJS.parse(text).toTex();
          } catch (e) {
            op.text = text;
          }

          break;
        }

        case "mathjs-simplify": {
          try {
            op.text = MATHJS.format(MATHJS.simplify(text));
          } catch (e) {
            op.text = text;
          }

          break;
        }
      }

      Editor.executeEdits("", [op]);

      if (move) {
        Editor.setPosition({
          lineNumber: position.lineNumber,
          column: position.column + move,
        });
      }
      Editor.focus();
    },

    tableAction(cmd: string) {
      const opts = options({});
      if (!tableEditor || !tableEditor.cursorIsInTable(opts)) {
        if (Editor) Editor.focus();
        return;
      }
      switch (cmd) {
        case "format":   tableEditor.format(opts); break;
        case "next":     tableEditor.nextCell(opts); break;
        case "previous": tableEditor.previousCell(opts); break;
        case "row":      tableEditor.insertRow(opts); break;
      }
      if (Editor) Editor.focus();
    },

    applyEditorConfig(cfg: EditorConfig) {
      this.editorConfig = cfg;
      if (Editor) {
        Editor.updateOptions({
          fontSize: cfg.fontSize,
          fontFamily: cfg.fontFamily,
          lineNumbers: cfg.lineNumbers,
          minimap: { enabled: cfg.minimap },
          wordWrap: cfg.wordWrap,
          tabSize: cfg.tabSize,
          insertSpaces: cfg.insertSpaces,
          renderWhitespace: cfg.renderWhitespace,
          folding: cfg.folding,
          bracketPairColorization: { enabled: cfg.bracketPairColorization },
          smoothScrolling: cfg.smoothScrolling,
          wordBasedSuggestions: cfg.wordBasedSuggestions ? "allDocuments" : false,
          cursorBlinking: cfg.cursorBlinking,
        });
      }
      const config = Utils.loadConfig();
      config.editor = { ...cfg };
      Utils.storeConfig(config);
    },

    switchLights() {
      if (Editor) {
        const config = Utils.loadConfig();

        this.lights = !this.lights;
        Editor.updateOptions({
          theme: this.lights ? "vs-light" : "vs-dark",
        });

        config.lights = this.lights;

        Utils.storeConfig(config);
      }

      return this.lights;
    },

    getBlob(hash: string) {
      if (hash.startsWith("/")) {
        hash = hash.slice(1);
      }

      // 1) legacy inline media (toolbar uploads), keyed by `hash+ending`
      const inline = this.blob?.get(hash);
      if (inline) return inline;

      // 2) files added through the file explorer, keyed by their path
      return this.projectDoc?.readFileData(hash);
    },

    getAllBlobs() {
      const blobs: any[] = [];

      // legacy inline media (hash-keyed)
      this.blob?.forEach((data, name) => {
        blobs.push({ name, data });
      });

      // all files from the explorer — readFileData handles both binary files
      // (fileData) and editable text files (fileText, e.g. .js/.cpp), so exports
      // are complete.
      if (this.projectDoc) {
        const project = this.projectDoc;
        project.files.forEach((meta, path) => {
          if (meta.type !== "file") return;
          const data = project.readFileData(path);
          if (data) {
            blobs.push({ name: path, data });
          }
        });
      }

      return blobs;
    },

    gotoLine(line: number) {
      if (Editor) {
        Editor.setPosition({ lineNumber: line + 1, column: 0 });
        Editor.revealLineNearTop(line + 1);
        Editor.focus();
      }
    },

    fork() {
      const id = Utils.randomString(24);
      const yDoc = new Y.Doc();
      const yText = yDoc.getText(id);
      const yMap = yDoc.getMap("blob");

      if (this.blob !== null) {
        this.blob.forEach((value, key) => {
          yMap.set(key, value);
        });
      }

      yText.insert(0, this.getValue());

      const indexeddbProvider = new IndexeddbPersistence(id, yDoc);

      indexeddbProvider.on("synced", (event: any) => {
        console.log("liascript: fork");

        navigateTo("?/edit/" + id);
      });
    },

    initEditor(code: string) {
      const div = document.getElementById("liascript-editor");

      if (!div) {
        console.warn("No editor init");
        return;
      }

      // Drag and drop handler for the editor
      div.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.stopPropagation();
      });

      div.addEventListener(
        "drop",
        async (e) => {
          // Zuerst prüfen, ob es sich um eine Markdown-Datei oder einen LiaScript-Link handelt
          let url = e.dataTransfer ? e.dataTransfer.getData("text/uri-list") : null;
          if (!url) {
            const textData = e.dataTransfer ? e.dataTransfer.getData("text/plain") : null;
            // Prüfen, ob der text bereits ein Markdown-Link ist
            if (textData && !/^\[.*\]\(.*\)$/.test(textData)) {
              url = textData;
            }
          }

          // Frühe Prüfung für Markdown oder LiaScript-Links
          const isMarkdownFile = url && url.toLowerCase().endsWith(".md");
          const liaScriptMatch =
            url && url.match(/https:\/\/liascript\.github\.io\/course\/\?(.*)/);

          // Nur für Markdown oder LiaScript-Links unser eigenes Handling verwenden
          if ((isMarkdownFile || liaScriptMatch) && Editor) {
            e.preventDefault();
            e.stopPropagation(); // Stoppt Weitergabe des Events an Monaco

            try {
              // Bei LiaScript-Link nehmen wir die eigentliche Markdown-URL
              const fetchUrl = liaScriptMatch
                ? decodeURIComponent(liaScriptMatch[1])
                : url;

              // Laden des Inhalts der Markdown-Datei
              const response = await fetch(fetchUrl);

              if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
              }

              const markdownContent = await response.text();

              // Suche nach der ersten Überschrift und schneide alles davor ab
              let processedContent = markdownContent;
              const headingMatch = markdownContent.match(/^#{1,6}\s+.*$/m);

              if (headingMatch) {
                // Index des ersten Zeichens nach der Zeile mit der Überschrift
                const headingEndIndex =
                  markdownContent.indexOf(headingMatch[0]) + headingMatch[0].length;
                // Alles nach der Überschrift
                processedContent = markdownContent.substring(headingEndIndex);

                // Entferne führende Leerzeilen
                processedContent = processedContent.replace(/^\n+/, "");
              }

              // Aktuelle Cursor-Position
              const position = Editor.getPosition();

              // Inhalt an Cursor-Position einfügen
              Editor.executeEdits("", [
                {
                  range: {
                    startLineNumber: position?.lineNumber || 1,
                    startColumn: position?.column || 1,
                    endLineNumber: position?.lineNumber || 1,
                    endColumn: position?.column || 1,
                  },
                  text: processedContent,
                },
              ]);

              Editor.focus();
              return false; // Verhindert weitere Verarbeitung
            } catch (error) {
              console.error("Could not load markdown:", error);

              // Bei Fehler: Nur für normale Markdown-Dateien als Fallback einen Link einfügen
              if (isMarkdownFile && !liaScriptMatch) {
                insertMarkdownLink(url, Editor);
              }
            }
          } else if (url && !isMarkdownFile && !liaScriptMatch && Editor) {
            // Für normale Links fügen wir einen Markdown-Link ein
            e.preventDefault();
            e.stopPropagation();
            insertMarkdownLink(url, Editor);
            return false;
          }
          // Für alle anderen Fälle: Monaco-Standardverhalten beibehalten
          return true;
        },
        true
      );

      // Hilfsfunktion zum Einfügen eines Markdown-Links
      function insertMarkdownLink(url, editor) {
        const position = editor.getPosition();

        editor.executeEdits("", [
          {
            range: {
              startLineNumber: position.lineNumber,
              startColumn: position.column,
              endLineNumber: position.lineNumber,
              endColumn: position.column,
            },
            text: `[](${url})`,
          },
        ]);

        // Cursor zwischen die eckigen Klammern setzen
        editor.setPosition({
          lineNumber: position.lineNumber,
          column: position.column + 1,
        });

        editor.focus();
      }

      const Editor = editor.create(div, {
        value: code,
        language: "markdown",
        theme: this.lights ? "vs-light" : "vs-dark",
        automaticLayout: true,
      });

      this.applyEditorConfig(this.editorConfig);

      const self = this;

      Editor.addAction({
        // An unique identifier of the contributed action.
        id: "compile",
        // A label of the action that will be presented to the user.
        label: "LiaScript - Compile",
        // An optional array of keybindings for the action.
        keybindings: [KeyMod.CtrlCmd | KeyCode.KeyS],
        // A precondition for this action.
        precondition: undefined,
        // A rule to evaluate on top of the precondition in order to dispatch the keybindings.
        keybindingContext: undefined,
        contextMenuGroupId: "navigation",
        contextMenuOrder: 1.5,
        // Method that will be executed when the action is triggered.
        // @param editor The editor instance is passed in as a convenience
        run: function (_: any) {
          self.$emit("compile");
        },
      });

      Editor.addAction({
        // An unique identifier of the contributed action.
        id: "mathjs-evaluate",
        // A label of the action that will be presented to the user.
        label: "MathJS - Evaluate Expression",
        // An optional array of keybindings for the action.
        keybindings: [KeyMod.CtrlCmd | KeyCode.KeyE],
        // A precondition for this action.
        precondition: undefined,
        // A rule to evaluate on top of the precondition in order to dispatch the keybindings.
        keybindingContext: undefined,
        contextMenuGroupId: "1_modifications",
        contextMenuOrder: 1.5,
        // Method that will be executed when the action is triggered.
        // @param editor The editor instance is passed in as a convenience
        run: function (text: any) {
          self.make("mathjs-evaluate");
        },
      });
      Editor.addAction({
        // An unique identifier of the contributed action.
        id: "mathjs-simplify",
        // A label of the action that will be presented to the user.
        label: "MathJS - Simplify Expression",
        // An optional array of keybindings for the action.
        keybindings: [KeyMod.CtrlCmd | KeyCode.KeyM],
        // A precondition for this action.
        precondition: undefined,
        // A rule to evaluate on top of the precondition in order to dispatch the keybindings.
        keybindingContext: undefined,
        contextMenuGroupId: "1_modifications",
        contextMenuOrder: 1.6,
        // Method that will be executed when the action is triggered.
        // @param editor The editor instance is passed in as a convenience
        run: function (text: any) {
          self.make("mathjs-simplify");
        },
      });

      Editor.addAction({
        // An unique identifier of the contributed action.
        id: "mathjs-tex",
        // A label of the action that will be presented to the user.
        label: "MathJS - to Tex",
        // An optional array of keybindings for the action.
        keybindings: [KeyMod.CtrlCmd | KeyCode.KeyO],
        // A precondition for this action.
        precondition: undefined,
        // A rule to evaluate on top of the precondition in order to dispatch the keybindings.
        keybindingContext: undefined,
        contextMenuGroupId: "1_modifications",
        contextMenuOrder: 1.7,
        // Method that will be executed when the action is triggered.
        // @param editor The editor instance is passed in as a convenience
        run: function (text: any) {
          self.make("mathjs-tex");
        },
      });

      const snippetProvider = languages.registerCompletionItemProvider("markdown", {
        //triggerCharacters: ['['],

        provideCompletionItems: function (
          model,
          position,
          context
        ): languages.ProviderResult<languages.CompletionList> {
          const word = model.getWordAtPosition(position);

          if (
            word?.word.startsWith("lia") ||
            word?.word.startsWith("voice") ||
            word?.word.startsWith("hili")
          ) {
            const range = {
              startLineNumber: position.lineNumber,
              endLineNumber: position.lineNumber,
              startColumn: word?.startColumn || 0,
              endColumn: word?.endColumn || 0,
            };

            for (let i = 0; i < Snippets.length; i++) {
              Snippets[i].range = range;
            }

            return {
              suggestions: Snippets,
            } as languages.ProviderResult<languages.CompletionList>;
          }

          return {
            suggestions: [],
          };
        },
      });

      completionProviders.push(snippetProvider);

      const emojiProvider = languages.registerCompletionItemProvider("markdown", {
        triggerCharacters: [":"],
        provideCompletionItems: function (
          model,
          position,
          context
        ): languages.ProviderResult<languages.CompletionList> {
          const word = model.getWordAtPosition(position);

          const range = {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: (word?.startColumn || position.column) - 1,
            endColumn: word?.endColumn || position.column,
          };

          if (
            model.getValueInRange(range) == "" ||
            model.getValueInRange(range).startsWith(":")
          ) {
            for (let i = 0; i < Emojis.length; i++) {
              Emojis[i].range = range;
            }

            return {
              suggestions: Emojis,
            } as languages.ProviderResult<languages.CompletionList>;
          }

          return {
            suggestions: [],
          };
        },
      });

      completionProviders.push(emojiProvider);

      languages.registerCodeActionProvider("markdown", {
        provideCodeActions(model, range, token) {
          if (isCtrlPressed) {
            isCtrlPressed = false;
            self.$emit("goto", range.startLineNumber);
          }
          return undefined;
        },
      });

      Editor.onKeyDown((e) => {
        if (e.keyCode == 5) {
          isCtrlPressed = true;
        }
      });

      Editor.onKeyUp((e) => {
        if (e.keyCode == 5) {
          isCtrlPressed = false;
        }
      });

      return this.toTableEditor(Editor);
    },

    toTableEditor(textEditor: any = null) {
      if (!textEditor) return;

      const Interface = new TextEditorInterface(textEditor);
      tableEditor = new TableEditor(Interface);

      textEditor.addAction({
        id: "table-format",
        label: "Table - Format",
        keybindings: [KeyMod.CtrlCmd | KeyCode.Enter],
        contextMenuGroupId: "2_modifications",
        contextMenuOrder: 2,

        run: function (_: any) {
          if (tableEditor) {
            if (tableEditor.cursorIsInTable(options({}))) {
              tableEditor.format(options({}));
            } else {
              textEditor.trigger("keyboard", "type", {
                text: "\n",
              });
            }
          }
        },
      });

      textEditor.addAction({
        id: "table-next",
        label: "Table - Jump to Next Cell",
        keybindings: [KeyCode.Tab],
        contextMenuGroupId: "2_modifications",
        contextMenuOrder: 2.1,

        run: function (_: any) {
          if (tableEditor) {
            if (tableEditor.cursorIsInTable(options({}))) {
              tableEditor.nextCell(options({}));
            } else {
              textEditor.trigger("keyboard", "type", {
                text: "    ",
              });
            }
          }
        },
      });

      textEditor.addAction({
        id: "table-previous",
        label: "Table - Jump to Previous Cell",
        keybindings: [KeyMod.Shift | KeyCode.Tab],
        contextMenuGroupId: "2_modifications",
        contextMenuOrder: 2.2,

        run: function (_: any) {
          if (tableEditor) {
            if (tableEditor.cursorIsInTable(options({}))) {
              tableEditor.previousCell(options({}));
            }
          }
        },
      });

      textEditor.addAction({
        id: "table-row",
        label: "Table - Add Row/Line",
        keybindings: [KeyMod.CtrlCmd | KeyCode.KeyL],
        contextMenuGroupId: "2_modifications",
        contextMenuOrder: 2.3,

        run: function (_: any) {
          if (tableEditor) {
            if (tableEditor.cursorIsInTable(options({}))) {
              tableEditor.insertRow(options({}));
            }
          }
        },
      });

      return textEditor;
    },

    loadFromLocalStorage(storageId: string) {
      // The Y.Doc, its network provider and IndexedDB persistence are owned by
      // the shared ProjectDoc service so the file explorer can use the very
      // same document. We just acquire it here and bind Monaco to its content.
      const project = getProjectDoc(storageId, this.$props.connection);
      this.projectDoc = project;

      provider = project.provider;
      this.blob = project.blob;

      const self = this;
      project.idb.on("synced", (event: any) => {
        console.log("liascript: content from the database is loaded");
        self.$emit("ready");
      });
      // If persistence already synced before this listener was attached
      // (shared doc reused), make sure the editor still becomes ready.
      if (project.idb.synced) {
        self.$emit("ready");
      }

      if (provider) {
        provider.awareness.setLocalStateField("user", this.user);

        provider.on("status", (status: any) => {
          if (status.state === "connected") {
            self.online = 1;
          } else {
            self.online = 0;
          }
          self.$emit("online", self.online);
        });

        provider.awareness.on("change", (changes: any) => {
          // Whenever somebody updates their awareness information,
          // we log all awareness information from all users.

          const online = Array.from(provider.awareness.getStates().values()).length;

          if (online != self.online) {
            self.$emit("online", online);
            self.online = online;
          }
        });
      }

      // Bind Monaco to the main course document (this also creates the model).
      this.openMain();
    },
  },

  unmounted() {
    // Tear down the active model/binding.
    if (currentBinding) {
      currentBinding.destroy();
      currentBinding = null;
    }
    if (currentModel) {
      try {
        currentModel.dispose();
      } catch (e) {
        /* ignore */
      }
      currentModel = null;
    }
    this.setImage("");
    this.setVideo("");

    // Release our reference to the shared document; it is destroyed once both
    // the editor and the file explorer have released it.
    if (this.projectDoc) {
      releaseProjectDoc(this.projectDoc.storageId);
      this.projectDoc = null;
    }
    provider = undefined;

    // Dispose completion providers
    completionProviders.forEach((disposable) => disposable.dispose());
    completionProviders = []; // Clear the array

    Editor = undefined;
  },

  emits: ["compile", "ready", "online", "goto"],

  mounted() {
    Editor = this.initEditor(this.content || "");

    // The provider lifecycle is managed by the shared ProjectDoc service
    // (reference counted), so we must NOT destroy it here — the file explorer
    // may hold the same document.

    if (this.storageId) {
      this.loadFromLocalStorage(this.storageId);
    } else {
      this.$emit("ready");
    }

    const self = this;

    const eventListener = function (media: string) {
      return function (event) {
        const file = event.target.files[0];

        if (file) {
          const reader = new FileReader();

          reader.onload = async function (e) {
            if (
              e.target?.result === null ||
              e.target?.result === undefined ||
              typeof e.target?.result === "string"
            ) {
              console.warn("could not load file: ", file);
              return;
            }

            const blob = new Uint8Array(e.target?.result);

            console.warn("liascript: upload", e.target);

            if (blob) {
              // Keep the original file name (visible in the file explorer)
              // instead of a hash-based one.
              const path = self.storeUpload(file.name, blob, file.type);
              self.make("upload-" + media, path);
            } else {
              console.warn("could not load file: ", file);
            }
          };

          reader.readAsArrayBuffer(file);
        }
      };
    };

    for (let media of ["image", "audio", "movie"]) {
      this.upload[media] = document.getElementById(media + "Input");

      if (this.upload[media])
        this.upload[media].addEventListener("change", eventListener(media), false);
    }
  },
};
</script>

<template>
  <div
    v-if="isTextActive"
    class="lia-toolbar"
    role="toolbar"
    :aria-label="$t('toolbar.ariaLabel')"
  >
    <!-- Tab bar -->
    <div class="lia-tab-bar">
      <button v-if="isMarkdownActive" class="lia-tab" :class="{ active: activeTab === 'start' }"     @click="activeTab = 'start'">{{ $t('toolbar.tabs.start') }}</button>
      <button v-if="isMarkdownActive" class="lia-tab" :class="{ active: activeTab === 'tabellen' }"  @click="activeTab = 'tabellen'">{{ $t('toolbar.tabs.tables') }}</button>
      <button v-if="isMarkdownActive" class="lia-tab" :class="{ active: activeTab === 'einfuegen' }" @click="activeTab = 'einfuegen'">{{ $t('toolbar.tabs.insert') }}</button>
      <button v-if="isMarkdownActive" class="lia-tab" :class="{ active: activeTab === 'liascript' }" @click="activeTab = 'liascript'">{{ $t('toolbar.tabs.liascript') }}</button>
      <button v-if="isMarkdownActive" class="lia-tab" :class="{ active: activeTab === 'code' }"      @click="activeTab = 'code'">{{ $t('toolbar.tabs.code') }}</button>
      <button v-if="isMarkdownActive" class="lia-tab" :class="{ active: activeTab === 'aufnahme' }"  @click="activeTab = 'aufnahme'">{{ $t('toolbar.tabs.recording') }}</button>
      <button v-if="isMarkdownActive" class="lia-tab" :class="{ active: activeTab === 'tutorial' }"  @click="activeTab = 'tutorial'">{{ $t('toolbar.tabs.tutorial') }}</button>
      <button class="lia-tab" :class="{ active: activeTab === 'editor' }"    @click="activeTab = 'editor'">{{ $t('toolbar.tabs.editor') }}</button>
    </div>

    <!-- Tab content -->
    <div class="lia-tab-content">

      <!-- ── Start ─────────────────────────────────────────── -->
      <template v-if="activeTab === 'start'">
        <div class="toolbar-section">
          <div class="toolbar-buttons">
            <button class="btn-fmt" type="button" :title="$t('toolbar.buttons.bold')"          @click="make('bold')"><i class="bi bi-type-bold"></i></button>
            <button class="btn-fmt" type="button" :title="$t('toolbar.buttons.italic')"        @click="make('italic')"><i class="bi bi-type-italic"></i></button>
            <button class="btn-fmt" type="button" :title="$t('toolbar.buttons.heading')"       @click="make('header')"><i class="bi bi-type-h1"></i></button>
            <button class="btn-fmt" type="button" :title="$t('toolbar.buttons.strikethrough')" @click="make('strikethrough')"><i class="bi bi-type-strikethrough"></i></button>
            <button class="btn-fmt" type="button" :title="$t('toolbar.buttons.underline')"     @click="make('underline')"><i class="bi bi-type-underline"></i></button>
            <button class="btn-fmt" type="button" :title="$t('toolbar.buttons.superscript')"   @click="make('superscript')"><i class="bi bi-superscript"></i></button>
            <button class="btn-fmt" type="button" :title="$t('toolbar.buttons.inlineCode')"    @click="make('code-inline')"><i class="bi bi-code"></i></button>
            <button class="btn-fmt" type="button" :title="$t('toolbar.buttons.keyboard')"      @click="make('keyboard')"><i class="bi bi-keyboard"></i></button>
          </div>
          <div class="toolbar-label">{{ $t('toolbar.sections.font') }}</div>
        </div>
        <div class="toolbar-section">
          <div class="toolbar-buttons">
            <button class="btn-fmt" type="button" :title="$t('toolbar.buttons.quote')"          @click="make('quote')"><i class="bi bi-quote"></i></button>
            <button class="btn-fmt" type="button" :title="$t('toolbar.buttons.list')"           @click="make('list-unordered')"><i class="bi bi-list-ul"></i></button>
            <button class="btn-fmt" type="button" :title="$t('toolbar.buttons.numberedList')"   @click="make('list-ordered')"><i class="bi bi-list-ol"></i></button>
            <button class="btn-fmt" type="button" :title="$t('toolbar.buttons.checkList')"      @click="make('list-check')"><i class="bi bi-check-square"></i></button>
            <button class="btn-fmt" type="button" :title="$t('toolbar.buttons.horizontalLine')" @click="make('line')"><i class="bi bi-hr"></i></button>
          </div>
          <div class="toolbar-label">{{ $t('toolbar.sections.paragraph') }}</div>
        </div>
        <div class="toolbar-section">
          <div class="toolbar-buttons">
            <button class="btn-fmt" type="button" :title="$t('toolbar.buttons.note')"      @click="make('gfm-note')"><i class="bi bi-info-circle"></i></button>
            <button class="btn-fmt" type="button" :title="$t('toolbar.buttons.tip')"       @click="make('gfm-tip')"><i class="bi bi-lightbulb"></i></button>
            <button class="btn-fmt" type="button" :title="$t('toolbar.buttons.important')" @click="make('gfm-important')"><i class="bi bi-exclamation-circle"></i></button>
            <button class="btn-fmt" type="button" :title="$t('toolbar.buttons.warning')"   @click="make('gfm-warning')"><i class="bi bi-exclamation-triangle"></i></button>
            <button class="btn-fmt" type="button" :title="$t('toolbar.buttons.caution')"   @click="make('gfm-caution')"><i class="bi bi-shield-exclamation"></i></button>
          </div>
          <div class="toolbar-label">{{ $t('toolbar.sections.gfmAlerts') }}</div>
        </div>
      </template>

      <!-- ── Tables ───────────────────────────────────────── -->
      <template v-else-if="activeTab === 'tabellen'">
        <div class="toolbar-section">
          <div class="toolbar-buttons">
            <button class="btn-fmt" type="button" :title="$t('toolbar.buttons.insertTable')" @click="make('table')">
              <i class="bi bi-table"></i>
            </button>
          </div>
          <div class="toolbar-label">{{ $t('toolbar.sections.insert') }}</div>
        </div>
        <div class="toolbar-section">
          <div class="toolbar-buttons">
            <button class="btn-fmt" type="button" :title="$t('toolbar.buttons.formatTable')" @click="tableAction('format')">
              <i class="bi bi-layout-text-sidebar-reverse"></i>
            </button>
            <button class="btn-fmt" type="button" :title="$t('toolbar.buttons.insertRow')" @click="tableAction('row')">
              <i class="bi bi-table"></i>
              <i class="bi bi-plus-lg icon-overlay"></i>
            </button>
          </div>
          <div class="toolbar-label">{{ $t('toolbar.sections.edit') }}</div>
        </div>
        <div class="toolbar-section">
          <div class="toolbar-buttons">
            <button class="btn-fmt" type="button" :title="$t('toolbar.buttons.previousCell')" @click="tableAction('previous')">
              <i class="bi bi-arrow-left-square"></i>
            </button>
            <button class="btn-fmt" type="button" :title="$t('toolbar.buttons.nextCell')" @click="tableAction('next')">
              <i class="bi bi-arrow-right-square"></i>
            </button>
          </div>
          <div class="toolbar-label">{{ $t('toolbar.sections.navigation') }}</div>
        </div>
      </template>

      <!-- ── Insert ───────────────────────────────────────── -->
      <template v-else-if="activeTab === 'einfuegen'">
        <div class="toolbar-section">
          <div class="toolbar-buttons">
            <button class="btn-fmt" type="button" :title="$t('toolbar.buttons.link')"      @click="make('link')"><i class="bi bi-link-45deg"></i></button>
            <button class="btn-fmt" type="button" :title="$t('toolbar.buttons.image')"     @click="make('image')"><i class="bi bi-image"></i></button>
            <button class="btn-fmt" type="button" :title="$t('toolbar.buttons.audio')"     @click="make('audio')"><i class="bi bi-music-note-beamed"></i></button>
            <button class="btn-fmt" type="button" :title="$t('toolbar.buttons.movie')"     @click="make('movie')"><i class="bi bi-film"></i></button>
            <button class="btn-fmt" type="button" :title="$t('toolbar.buttons.embedLink')" @click="make('oembed')"><i class="bi bi-puzzle"></i></button>
          </div>
          <div class="toolbar-label">{{ $t('toolbar.sections.link') }}</div>
        </div>
        <input type="file" id="imageInput" style="display: none" accept="image/*" />
        <input type="file" id="audioInput" style="display: none" accept="audio/*" />
        <input type="file" id="movieInput" style="display: none" accept="video/*" />
        <div class="toolbar-section">
          <div class="toolbar-buttons">
            <button class="btn-fmt" type="button" :title="$t('toolbar.buttons.uploadImage')" @click="make('upload-image')">
              <i class="bi bi-upload"></i><i class="bi bi-image icon-overlay"></i>
            </button>
            <button class="btn-fmt" type="button" :title="$t('toolbar.buttons.uploadAudio')" @click="make('upload-audio')">
              <i class="bi bi-upload"></i><i class="bi bi-music-note-beamed icon-overlay"></i>
            </button>
            <button class="btn-fmt" type="button" :title="$t('toolbar.buttons.uploadMovie')" @click="make('upload-movie')">
              <i class="bi bi-upload"></i><i class="bi bi-film icon-overlay"></i>
            </button>
          </div>
          <div class="toolbar-label">{{ $t('toolbar.sections.upload') }}</div>
        </div>
      </template>

      <!-- ── LiaScript ─────────────────────────────────────── -->
      <template v-else-if="activeTab === 'liascript'">
        <div class="toolbar-section">
          <div class="toolbar-buttons">
            <button class="btn-fmt" type="button" :title="$t('toolbar.buttons.animation')" @click="make('animation')">
              <i class="bi bi-lightning-fill"></i><i class="bi bi-easel icon-overlay"></i>
            </button>
            <button class="btn-fmt" type="button" :title="$t('toolbar.buttons.comment')" @click="make('comment')">
              <i class="bi bi-chat-text"></i><i class="bi bi-easel icon-overlay"></i>
            </button>
            <button class="btn-fmt" type="button" :title="$t('toolbar.buttons.tts')" @click="make('tts')">
              <i class="bi bi-play-circle"></i><i class="bi bi-easel icon-overlay"></i>
            </button>
          </div>
          <div class="toolbar-label">{{ $t('toolbar.sections.effects') }}</div>
        </div>
        <div class="toolbar-section">
          <div class="toolbar-buttons">
            <button class="btn-fmt" type="button" :title="$t('toolbar.buttons.singleChoice')"   @click="make('quiz-single-choice')">
              <i class="bi bi-x-circle"></i><i class="bi bi-question-lg icon-overlay"></i>
            </button>
            <button class="btn-fmt" type="button" :title="$t('toolbar.buttons.multipleChoice')" @click="make('quiz-multiple-choice')">
              <i class="bi bi-x-square"></i><i class="bi bi-question-lg icon-overlay"></i>
            </button>
            <button class="btn-fmt" type="button" :title="$t('toolbar.buttons.textInput')"      @click="make('quiz-input')">
              <i class="bi bi-input-cursor-text"></i><i class="bi bi-question-lg icon-overlay"></i>
            </button>
            <button class="btn-fmt" type="button" :title="$t('toolbar.buttons.selection')"      @click="make('quiz-selection')">
              <i class="bi bi-option"></i><i class="bi bi-question-lg icon-overlay"></i>
            </button>
            <button class="btn-fmt" type="button" :title="$t('toolbar.buttons.matrix')"         @click="make('quiz-matrix')">
              <i class="bi bi-grid-3x3-gap"></i><i class="bi bi-question-lg icon-overlay"></i>
            </button>
            <button class="btn-fmt" type="button" :title="$t('toolbar.buttons.gapText')"        @click="make('quiz-gap-text')">
              <i class="bi bi-body-text"></i><i class="bi bi-question-lg icon-overlay"></i>
            </button>
          </div>
          <div class="toolbar-label">{{ $t('toolbar.sections.quiz') }}</div>
        </div>
        <div class="toolbar-section">
          <div class="toolbar-buttons">
            <button class="btn-fmt" type="button" :title="$t('toolbar.buttons.inlineFormula')" @click="make('formula-inline')">
              <i class="bi bi-currency-dollar"></i>
            </button>
            <button class="btn-fmt" type="button" :title="$t('toolbar.buttons.formulaBlock')"  @click="make('formula')">
              <i class="bi bi-currency-dollar"></i><i class="bi bi-currency-dollar icon-overlay"></i>
            </button>
          </div>
          <div class="toolbar-label">{{ $t('toolbar.sections.formula') }}</div>
        </div>
      </template>

      <!-- ── Code ──────────────────────────────────────────── -->
      <template v-else-if="activeTab === 'code'">
        <div class="toolbar-section">
          <div class="toolbar-buttons">
            <button class="btn-fmt" type="button" :title="$t('toolbar.buttons.codeBlock')"      @click="make('code')"><i class="bi bi-code-slash"></i></button>
            <button class="btn-fmt" type="button" :title="$t('toolbar.buttons.executableCode')" @click="make('code-executable')"><i class="bi bi-terminal"></i></button>
            <button class="btn-fmt" type="button" :title="$t('toolbar.buttons.codeProject')"    @click="make('code-project')"><i class="bi bi-terminal-split"></i></button>
          </div>
          <div class="toolbar-label">{{ $t('toolbar.sections.code') }}</div>
        </div>
        <div class="toolbar-section">
          <div class="toolbar-buttons">
            <button class="btn-fmt" type="button" :title="$t('toolbar.buttons.graph')"    @click="make('graph')"><i class="bi bi-graph-down"></i></button>
            <button class="btn-fmt" type="button" :title="$t('toolbar.buttons.asciiArt')" @click="make('ascii')"><i class="bi bi-boxes"></i></button>
          </div>
          <div class="toolbar-label">{{ $t('toolbar.sections.ascii') }}</div>
        </div>
        <div class="toolbar-section">
          <div class="toolbar-buttons">
            <button class="btn-fmt" type="button" :title="$t('toolbar.buttons.evaluateExpr')" @click="make('mathjs-evaluate')">
              <i class="bi bi-gear"></i>
            </button>
            <button class="btn-fmt" type="button" :title="$t('toolbar.buttons.simplifyExpr')" @click="make('mathjs-simplify')">
              <i class="bi bi-gear"></i><i class="bi bi-lightning-charge icon-overlay"></i>
            </button>
            <button class="btn-fmt" type="button" :title="$t('toolbar.buttons.convertTex')"   @click="make('mathjs-tex')">
              <i class="bi bi-gear"></i><i class="bi icon-overlay">TeX</i>
            </button>
          </div>
          <div class="toolbar-label">{{ $t('toolbar.sections.mathjs') }}</div>
        </div>
      </template>

      <!-- ── Recording ─────────────────────────────────────── -->
      <template v-else-if="activeTab === 'aufnahme'">
        <div class="toolbar-section">
          <div class="toolbar-buttons">
            <button class="btn-fmt" type="button" :title="$t('toolbar.buttons.audioRecording')"  @click="recorder.audio = true"><i class="bi bi-mic"></i></button>
            <button class="btn-fmt" type="button" :title="$t('toolbar.buttons.webcamRecording')" @click="recorder.webcam = true"><i class="bi bi-webcam"></i></button>
            <button class="btn-fmt" type="button" :title="$t('toolbar.buttons.screenRecording')" @click="recorder.desktop = true"><i class="bi bi-camera-reels"></i></button>
          </div>
          <div class="toolbar-label">{{ $t('toolbar.sections.recording') }}</div>
        </div>
      </template>

      <!-- ── Tutorial ──────────────────────────────────────── -->
      <template v-else-if="activeTab === 'tutorial'">
        <div class="toolbar-section">
          <div class="toolbar-buttons">
            <button class="btn-fmt" type="button" :title="$t('toolbar.buttons.initDocument')" @click="make('init')">
              <i class="bi bi-rocket-takeoff"></i>
            </button>
          </div>
          <div class="toolbar-label">{{ $t('toolbar.sections.new') }}</div>
        </div>
      </template>

      <!-- ── Editor Settings ────────────────────────────────── -->
      <template v-else-if="activeTab === 'editor'">
        <EditorSettingsTab :config="editorConfig" :lights="lights" @update:config="applyEditorConfig" @toggle-lights="switchLights" />
      </template>

    </div>
  </div>

  <div
    style="
      z-index: 100;
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
    "
    v-if="recorder.audio"
  >
    <div>
      <button
        type="button"
        class="btn-close"
        aria-label="Close"
        style="position: absolute; z-index: 101; right: 12px; top: 10px"
        @click="recorder.audio = false"
      ></button>
      <audio-recorder :attempts="3" :time="2" :customUploader="storeAudioFile" />
    </div>
  </div>

  <div
    style="
      z-index: 100;
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
    "
    v-if="recorder.webcam"
  >
    <div>
      <button
        type="button"
        class="btn-close"
        aria-label="Close"
        style="position: absolute; z-index: 101; right: 12px; top: 10px"
        @click="recorder.webcam = false"
      ></button>
      <Recorder :storeBlob="storeVideoFile" stream="webcam" />
    </div>
  </div>

  <div
    style="
      z-index: 100;
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
    "
    v-if="recorder.desktop"
  >
    <div>
      <button
        type="button"
        class="btn-close"
        aria-label="Close"
        style="position: absolute; z-index: 101; right: 12px; top: 10px"
        @click="recorder.desktop = false"
      ></button>
      <Recorder :storeBlob="storeVideoFile" stream="desktop" />
    </div>
  </div>

  <!-- Bar showing the currently active non-main file -->
  <div v-if="activePath" class="lia-active-bar">
    <i class="bi bi-file-earmark-text"></i>
    <span class="lia-active-name" :title="activePath">{{ activePath }}</span>
    <button
      type="button"
      class="btn btn-sm btn-outline-secondary lia-active-close"
      :title="$t('toolbar.buttons.backToCourse')"
      @click="openMain()"
    >
      <i class="bi bi-x-lg"></i>
    </button>
  </div>

  <div id="liascript-editor" v-show="activeView === 'text'"></div>

  <div v-show="activeView === 'image'" class="lia-file-view lia-image-view">
    <img :src="imageUrl" :alt="activePath" />
  </div>

  <div v-show="activeView === 'video'" class="lia-file-view lia-video-view">
    <video v-if="videoUrl" :src="videoUrl" controls></video>
  </div>

  <div v-show="activeView === 'binary'" class="lia-file-view lia-binary-view">
    <p>
      <i class="bi bi-file-earmark-binary"></i><br />
      {{ $t('toolbar.noPreview') }}
    </p>
  </div>
</template>

<style>
#liascript-editor {
  height: 100vh;
}

.lia-active-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 8px;
  background-color: #ececec;
  border-bottom: solid lightgray 1px;
  font-size: 13px;
}

.lia-active-name {
  flex: 1 1 auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lia-active-close {
  flex: 0 0 auto;
  padding: 0 6px;
  line-height: 1.4;
}

.lia-file-view {
  height: 100vh;
  overflow: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #2d2d2d;
}

.lia-image-view img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.lia-video-view video {
  max-width: 100%;
  max-height: 100%;
}

.lia-binary-view {
  background-color: #f6f6f6;
  color: #777;
  text-align: center;
}

.lia-binary-view .bi {
  font-size: 2rem;
}

.lia-toolbar {
  display: flex;
  flex-direction: column;
  background: #f3f3f3;
  border-top: 1px solid #c8c8c8;
  border-bottom: 1px solid #c8c8c8;
  user-select: none;
}

.lia-tab-bar {
  display: flex;
  flex-wrap: nowrap;
  overflow-x: auto;
  background: #e8e8e8;
  border-bottom: 1px solid #c8c8c8;
  padding: 0 4px;
  scrollbar-width: thin;
  scrollbar-color: #bbb #e8e8e8;
}

.lia-tab-bar::-webkit-scrollbar {
  height: 3px;
}

.lia-tab-bar::-webkit-scrollbar-thumb {
  background: #bbb;
  border-radius: 2px;
}

.lia-tab-bar::-webkit-scrollbar-track {
  background: #e8e8e8;
}

.lia-tab {
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  padding: 5px 13px 4px 13px;
  font-size: 0.75rem;
  color: #555;
  cursor: pointer;
  white-space: nowrap;
  letter-spacing: 0.02em;
  transition: color 0.1s, border-color 0.1s, background 0.1s;
  flex-shrink: 0;
}

.lia-tab:hover {
  color: #1a1a1a;
  background: #ddd;
}

.lia-tab.active {
  color: #1a6db5;
  border-bottom-color: #1a6db5;
  font-weight: 600;
  background: #f3f3f3;
}

.lia-tab-content {
  display: flex;
  flex-wrap: nowrap;
  overflow-x: auto;
  align-items: stretch;
  padding: 3px 2px 0 2px;
  scrollbar-width: thin;
  scrollbar-color: #bbb #f3f3f3;
}

.lia-tab-content::-webkit-scrollbar {
  height: 3px;
}

.lia-tab-content::-webkit-scrollbar-thumb {
  background: #bbb;
  border-radius: 2px;
}

.lia-tab-content::-webkit-scrollbar-track {
  background: #f3f3f3;
}

.toolbar-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2px 5px 0 5px;
  border-right: 1px solid #d8d8d8;
  flex-shrink: 0;
}

.toolbar-section:last-child {
  border-right: none;
}

.toolbar-buttons {
  display: flex;
  flex-wrap: nowrap;
  gap: 1px;
  justify-content: center;
  align-items: center;
  flex: 1;
}

.toolbar-label {
  font-size: 0.58rem;
  color: #aaa;
  text-align: center;
  padding: 3px 0 3px 0;
  white-space: nowrap;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  width: 100%;
}

.btn-fmt {
  background: none;
  border: none;
  border-radius: 3px;
  padding: 5px 7px;
  color: #333;
  cursor: pointer;
  font-size: 1rem;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  position: relative;
  min-width: 30px;
  min-height: 28px;
  transition: background 0.1s;
}

.btn-fmt:hover {
  background: #dce6f0;
  color: #1a1a1a;
}

.btn-fmt:active {
  background: #b8cfea;
}

.ar-icon {
  line-height: 2px !important;
}

.ar-recorder__records-limit {
  top: 66px !important;
}

@media (max-width: 896px) {
  .btn-fmt {
    padding: 4px 5px;
    min-width: 26px;
    min-height: 24px;
    font-size: 0.9rem;
  }

  .toolbar-section {
    padding: 2px 3px 0 3px;
  }

  .lia-tab {
    padding: 4px 9px 3px 9px;
    font-size: 0.7rem;
  }
}

.icon-overlay {
  top: -8px;
  scale: 0.5;
  left: -3px;
  position: relative;
  display: inline-block;
  width: 0px;
}

.yRemoteSelection {
  background-color: rgb(250, 129, 0, 0.5);
}
.yRemoteSelectionHead {
  position: absolute;
  border-left: orange solid 2px;
  border-top: orange solid 2px;
  border-bottom: orange solid 2px;
  height: 100%;
  box-sizing: border-box;
}
.yRemoteSelectionHead::after {
  position: absolute;
  content: " ";
  border: 3px solid orange;
  border-radius: 4px;
  left: -4px;
  top: -5px;
}
</style>
