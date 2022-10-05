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
  
The following resource with the url:

${url}

could not be loaded.

It responded with the following error message:

\`${response}\`

Please check if this resource is available, or if your are offline.`;
}

export default {
  name: "File-Editor",
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