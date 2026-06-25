<script lang="ts">
import { tutorial } from "../ts/Tutorial";
import Dexie from "../ts/indexDB";

import Editor from "../components/Editor.vue";
import FileExplorer from "../components/FileExplorer.vue";
import Preview from "../components/Preview.vue";
import Modal from "../components/Modal.vue";
import LanguageDropdown from "../components/LanguageDropdown.vue";
import ImportMenu from "../components/ImportMenu.vue";
import ShareModal from "../components/ShareModal.vue";
// shrink-string, pako and jszip are only needed for the export/share actions,
// so they are loaded on demand (see shareData/shareCode/embedCode/downloadZip)
// to keep them out of the editor's startup bundle.

import { Splitpanes, Pane } from "splitpanes";
import "splitpanes/dist/splitpanes.css";

import { defineAsyncComponent } from "vue";
import { LiaScriptURL, buildProjectZip } from "../ts/utils";
const NostrModal = defineAsyncComponent(() => import("./Export/Nostr.vue"));
const ExporterModal = defineAsyncComponent(() => import("./Export/Exporter.vue"));
const GitHubImportModal = defineAsyncComponent(() => import("./GitHub/ImportModal.vue"));
const GitHubPushModal = defineAsyncComponent(() => import("./GitHub/PushModal.vue"));
const GitHubPullModal = defineAsyncComponent(() => import("./GitHub/PullModal.vue"));
const GitHubPublishModal = defineAsyncComponent(() => import("./GitHub/PublishModal.vue"));
const LocalFolderSyncModal = defineAsyncComponent(() => import("./LocalFolder/SyncModal.vue"));

import * as LocalFolder from "../ts/LocalFolder";
import { detectGitHubRemote } from "../ts/localFolderSync";
import { SYNC_ON_OPEN_KEY } from "../ts/createProject";

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
      activeFilePath: "README.md",
      // resolved path of the document currently shown in the preview; used to
      // export the right file and to surface its gist/nostr share state
      previewFilePath: "",
      nostrModalVisible: false,
      exporterVisible: false,
      githubImportVisible: false,
      githubPushVisible: false,
      githubPullVisible: false,
      githubPublishVisible: false,
      localFolderSyncVisible: false,
      showFiles: false,
      showToolbar: true,
    };
  },

  mounted() {
    window.addEventListener("resize", () => {
      this.horizontal =
        document.documentElement.clientWidth < document.documentElement.clientHeight;
    });

    // Opened straight from the index page's "local folder" import: pop the sync
    // dialog so the user can pull the folder's files into the fresh project.
    if (
      this.$props.storageId &&
      sessionStorage.getItem(SYNC_ON_OPEN_KEY) === this.$props.storageId
    ) {
      sessionStorage.removeItem(SYNC_ON_OPEN_KEY);
      this.localFolderSyncVisible = true;
    }
  },

  computed: {
    // basename of the active file (shown on the download menu entry)
    activeFileName(): string {
      return this.activeFilePath.split("/").pop() || this.activeFilePath;
    },

    // File System Access API is Chromium-only; gate the menu segment on it.
    localFolderSupported(): boolean {
      return LocalFolder.isSupported();
    },

    // A LiaScript course link to the currently active file, served from the
    // linked GitHub repository's raw URL. Empty when the project is not a repo.
    githubCourseUrl(): string {
      const gh = (this.meta as any)?.meta?.github;
      if (!gh?.owner || !gh?.repo || !gh?.branch) return "";
      const path = this.activeFilePath
        .split("/")
        .map((s: string) => encodeURIComponent(s))
        .join("/");
      const raw = `https://raw.githubusercontent.com/${gh.owner}/${gh.repo}/${gh.branch}/${path}`;
      return this.LiaScriptURL + "?" + raw;
    },

    // Gist raw URL of the file currently shown in the preview, if it has been
    // exported as a gist before (empty otherwise). Keyed per file so that each
    // document in a multi-file project keeps its own gist.
    gistLink(): string {
      const raw = (this.meta as any)?.meta?.gist_files?.[this.previewFilePath]?.raw_url;
      return raw ? this.LiaScriptURL + "?" + raw : "";
    },

    // LiaScript course URL of the file currently shown in the preview, if it has
    // been published to Nostr before (empty otherwise).
    nostrLink(): string {
      return (this.meta as any)?.meta?.nostr_files?.[this.previewFilePath]?.url || "";
    },

    // Tabbed structure consumed by ShareModal. Labels/descriptions reuse the
    // existing share.* / github.menu.* / localFolder.menu.* keys; `disabled`
    // mirrors the gates of the old dropdown (need a project / linked repo /
    // linked folder / a previous export). `href` items open an external link.
    shareTabs(): any[] {
      const noProject = !this.$props.storageId;
      const noRepo = !(this.meta as any)?.meta?.github;
      const noFolder = !(this.meta as any)?.meta?.localFolder;

      const tabs: any[] = [
        {
          id: "collaborate",
          labelKey: "share.tabs.collaborate",
          sections: [
            {
              items: [
                { id: "collaborationLink", icon: "bi-people", labelKey: "share.collaborationLink", descriptionKey: "share.collaborationLinkTitle", disabled: noProject },
                { id: "snapshotUrl", icon: "bi-camera", labelKey: "share.snapshotUrl", descriptionKey: "share.snapshotUrlAria" },
                { id: "embedCode", icon: "bi-code-slash", labelKey: "share.embedCode", descriptionKey: "share.embedCodeAria" },
                { id: "externalResource", icon: "bi-link-45deg", labelKey: "share.externalResource", descriptionKey: "share.externalResourceAria" },
              ],
            },
          ],
        },
        {
          id: "publish",
          labelKey: "share.tabs.publish",
          sections: [
            {
              items: [
                { id: "githubGist", icon: "bi-github", labelKey: "share.githubGist", descriptionKey: "share.githubGistTooltip", disabled: noProject },
                { id: "nostr", icon: "bi-broadcast", labelKey: "share.nostr", descriptionKey: "share.nostrAria" },
                { id: "dataUri", icon: "bi-link", labelKey: "share.dataUri", descriptionKey: "share.dataUriAria" },
              ],
            },
          ],
        },
        {
          id: "published",
          labelKey: "share.tabs.published",
          sections: [
            {
              items: [
                { id: "githubGistLink", icon: "bi-box-arrow-up-right", labelKey: "share.githubGistLink", descriptionKey: "share.githubGistLinkTooltip", href: this.gistLink, disabled: !this.gistLink },
                { id: "nostrLink", icon: "bi-box-arrow-up-right", labelKey: "share.nostrLink", descriptionKey: "share.nostrLinkTooltip", href: this.nostrLink, disabled: !this.nostrLink },
                { id: "githubRepoFile", icon: "bi-box-arrow-up-right", label: this.$t("share.githubRepoFile", { file: this.activeFileName }), descriptionKey: "share.githubRepoFileTooltip", href: this.githubCourseUrl, disabled: !this.githubCourseUrl },
                { id: "fileUrl", icon: "bi-box-arrow-up-right", labelKey: "share.fileUrl", descriptionKey: "share.fileUrlTooltip", href: this.$props.fileUrl ? this.LiaScriptURL + "?" + this.$props.fileUrl : "", disabled: !this.$props.fileUrl },
              ],
            },
          ],
        },
        {
          id: "github",
          labelKey: "share.tabs.github",
          sections: [
            {
              items: [
                { id: "githubImport", icon: "bi-box-arrow-in-down", labelKey: "github.menu.import", descriptionKey: "github.menu.importTooltip" },
                { id: "githubPublish", icon: "bi-cloud-upload", labelKey: "github.menu.publish", descriptionKey: "github.menu.publishTooltip", disabled: noProject },
                { id: "githubPush", icon: "bi-arrow-up-circle", labelKey: "github.menu.push", descriptionKey: "github.menu.pushTooltip", disabled: noRepo },
                { id: "githubPull", icon: "bi-arrow-down-circle", labelKey: "github.menu.pull", descriptionKey: "github.menu.pullTooltip", disabled: noRepo },
              ],
            },
          ],
        },
      ];

      if (this.localFolderSupported) {
        tabs.push({
          id: "localFolder",
          labelKey: "share.tabs.localFolder",
          sections: [
            {
              items: [
                { id: "openLocalFolder", icon: "bi-folder2-open", labelKey: "localFolder.menu.open", descriptionKey: "localFolder.menu.openTooltip", disabled: noProject },
                { id: "localFolderSync", icon: "bi-arrow-down-up", labelKey: "localFolder.menu.sync", descriptionKey: "localFolder.menu.syncTooltip", disabled: noFolder },
              ],
            },
          ],
        });
      }

      // Export is the last tab: the LiaScript Exporter (format conversion) plus
      // the plain file downloads — i.e. every way to get the content "out".
      tabs.push({
        id: "export",
        labelKey: "share.tabs.export",
        sections: [
          {
            items: [
              { id: "exporter", icon: "bi-box-arrow-up-right", labelKey: "share.exporter", descriptionKey: "share.exporterTooltip", disabled: noProject },
              { id: "downloadZip", icon: "bi-file-zip", labelKey: "share.downloadZipLabel", descriptionKey: "share.downloadZip" },
              { id: "downloadReadme", icon: "bi-file-earmark-text", label: this.activeFileName, descriptionKey: "share.downloadActiveFileInfo" },
            ],
          },
        ],
      });

      return tabs;
    },
  },

  methods: {
    openShare() {
      (this.$refs.shareModal as any)?.open();
    },

    // Map a card id from ShareModal back to the existing action methods.
    onShareAction(id: string) {
      const actions: Record<string, () => void> = {
        collaborationLink: () => this.shareLink(),
        snapshotUrl: () => this.shareCode(),
        embedCode: () => this.embedCode(),
        externalResource: () => this.shareFile(),
        githubGist: () => this.githubGist(),
        nostr: () => this.nostr(),
        exporter: () => this.exporter(),
        dataUri: () => this.shareData(),
        downloadZip: () => this.downloadZip(),
        downloadReadme: () => this.download(),
        githubImport: () => this.githubImport(),
        githubPublish: () => this.githubPublish(),
        githubPush: () => this.githubPush(),
        githubPull: () => this.githubPull(),
        openLocalFolder: () => this.openLocalFolder(),
        localFolderSync: () => this.localFolderSync(),
      };
      actions[id]?.();
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

    // Persist which file is currently shown in the preview, then open the Gist
    // export route in a new tab. Storing the path in IndexedDB lets the separate
    // export page (and the GitHub OAuth round-trip) pick up the active document
    // instead of always exporting the main README.md.
    async githubGist() {
      if (!this.$props.storageId) return;
      await this.database?.put(this.$props.storageId, {
        gist_export_path: this.previewFilePath,
      });
      window.open(this.urlPath(["export", "github", this.$props.storageId]), "_blank");
    },

    githubImport() {
      this.githubImportVisible = true;
    },

    githubPublish() {
      this.githubPublishVisible = true;
    },

    githubPush() {
      if ((this.meta as any)?.meta?.github) this.githubPushVisible = true;
    },

    githubPull() {
      if ((this.meta as any)?.meta?.github) this.githubPullVisible = true;
    },

    // keep the locally stored repo link in sync after a push/pull
    onGithubUpdated(link: any) {
      const meta = (this.meta as any)?.meta;
      if (meta) meta.github = link;
    },

    // --- local folder (File System Access API) -------------------------------
    // Pick a folder and link it to this project. The handle is persisted (in a
    // separate IndexedDB store) so the link survives reloads; only the display
    // name is stored in the project meta to surface the "connected" state.
    async openLocalFolder() {
      if (!this.$props.storageId) return;
      try {
        const handle = await LocalFolder.pickFolder();
        await LocalFolder.saveHandle(this.$props.storageId, handle);
        const update: any = { localFolder: { name: handle.name } };
        // If the folder is a GitHub clone and the project isn't linked to a repo
        // yet, adopt that link so the user can push straight to GitHub.
        if (!(this.meta as any)?.meta?.github) {
          const repo = await detectGitHubRemote(handle);
          if (repo) update.github = repo;
        }
        await this.database?.put(this.$props.storageId, update);
        this.localFolderSyncVisible = true;
      } catch (e) {
        // user dismissed the picker — nothing to do
      }
    },

    localFolderSync() {
      if ((this.meta as any)?.meta?.localFolder) this.localFolderSyncVisible = true;
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

      const activeValue = this.$refs.editor.getActiveValue();

      try {
        base64 =
          LiaScriptURL + "?data:text/plain;base64," + btoa(activeValue);

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
          encodeURIComponent(activeValue);

        uriEncode =
          this.bytesInfo(uriEncode) +
          `<a target="_blank" style="word-break: break-all" href="${uriEncode}">
          ${uriEncode}
        </a>`;
      } catch (e) {}

      try {
        const pako = (await import("pako")).default;
        gzip = pako.gzip(activeValue);
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
        await compress(this.$refs.editor.getActiveValue()),
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
      const activeValue = this.$refs.editor.getActiveValue();
      const zipCode = this.urlPath([
        "embed",
        "code",
        await compress(activeValue),
      ]);

      const base64 = this.urlPath([
        "embed",
        "code",
        btoa(unescape(encodeURIComponent(activeValue))),
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
      // download whatever file is currently active (markdown, code, image,
      // audio, ...), falling back to the main course document
      const file = this.$refs.editor.getActiveDownload();
      const blob = new Blob([file.data], {
        type: file.mime || "application/octet-stream",
      });
      const url = URL.createObjectURL(blob);
      const element = document.createElement("a");
      element.href = url;
      element.download = file.name;
      element.style.display = "none";
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },

    async downloadZip() {
      const fileName =
        "Project-" + (this.$props?.storageId?.slice(0, 8) || "xxxxxxxx") + ".zip";

      // buildProjectZip bundles the main document (as README.md) plus all
      // explorer files — the same bundle the LiaScript-Exporter integration ships.
      const file = await buildProjectZip(
        this.$refs.editor.getMainValue(),
        this.$refs.editor.getAllBlobs(),
        fileName
      );

      const url = URL.createObjectURL(file);
      const element = document.createElement("a");
      element.href = url;
      element.setAttribute("download", fileName);
      element.style.display = "none";
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
      setTimeout(() => URL.revokeObjectURL(url), 30 * 1000);
    },

    exporter() {
      this.exporterVisible = true;
    },

    fork() {
      this.$refs.editor.fork();
    },

    compile() {
      if (this.preview && this.editorIsReady) {
        console.log("liascript: compile");

        // Render the markdown document currently selected for preview (the main
        // course by default; another markdown file once the user switches).
        let code = this.$refs.editor.getPreviewValue();

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

  components: {
    Editor,
    FileExplorer,
    Modal,
    Pane,
    Preview,
    Splitpanes,
    NostrModal,
    ExporterModal,
    LanguageDropdown,
    ImportMenu,
    ShareModal,
    GitHubImportModal,
    GitHubPushModal,
    GitHubPullModal,
    GitHubPublishModal,
    LocalFolderSyncModal,
  },
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

      <div class="flex-grow-1 d-flex justify-content-center">
        <LanguageDropdown />
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

      <div v-if="!embed" class="collapse navbar-collapse flex-grow-0" id="navbarSupportedContent">
        <!-- SPAN -->
        <div class="navbar-nav me-auto mb-lg-0"></div>

        <div class="navbar-nav mb-2 mb-lg-0">
          <div class="nav-actions-row">
          <div class="nav-item nav-item-sm ms-2 me-2">
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

          <div class="nav-item nav-item-sm ms-2 me-2 d-flex align-items-center">
            <ImportMenu />
          </div>

          <div class="nav-item ms-2 me-2">
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
          </div>

          <div class="nav-item ms-2 me-2 d-flex align-items-center">
            <button
              type="button"
              class="btn nav-link btn-link"
              @click="openShare"
              :title="$t('nav.menu')"
            >
              <i class="bi bi-box-arrow-up"></i>
              {{ $t('nav.menu') }}
            </button>
          </div>

          <div class="nav-item dropdown ms-2 me-2 d-flex align-items-center flex-wrap">
            <button
              class="btn btn-sm dropdown-toggle text-white"
              :class="conn.users === 0 ? 'bg-secondary' : 'bg-primary'"
              data-bs-toggle="dropdown"
              data-bs-display="static"
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
              @active="activeFilePath = $event"
              @preview="previewFilePath = $event"
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
  <ShareModal ref="shareModal" :tabs="shareTabs" @action="onShareAction" />
  <NostrModal
    ref="nostrModal"
    :visible="nostrModalVisible"
    :storageId="$props.storageId"
    :courseUrl="LiaScriptURL"
    :exportPath="previewFilePath"
    @close="nostrModalVisible = false"
  />
  <ExporterModal
    :visible="exporterVisible"
    :storageId="$props.storageId"
    :connection="$props.connection"
    @close="exporterVisible = false"
  />
  <GitHubImportModal
    :visible="githubImportVisible"
    :storageId="$props.storageId"
    :connection="$props.connection"
    @close="githubImportVisible = false"
  />
  <GitHubPublishModal
    v-if="$props.storageId"
    :visible="githubPublishVisible"
    :storageId="$props.storageId"
    :connection="$props.connection"
    :title="meta?.meta?.title"
    @close="githubPublishVisible = false"
    @updated="onGithubUpdated"
  />
  <GitHubPushModal
    v-if="meta?.meta?.github"
    :visible="githubPushVisible"
    :storageId="$props.storageId"
    :connection="$props.connection"
    :github="meta.meta.github"
    @close="githubPushVisible = false"
    @updated="onGithubUpdated"
  />
  <GitHubPullModal
    v-if="meta?.meta?.github"
    :visible="githubPullVisible"
    :storageId="$props.storageId"
    :connection="$props.connection"
    :github="meta.meta.github"
    @close="githubPullVisible = false"
    @updated="onGithubUpdated"
  />
  <LocalFolderSyncModal
    v-if="$props.storageId"
    :visible="localFolderSyncVisible"
    :storageId="$props.storageId"
    :connection="$props.connection"
    :folderName="meta?.meta?.localFolder?.name"
    @close="localFolderSyncVisible = false"
  />
</template>

<style scoped>
#liascript {
  height: 100vh;
}

/* help / new / fork in one row */
.nav-actions-row {
  display: flex;
}

/* below the navbar breakpoint (lg) the menu is stacked: keep these three in a
   single row and let them share the full width equally */
@media (max-width: 991.98px) {
  .nav-actions-row {
    width: 100%;
  }
  .nav-actions-row > .nav-item {
    flex: 1 1 0;
    margin-left: 0.25rem !important;
    margin-right: 0.25rem !important;
  }
  .nav-actions-row > .nav-item .nav-link {
    width: 100%;
    text-align: center;
  }
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
