<template>

  <LiaScript
    v-if="data"
    :content="data"
  >
  </LiaScript>
</template>
  


<script lang="ts">
import LiaScript from "./LiaScript.vue";

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
      const baseURL = this.params.file.replace(/\/[^\/]*$/, "/");
      this.data = replaceURLs(baseURL, this.data);
    } else {
      this.data = errorMsg(
        this.fileUrl,
        response.status + ": " + response.statusText
      );
    }
  },
  components: { LiaScript },
};
</script>