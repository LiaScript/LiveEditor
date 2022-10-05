<template>
  <div
    class="container p-0"
    style="max-width:100%"
  >
    <div
      id="liascript-ide"
      class="row align-items-start p-0 m-0 flex-nowrap"
      style="height: calc(100vh - 56px);"
    >
      <div class="col-6 w-50 p-0 h-100">
        <Editor
          class="col w-100 p-0 h-100"
          @compile="compile"
          @ready="editorReady"
          :storageId="$props.editId"
        />
      </div>

      <div class="col-6 w-50 h-100 p-0">
        <Preview
          @ready="previewReady"
          @update="previewUpdate"
        />
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { tutorial } from "../ts/views/Helper/Tutorial";
import Editor from "../components/Editor.vue";
import Preview from "../components/Preview.vue";

export default {
  name: "LiaScript",

  props: ["editId"],

  data() {
    console.warn("XXX", this.$props.editId);

    return {
      preview: undefined,
      firstCode: undefined,
    };
  },

  methods: {
    compile(code: string) {
      console.log("liascript: compile");

      if (this.firstCode !== undefined) {
        code = this.firstCode;
        this.firstCode = undefined;
        console.log("liascript: first load");
      }

      if (this.preview) {
        if (code.trim().length == 0) {
          code = tutorial;
        }

        this.preview.focusOnMain = false;
        this.preview.scrollUpOnMain = false;

        this.preview.jit(code);
      }
    },

    editorReady(code: string) {
      console.log("liascript: editor ready");
      this.firstCode = code;
      this.compile("");
    },

    previewReady(preview: any) {
      console.log("liascript: preview ready");
      this.preview = preview;
      this.compile("");
    },

    previewUpdate(params: any) {
      console.log("liascript: update", params);
    },
  },

  components: { Editor, Preview },
};
</script>

<style scoped>
#liascript {
  height: 100vh;
}
</style>