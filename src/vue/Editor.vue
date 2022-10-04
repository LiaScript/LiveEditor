<template>
  <div id="liascript-editor"></div>
</template>

<script lang="ts">
import { MonacoBinding } from "y-monaco";
import * as monaco from "monaco-editor";
import { Snippets } from "../ts/views/Helper/Snippets";

export default {
  name: "Editor",

  data() {
    return {
      editor: undefined,
      lights: true,
    };
  },

  methods: {
    getValue() {
      return this.editor.getValue();
    },
  },

  emits: ["compile", "ready"],

  mounted() {
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

    this.editor = editor;

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

    this.$emit("ready", editor.getValue());
  },
};
</script>

<style scoped>
#liascript-editor {
  height: 100vh;
}
</style>