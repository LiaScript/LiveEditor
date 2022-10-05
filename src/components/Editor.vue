<template>
  <div id="liascript-editor"></div>
</template>

<script lang="ts">
import * as Y from "yjs";

import { IndexeddbPersistence } from "y-indexeddb";
import { WebrtcProvider } from "y-webrtc";
import { MonacoBinding } from "y-monaco";
import * as monaco from "monaco-editor";
import { Snippets } from "../ts/views/Helper/Snippets";
import * as Utils from "../ts/utils";

export default {
  name: "Editor",

  props: ["storageId"],

  data() {
    return {
      editor: undefined,
      lights: true,

      user: {
        name: Utils.randomString(),
        color: Utils.randomColor(),
      },
    };
  },

  methods: {
    initEditor(code: string) {
      const div = document.getElementById("liascript-editor");

      if (!div) {
        console.warn("No editor init");
        return;
      }

      const editor = monaco.editor.create(div, {
        value: "",
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
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KEY_S],
        // A precondition for this action.
        precondition: undefined,
        // A rule to evaluate on top of the precondition in order to dispatch the keybindings.
        keybindingContext: undefined,
        contextMenuGroupId: "navigation",
        contextMenuOrder: 1.5,
        // Method that will be executed when the action is triggered.
        // @param editor The editor instance is passed in as a convenience
        run: function (_: any) {
          self.$emit("compile", editor.getValue());
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

          if (textUntilPosition.match(/(lia|hili|voice).*$/m)) {
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
          }

          return {
            suggestions,
          };
        },
      });

      return editor;
    },

    loadFromLocalStorage(editor: any, storageId: string) {
      const yDoc = new Y.Doc();
      const provider = new WebrtcProvider(storageId, yDoc, {
        // @ts-ignore
        url: "https//signaling.simplewebrtc.com:443/",
      });

      const indexeddbProvider = new IndexeddbPersistence(storageId, yDoc);

      const self = this;
      indexeddbProvider.on("synced", (event: any) => {
        console.log("content from the database is loaded");
        self.$emit("ready", editor.getValue());
      });

      const awareness = provider.awareness;

      awareness.setLocalStateField("user", this.user);

      let status;

      provider.on("status", (event: any) => {
        console.log("-----------------------------", event.status); // logs "connected" or "disconnected"
        status = event.status;
        if (event.status === "connected") {
        }
      });

      awareness.on("change", (changes) => {
        // Whenever somebody updates their awareness information,
        // we log all awareness information from all users.
        const users = document.getElementById("number_of_users");

        if (users) {
          users.innerText =
            "" + Array.from(awareness.getStates().values()).length;
        }
      });

      const content = yDoc.getText(storageId);
      const monacoBinding = new MonacoBinding(
        content,
        editor.getModel(),
        new Set([editor]),
        awareness
      );
    },
  },

  emits: ["compile", "ready"],

  mounted() {
    const editor = this.initEditor("");

    this.editor = editor;

    if (this.storageId) {
      this.loadFromLocalStorage(editor, this.storageId);
    } else {
      this.$emit("ready", editor.getValue());
    }
  },
};
</script>

<style scoped>
#liascript-editor {
  height: 100vh;
}
</style>