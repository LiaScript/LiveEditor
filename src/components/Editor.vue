<script lang="ts">
import * as Y from "yjs";

import { IndexeddbPersistence } from "y-indexeddb";
import { WebrtcProvider } from "y-webrtc";
import { WebsocketProvider } from "y-websocket";
import { MonacoBinding } from "y-monaco";
import { editor, KeyMod, KeyCode, languages } from "monaco-editor";
import * as Utils from "../ts/utils";
import { navigateTo } from "../index";

// import * as MATHJS from "mathjs";
import { TableEditor, options, Point, Range } from "@susisu/mte-kernel";
import TextEditorInterface from "../ts/TextEditorInterface";

import Recorder from "./Recorder.vue";

var Emojis = [];
import("../ts/Emojis.ts").then((module) => {
  for (const [label, emoji] of module.Emojis) {
    Emojis.push({
      label: label + " " + emoji,
      insertText: emoji,
      range: null,
    });
  }
});

var Snippets = [];
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

var Editor;
var tableEditor;
var provider;
var isCtrlPressed = false;
var MATHJS;

import("mathjs").then((module) => {
  MATHJS = module;
});

async function fileHash(arrayBuffer) {
  // Use the subtle crypto API to perform a SHA256 Sum of the file's
  // Array Buffer. The resulting hash is stored in an array buffer
  const hashAsArrayBuffer = await crypto.subtle.digest("SHA-1", arrayBuffer);

  // To display it as a string we will get the hexadecimal value of
  // each byte of the array buffer. This gets us an array where each byte
  // of the array buffer becomes one item in the array
  const uint8ViewOfHash = new Uint8Array(hashAsArrayBuffer);

  // We then convert it to a regular array so we can convert each item
  // to hexadecimal strings, where characters of 0-9 or a-f represent
  // a number between 0 and 15, containing 4 bits of information,
  // so 2 of them is 8 bits (1 byte).
  const hashAsString = Array.from(uint8ViewOfHash)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return hashAsString;
}

function blobToUint8Array(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    // Define the onload event handler
    reader.onload = function (event) {
      const arrayBuffer = event.target.result;
      const uint8Array = new Uint8Array(arrayBuffer);
      resolve(uint8Array);
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
  components: { Recorder },
  props: ["storageId", "content", "lights", "connection", "toolbar"],

  data() {
    const config = Utils.loadConfig();

    let toolbar = true;

    if (this.$props.toolbar !== undefined) {
      toolbar = this.$props.toolbar;
    }

    return {
      lights: config.lights,
      user: config.user,
      toolbar: toolbar,
      recorder: { audio: false, webcam: false, desktop: false },

      online: null,
      upload: {
        image: null,
        audio: null,
        movie: null,
      },
      blob: null,
    };
  },

  methods: {
    storeAudioFile(blob) {
      if (record.blob) {
        const self = this;
        blobToUint8Array(record.blob)
          .then((uint8Array) => {
            const date = new Date();
            const filename = "recording-" + date.toISOString() + ".mp3";

            self.blob.set(filename, uint8Array);
            self.make("upload-audio", filename);
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

            self.blob.set(filename, uint8Array);
            self.make("upload-movie", filename);
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
            if (el.label === "lia-init") {
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
      if (!this.blob) return;

      if (hash.startsWith("/")) {
        hash = hash.slice(1);
      }

      return this.blob.get(hash);
    },

    getAllBlobs() {
      if (!this.blob) return;

      const blobs: any[] = [];

      this.blob.forEach((data, name) => {
        blobs.push({ name, data });
      });

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

      const Editor = editor.create(div, {
        value: code,
        language: "markdown",
        theme: this.lights ? "vs-light" : "vs-dark",
        automaticLayout: true,
        wordWrap: "on",
        renderWhitespace: "boundary",
      });

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

      languages.registerCompletionItemProvider("markdown", {
        //triggerCharacters: ['['],
        provideCompletionItems: function (model, position, context) {
          const word = model.getWordAtPosition(position);

          if (
            word.word.startsWith("lia") ||
            word.word.startsWith("voice") ||
            word.word.startsWith("hili")
          ) {
            const textUntilPosition = model.getValueInRange({
              startLineNumber: position.lineNumber,
              startColumn: 1,
              endLineNumber: position.lineNumber,
              endColumn: position.column,
            });

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
            };
          }

          return {
            suggestions: [],
          };
        },
      });

      languages.registerCompletionItemProvider("markdown", {
        triggerCharacters: [":"],
        provideCompletionItems: function (model, position, context) {
          const word = model.getWordAtPosition(position);

          const textUntilPosition = model.getValueInRange({
            startLineNumber: position.lineNumber - 1,
            startColumn: 1,
            endLineNumber: position.lineNumber,
            endColumn: position.column,
          });

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
            };
          }

          return {
            suggestions: [],
          };
        },
      });

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

    loadFromLocalStorage(editor: any, storageId: string) {
      const yDoc = new Y.Doc();

      switch (this.$props.connection) {
        case "webrtc": {
          provider = new WebrtcProvider(storageId, yDoc, {
            signaling: process.env.SIGNALING_SERVER.split(" ") || [
              "wss://rooms.deno.dev",
            ],
            peerOpts: {
              config: {
                iceServers: JSON.parse(process.env.ICE_SERVERS || "[]"),
              },
            },
          });
          break;
        }
        case "websocket": {
          provider = new WebsocketProvider(
            process.env.WEBSOCKET_SERVER || "wss://aamkeaam.com/" + storageId,
            storageId,
            yDoc
          );
          break;
        }
        default: {
          provider = null;
        }
      }

      const indexeddbProvider = new IndexeddbPersistence(storageId, yDoc);

      const self = this;
      indexeddbProvider.on("synced", (event: any) => {
        console.log("liascript: content from the database is loaded");
        self.$emit("ready");
      });

      if (provider) {
        provider.awareness.setLocalStateField("user", this.user);

        provider.on("status", (event: any) => {
          if (event.status === "connected") {
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
      const content = yDoc.getText(storageId);
      this.blob = yDoc.getMap("blob");

      const monacoBinding = new MonacoBinding(
        content,
        editor.getModel(),
        new Set([editor]),
        provider ? provider.awareness : null
      );
    },
  },

  unmounted() {
    if (provider) provider.destroy();

    Editor = undefined;
  },

  emits: ["compile", "ready", "online", "goto"],

  mounted() {
    Editor = this.initEditor(this.content || "");

    if (provider) {
      provider.destroy();
    }

    if (this.storageId) {
      this.loadFromLocalStorage(Editor, this.storageId);
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
            const blob = new Uint8Array(e.target?.result);
            const hash = await fileHash(e.target?.result);

            let fileEnding = file.name.split(".").pop();

            if (fileEnding) {
              fileEnding = "." + fileEnding.toLowerCase();
            } else {
              fileEnding = "";
            }

            console.warn("liascript: upload", e.target);

            if (blob) {
              self.blob.set(hash + fileEnding, blob);
              self.make("upload-" + media, hash + fileEnding);
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
  <nav
    v-if="toolbar"
    class="navbar navbar-light bg-light"
    style="
      border-top: solid lightgray 2px;
      border-bottom: solid lightgray 2px;
      padding: 0px;
    "
  >
    <div class="btn-toolbar" role="toolbar" aria-label="Toolbar with button groups">
      <div class="btn-group" role="group" aria-label="Text formatting">
        <button
          class="btn btn-sm btn-outline-secondary"
          type="button"
          title="Bold"
          @click="make('bold')"
        >
          <i class="bi bi-type-bold"></i>
        </button>

        <button
          class="btn btn-sm btn-outline-secondary"
          type="button"
          title="Italic"
          @click="make('italic')"
        >
          <i class="bi bi-type-italic"></i>
        </button>

        <button
          class="btn btn-sm btn-outline-secondary"
          type="button"
          title="Heading"
          @click="make('header')"
        >
          <i class="bi bi-type-h1"></i>
        </button>

        <button
          class="btn btn-sm btn-outline-secondary"
          type="button"
          title="Strikethrough"
          @click="make('strikethrough')"
        >
          <i class="bi bi-type-strikethrough"></i>
        </button>

        <button
          class="btn btn-sm btn-outline-secondary"
          type="button"
          title="Underline"
          @click="make('underline')"
        >
          <i class="bi bi-type-underline"></i>
        </button>

        <button
          class="btn btn-sm btn-outline-secondary"
          type="button"
          title="Superscript"
          @click="make('superscript')"
        >
          <i class="bi bi-superscript"></i>
        </button>

        <button
          class="btn btn-sm btn-outline-secondary"
          type="button"
          title="Inline Code"
          @click="make('code-inline')"
        >
          <i class="bi bi-code"></i>
        </button>

        <button
          class="btn btn-sm btn-outline-secondary"
          type="button"
          title="Keyboard"
          @click="make('keyboard')"
        >
          <i class="bi bi-keyboard"></i>
        </button>
      </div>

      <div class="btn-group" role="group" aria-label="Code Blocks">
        <button
          class="btn btn-sm btn-outline-secondary"
          type="button"
          title="Code Block"
          @click="make('code')"
        >
          <i class="bi bi-code-slash"></i>
        </button>

        <button
          class="btn btn-sm btn-outline-secondary"
          type="button"
          title="Executable Code"
          @click="make('code-executable')"
        >
          <i class="bi bi-terminal"></i>
        </button>

        <button
          class="btn btn-sm btn-outline-secondary"
          type="button"
          title="Executable Code Project"
          @click="make('code-project')"
        >
          <i class="bi bi-terminal-split"></i>
        </button>
      </div>

      <div class="btn-group" role="group" aria-label="Block types">
        <button
          class="btn btn-sm btn-outline-secondary"
          type="button"
          title="Quote"
          @click="make('quote')"
        >
          <i class="bi bi-quote"></i>
        </button>

        <button
          class="btn btn-sm btn-outline-secondary"
          type="button"
          title="List"
          @click="make('list-unordered')"
        >
          <i class="bi bi-list-ul"></i>
        </button>

        <button
          class="btn btn-sm btn-outline-secondary"
          type="button"
          title="Numbered List"
          @click="make('list-ordered')"
        >
          <i class="bi bi-list-ol"></i>
        </button>

        <button
          class="btn btn-sm btn-outline-secondary"
          type="button"
          title="Check List"
          @click="make('list-check')"
        >
          <i class="bi bi-check-square"></i>
        </button>

        <button
          class="btn btn-sm btn-outline-secondary"
          type="button"
          title="Table"
          @click="make('table')"
        >
          <i class="bi bi-table"></i>
        </button>

        <button
          class="btn btn-sm btn-outline-secondary"
          type="button"
          title="Horizontal Line"
          @click="make('line')"
        >
          <i class="bi bi-hr"></i>
        </button>
      </div>

      <div class="btn-group" role="group" aria-label="Embed or Link to Multimedia">
        <button
          class="btn btn-sm btn-outline-secondary"
          type="button"
          title="Link"
          @click="make('link')"
        >
          <i class="bi bi-link-45deg"></i>
        </button>

        <button
          class="btn btn-sm btn-outline-secondary"
          type="button"
          title="Image"
          @click="make('image')"
        >
          <i class="bi bi-image"></i>
        </button>

        <button
          class="btn btn-sm btn-outline-secondary"
          type="button"
          title="Audio"
          @click="make('audio')"
        >
          <i class="bi bi-music-note-beamed"></i>
        </button>

        <button
          class="btn btn-sm btn-outline-secondary"
          type="button"
          title="Movie"
          @click="make('movie')"
        >
          <i class="bi bi-film"></i>
        </button>

        <button
          class="btn btn-sm btn-outline-secondary"
          type="button"
          title="Try to embed any kind of link"
          @click="make('oembed')"
        >
          <i class="bi bi-puzzle"></i>
        </button>
      </div>

      <input type="file" id="imageInput" style="display: none" accept="image/*" />
      <input type="file" id="audioInput" style="display: none" accept="audio/*" />
      <input type="file" id="movieInput" style="display: none" accept="video/*" />
      <div class="btn-group" role="group" aria-label="Upload Multiline">
        <button
          class="btn btn-sm btn-outline-secondary"
          type="button"
          title="Upload Image"
          @click="make('upload-image')"
        >
          <i class="bi bi-upload"></i>
          <i class="bi bi-image icon-overlay"></i>
        </button>

        <button
          class="btn btn-sm btn-outline-secondary"
          type="button"
          title="Upload Audio"
          @click="make('upload-audio')"
        >
          <i class="bi bi-upload"></i>
          <i class="bi bi-music-note-beamed icon-overlay"></i>
        </button>

        <button
          class="btn btn-sm btn-outline-secondary"
          type="button"
          title="Upload Movie"
          @click="make('upload-movie')"
        >
          <i class="bi bi-upload"></i>
          <i class="bi bi-film icon-overlay"></i>
        </button>
      </div>

      <div class="btn-group" role="group" aria-label="LiaScript Effects">
        <button
          class="btn btn-sm btn-outline-secondary"
          type="button"
          title="Animation"
          @click="make('animation')"
        >
          <i class="bi bi-lightning-fill"></i>
          <i class="bi bi-easel icon-overlay"></i>
        </button>

        <button
          class="btn btn-sm btn-outline-secondary"
          type="button"
          title="Comment"
          @click="make('comment')"
        >
          <i class="bi bi-chat-text"></i>
          <i class="bi bi-easel icon-overlay"></i>
        </button>

        <button
          class="btn btn-sm btn-outline-secondary"
          type="button"
          title="Speak out loud"
          @click="make('tts')"
        >
          <i class="bi bi-play-circle"></i>
          <i class="bi bi-easel icon-overlay"></i>
        </button>
      </div>

      <div class="btn-group" role="group" aria-label="Quizzes">
        <button
          class="btn btn-sm btn-outline-secondary"
          type="button"
          title="Single Choice Quiz"
          @click="make('quiz-single-choice')"
        >
          <i class="bi bi-x-circle"></i>
          <i class="bi bi-question-lg icon-overlay"></i>
        </button>

        <button
          class="btn btn-sm btn-outline-secondary"
          type="button"
          title="Multiple Choice Quiz"
          @click="make('quiz-multiple-choice')"
        >
          <i class="bi bi-x-square"></i>
          <i class="bi bi-question-lg icon-overlay"></i>
        </button>

        <button
          class="btn btn-sm btn-outline-secondary"
          type="button"
          title="Text Input Quiz"
          @click="make('quiz-input')"
        >
          <i class="bi bi-input-cursor-text"></i>
          <i class="bi bi-question-lg icon-overlay"></i>
        </button>

        <button
          class="btn btn-sm btn-outline-secondary"
          type="button"
          title="Selection Quiz"
          @click="make('quiz-selection')"
        >
          <i class="bi bi-option"></i>
          <i class="bi bi-question-lg icon-overlay"></i>
        </button>

        <button
          class="btn btn-sm btn-outline-secondary"
          type="button"
          title="Matrix Quiz"
          @click="make('quiz-matrix')"
        >
          <i class="bi bi-grid-3x3-gap"></i>
          <i class="bi bi-question-lg icon-overlay"></i>
        </button>

        <button
          class="btn btn-sm btn-outline-secondary"
          type="button"
          title="Gap Text"
          @click="make('quiz-gap-text')"
        >
          <i class="bi bi-body-text"></i>
          <i class="bi bi-question-lg icon-overlay"></i>
        </button>
      </div>

      <div class="btn-group" role="group" aria-label="Formulas with KaTeX">
        <button
          class="btn btn-sm btn-outline-secondary"
          type="button"
          title="Inline Formula"
          @click="make('formula-inline')"
        >
          <i class="bi bi-currency-dollar"></i>
        </button>

        <button
          class="btn btn-sm btn-outline-secondary"
          type="button"
          title="Formula Block"
          @click="make('formula')"
        >
          <i class="bi bi-currency-dollar"></i>
          <i class="bi bi-currency-dollar icon-overlay"></i>
        </button>
      </div>

      <div class="btn-group" role="group" aria-label="ASCII-art drawings">
        <button
          class="btn btn-sm btn-outline-secondary"
          type="button"
          title="Graph"
          @click="make('graph')"
        >
          <i class="bi bi-graph-down"></i>
        </button>

        <button
          class="btn btn-sm btn-outline-secondary"
          type="button"
          title="ASCII-Art"
          @click="make('ascii')"
        >
          <i class="bi bi-boxes"></i>
        </button>
      </div>

      <div class="btn-group" role="group" aria-label="MathJS helpers">
        <button
          class="btn btn-sm btn-outline-secondary"
          type="button"
          title="MathJS - Evaluate Expression (Ctrl+E)"
          @click="make('mathjs-evaluate')"
        >
          <i class="bi bi-gear"></i>
        </button>

        <button
          class="btn btn-sm btn-outline-secondary"
          type="button"
          title="MathJS - Simplify Expression (Ctrl+M)"
          @click="make('mathjs-simplify')"
        >
          <i class="bi bi-gear"></i>
          <i class="bi bi-lightning-charge icon-overlay"></i>
        </button>

        <button
          class="btn btn-sm btn-outline-secondary"
          type="button"
          title="MathJS - Convert to TeX (Ctrl+O)"
          @click="make('mathjs-tex')"
        >
          <i class="bi bi-gear"></i>
          <i class="bi icon-overlay">TeX</i>
        </button>
      </div>

      <div class="btn-group" role="group">
        <button
          class="btn btn-sm btn-outline-secondary"
          type="button"
          title="Initialize empty document"
          @click="make('init')"
        >
          <i class="bi bi-rocket-takeoff"></i>
        </button>
      </div>

      <div class="btn-group" role="group">
        <button
          class="btn btn-sm btn-outline-secondary"
          type="button"
          title="Open audio recorder"
          @click="recorder.audio = true"
        >
          <i class="bi bi-mic"></i>
        </button>

        <button
          class="btn btn-sm btn-outline-secondary"
          type="button"
          title="Open webcam recorder"
          @click="recorder.webcam = true"
        >
          <i class="bi bi-webcam"></i>
        </button>

        <button
          class="btn btn-sm btn-outline-secondary"
          type="button"
          title="Open desktop recorder"
          @click="recorder.desktop = true"
        >
          <i class="bi bi-camera-reels"></i>
        </button>
      </div>
    </div>
  </nav>

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

  <div id="liascript-editor"></div>
</template>

<style>
#liascript-editor {
  height: 100vh;
}

.btn-sm {
  padding: 0.4rem 0.75rem 0.2rem 0.75rem;
}

.btn-group {
  margin: 0.1rem 0.3rem 0.1rem 0.2rem;
}

.ar-icon {
  line-height: 2px !important;
}

.ar-recorder__records-limit {
  top: 66px !important;
}

@media (max-width: 896px) {
  .btn-sm {
    padding: 0.1rem 0.25rem 0px 0.15rem;
  }

  .btn-group {
    margin: 0.1rem 0.3rem 0.1rem 0.2rem;
  }
}

.btn-toolbar {
  flex-wrap: wrap;
  flex-direction: row;
  flex-flow: row wrap;
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
