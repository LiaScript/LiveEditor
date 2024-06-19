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
  props: ["zipCode", "embed", "mode"],
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
  <LiaScript v-if="data" :content="data" :embed="embed" :mode="mode"> </LiaScript>

  <Toast v-if="!embed" :hidden="error">
    You can modify and compile this course with <kbd>Ctrl</kbd>+<kbd>S</kbd>, but if you
    want to store your changes permanently you have to fork it!
  </Toast>

  <Toast v-else :hidden="error">
    You can modify and compile this course with <kbd>Ctrl</kbd>+<kbd>S</kbd>, or open it
    in the
    <a
      :href="'https://LiaScript.github.io/LiveEditor/?/show/code/' + zipCode"
      target="_blank"
      >LiveEditor</a
    >.

    <div v-if="mode">
      <hr />
      Use toolbar to switch between the editor and preview modes.
    </div>
  </Toast>
</template>
