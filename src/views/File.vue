<script lang="ts">
import LiaScript from "./LiaScript.vue";
import Toast from "../components/Toast.vue";
import { LiaScriptURL, LiveEditorURL } from "../ts/utils";

function errorMsg(url: string, response: string) {
  return `# Ups, something went wrong
  
The following resource with the URL:

${url}

could not be loaded.

It responded with the following error message:

\`${response}\`

**Reasons:**

* The URL is wrong or the resource is not available anymore.
* Or, you are offline...`;
}

function replaceURLs(base: string, code: string): string {
  return code.replace(
    /(\[[^\]]*\]\()(?!(http:|https:|ipfs:|#|\/\/))\.?\/?([^\)]+)/g,
    `$1${base}$3`
  );
}

function replaceMacroURLs(macro: string, base: string, code: string): string {
  // Use the macro parameter to define the script path regex
  const scriptPathRegex = new RegExp(`${macro}:\\s*(.+?)(?=\\n|$)`, "g");

  // Regex to find HTML comments
  const htmlCommentRegex = /<!--([\s\S]*?)-->/g;

  // Loop through all HTML comments
  return code.replace(htmlCommentRegex, (commentMatch, commentContent) => {
    // Loop through all script paths within the comment
    return commentMatch.replace(scriptPathRegex, (scriptMatch, scriptPath) => {
      // Check if the script path needs the base URL added
      if (!/^(http|https|ipfs):/.test(scriptPath.trim())) {
        return `${macro}: ${base}${scriptPath.trim()}`;
      }
      return scriptMatch;
    });
  });
}

export default {
  name: "LiaScript-FileView",
  props: ["fileUrl", "embed", "mode"],
  data() {
    let embed = this.$props.embed || false;

    return {
      embed,
      data: undefined,
      LiaScriptURL,
      LiveEditorURL,
    };
  },

  async created() {
    const response = await fetch(this.fileUrl);

    if (response.ok) {
      this.data = await response.text();
      const baseURL = this.fileUrl.replace(/\/[^\/]*$/, "/");
      this.data = replaceURLs(baseURL, this.data);
      this.data = replaceMacroURLs("script", baseURL, this.data);
      this.data = replaceMacroURLs("link", baseURL, this.data);
    } else {
      this.data = errorMsg(this.fileUrl, response.status + ": " + response.statusText);
    }
  },
  components: { LiaScript, Toast },
};
</script>

<template>
  <LiaScript v-if="data" :content="data" :file-url="fileUrl" :embed="embed" :mode="mode">
  </LiaScript>

  <Toast v-if="!embed">
    You can modify and compile this course with <kbd>Ctrl</kbd>+<kbd>S</kbd>, but if you
    want to store your changes permanently you have to fork it!

    <br />
    If you want to see the course on LiaScript, click
    <a :href="LiaScriptURL + '?' + fileUrl" target="_blank">here</a>.
  </Toast>

  <Toast v-else>
    You can modify and compile this course with <kbd>Ctrl</kbd>+<kbd>S</kbd>
    <br />
    ... or, open it in the
    <a :href="LiveEditorURL + '?/show/file/' + fileUrl" target="_blank">LiveEditor</a>
    ...
    <br />
    If you want to see the course on LiaScript, click
    <a :href="LiaScriptURL + '?' + fileUrl" target="_blank">here</a>.

    <div v-if="mode">
      <hr />
      Use toolbar to switch between the editor and preview modes.
    </div>
  </Toast>
</template>
