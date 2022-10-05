<template>

  <LiaScript
    v-if="data"
    :content="data"
  >
  </LiaScript>
</template>
    
  
  
<script lang="ts">
import * as Shrink from "shrink-string";
import LiaScript from "./LiaScript.vue";

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
    };
  },

  async created() {
    try {
      this.data = await Shrink.decompress(this.zipCode);
    } catch (e) {
      this.data = errorMsg(e.message);
    }
  },

  components: { LiaScript },
};
</script>