<template>
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
      console.warn("XXXXXXXXX", this.lights);

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