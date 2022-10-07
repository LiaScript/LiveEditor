<template>

  <nav class="navbar navbar-expand-lg bg-light">
    <div class="container-fluid">
      <a
        class="navbar-brand"
        href="./"
        data-link="true"
      >[Title]</a>

      <div
        class="btn-toolbar btn-group-sm"
        role="toolbar"
        aria-label="Toolbar with button groups"
      >
        <div
          class="btn-group btn-outline-secondary me-2"
          role="group"
          aria-label="Basic radio toggle button group"
        >
          <input
            type="radio"
            class="btn-check"
            name="btnradio"
            id="btnradio1"
            autocomplete="off"
            @click="changeMode(-1)"
          >
          <label
            class="btn btn-outline-secondary"
            for="btnradio1"
            title="Editor only"
          >
            <i class="bi bi-pencil"></i>
          </label>

          <input
            type="radio"
            class="btn-check"
            name="btnradio"
            id="btnradio2"
            autocomplete="off"
            checked
            @click="changeMode(0)"
          >
          <label
            class="btn btn-outline-secondary"
            for="btnradio2"
            title="Split view"
          >
            <i class="bi bi-layout-split"></i>
          </label>

          <input
            type="radio"
            class="btn-check"
            name="btnradio"
            id="btnradio3"
            autocomplete="off"
            @click="changeMode(1)"
          >
          <label
            class="btn btn-outline-secondary"
            for="btnradio3"
            title="Preview only"
          >
            <i class="bi bi-eye"></i>
          </label>
        </div>
      </div>

      <button
        type="button"
        class="btn btn-outline-secondary me-2 px-3"
        @click="compile()"
        title="Compile (Ctrl+S)"
      >
        <i class="bi bi-arrow-counterclockwise"></i>
      </button>

      <!-- Drop-Down Navigation -->

      <button
        class="navbar-toggler"
        type="button"
        data-bs-toggle="collapse"
        data-bs-target="#navbarSupportedContent"
        aria-controls="navbarSupportedContent"
        aria-expanded="false"
        aria-label="Toggle navigation"
      >
        <span class="navbar-toggler-icon"></span>
      </button>

      <div
        class="collapse navbar-collapse"
        id="navbarSupportedContent"
      >

        <!-- SPAN -->
        <div class="navbar-nav me-auto mb-lg-0">
        </div>

        <div class="navbar-nav mb-2 mb-lg-0">

          <div class="nav-item nav-item-sm ml-4 me-4">
            <a
              class="nav-link"
              aria-current="page"
              href="./?/edit"
              title="Create a new and empty document"
              data-link
            >
              <i class="bi bi-plus"></i>
              New
            </a>
          </div>

          <div class="nav-item me-4">
            <button
              type="button"
              class="btn nav-link btn-link"
              @click="fork"
              title="Create a copy of this document"
            >
              <i class="bi bi-bezier2"></i>
              Fork
            </button>
          </div>
        </div>
      </div>

    </div>
  </nav>

  <div
    class="container p-0"
    style="max-width:100%"
  >
    <div
      id="liascript-ide"
      class="row align-items-start p-0 m-0 flex-nowrap"
      style="height: calc(100vh - 56px);"
    >
      <div
        class="col-6 w-50 p-0 h-100"
        :hidden="mode > 0"
        :class="{'w-50': mode==0, 'w-100': mode!=0}"
      >
        <Editor
          class="col w-100 p-0 h-100"
          @compile="compile"
          @ready="editorReady"
          :storage-id="$props.storageId"
          :content="$props.content"
          ref="editor"
        >
        </Editor>
      </div>

      <div
        class="col-6 w-50 h-100 p-0"
        :hidden="mode < 0"
        :class="{'w-50': mode==0, 'w-100': mode!=0}"
      >
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
import Dexie from "../ts/indexDB";

import Editor from "../components/Editor.vue";
import Preview from "../components/Preview.vue";

// @ts-ignore
import JSONWorker from "url:monaco-editor/esm/vs/language/json/json.worker.js";
// @ts-ignore
import CSSWorker from "url:monaco-editor/esm/vs/language/css/css.worker.js";
// @ts-ignore
import HTMLWorker from "url:monaco-editor/esm/vs/language/html/html.worker.js";
// @ts-ignore
import TSWorker from "url:monaco-editor/esm/vs/language/typescript/ts.worker.js";
// @ts-ignore
import EditorWorker from "url:monaco-editor/esm/vs/editor/editor.worker.js";
// @ts-ignore
window.MonacoEnvironment = {
  getWorkerUrl: function (moduleId, label) {
    if (label === "json") {
      return JSONWorker;
    }
    if (label === "css" || label === "scss" || label === "less") {
      return CSSWorker;
    }
    if (label === "html" || label === "handlebars" || label === "razor") {
      return HTMLWorker;
    }
    if (label === "typescript" || label === "javascript") {
      return TSWorker;
    }
    return EditorWorker;
  },
};

export default {
  name: "LiaScript",

  props: ["storageId", "content"],

  data() {
    let database: Dexie | undefined;

    if (this.$props.storageId) {
      database = new Dexie();
      database.maybeInit(this.$props.storageId);
    }

    return {
      preview: undefined,
      previewNotReady: true,
      compilationCounter: 0,
      mode: 0,
      editorIsReady: false,
      database,
    };
  },

  methods: {
    changeMode(mode: number) {
      this.mode = mode;
    },

    fork() {
      this.$refs.editor.fork();
    },

    compile() {
      console.log("liascript: compile");

      if (this.preview && this.editorIsReady) {
        let code = this.$refs.editor.getValue();

        if (code.trim().length == 0) {
          code = tutorial;
        }

        this.preview.focusOnMain = false;
        this.preview.scrollUpOnMain = false;

        this.preview.jit(code);
      }
    },

    editorReady() {
      console.log("liascript: editor ready");
      this.editorIsReady = true;
      this.compile();
    },

    previewReady(preview: any) {
      console.log("liascript: preview ready");
      this.preview = preview;
      this.compile();
    },

    previewUpdate(params: any) {
      console.log("liascript: update", params);

      this.compilationCounter++;
      if (this.compilationCounter > 1) {
        this.previewNotReady = false;

        if (this.$props.storageId) {
          const titleMatch = this.$refs.editor.getValue().match(/^# (.+)/m);

          if (titleMatch) params.title = titleMatch[1];

          this.database.put(this.$props.storageId, params);
        }
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