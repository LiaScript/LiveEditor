<template>
  <nav
    class="navbar navbar-light bg-light"
    style="border-top: solid lightgray 2px;
          border-bottom: solid lightgray 2px;
          padding: 0px;"
  >
    <form
      class="container-fluid justify-content-start"
      style="padding: 0px"
    >
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
        <i class="bi bi-youtube"></i>
      </button>

      <button
        class="btn btn-sm btn-outline-secondary"
        type="button"
        title="oEmbed"
        @click="make('oembed')"
      >
        <i class="bi bi-magic"></i>
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

      <button
        class="btn btn-sm btn-outline-secondary"
        type="button"
        title="Key"
        @click="make('keyboard')"
      >
        <i class="bi bi-keyboard"></i>

      </button>

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

      <button
        class="btn btn-sm btn-outline-secondary"
        type="button"
        title="Initialize empty document"
        @click="make('init')"
      >
        <i class="bi bi-rocket-takeoff"></i>
      </button>

    </form>
  </nav>
  <div id="liascript-editor">
  </div>
</template>

<script lang="ts">
import * as Y from "yjs";

import { IndexeddbPersistence } from "y-indexeddb";
import { WebrtcProvider } from "y-webrtc";
import { MonacoBinding } from "y-monaco";
import * as monaco from "monaco-editor";
import { Snippets } from "../ts/Snippets";
import * as Utils from "../ts/utils";
import { navigateTo } from "../index";

var editor;
var provider;
var isCtrlPressed = false;

export default {
  name: "Editor",

  props: ["storageId", "content", "lights"],

  data() {
    const config = Utils.loadConfig();

    return {
      lights: config.lights,
      user: config.user,
      online: null,
    };
  },

  methods: {
    getValue() {
      if (editor) {
        return editor.getValue();
      }
    },

    make(cmd: string) {
      if (!editor) return;

      const position = editor.getPosition();
      const selection = editor.getSelection();
      const range = {
        startLineNumber: selection?.startLineNumber || 1,
        startColumn: selection?.startColumn || 1,
        endLineNumber: selection?.endLineNumber || 1,
        endColumn: selection?.endColumn || 1,
      };
      const line = editor.getModel().getLineContent(position.lineNumber);
      const text = editor.getModel().getValueInRange(selection);

      let op = { range, text: "" };
      let move = 0;

      switch (cmd) {
        case "animation": {
          if (text) {
            if (text.match(/\n\s*\n/g)) {
              op.text =
                "      {{1}}\n<section>\n\n" + text + "\n\n</section>\n";
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
          op.text = "?[](https://)";
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
            op.text =
              '``` js\nvar message="Hello World"\nconsole.log(message)\n```';
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

          op.text =
            "#" + (line.startsWith(" ") || line.startsWith("#") ? "" : " ");

          break;
        }

        case "image": {
          op.text = "![](https://)";
          move = 2;
          break;
        }

        case "init": {
          for (const el of Snippets) {
            if (el.label === "lia-init") {
              editor.setValue(el.insertText);

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
          op.text = "!?[](https://)";
          move = 3;
          break;
        }

        case "oembed": {
          op.text = "??[](https://)";
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
            text: "| Column 1 | Column 2 | Column 3 |\n| -------- | :------: | -------: |\n| Text     |   Text   |     Text |\n\n",
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
      }

      editor.executeEdits("", [op]);

      if (move) {
        editor.setPosition({
          lineNumber: position.lineNumber,
          column: position.column + move,
        });
      }
      editor.focus();
    },

    switchLights() {
      if (editor) {
        const config = Utils.loadConfig();

        this.lights = !this.lights;
        editor.updateOptions({
          theme: this.lights ? "vs-light" : "vs-dark",
        });

        config.lights = this.lights;

        Utils.storeConfig(config);
      }

      return this.lights;
    },

    gotoLine(line: number) {
      if (editor) {
        editor.setPosition({ lineNumber: line + 1, column: 0 });
        editor.revealLineNearTop(line + 1);
        editor.focus();
      }
    },

    fork() {
      const id = Utils.randomString(24);
      const yDoc = new Y.Doc();
      const yText = yDoc.getText(id);

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

      const editor = monaco.editor.create(div, {
        value: code,
        language: "markdown",
        theme: this.lights ? "vs-light" : "vs-dark",
        automaticLayout: true,
        wordWrap: "on",
      });

      const self = this;

      editor.addAction({
        // An unique identifier of the contributed action.
        id: "compile",
        // A label of the action that will be presented to the user.
        label: "LiaScript compile",
        // An optional array of keybindings for the action.
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
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

      monaco.languages.registerCompletionItemProvider("markdown", {
        //triggerCharacters: ['['],
        provideCompletionItems: function (model, position, context) {
          const word = model.getWordAtPosition(position);

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

          const suggestions: any[] = [];

          for (const snippet of Snippets) {
            suggestions.push({
              label: snippet.label,
              kind: monaco.languages.CompletionItemKind.Text,
              documentation: snippet.documentation,
              insertText: snippet.insertText,
              range: range,
              command: {
                id: "editor.action.insertLineAfter",
              },
            });
          }

          return {
            suggestions,
          };
        },
      });

      monaco.languages.registerCodeActionProvider("markdown", {
        provideCodeActions(model, range, token) {
          if (isCtrlPressed) {
            isCtrlPressed = false;
            self.$emit("goto", range.startLineNumber);
          }
          return undefined;
        },
      });

      editor.onKeyDown((e) => {
        if (e.keyCode == 5) {
          isCtrlPressed = true;
        }
      });

      editor.onKeyUp((e) => {
        if (e.keyCode == 5) {
          isCtrlPressed = false;
        }
      });

      return editor;
    },

    loadFromLocalStorage(editor: any, storageId: string) {
      const yDoc = new Y.Doc();

      provider = new WebrtcProvider(storageId, yDoc, {
        signaling: ["wss://rooms.deno.dev"],
      });

      const indexeddbProvider = new IndexeddbPersistence(storageId, yDoc);

      const self = this;
      indexeddbProvider.on("synced", (event: any) => {
        console.log("liascript: content from the database is loaded");
        self.$emit("ready");
      });

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

        const online = Array.from(
          provider.awareness.getStates().values()
        ).length;

        if (online != self.online) {
          self.$emit("online", online);
          self.online = online;
        }
      });

      const content = yDoc.getText(storageId);
      const monacoBinding = new MonacoBinding(
        content,
        editor.getModel(),
        new Set([editor]),
        provider.awareness
      );
    },
  },

  unmounted() {
    if (provider) provider.destroy();

    editor = undefined;
  },

  emits: ["compile", "ready", "online", "goto"],

  mounted() {
    editor = this.initEditor(this.content || "");

    if (provider) {
      provider.destroy();
    }

    if (this.storageId) {
      this.loadFromLocalStorage(editor, this.storageId);
    } else {
      this.$emit("ready");
    }
  },
};
</script>

<style>
#liascript-editor {
  height: 100vh;
}

.btn-sm {
  border: 0px !important;
}

.icon-overlay {
  top: -8px;
  scale: 0.6;
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