<script lang="ts">
import { tutorial } from "../ts/Tutorial";
import Dexie from "../ts/indexDB";

import Editor from "../components/Editor.vue";
import Preview from "../components/Preview.vue";
import Modal from "../components/Modal.vue";
import { compress } from "shrink-string";

import pako from "pako";
import JSZip from "jszip";

import { Splitpanes, Pane } from "splitpanes";
import "splitpanes/dist/splitpanes.css";

import { LiaScriptURL } from "../ts/utils";
import NostrModal from "./Export/Nostr.vue";

// @ts-ignore
// import JSONWorker from "url:monaco-editor/esm/vs/language/json/json.worker.js";
// @ts-ignore
// import CSSWorker from "url:monaco-editor/esm/vs/language/css/css.worker.js";
// @ts-ignore
// import HTMLWorker from "url:monaco-editor/esm/vs/language/html/html.worker.js";
// @ts-ignore
// import TSWorker from "url:monaco-editor/esm/vs/language/typescript/ts.worker.js";
// @ts-ignore
import EditorWorker from "url:monaco-editor/esm/vs/editor/editor.worker.js";
import { editor } from "monaco-editor";

import logoImg from "url:../../assets/logo.png";

// @ts-ignore
window.MonacoEnvironment = {
  getWorkerUrl: function (moduleId, label) {
    /*
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
    */
    return EditorWorker;
  },
};

export default {
  name: "LiaScript",

  props: ["storageId", "content", "fileUrl", "connection", "embed", "mode"],

  data() {
    let database: Dexie | undefined;

    if (this.$props.storageId) {
      database = new Dexie();
      database.maybeInit(this.$props.storageId);

      const self = this;
      database.watch(this.$props.storageId, (meta) => {
        self.meta = meta;
      });
    }

    let connectionType = this.$props.connection || "offline";

    switch (connectionType) {
      case "webrtc":
        connectionType = "WebRTC";
        break;
      case "websocket":
        connectionType = "WebSocket";
        break;
      default:
        connectionType = "Offline";
    }

    return {
      logoImg,
      preview: undefined,
      horizontal:
        document.documentElement.clientWidth < document.documentElement.clientHeight,
      previewNotReady: true,
      compilationCounter: 0,
      mode: this.$props.mode || 0,
      editorIsReady: false,
      database,
      meta: {},
      onlineUsers: 0,
      lights: false,
      conn: {
        type: connectionType,
        users: 0,
      },
      resizing: false,
      LiaScriptURL,
      nostrModalVisible: false,
    };
  },

  computed: {
    lightMode() {
      return this.lights ? "bi bi-sun" : "bi bi-moon";
    },
  },

  mounted() {
    window.addEventListener("resize", () => {
      this.horizontal =
        document.documentElement.clientWidth < document.documentElement.clientHeight;
    });
  },

  methods: {
    newCourse() {
      window.location.href = "./?/edit";
    },

    urlPath(path: string[]) {
      return window.location.origin + window.location.pathname + "?/" + path.join("/");
    },

    online(users: number) {
      this.conn.users = users;
    },

    changeMode(mode: number) {
      this.mode = mode;
    },

    nostr() {
      this.nostrModalVisible = true;
    },

    shareLink() {
      let link = window.location.toString();

      if (!link.endsWith("/webrtc") && !link.endsWith("/websocket")) {
        link += "/webrtc";
      }
      this.$refs.modal.show(
        "Collaboration link",
        `
        If you share the link below, the editor will be in collaborative mode.
        Working should also be possible offline, but all connected users will work on the same course.
        If you did receive this via a collaboration link and want to make a complete new course by yourself, then you will have to click onto the "Fork" button, which will create a complete new version.

        <hr>

        <a target="_blank" href="${link}">
          ${link}
        </a>`
      );
    },

    shareFile() {
      const fileUrl = prompt(
        "please insert the URL of a Markdown file you want to share",
        ""
      );

      if (!fileUrl) return;

      this.$refs.modal.show(
        "External resource",
        `
        Use this URL to predefine the content for your share link.
        In this case the editor will at first try to load the Markdown file and insert its content into the editor.
        This link will only work if your Markdown file is accessible via the internet.

        <hr>

        <a target="_blank" style="word-break: break-all" href="${this.urlPath([
          "show",
          "file",
          fileUrl,
        ])}">
          ${this.urlPath(["show", "file", fileUrl])}
        </a>`
      );
    },

    bytesInfo(url: string) {
      return `<code>URL-length: ${url.length} bytes</code><br>`;
    },

    async shareData() {
      let base64 = "";

      let uriEncode = "";
      let gzip = "";

      try {
        base64 =
          LiaScriptURL + "?data:text/plain;base64," + btoa(this.$refs.editor.getValue());

        base64 =
          this.bytesInfo(base64) +
          `<a target="_blank" style="word-break: break-all" href="${base64}">
          ${base64}
        </a>`;
      } catch (e) {}

      try {
        uriEncode =
          LiaScriptURL +
          "?data:text/plain," +
          encodeURIComponent(this.$refs.editor.getValue());

        uriEncode =
          this.bytesInfo(uriEncode) +
          `<a target="_blank" style="word-break: break-all" href="${uriEncode}">
          ${uriEncode}
        </a>`;
      } catch (e) {}

      try {
        gzip = pako.gzip(this.$refs.editor.getValue());
        gzip =
          LiaScriptURL +
          "?data:text/plain;charset=utf-8;Content-Encoding=gzip;base64," +
          btoa(String.fromCharCode.apply(null, gzip));

        gzip =
          this.bytesInfo(gzip) +
          `<a target="_blank" style="word-break: break-all" href="${gzip}">
          ${gzip}
        </a>`;
      } catch (e) {}

      this.$refs.modal.show(
        "Data-Protocol",
        `
        The entire content of the course is base64 encoded or URI-encoded put into a data-URI.
        Since base64 might fail for certain languages, the URI-encoded URL is generated as well.
        However, this works only for short courses, the longer the course the longer the URi.
        Sharing your editor via a messenger for example, you will have to check first if no parts are truncated!
        Additionally different browser support different lengths of URLs... (Choose the shorter version)

        <hr>

        ${gzip}

        <hr>

        ${base64}

        <hr>

        ${uriEncode}
        `
      );
    },

    async shareCode() {
      const zipCode = this.urlPath([
        "show",
        "code",
        await compress(this.$refs.editor.getValue()),
      ]);

      this.$refs.modal.show(
        "Snapshot url",
        `
        Snapshots are URLs that contain the entire course defintion.
        However, this works only for short courses, the longer the course the longer the URL.
        Sharing your editor via a messenger for example, you will have to check first if no parts are truncated!
        Additionally different browser support different lengths of URLs...

        <hr>
        ${this.bytesInfo(zipCode)}
        <a target="_blank" style="word-break: break-all" href="${zipCode}">
          ${zipCode}
        </a>`
      );
    },

    async embedCode() {
      const zipCode = this.urlPath([
        "embed",
        "code",
        await compress(this.$refs.editor.getValue()),
      ]);

      const base64 = this.urlPath([
        "embed",
        "code",
        btoa(unescape(encodeURIComponent(this.$refs.editor.getValue()))),
      ]);

      this.$refs.modal.show(
        "Embed Code",
        `
        Copy this HTML code into your website to embed the this as an example.
        Optionally you can modify the URL with one of the following, to open the editor or the preview directly:<br>

        <code>?/embed/code/edit</code> or <code>?/embed/code/preview</code>

        <hr>

        ${this.bytesInfo(zipCode)}
        <code style="word-break: break-all">&lt;iframe style="height: 80vh; min-width: 100%; border: 1px black solid" src="${zipCode}"&gt;&lt;/iframe&gt;</code>

        <hr>
        <p>
          This code can be generated externally via:
          <code>btoa(unescape(encodeURIComponent(string)))</code>
        </p>

        ${this.bytesInfo(base64)}
        <code style="word-break: break-all">&lt;iframe style="height: 80vh; min-width: 100%; border: 1px black solid" src="${base64}"&gt;&lt;/iframe&gt;</code>
        `
      );
    },

    download() {
      const element = document.createElement("a");
      element.setAttribute(
        "href",
        "data:text/plain;charset=utf-8," +
          encodeURIComponent(this.$refs.editor.getValue())
      );
      element.setAttribute("download", "README.md");
      element.style.display = "none";
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
    },

    downloadZip() {
      const zip = JSZip();

      zip.file("README.md", this.$refs.editor.getValue());

      const blobs = this.$refs.editor.getAllBlobs();

      if (blobs) {
        for (const blob of blobs) {
          zip.file(blob.name, blob.data);
        }
      }

      const fileName =
        "Project-" + (this.$props?.storageId?.slice(0, 8) || "xxxxxxxx") + ".zip";
      zip.generateAsync({ type: "blob" }).then(function (content) {
        let url = URL.createObjectURL(content);

        const element = document.createElement("a");
        element.href = url;
        element.setAttribute("download", fileName);
        element.style.display = "none";
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
        element.addEventListener("click", function () {
          setTimeout(() => URL.revokeObjectURL(url), 30 * 1000);
        });
      });
    },

    fork() {
      this.$refs.editor.fork();
    },

    switchLights() {
      this.lights = this.$refs.editor.switchLights();
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

    fetchError(src: string) {
      return this.$refs.editor.getBlob(src);
    },

    editorReady() {
      console.log("liascript: editor ready");
      this.editorIsReady = true;
      this.lights = this.$refs.editor.lights;
      this.compile();
    },

    previewReady(preview: any) {
      console.log("liascript: preview ready");
      this.preview = preview;
      this.compile();
    },

    gotoEditor(line: number) {
      if (this.$refs.editor) {
        this.$refs.editor.gotoLine(line);
      }
    },

    gotoPreview(line: number) {
      if (this.preview) this.preview.gotoLine(line);
    },

    previewUpdate(params: any) {
      console.log("liascript: update");

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

  components: { Editor, Modal, Pane, Preview, Splitpanes, NostrModal },
};
</script>

<template>
  <nav class="navbar navbar-expand-lg bg-light">
    <div class="container-fluid">
      <a v-if="!embed" class="navbar-brand" href="./" data-link="true">
        <img :src="logoImg" alt="LiaScript" height="28" />
        <span id="lia-edit">LiaEdit</span>
      </a>
      <span v-else class="navbar-brand">
        <img :src="logoImg" alt="LiaScript" height="28" />
        <span id="lia-edit">LiaDemo</span>
      </span>

      <button
        type="button"
        class="btn btn-outline-secondary me-2 px-3"
        @click="switchLights()"
        title="Switch between light and dark mode"
      >
        <i :class="lightMode"></i>
      </button>

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
            :checked="mode < 0"
          />
          <label class="btn btn-outline-secondary" for="btnradio1" title="Editor only">
            <i class="bi bi-pencil"></i>
          </label>

          <input
            type="radio"
            class="btn-check"
            name="btnradio"
            id="btnradio2"
            autocomplete="off"
            :checked="mode === 0"
            @click="changeMode(0)"
          />
          <label class="btn btn-outline-secondary" for="btnradio2" title="Split view">
            <i
              class="bi bi-layout-split"
              style="display: inline-block"
              :style="{ transform: horizontal ? 'rotate(90deg)' : 'rotate(0deg)' }"
            ></i>
          </label>

          <input
            type="radio"
            class="btn-check"
            name="btnradio"
            id="btnradio3"
            autocomplete="off"
            @click="changeMode(1)"
            :checked="mode > 0"
          />
          <label class="btn btn-outline-secondary" for="btnradio3" title="Preview only">
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
        v-if="!embed"
        class="btn btn-outline-secondary me-2 px-3"
        type="button"
        data-bs-toggle="collapse"
        data-bs-target="#navbarSupportedContent"
        aria-controls="navbarSupportedContent"
        aria-expanded="false"
        aria-label="Toggle navigation"
      >
        <span class="navbar-toggler-icon"></span>
      </button>

      <div v-if="!embed" class="collapse navbar-collapse" id="navbarSupportedContent">
        <!-- SPAN -->
        <div class="navbar-nav me-auto mb-lg-0"></div>

        <div class="navbar-nav mb-2 mb-lg-0">
          <div class="nav-item nav-item-sm ml-4 me-4">
            <a
              class="nav-link"
              aria-current="page"
              href="https://liascript.github.io/course/?https://raw.githubusercontent.com/liaScript/docs/master/README.md"
              title="Open the documentation"
              target="_blank"
            >
              <i class="bi bi-question"></i>
              Help
            </a>
          </div>

          <div class="nav-item nav-item-sm ml-4 me-4">
            <button
              class="btn nav-link btn-link"
              aria-current="page"
              @click="newCourse"
              title="Create a new and empty document"
            >
              <i class="bi bi-plus"></i>
              New
            </button>
          </div>

          <div class="nav-item me-4">
            <button
              type="button"
              class="btn nav-link btn-link"
              @click="fork"
              title="Create a copy of this document"
            >
              <i class="bi bi-signpost-split"></i>
              Fork
            </button>
          </div>

          <div class="nav-item dropdown me-4">
            <a
              class="nav-link dropdown-toggle"
              href="#"
              role="button"
              data-bs-toggle="dropdown"
              aria-expanded="false"
            >
              Menu
            </a>

            <ul class="dropdown-menu">
              <li>
                <h6 class="dropdown-header fw-light">Share editor ...</h6>
              </li>
              <li>
                <span
                  class="d-inline-block"
                  tabindex="0"
                  data-toggle="tooltip"
                  title="Fork this document before you can use this function"
                >
                  <button
                    class="btn dropdown-item btn-link"
                    @click="shareLink"
                    :disabled="!storageId"
                    title="Share this document with others"
                  >
                    collaboration link
                  </button>
                </span>
              </li>
              <li>
                <button
                  class="btn dropdown-item btn-link"
                  @click="shareCode"
                  aria-label="Share the current course with the editor"
                >
                  snapshot url
                </button>
              </li>
              <li>
                <button
                  class="btn dropdown-item btn-link"
                  @click="embedCode"
                  aria-label="Get the embed code for the current course within the editor"
                >
                  embed code
                </button>
              </li>
              <li>
                <button
                  class="btn dropdown-item btn-link"
                  @click="shareFile"
                  aria-label="Use an external document url for sharing with the editor"
                >
                  external resource
                </button>
              </li>
              <li>
                <hr class="dropdown-divider" />
              </li>
              <li>
                <h6 class="dropdown-header fw-light">Share course via ...</h6>
              </li>
              <li>
                <span
                  class="d-inline-block"
                  tabindex="0"
                  data-toggle="tooltip"
                  title="You have to export this file to GitHub gist before you can use this functionality"
                >
                  <a
                    class="dropdown-item"
                    :class="{ disabled: !meta.meta?.gist_url }"
                    :href="LiaScriptURL + '?' + meta.meta?.gist_url"
                    target="_blank"
                    aria-label="Load the LiaScript course from a previous export to GitHub gist"
                  >
                    GitHub gist link
                  </a>
                </span>
              </li>
              <li>
                <button
                  class="btn dropdown-item btn-link"
                  @click="shareData"
                  aria-label="Share the current course at LiaScript, with the content embedded into the URL"
                >
                  data-URI
                </button>
              </li>
              <li>
                <div
                  class="d-inline-block"
                  tabindex="0"
                  style="width: 100%"
                  data-toggle="tooltip"
                  title="This function is only available if you have shared an external resource"
                >
                  <a
                    class="btn dropdown-item btn-link"
                    :class="{ disabled: !fileUrl }"
                    :href="LiaScriptURL + '?' + fileUrl"
                    target="_blank"
                    title="open this course on LiaScript"
                  >
                    file URL
                  </a>
                </div>
              </li>
              <li>
                <hr class="dropdown-divider" />
              </li>
              <li>
                <h6 class="dropdown-header fw-light">Download to ...</h6>
              </li>
              <li>
                <button
                  class="btn dropdown-item btn-link"
                  @click="download"
                  title="Download the Readme file"
                  aria-label="Download the Readme file"
                >
                  README.md
                </button>
              </li>
              <li>
                <button
                  class="btn dropdown-item btn-link"
                  @click="downloadZip"
                  title="Download the entire project in a zip file"
                  aria-label="Download the entire project in a zip file"
                >
                  Project-{{ $props?.storageId?.slice(0, 8) || "xxxxxxxx" }}.zip
                </button>
              </li>
              <!--li>
                <hr class="dropdown-divider">
              </li>
              <li>
                <h6 class="dropdown-header fw-light">
                  Upload from ...
                </h6>
              </li>

              <li>
                <input
                  type="file"
                  id="uploadMarkdown"
                  style="display: none;"
                >
                <button
                  class="btn dropdown-item btn-link"
                  @click="upload"
                >
                  README.md
                </button>
              </li>
              <li>
                <input
                  type="file"
                  id="uploadZip"
                  style="display: none;"
                >
                <button
                  class="btn dropdown-item btn-link"
                  @click="uploadZip"
                >
                  Project.zip
                </button>
              </li-->
              <li>
                <hr class="dropdown-divider" />
              </li>
              <li>
                <h6 class="dropdown-header fw-light">Export to...</h6>
              </li>
              <li>
                <span
                  class="d-inline-block"
                  style="width: 100%"
                  tabindex="0"
                  data-toggle="tooltip"
                  title="Fork this document before you can use this function"
                >
                  <a
                    class="btn dropdown-item btn-link"
                    :class="{ disabled: !storageId }"
                    aria-current="page"
                    target="_blank"
                    :href="urlPath(['export', 'github', storageId])"
                    title="Store the document on github"
                    aria-label="Store the document on GitHub as a gist"
                  >
                    GitHub gist
                  </a>
                </span>
              </li>
              <li>
                <span
                  class="d-inline-block"
                  style="width: 100%"
                  tabindex="0"
                  data-toggle="tooltip"
                  title="Fork this document before you can use this function"
                >
                  <button
                    class="btn dropdown-item btn-link"
                    @click="nostr"
                    aria-label="Share the current content on Nostr"
                  >
                    Nostr
                  </button>
                </span>
              </li>
            </ul>
          </div>

          <div class="nav-item dropdown me-4">
            <button
              class="btn badge dropdown-toggle p-3"
              :class="conn.users === 0 ? 'bg-secondary' : 'bg-primary'"
              data-bs-toggle="dropdown"
              aria-expanded="false"
              style="width: 100%"
              :aria-label="
                conn.type === 'Offline'
                  ? 'The editor is used in offline mode, which means that you are the only one editing'
                  : `The editor is in collaborative mode via ${conn.type}, which means that you can share the URL and start editing with others`
              "
            >
              {{ conn.type }}
              <i class="bi bi-people-fill mx-1"></i>
              <span class="mx-1">
                {{ conn.users > 0 ? conn.users : "" }}
              </span>
            </button>

            <ul class="dropdown-menu">
              <li>
                <a
                  class="btn dropdown-item btn-link"
                  :class="{ disabled: !storageId }"
                  aria-current="page"
                  :href="this.urlPath(['edit', storageId])"
                  aria-label="Turn off collaborative editing and switch to offline mode"
                >
                  Offline
                </a>
              </li>

              <li>
                <a
                  class="btn dropdown-item btn-link"
                  :class="{ disabled: !storageId }"
                  aria-current="page"
                  :href="this.urlPath(['edit', storageId, 'webrtc'])"
                  aria-label="Switch to collaborative editing via WebRTC"
                >
                  WebRTC
                </a>
              </li>
              <li>
                <a
                  class="btn dropdown-item btn-link"
                  :class="{ disabled: !storageId }"
                  aria-current="page"
                  :href="this.urlPath(['edit', storageId, 'websocket'])"
                  aria-label="Switch to collaborative editing via Websocket"
                >
                  Websocket
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </nav>

  <div class="container p-0" style="max-width: 100%">
    <splitpanes
      id="liascript-ide"
      class="default-theme"
      style="height: calc(100vh - 56px)"
      @resize="resizing = true"
      @resized="resizing = false"
      :horizontal="horizontal"
    >
      <pane
        :hidden="mode > 0"
        style="border-right: solid lightgray 2px"
        :class="{
          fullHeight: mode < 0 && horizontal,
          fullWidth: mode < 0 && !horizontal,
        }"
      >
        <Editor
          class="col w-100 p-0 h-100"
          @compile="compile"
          @ready="editorReady"
          @online="online"
          @goto="gotoPreview"
          :storage-id="$props.storageId"
          :content="$props.content"
          ref="editor"
          :connection="$props.connection"
          :toolbar="!$props.embed"
        >
        </Editor>
      </pane>

      <pane
        :hidden="mode < 0"
        :class="{
          fullHeight: mode > 0 && horizontal,
          fullWidth: mode > 0 && !horizontal,
        }"
      >
        <div
          v-show="previewNotReady"
          style="position: absolute; background-color: white; width: 50%; height: 100%"
        >
          <div
            class="spinner-grow"
            style="
              width: 5rem;
              height: 5rem;
              margin-top: 50%;
              margin-left: 45%;
              margin-right: 45%;
            "
            role="status"
          >
            <span class="visually-hidden">Loading...</span>
          </div>
        </div>

        <div
          v-show="resizing"
          style="position: absolute; width: 100%; height: 100%"
        ></div>

        <Preview
          @ready="previewReady"
          @update="previewUpdate"
          @goto="gotoEditor"
          :fetchError="fetchError"
          :class="{ invisible: previewNotReady }"
        />
      </pane>
    </splitpanes>
  </div>

  <Modal ref="modal" />
  <NostrModal
    ref="nostrModal"
    :visible="nostrModalVisible"
    :storageId="$props.storageId"
    :courseUrl="LiaScriptURL"
    @close="nostrModalVisible = false"
  />
</template>

<style scoped>
#liascript {
  height: 100vh;
}

.invisible {
  visibility: hidden;
}

.fullWidth {
  min-width: 100%;
}

.fullHeight {
  min-height: calc(100% - 10px);
}

@media (max-width: 460px) {
  .btn {
    padding: 0.2rem 0.4rem;
  }
}

#lia-edit {
  margin-left: 10px;
}

@media (max-width: 418px) {
  #lia-edit {
    display: none;
  }
  .btn {
    padding: 0.2rem 0.4rem;
  }
}
</style>

<style>
.splitpanes__splitter {
  background-color: #f8f9fa !important;
}

.splitpanes--vertical > .splitpanes__splitter {
  min-width: 10px;
}

.splitpanes--horizontal > .splitpanes__splitter {
  min-height: 10px;
}
</style>
