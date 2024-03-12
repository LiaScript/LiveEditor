<script lang="ts">
import * as Shrink from "shrink-string";
import LiaScript from "./LiaScript.vue";
import Toast from "../components/Toast.vue";

function errorMsg(msg: string) {
  return `# Ups, something went wrong
    
The encoded content within the URL could not be properly parsed.
It resulted with the following error message:

\`${msg}\`

**Reasons:**

* This might be the case if the URL is too long or if the "messenger" that was used to transmit this URL performed an automated message truncation.
* Or, in some cases the URL has been falsely modified...
`;
}

export default {
  name: "LiaScript-ZipView",
  props: ["zipCode"],
  data() {
    return {
      data: undefined,
      error: true,
    };
  },

  async created() {
    try {
      this.data = await Shrink.decompress(this.zipCode);
      this.error = false;
    } catch (e) {
      this.data = errorMsg(e.message);
    }
  },

  components: { LiaScript, Toast },
};
</script>

<template>
  <LiaScript v-if="data" :content="data"> </LiaScript>

  <Toast :hidden="error">
    You can modify and compile this course with Ctrl+S, but if you want to store your
    changes permanently you have to fork it!
  </Toast>
</template>
