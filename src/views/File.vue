<template>

  <LiaScript
    v-if="data"
    :content="data"
    :file-url="fileUrl"
  >
  </LiaScript>

  <Toast>
    You can modify and compile this course with Ctrl+S, but if you want to store your changes permanently you have to fork it!

    <br>
    If you want to see the course on LiaScript, click <a
      :href="'https://LiaScript.github.io/course/?' + fileUrl"
      target="_blank"
    >here</a>.

  </Toast>
</template>
  


<script lang="ts">
import LiaScript from "./LiaScript.vue";
import Toast from "../components/Toast.vue";

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

export default {
  name: "LiaScript-FileView",
  props: ["fileUrl"],
  data() {
    return {
      data: undefined,
    };
  },

  async created() {
    const response = await fetch(this.fileUrl);

    if (response.ok) {
      this.data = await response.text();
      const baseURL = this.fileUrl.replace(/\/[^\/]*$/, "/");
      this.data = replaceURLs(baseURL, this.data);
    } else {
      this.data = errorMsg(
        this.fileUrl,
        response.status + ": " + response.statusText
      );
    }
  },
  components: { LiaScript, Toast },
};
</script>