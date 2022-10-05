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
          :storage-id="$props.storageId"
          :content="$props.content"
        >
        </Editor>
      </div>

      <div class="col-6 w-50 h-100 p-0">
        <div
          v-show="previewNotReady"
          style="position: absolute; background-color: white; width:50%; height: 100%"
        >
          <div
            class="spinner-grow"
            style="width: 5rem; height: 5rem; margin-top: 50%; margin-left: 45%; margin-right: 45%;"
            role="status"
          >
            <span class="visually-hidden">Loading...</span>
          </div>
        </div>

        <Preview
          @ready="previewReady"
          @update="previewUpdate"
          :class="{ invisible: previewNotReady }"
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

  props: ["storageId", "content"],

  data() {
    return {
      preview: undefined,
      previewNotReady: true,
      firstCode: undefined,
      compilationCounter: 0,
    };
  },

  methods: {
    compile(code: string) {
      console.log("liascript: compile", this.$props.content);

      if (this.firstCode !== undefined && this.preview) {
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

      this.compilationCounter++;
      if (this.compilationCounter > 1) {
        this.previewNotReady = false;
      }
    },
  },

  components: { Editor, Preview },
};
</script>

<style scoped>
#liascript {
  height: 100vh;
}

.invisible {
  visibility: hidden;
}
</style>