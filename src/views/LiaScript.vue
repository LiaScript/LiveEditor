<script lang="ts">
import { tutorial } from "../ts/Tutorial";
import Dexie from "../ts/indexDB";

import Editor from "../components/Editor.vue";
import FileExplorer from "../components/FileExplorer.vue";
import Preview from "../components/Preview.vue";
import Modal from "../components/Modal.vue";
// shrink-string, pako and jszip are only needed for the export/share actions,
// so they are loaded on demand (see shareData/shareCode/embedCode/downloadZip)
// to keep them out of the editor's startup bundle.

import { Splitpanes, Pane } from "splitpanes";
import "splitpanes/dist/splitpanes.css";

import { defineAsyncComponent } from "vue";
import { LiaScriptURL } from "../ts/utils";
const NostrModal = defineAsyncComponent(() => import("./Export/Nostr.vue"));

import logoImg from "url:../../assets/logo.png";

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
      // Gate the (heavy) LiaScript preview iframe so its runtime only boots once
      // the editor is interactive — see editorReady(). Avoids both competing for
      // the main thread on startup.
      loadPreview: false,
      compilationCounter: 0,
      currentMode: this.$props.mode || 0,
      editorIsReady: false,
      database,
      meta: {},
      onlineUsers: 0,
      conn: {
        type: connectionType,
        users: 0,
      },
      resizing: false,
      LiaScriptURL,
      nostrModalVisible: false,
      showFiles: false,
      showToolbar: true,
    };
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

    changeLocale(locale: string) {
      this.$i18n.locale = locale;
      localStorage.setItem('locale', locale);
    },

    urlPath(path: string[]) {
      return window.location.origin + window.location.pathname + "?/" + path.join("/");
    },

    online(users: number) {
      this.conn.users = users;
    },

    // Open the main course document in the editor.
    openMainDoc() {
      (this.$refs.editor as any)?.openMain();
      if (this.currentMode > 0) this.currentMode = 0;
    },

    // Open a file selected in the explorer as the active document: text files
    // become editable, images are displayed.
    openAsset(asset: { path: string; mime?: string }) {
      (this.$refs.editor as any)?.openPath(asset.path, asset.mime);
      if (this.currentMode > 0) this.currentMode = 0;
    },

    changeMode(mode: number) {
      this.currentMode = mode;
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
        this.$t('modal.collaborationTitle'),
        `${this.$t('modal.collaborationBody')}
        <hr>
        <a target="_blank" href="${link}">${link}</a>`
      );
    },

    shareFile() {
      const fileUrl = prompt(this.$t('prompt.shareFileUrl'), "");

      if (!fileUrl) return;

      this.$refs.modal.show(
        this.$t('modal.externalResourceTitle'),
        `${this.$t('modal.externalResourceBody')}
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
          LiaScriptURL + "?data:text/plain;base64," + btoa(this.$refs.editor.getMainValue());

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
          encodeURIComponent(this.$refs.editor.getMainValue());

        uriEncode =
          this.bytesInfo(uriEncode) +
          `<a target="_blank" style="word-break: break-all" href="${uriEncode}">
          ${uriEncode}
        </a>`;
      } catch (e) {}

      try {
        const pako = (await import("pako")).default;
        gzip = pako.gzip(this.$refs.editor.getMainValue());
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
        this.$t('modal.dataProtocolTitle'),
        `${this.$t('modal.dataProtocolBody')}
        <hr>
        ${gzip}
        <hr>
        ${base64}
        <hr>
        ${uriEncode}`
      );
    },

    async shareCode() {
      const { compress } = await import("shrink-string");
      const zipCode = this.urlPath([
        "show",
        "code",
        await compress(this.$refs.editor.getMainValue()),
      ]);

      this.$refs.modal.show(
        this.$t('modal.snapshotTitle'),
        `${this.$t('modal.snapshotBody')}
        <hr>
        ${this.bytesInfo(zipCode)}
        <a target="_blank" style="word-break: break-all" href="${zipCode}">${zipCode}</a>`
      );
    },

    async embedCode() {
      const { compress } = await import("shrink-string");
      const zipCode = this.urlPath([
        "embed",
        "code",
        await compress(this.$refs.editor.getMainValue()),
      ]);

      const base64 = this.urlPath([
        "embed",
        "code",
        btoa(unescape(encodeURIComponent(this.$refs.editor.getMainValue()))),
      ]);

      this.$refs.modal.show(
        this.$t('modal.embedTitle'),
        `${this.$t('modal.embedBody')}<br>
        <code>?/embed/code/edit</code> or <code>?/embed/code/preview</code>
        <hr>
        ${this.bytesInfo(zipCode)}
        <code style="word-break: break-all">&lt;iframe style="height: 80vh; min-width: 100%; border: 1px black solid" src="${zipCode}"&gt;&lt;/iframe&gt;</code>
        <hr>
        <p>This code can be generated externally via: <code>btoa(unescape(encodeURIComponent(string)))</code></p>
        ${this.bytesInfo(base64)}
        <code style="word-break: break-all">&lt;iframe style="height: 80vh; min-width: 100%; border: 1px black solid" src="${base64}"&gt;&lt;/iframe&gt;</code>`
      );
    },

    download() {
      const element = document.createElement("a");
      element.setAttribute(
        "href",
        "data:text/plain;charset=utf-8," +
          encodeURIComponent(this.$refs.editor.getMainValue())
      );
      element.setAttribute("download", "README.md");
      element.style.display = "none";
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
    },

    async downloadZip() {
      const JSZip = (await import("jszip")).default;
      const zip = JSZip();

      zip.file("README.md", this.$refs.editor.getMainValue());

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

    compile() {
      if (this.preview && this.editorIsReady) {
        console.log("liascript: compile");

        // Always render the main course, no matter which file is active.
        let code = this.$refs.editor.getMainValue();

        if (code.trim().length == 0) {
          code = tutorial;
        }

        this.preview.focusOnMain = false;
        this.preview.scrollUpOnMain = false;

        this.preview.jit(this.rewriteLocalResources(code));
      }
    },

    // The dev/prod server answers unknown paths with the SPA index.html (status
    // 200), so a `<script src="repo.js">` "loads" the wrong content and never
    // fires onerror -> the fetchError redirect can't kick in. To make local
    // libraries/styles work, we inline `script:`/`link:` header references that
    // point to project files as self-contained data: URLs before compiling.
    rewriteLocalResources(code: string) {
      const header = code.match(/<!--[\s\S]*?-->/);
      if (!header) return code;

      const rewritten = header[0].replace(
        /^([ \t]*(?:script|link):[ \t]*)(\S+)[ \t]*$/gim,
        (full: string, prefix: string, value: string) => {
          const url = this.localDataUrl(value);
          return url ? prefix + url : full;
        }
      );

      return rewritten === header[0] ? code : code.replace(header[0], rewritten);
    },

    localDataUrl(value: string): string | null {
      // leave remote/embedded references untouched
      if (/^(https?:|data:|blob:|\/\/)/i.test(value)) return null;

      const bytes = (this.$refs.editor as any)?.getBlob(value);
      if (!bytes) return null;

      return "data:" + this.mimeForPath(value) + ";base64," + this.bytesToBase64(bytes);
    },

    mimeForPath(path: string): string {
      switch (path.split(".").pop()?.toLowerCase()) {
        case "js":
        case "mjs":
        case "cjs":
          return "text/javascript";
        case "css":
          return "text/css";
        case "json":
          return "application/json";
        case "svg":
          return "image/svg+xml";
        default:
          return "application/octet-stream";
      }
    },

    bytesToBase64(bytes: Uint8Array): string {
      let binary = "";
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode.apply(
          null,
          bytes.subarray(i, i + chunk) as unknown as number[]
        );
      }
      return btoa(binary);
    },

    fetchError(src: string) {
      // Local resources (script:/link:/images) are requested by LiaScript as
      // absolute same-origin URLs, e.g. "http://localhost:4321/repo.js". Map
      // them back to a project-relative path so they can be resolved from the
      // editor's virtual file system (yjs).
      const origin = window.location.origin;
      if (src.indexOf(origin) === 0) {
        src = src.slice(origin.length);
      }
      return this.$refs.editor.getBlob(src);
    },

    editorReady() {
      console.log("liascript: editor ready");
      this.editorIsReady = true;
      // compile() guards on (preview && editorIsReady); whichever of editor /
      // preview becomes ready last triggers the single initial compile.
      this.compile();
      // Boot the preview iframe (LiaScript runtime) only now that the editor is
      // interactive, one frame later so the editor can paint first.
      requestAnimationFrame(() => {
        this.loadPreview = true;
      });
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
          const titleMatch = this.$refs.editor.getMainValue().match(/^# (.+)/m);

          if (titleMatch) params.title = titleMatch[1];

          this.database.put(this.$props.storageId, params);
        }
      }
    },
  },

  components: { Editor, FileExplorer, Modal, Pane, Preview, Splitpanes, NostrModal },
};
</script>

<template>
  <nav class="navbar navbar-expand-lg bg-light">
    <div class="container-fluid">
      <a v-if="!embed" class="navbar-brand" href="./" data-link="true">
        <img :src="logoImg" alt="LiaScript" height="28" />
        <span id="lia-edit">{{ $t('app.title') }}</span>
      </a>
      <span v-else class="navbar-brand">
        <img :src="logoImg" alt="LiaScript" height="28" />
        <span id="lia-edit">{{ $t('app.demo') }}</span>
      </span>

      <div
        class="btn-toolbar btn-group-sm"
        role="toolbar"
        :aria-label="$t('nav.toolbar.ariaLabel')"
      >
        <div
          class="btn-group btn-group-sm btn-outline-secondary me-2"
          role="group"
          :aria-label="$t('nav.toolbar.radioGroupAria')"
        >
          <input
            type="radio"
            class="btn-check"
            name="btnradio"
            id="btnradio1"
            autocomplete="off"
            @click="changeMode(-1)"
            :checked="currentMode < 0"
          />
          <label class="btn btn-sm btn-outline-secondary" for="btnradio1" :title="$t('nav.toolbar.editorOnly')">
            <i class="bi bi-pencil"></i>
          </label>

          <input
            type="radio"
            class="btn-check"
            name="btnradio"
            id="btnradio2"
            autocomplete="off"
            :checked="currentMode === 0"
            @click="changeMode(0)"
          />
          <label class="btn btn-sm btn-outline-secondary" for="btnradio2" :title="$t('nav.toolbar.splitView')">
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
            :checked="currentMode > 0"
          />
          <label class="btn btn-sm btn-outline-secondary" for="btnradio3" :title="$t('nav.toolbar.previewOnly')">
            <i class="bi bi-eye"></i>
          </label>
        </div>
      </div>

      <button
        type="button"
        class="btn btn-sm btn-outline-secondary me-2"
        @click="compile()"
        :title="$t('nav.toolbar.compile')"
      >
        <i class="bi bi-arrow-counterclockwise"></i>
      </button>

      <div class="btn-group btn-group-sm me-2" role="group" aria-label="Language">
        <button
          type="button"
          class="btn btn-outline-secondary"
          :class="{ active: $i18n.locale === 'en' }"
          @click="changeLocale('en')"
        >EN</button>
        <button
          type="button"
          class="btn btn-outline-secondary"
          :class="{ active: $i18n.locale === 'de' }"
          @click="changeLocale('de')"
        >DE</button>
      </div>

      <!-- Drop-Down Navigation -->

      <button
        v-if="!embed"
        class="navbar-toggler btn btn-sm btn-outline-secondary me-2"
        type="button"
        data-bs-toggle="collapse"
        data-bs-target="#navbarSupportedContent"
        aria-controls="navbarSupportedContent"
        aria-expanded="false"
        :aria-label="$t('nav.toolbar.toggleNavAria')"
      >
        <i class="bi bi-list"></i>
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
              :title="$t('nav.help')"
              target="_blank"
            >
              <i class="bi bi-question"></i>
              {{ $t('nav.help') }}
            </a>
          </div>

          <div class="nav-item nav-item-sm ml-4 me-4">
            <button
              class="btn nav-link btn-link"
              aria-current="page"
              @click="newCourse"
              :title="$t('nav.new')"
            >
              <i class="bi bi-plus"></i>
              {{ $t('nav.new') }}
            </button>
          </div>

          <div class="nav-item me-4">
            <button
              type="button"
              class="btn nav-link btn-link"
              @click="fork"
              :title="$t('nav.fork')"
            >
              <i class="bi bi-signpost-split"></i>
              {{ $t('nav.fork') }}
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
              {{ $t('nav.menu') }}
            </a>

            <ul class="dropdown-menu">
              <li>
                <h6 class="dropdown-header fw-light">{{ $t('share.header') }}</h6>
              </li>
              <li>
                <span
                  class="d-inline-block"
                  tabindex="0"
                  data-toggle="tooltip"
                  :title="$t('share.collaborationLinkTooltip')"
                >
                  <button
                    class="btn dropdown-item btn-link"
                    @click="shareLink"
                    :disabled="!storageId"
                    :title="$t('share.collaborationLinkTitle')"
                  >
                    {{ $t('share.collaborationLink') }}
                  </button>
                </span>
              </li>
              <li>
                <button
                  class="btn dropdown-item btn-link"
                  @click="shareCode"
                  :aria-label="$t('share.snapshotUrlAria')"
                >
                  {{ $t('share.snapshotUrl') }}
                </button>
              </li>
              <li>
                <button
                  class="btn dropdown-item btn-link"
                  @click="embedCode"
                  :aria-label="$t('share.embedCodeAria')"
                >
                  {{ $t('share.embedCode') }}
                </button>
              </li>
              <li>
                <button
                  class="btn dropdown-item btn-link"
                  @click="shareFile"
                  :aria-label="$t('share.externalResourceAria')"
                >
                  {{ $t('share.externalResource') }}
                </button>
              </li>
              <li>
                <hr class="dropdown-divider" />
              </li>
              <li>
                <h6 class="dropdown-header fw-light">{{ $t('share.courseHeader') }}</h6>
              </li>
              <li>
                <span
                  class="d-inline-block"
                  tabindex="0"
                  data-toggle="tooltip"
                  :title="$t('share.githubGistLinkTooltip')"
                >
                  <a
                    class="dropdown-item"
                    :class="{ disabled: !meta.meta?.gist_url }"
                    :href="LiaScriptURL + '?' + meta.meta?.gist_url"
                    target="_blank"
                    :aria-label="$t('share.githubGistLinkAria')"
                  >
                    {{ $t('share.githubGistLink') }}
                  </a>
                </span>
              </li>
              <li>
                <button
                  class="btn dropdown-item btn-link"
                  @click="shareData"
                  :aria-label="$t('share.dataUriAria')"
                >
                  {{ $t('share.dataUri') }}
                </button>
              </li>
              <li>
                <div
                  class="d-inline-block"
                  tabindex="0"
                  style="width: 100%"
                  data-toggle="tooltip"
                  :title="$t('share.fileUrlTooltip')"
                >
                  <a
                    class="btn dropdown-item btn-link"
                    :class="{ disabled: !fileUrl }"
                    :href="LiaScriptURL + '?' + fileUrl"
                    target="_blank"
                    :title="$t('share.fileUrlTitle')"
                  >
                    {{ $t('share.fileUrl') }}
                  </a>
                </div>
              </li>
              <li>
                <hr class="dropdown-divider" />
              </li>
              <li>
                <h6 class="dropdown-header fw-light">{{ $t('share.downloadHeader') }}</h6>
              </li>
              <li>
                <button
                  class="btn dropdown-item btn-link"
                  @click="download"
                  :title="$t('share.downloadReadme')"
                  :aria-label="$t('share.downloadReadme')"
                >
                  README.md
                </button>
              </li>
              <li>
                <button
                  class="btn dropdown-item btn-link"
                  @click="downloadZip"
                  :title="$t('share.downloadZip')"
                  :aria-label="$t('share.downloadZip')"
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
                <h6 class="dropdown-header fw-light">{{ $t('share.exportHeader') }}</h6>
              </li>
              <li>
                <span
                  class="d-inline-block"
                  style="width: 100%"
                  tabindex="0"
                  data-toggle="tooltip"
                  :title="$t('share.githubGistTooltip')"
                >
                  <a
                    class="btn dropdown-item btn-link"
                    :class="{ disabled: !storageId }"
                    aria-current="page"
                    target="_blank"
                    :href="urlPath(['export', 'github', storageId])"
                    :title="$t('share.githubGistTitle')"
                    :aria-label="$t('share.githubGistAria')"
                  >
                    {{ $t('share.githubGist') }}
                  </a>
                </span>
              </li>
              <li>
                <span
                  class="d-inline-block"
                  style="width: 100%"
                  tabindex="0"
                  data-toggle="tooltip"
                  :title="$t('share.githubGistTooltip')"
                >
                  <button
                    class="btn dropdown-item btn-link"
                    @click="nostr"
                    :aria-label="$t('share.nostrAria')"
                  >
                    Nostr
                  </button>
                </span>
              </li>
            </ul>
          </div>

          <div class="nav-item dropdown me-4 d-flex align-items-center">
            <button
              class="btn btn-sm badge dropdown-toggle"
              :class="conn.users === 0 ? 'bg-secondary' : 'bg-primary'"
              data-bs-toggle="dropdown"
              aria-expanded="false"
              style="width: 100%"
              :aria-label="
                conn.type === 'Offline'
                  ? $t('nav.connection.offlineAria')
                  : $t('nav.connection.onlineAria', { type: conn.type })
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
                  :aria-label="$t('nav.connection.switchOfflineAria')"
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
                  :aria-label="$t('nav.connection.switchWebRTCAria')"
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
                  :aria-label="$t('nav.connection.switchWebSocketAria')"
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
        :hidden="currentMode > 0"
        style="border-right: solid lightgray 2px"
        :class="{
          fullHeight: currentMode < 0 && horizontal,
          fullWidth: currentMode < 0 && !horizontal,
        }"
      >
        <div class="lia-editor-area">
          <div v-if="$props.storageId && !$props.embed" class="lia-activity-bar">
            <button
              class="btn btn-sm btn-outline-secondary"
              type="button"
              :class="{ active: showToolbar }"
              :title="showToolbar ? $t('nav.activityBar.hideToolbar') : $t('nav.activityBar.showToolbar')"
              @click="showToolbar = !showToolbar"
            >
              <i class="bi bi-layout-text-window-reverse"></i>
            </button>
            <button
              class="btn btn-sm btn-outline-secondary"
              type="button"
              :class="{ active: showFiles }"
              :title="showFiles ? $t('nav.activityBar.hideFiles') : $t('nav.activityBar.showFiles')"
              @click="showFiles = !showFiles"
            >
              <i class="bi bi-layout-text-sidebar-reverse"></i>
            </button>
          </div>

          <FileExplorer
            v-if="$props.storageId && !$props.embed"
            v-show="showFiles"
            class="lia-files-panel"
            :storage-id="$props.storageId"
            :connection="$props.connection"
            @open-main="openMainDoc"
            @open-asset="openAsset"
          />

          <div class="lia-editor-pane">
            <Editor
              @compile="compile"
              @ready="editorReady"
              @online="online"
              @goto="gotoPreview"
              :storage-id="$props.storageId"
              :content="$props.content"
              ref="editor"
              :connection="$props.connection"
              :toolbar="!$props.embed && ($props.storageId ? showToolbar : true)"
            >
            </Editor>
          </div>
        </div>
      </pane>

      <pane
        :hidden="currentMode < 0"
        :class="{
          fullHeight: currentMode > 0 && horizontal,
          fullWidth: currentMode > 0 && !horizontal,
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
            <span class="visually-hidden">{{ $t('preview.loading') }}</span>
          </div>
        </div>

        <div
          v-show="resizing"
          style="position: absolute; width: 100%; height: 100%"
        ></div>

        <Preview
          v-if="loadPreview"
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

.lia-editor-area {
  display: flex;
  flex-direction: row;
  height: 100%;
  width: 100%;
  overflow: hidden;
}

.lia-activity-bar {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 4px;
  background-color: #ececec;
  border-right: solid lightgray 1px;
  gap: 4px;
}

.lia-activity-bar .btn.active {
  background-color: var(--bs-secondary, #6c757d);
  color: #fff;
}

.lia-files-panel {
  flex: 0 0 240px;
  width: 240px;
  max-width: 50%;
  height: 100%;
}

.lia-editor-pane {
  flex: 1 1 auto;
  min-width: 0;
  height: 100%;
  overflow: hidden;
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
