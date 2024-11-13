<script lang="ts">
import * as Shrink from "shrink-string";
import LiaScript from "./LiaScript.vue";
import Toast from "../components/Toast.vue";
import { LiveEditorURL } from "../ts/utils";

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

function isBase64Encoded(str: string): string | null {
  // Check if the length is a multiple of 4
  if (str.length % 4 !== 0) {
    return null;
  }

  // Check for valid base64 characters
  const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
  if (!base64Regex.test(str)) {
    return null;
  }

  // Try to decode the string
  try {
    return decodeURIComponent(escape(atob(str)));
  } catch (e) {}

  try {
    return atob(str);
  } catch (e) {}

  return null;
}

export default {
  name: "LiaScript-ZipView",
  props: ["zipCode", "embed", "mode"],
  data() {
    return {
      data: undefined,
      error: true,
      LiveEditorURL,
    };
  },

  async created() {
    try {
      this.data = await Shrink.decompress(this.zipCode);
      this.error = false;
    } catch (e) {
      this.data = isBase64Encoded(this.zipCode);

      if (this.data === null) {
        this.data = errorMsg(e.message);
        return;
      }
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
    <a :href="LiveEditorURL + '?/show/code/' + zipCode" target="_blank">LiveEditor</a>.

    <div v-if="mode">
      <hr />
      Use toolbar to switch between the editor and preview modes.
    </div>
  </Toast>
</template>
