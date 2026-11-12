<script lang="ts">
import { tutorialFor } from "../ts/Tutorial";
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
const GitLabImportModal = defineAsyncComponent(() => import("./GitLab/ImportModal.vue"));
const GitLabPushModal = defineAsyncComponent(() => import("./GitLab/PushModal.vue"));
const GitLabPullModal = defineAsyncComponent(() => import("./GitLab/PullModal.vue"));
const GitLabPublishModal = defineAsyncComponent(() => import("./GitLab/PublishModal.vue"));
const LocalFolderSyncModal = defineAsyncComponent(() => import("./LocalFolder/SyncModal.vue"));

import * as LocalFolder from "../ts/LocalFolder";
import { detectGitHubRemote, detectGitLabRemote } from "../ts/localFolderSync";
import { SYNC_ON_OPEN_KEY, BACKUP_ON_OPEN_KEY } from "../ts/createProject";
import {
  DEVICES,
  DEVICE_GROUPS,
  RESPONSIVE,
  findDevice,
  loadPreviewDevice,
  savePreviewDevice,
} from "../ts/previewDevices";

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
      this.unwatch = database.watch(this.$props.storageId, (meta) => {
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

    const previewDevice = loadPreviewDevice();

    return {
      logoImg,
      DEVICE_GROUPS,
      RESPONSIVE,
      previewDevice: previewDevice.device,
      previewLandscape: previewDevice.landscape,
      previewZoom: previewDevice.zoom,
      previewScaling: previewDevice.scaling,
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
      gitlabImportVisible: false,
      gitlabPushVisible: false,
      gitlabPullVisible: false,
      gitlabPublishVisible: false,
      localFolderSyncVisible: false,
      showFiles: false,
      showToolbar: true,
      showDevices: false,
    };
  },

  watch: {
    previewDeviceState(state) {
      savePreviewDevice(state);
    },

    // 200 % suits a 4K beamer, not a 240 px phone
    previewDevice() {
      this.previewScaling = 1;
    },
  },

  unmounted() {
    window.removeEventListener("resize", this.onResize);
    this.unwatch?.();
  },

  mounted() {
    window.addEventListener("resize", this.onResize);

    // Opened straight from the index page's "local folder" import: pop the sync
    // dialog so the user can pull the folder's files into the fresh project.
    if (
      this.$props.storageId &&
      sessionStorage.getItem(SYNC_ON_OPEN_KEY) === this.$props.storageId
    ) {
      sessionStorage.removeItem(SYNC_ON_OPEN_KEY);
      this.localFolderSyncVisible = true;
    }

    // "Back up" on an index card: show the download/export options right away
    if (
      this.$props.storageId &&
      sessionStorage.getItem(BACKUP_ON_OPEN_KEY) === this.$props.storageId
    ) {
      sessionStorage.removeItem(BACKUP_ON_OPEN_KEY);
      this.$nextTick(() => (this.$refs.shareModal as any)?.open("export"));
    }
  },

  computed: {
    currentDevice() {
      return findDevice(this.previewDevice);
    },

    previewDeviceState() {
      return {
        device: this.previewDevice,
        landscape: this.previewLandscape,
        zoom: this.previewZoom,
        scaling: this.previewScaling,
      };
    },

    // basename of the active file (shown on the download menu entry)
    activeFileName(): string {
      return this.activeFilePath.split("/").pop() || this.activeFilePath;
    },

    courseTitle(): string {
      return (this.meta as any)?.meta?.title || this.$t("card.untitled");
    },

    // plain-language name of the current collaboration mode
    connLabel(): string {
      switch (this.conn.type) {
        case "WebRTC":
          return this.$t("nav.connection.webrtc");
        case "WebSocket":
          return this.$t("nav.connection.websocket");
        default:
          return this.$t("nav.connection.solo");
      }
    },

    connTitle(): string {
      return this.conn.users > 0
        ? `${this.connLabel} · ${this.$t("nav.connection.users", { n: this.conn.users })}`
        : this.connLabel;
    },

    connOptions(): any[] {
      const id = this.$props.storageId;
      return [
        {
          id: "offline",
          path: ["edit", id],
          labelKey: "nav.connection.solo",
          descKey: "nav.connection.soloDesc",
          ariaKey: "nav.connection.switchOfflineAria",
          active: this.conn.type === "Offline",
        },
        {
          id: "webrtc",
          path: ["edit", id, "webrtc"],
          labelKey: "nav.connection.webrtc",
          descKey: "nav.connection.webrtcDesc",
          ariaKey: "nav.connection.switchWebRTCAria",
          tech: "WebRTC",
          active: this.conn.type === "WebRTC",
        },
        {
          id: "websocket",
          path: ["edit", id, "websocket"],
          labelKey: "nav.connection.websocket",
          descKey: "nav.connection.websocketDesc",
          ariaKey: "nav.connection.switchWebSocketAria",
          tech: "WebSocket",
          active: this.conn.type === "WebSocket",
        },
      ];
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

    // Same as githubCourseUrl, for a linked GitLab project.
    gitlabCourseUrl(): string {
      const gl = (this.meta as any)?.meta?.gitlab;
      if (!gl?.host || !gl?.projectPath || !gl?.branch) return "";
      const path = this.activeFilePath
        .split("/")
        .map((s: string) => encodeURIComponent(s))
        .join("/");
      const raw = `https://${gl.host}/${gl.projectPath}/-/raw/${gl.branch}/${path}`;
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

    // Groups for ShareModal, ordered by what the user wants to achieve. All
    // texts are translated here so items can interpolate ({service}, {file}).
    // `disabled` mirrors the old gates (need a saved project / linked repo /
    // linked folder); a disabled item names the reason and, where possible, the
    // action that unlocks it (`fix`).
    shareGroups(): any[] {
      const t = (key: string, values?: any) => this.$t(key, values) as string;
      const meta = (this.meta as any)?.meta || {};
      const noProject = !this.$props.storageId;

      const tag = {
        permanent: { text: t("share.tags.permanent"), tone: "good" },
        noAccount: { text: t("share.tags.noAccount"), tone: "good" },
        githubAccount: { text: t("share.tags.githubAccount") },
        shortOnly: { text: t("share.tags.shortOnly"), tone: "warn" },
        live: { text: t("share.tags.live"), tone: "good" },
        sameCourse: { text: t("share.tags.sameCourse") },
        ownCopy: { text: t("share.tags.ownCopy") },
        allFiles: { text: t("share.tags.allFiles"), tone: "good" },
      };

      // items that need a project stored in this browser
      const needsProject = (item: any) =>
        noProject
          ? {
              ...item,
              disabled: true,
              reason: t("share.reasons.noProject"),
              fix: { id: "fork", label: t("nav.fork") },
            }
          : item;

      const repoItems = (service: "GitHub" | "GitLab", prefix: string, linked: boolean) => {
        const s = { service };
        const notLinked = !linked && {
          disabled: true,
          reason: t("share.reasons.noRepo", s),
          fix: noProject ? undefined : { id: prefix + "Publish", label: t("share.actions.connectNow") },
        };
        return [
          needsProject({
            id: prefix + "Publish",
            icon: "bi-cloud-upload",
            label: t("share.items.repoPublish.label", s),
            desc: t("share.items.repoPublish.desc", s),
            tags: [tag.permanent, tag.allFiles],
            action: t("share.actions.createRepo"),
            primary: !linked,
          }),
          {
            id: prefix + "Push",
            icon: "bi-arrow-up-circle",
            label: t("share.items.repoPush.label", s),
            desc: t("share.items.repoPush.desc", s),
            tech: "Push",
            action: t("share.actions.push"),
            primary: linked,
            ...(notLinked || {}),
          },
          {
            id: prefix + "Pull",
            icon: "bi-arrow-down-circle",
            label: t("share.items.repoPull.label", s),
            desc: t("share.items.repoPull.desc", s),
            tech: "Pull",
            action: t("share.actions.pull"),
            ...(notLinked || {}),
          },
          {
            id: prefix + "Import",
            icon: "bi-box-arrow-in-down",
            label: t("share.items.repoImport.label", s),
            desc: t("share.items.repoImport.desc", s),
            action: t("share.actions.import"),
          },
        ];
      };

      // links to earlier publications: only the ones that exist are listed
      const published: any[] = [];
      if (this.gistLink)
        published.push({ id: "githubGistLink", icon: "bi-github", label: t("share.items.githubGistLink.label"), desc: t("share.items.githubGistLink.desc"), href: this.gistLink, action: t("share.actions.open") });
      if (this.nostrLink)
        published.push({ id: "nostrLink", icon: "bi-broadcast", label: t("share.items.nostrLink.label"), desc: t("share.items.nostrLink.desc"), href: this.nostrLink, action: t("share.actions.open") });
      if (this.githubCourseUrl)
        published.push({ id: "githubRepoFile", icon: "bi-github", label: t("share.githubRepoFile", { file: this.activeFileName }), desc: t("share.items.repoFile.desc"), href: this.githubCourseUrl, action: t("share.actions.open") });
      if (this.gitlabCourseUrl)
        published.push({ id: "gitlabRepoFile", icon: "bi-gitlab", label: t("share.gitlabRepoFile", { file: this.activeFileName }), desc: t("share.items.repoFile.desc"), href: this.gitlabCourseUrl, action: t("share.actions.open") });
      if (this.$props.fileUrl)
        published.push({ id: "fileUrl", icon: "bi-globe", label: t("share.items.fileUrl.label"), desc: t("share.items.fileUrl.desc"), href: this.LiaScriptURL + "?" + this.$props.fileUrl, action: t("share.actions.open") });

      const groups: any[] = [
        {
          id: "collaborate",
          icon: "bi-people",
          label: t("share.groups.collaborate.label"),
          sub: t("share.groups.collaborate.sub"),
          intro: t("share.groups.collaborate.intro"),
          sections: [
            {
              items: [
                needsProject({ id: "collaborationLink", icon: "bi-people", label: t("share.items.collaborationLink.label"), desc: t("share.items.collaborationLink.desc"), tags: [tag.live, tag.sameCourse], tech: "WebRTC", action: t("share.actions.showLink"), primary: true }),
                { id: "snapshotUrl", icon: "bi-copy", label: t("share.items.snapshotUrl.label"), desc: t("share.items.snapshotUrl.desc"), tags: [tag.ownCopy, tag.shortOnly], tech: "Snapshot-URL", action: t("share.actions.createLink") },
                { id: "externalResource", icon: "bi-link-45deg", label: t("share.items.externalResource.label"), desc: t("share.items.externalResource.desc"), action: t("share.actions.enterUrl") },
              ],
            },
          ],
        },
        {
          id: "publish",
          icon: "bi-globe",
          label: t("share.groups.publish.label"),
          sub: t("share.groups.publish.sub"),
          intro: t("share.groups.publish.intro"),
          sections: [
            {
              items: [
                needsProject({ id: "githubGist", icon: "bi-github", label: t("share.items.githubGist.label"), desc: t("share.items.githubGist.desc"), tags: [tag.permanent, tag.githubAccount], tech: "Gist", action: t("share.actions.save"), primary: true }),
                { id: "nostr", icon: "bi-broadcast", label: t("share.items.nostr.label"), desc: t("share.items.nostr.desc"), tags: [tag.permanent, tag.noAccount], tech: "Nostr", action: t("share.actions.publish") },
                { id: "dataUri", icon: "bi-link", label: t("share.items.dataUri.label"), desc: t("share.items.dataUri.desc"), tags: [tag.noAccount, tag.shortOnly], tech: "data-URI", action: t("share.actions.createLink") },
                { id: "embedCode", icon: "bi-code-slash", label: t("share.items.embedCode.label"), desc: t("share.items.embedCode.desc"), tags: [tag.shortOnly], tech: "iframe", action: t("share.actions.createCode") },
              ],
            },
            {
              heading: t("share.sections.published"),
              items: published,
              empty: t("share.nothingPublished"),
            },
          ],
        },
        {
          id: "git",
          icon: "bi-git",
          label: t("share.groups.git.label"),
          sub: t("share.groups.git.sub"),
          intro: t("share.groups.git.intro"),
          sections: [
            { heading: "GitHub", items: repoItems("GitHub", "github", !!meta.github) },
            { heading: "GitLab", items: repoItems("GitLab", "gitlab", !!meta.gitlab) },
          ],
        },
      ];

      if (this.localFolderSupported) {
        groups.push({
          id: "localFolder",
          icon: "bi-folder2-open",
          label: t("share.groups.localFolder.label"),
          sub: t("share.groups.localFolder.sub"),
          intro: t("share.groups.localFolder.intro"),
          sections: [
            {
              items: [
                needsProject({ id: "openLocalFolder", icon: "bi-folder-plus", label: t("share.items.openLocalFolder.label"), desc: t("share.items.openLocalFolder.desc"), action: t("share.actions.chooseFolder"), primary: !meta.localFolder }),
                {
                  id: "localFolderSync",
                  icon: "bi-arrow-down-up",
                  label: t("share.items.localFolderSync.label"),
                  desc: t("share.items.localFolderSync.desc"),
                  action: t("share.actions.sync"),
                  primary: !!meta.localFolder,
                  ...(meta.localFolder
                    ? {}
                    : {
                        disabled: true,
                        reason: t("share.reasons.noFolder"),
                        fix: noProject ? undefined : { id: "openLocalFolder", label: t("share.actions.connectNow") },
                      }),
                },
              ],
            },
          ],
        });
      }

      groups.push({
        id: "export",
        icon: "bi-download",
        label: t("share.groups.export.label"),
        sub: t("share.groups.export.sub"),
        intro: t("share.groups.export.intro"),
        sections: [
          {
            items: [
              { id: "downloadZip", icon: "bi-file-zip", label: t("share.items.downloadZip.label"), desc: t("share.items.downloadZip.desc"), tags: [tag.allFiles], action: t("share.actions.download"), primary: true },
              needsProject({ id: "exporter", icon: "bi-mortarboard", label: t("share.items.exporter.label"), desc: t("share.items.exporter.desc"), tech: "SCORM · IMS · PDF · ePub", action: t("share.actions.openExporter") }),
              { id: "downloadReadme", icon: "bi-file-earmark-text", label: this.activeFileName, desc: t("share.downloadActiveFileInfo"), action: t("share.actions.download") },
            ],
          },
        ],
      });

      return groups;
    },
  },

  methods: {
    devicesIn(group: string) {
      return DEVICES.filter((d) => d.group === group);
    },

    deviceName(device: any) {
      return device.i18n ? this.$t("preview.device." + device.name) : device.name;
    },

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
        gitlabImport: () => this.gitlabImport(),
        gitlabPublish: () => this.gitlabPublish(),
        gitlabPush: () => this.gitlabPush(),
        gitlabPull: () => this.gitlabPull(),
        openLocalFolder: () => this.openLocalFolder(),
        localFolderSync: () => this.localFolderSync(),
        fork: () => this.fork(),
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

    gitlabImport() {
      this.gitlabImportVisible = true;
    },

    gitlabPublish() {
      this.gitlabPublishVisible = true;
    },

    gitlabPush() {
      if ((this.meta as any)?.meta?.gitlab) this.gitlabPushVisible = true;
    },

    gitlabPull() {
      if ((this.meta as any)?.meta?.gitlab) this.gitlabPullVisible = true;
    },

    onGitlabUpdated(link: any) {
      const meta = (this.meta as any)?.meta;
      if (meta) meta.gitlab = link;
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
        // If the folder is a GitHub/GitLab clone and the project isn't linked to
        // a repo yet, adopt that link so the user can push straight to it.
        if (!(this.meta as any)?.meta?.github && !(this.meta as any)?.meta?.gitlab) {
          const repo = await detectGitHubRemote(handle);
          if (repo) update.github = repo;
          else {
            const glRepo = await detectGitLabRemote(handle);
            if (glRepo) update.gitlab = glRepo;
          }
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
      this.$refs.modal.show({
        title: this.$t("share.items.collaborationLink.label"),
        intro: this.$t("result.collaborationIntro"),
        entries: [{ value: link, kind: "link" }],
        note: this.$t("result.collaborationNote"),
      });
    },

    shareFile() {
      const fileUrl = prompt(this.$t("prompt.shareFileUrl"), "");

      if (!fileUrl) return;

      this.$refs.modal.show({
        title: this.$t("share.items.externalResource.label"),
        intro: this.$t("result.externalIntro"),
        entries: [{ value: this.urlPath(["show", "file", fileUrl]), kind: "link" }],
        note: this.$t("result.externalNote"),
      });
    },

    async shareData() {
      const activeValue = this.$refs.editor.getActiveValue();
      const links: string[] = [];

      // three encodings; depending on the language one of them is shortest
      // (base64 fails for some characters, so each is optional)
      try {
        const pako = (await import("pako")).default;
        const gzip = pako.gzip(activeValue);
        links.push(
          LiaScriptURL +
            "?data:text/plain;charset=utf-8;Content-Encoding=gzip;base64," +
            btoa(String.fromCharCode.apply(null, gzip))
        );
      } catch (e) {}
      try {
        links.push(LiaScriptURL + "?data:text/plain;base64," + btoa(activeValue));
      } catch (e) {}
      try {
        links.push(LiaScriptURL + "?data:text/plain," + encodeURIComponent(activeValue));
      } catch (e) {}

      links.sort((a, b) => a.length - b.length);

      this.$refs.modal.show({
        title: this.$t("share.items.dataUri.label"),
        intro: this.$t("result.dataIntro"),
        entries: links.map((value, i) => ({
          label: i === 0 ? this.$t("result.shortest") : this.$t("result.alternative"),
          value,
          kind: "link",
        })),
        warning: this.$t("result.longLinkWarning"),
      });
    },

    async shareCode() {
      const { compress } = await import("shrink-string");
      const zipCode = this.urlPath([
        "show",
        "code",
        await compress(this.$refs.editor.getActiveValue()),
      ]);

      this.$refs.modal.show({
        title: this.$t("share.items.snapshotUrl.label"),
        intro: this.$t("result.snapshotIntro"),
        entries: [{ value: zipCode, kind: "link" }],
        warning: this.$t("result.longLinkWarning"),
      });
    },

    async embedCode() {
      const { compress } = await import("shrink-string");
      const activeValue = this.$refs.editor.getActiveValue();
      const zipCode = this.urlPath(["embed", "code", await compress(activeValue)]);
      const base64 = this.urlPath([
        "embed",
        "code",
        btoa(unescape(encodeURIComponent(activeValue))),
      ]);
      const iframe = (src: string) =>
        `<iframe style="height: 80vh; min-width: 100%; border: 1px solid black" src="${src}"></iframe>`;

      this.$refs.modal.show({
        title: this.$t("share.items.embedCode.label"),
        intro: this.$t("result.embedIntro"),
        entries: [
          { label: this.$t("result.shortest"), value: iframe(zipCode), kind: "code" },
          { label: this.$t("result.embedReadable"), value: iframe(base64), kind: "code" },
        ],
        warning: this.$t("result.longLinkWarning"),
        note: this.$t("result.embedNote"),
      });
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

    newCourse() {
      (this.$refs.importMenu as any)?.openChooser();
    },

    onResize() {
      this.horizontal =
        document.documentElement.clientWidth < document.documentElement.clientHeight;
    },

    compile() {
      if (this.preview && this.editorIsReady) {
        console.log("liascript: compile");

        // Render the markdown document currently selected for preview (the main
        // course by default; another markdown file once the user switches).
        let code = this.$refs.editor.getPreviewValue();

        if (code.trim().length == 0) {
          code = tutorialFor(this.$i18n.locale);
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

      const bytes = (this.$refs.editor as any)?.getBlob(this.resolvePath(value));
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
      // LiaScript prefixes paths with "/" ("../a.png" -> "/../a.png",
      // "/a.png" -> "//a.png"), so drop exactly one to get the written path.
      return this.$refs.editor.getBlob(this.resolvePath(src.replace(/^\//, "")));
    },

    // Resolve a path written in the previewed document against that document's
    // folder; a leading "/" means the project root.
    resolvePath(path: string): string {
      const dir = this.previewFilePath.replace(/[^/]*$/, "");
      const resolved = new URL(path, "http://x/" + dir).pathname.slice(1);
      try {
        return decodeURIComponent(resolved);
      } catch {
        return resolved;
      }
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

        // an empty document shows the built-in introduction (see compile());
        // its title/comment/version must not end up on the course card
        const showsIntro = this.$refs.editor.getPreviewValue().trim().length === 0;

        if (this.$props.storageId && !showsIntro) {
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
    GitLabImportModal,
    GitLabPushModal,
    GitLabPullModal,
    GitLabPublishModal,
    LocalFolderSyncModal,
  },
};
</script>

<template>
  <nav class="navbar bg-white border-bottom lia-editbar">
    <div class="container-fluid flex-nowrap gap-2 px-2">
      <!-- left: where am I -->
      <div class="lia-editbar-side d-flex align-items-center gap-2">
        <a
          v-if="!embed"
          class="lia-logo"
          href="./"
          data-link="true"
          :title="$t('nav.myCourses')"
          :aria-label="$t('nav.myCourses')"
        >
          <img :src="logoImg" alt="" height="28" />
        </a>
        <span v-else class="lia-logo">
          <img :src="logoImg" alt="" height="28" />
        </span>

        <div v-if="storageId && !embed" class="lia-course d-none d-sm-flex">
          <a class="lia-course-crumb" href="./" data-link="true">{{ $t('nav.myCourses') }} /</a>
          <span class="lia-course-title" :title="courseTitle">{{ courseTitle }}</span>
        </div>
        <span v-else class="fw-semibold d-none d-sm-inline">
          {{ $t('app.title') }}
        </span>
      </div>

      <!-- center: what do I see -->
      <div class="d-flex align-items-center gap-2 flex-shrink-0">
        <div class="lia-view-switch" role="radiogroup" :aria-label="$t('nav.toolbar.radioGroupAria')">
          <button
            type="button"
            role="radio"
            :aria-checked="currentMode < 0"
            :class="{ active: currentMode < 0 }"
            :title="$t('nav.toolbar.editorOnly')"
            @click="changeMode(-1)"
          >
            <i class="bi bi-pencil" aria-hidden="true"></i>
            <span class="d-none d-xl-inline">{{ $t('nav.view.write') }}</span>
          </button>
          <button
            type="button"
            role="radio"
            :aria-checked="currentMode === 0"
            :class="{ active: currentMode === 0 }"
            :title="$t('nav.toolbar.splitView')"
            @click="changeMode(0)"
          >
            <i
              class="bi bi-layout-split"
              aria-hidden="true"
              :style="{ transform: horizontal ? 'rotate(90deg)' : 'none' }"
            ></i>
            <span class="d-none d-xl-inline">{{ $t('nav.view.both') }}</span>
          </button>
          <button
            type="button"
            role="radio"
            :aria-checked="currentMode > 0"
            :class="{ active: currentMode > 0 }"
            :title="$t('nav.toolbar.previewOnly')"
            @click="changeMode(1)"
          >
            <i class="bi bi-eye" aria-hidden="true"></i>
            <span class="d-none d-xl-inline">{{ $t('nav.view.preview') }}</span>
          </button>
        </div>

        <button
          type="button"
          class="btn btn-sm btn-outline-secondary lia-bar-btn"
          @click="compile()"
          :title="$t('nav.toolbar.compile')"
          :aria-label="$t('nav.toolbar.compile')"
        >
          <i class="bi bi-arrow-clockwise" aria-hidden="true"></i>
          <span class="d-none d-lg-inline">{{ $t('nav.toolbar.refresh') }}</span>
        </button>
      </div>

      <!-- right: what can I do -->
      <div class="lia-editbar-side lia-editbar-right d-flex align-items-center justify-content-end">
        <template v-if="!embed">
          <div class="dropdown">
            <button
              type="button"
              class="btn btn-sm lia-bar-btn lia-conn"
              :class="conn.type === 'Offline' ? 'btn-outline-secondary' : 'btn-primary'"
              data-bs-toggle="dropdown"
              data-bs-display="static"
              aria-expanded="false"
              :title="connTitle"
              :aria-label="
                conn.type === 'Offline'
                  ? $t('nav.connection.offlineAria')
                  : $t('nav.connection.onlineAria', { type: conn.type })
              "
            >
              <i class="bi" :class="conn.type === 'Offline' ? 'bi-person' : 'bi-people-fill'" aria-hidden="true"></i>
              <span class="d-none d-md-inline">{{ connLabel }}</span>
              <span v-if="conn.users > 0" class="lia-conn-users">{{ conn.users }}</span>
              <i class="bi bi-chevron-down small" aria-hidden="true"></i>
            </button>

            <div class="dropdown-menu dropdown-menu-end lia-conn-menu">
              <h6 class="dropdown-header">{{ $t('nav.connection.title') }}</h6>
              <a
                v-for="option in connOptions"
                :key="option.id"
                class="dropdown-item lia-conn-option"
                :class="{ active: option.active, disabled: !storageId }"
                :href="urlPath(option.path)"
                :aria-current="option.active ? 'true' : null"
                :aria-label="$t(option.ariaKey)"
              >
                <i class="bi" :class="option.active ? 'bi-record-circle-fill' : 'bi-circle'" aria-hidden="true"></i>
                <span>
                  <span class="d-block fw-semibold">{{ $t(option.labelKey) }}</span>
                  <span class="d-block small lia-conn-desc">{{ $t(option.descKey) }}</span>
                  <span v-if="option.tech" class="d-block small lia-conn-desc">
                    {{ $t('nav.connection.tech', { name: option.tech }) }}
                  </span>
                </span>
              </a>
              <!-- only true while live: "Only me" shares nothing via the link -->
              <template v-if="conn.type !== 'Offline'">
                <div class="dropdown-divider"></div>
                <p class="px-3 mb-2 small text-body-secondary lia-conn-hint">
                  {{ $t('nav.connection.sameCourse') }}
                </p>
                <div class="px-3 pb-1">
                  <button type="button" class="btn btn-sm btn-outline-secondary" @click="fork">
                    <i class="bi bi-copy" aria-hidden="true"></i>
                    {{ $t('nav.fork') }}
                  </button>
                </div>
              </template>
            </div>
          </div>

          <a
            class="btn btn-sm lia-bar-btn lia-icon-btn d-none d-sm-inline-flex"
            href="https://liascript.github.io/course/?https://raw.githubusercontent.com/liaScript/docs/master/README.md"
            target="_blank"
            :title="$t('nav.help')"
            :aria-label="$t('nav.help')"
          >
            <i class="bi bi-question-circle" aria-hidden="true"></i>
          </a>

          <div class="d-none d-md-block lia-lang">
            <LanguageDropdown align="end" />
          </div>

          <button
            type="button"
            class="btn btn-sm btn-primary lia-bar-btn"
            @click="openShare"
            :title="$t('nav.menu')"
            :aria-label="$t('nav.menu')"
          >
            <i class="bi bi-box-arrow-up" aria-hidden="true"></i>
            <span class="d-none d-md-inline">{{ $t('nav.menu') }}</span>
          </button>

          <div class="dropdown">
            <button
              type="button"
              class="btn btn-sm lia-bar-btn lia-icon-btn"
              data-bs-toggle="dropdown"
              data-bs-display="static"
              aria-expanded="false"
              :title="$t('nav.more')"
              :aria-label="$t('nav.more')"
            >
              <i class="bi bi-three-dots-vertical" aria-hidden="true"></i>
            </button>
            <ul class="dropdown-menu dropdown-menu-end">
              <li>
                <button type="button" class="dropdown-item" @click="newCourse">
                  <i class="bi bi-plus-lg me-2" aria-hidden="true"></i>{{ $t('index.newCourse') }}
                </button>
              </li>
              <li>
                <button type="button" class="dropdown-item" @click="fork">
                  <i class="bi bi-copy me-2" aria-hidden="true"></i>{{ $t('nav.fork') }}
                </button>
              </li>
              <li class="d-sm-none">
                <a
                  class="dropdown-item"
                  href="https://liascript.github.io/course/?https://raw.githubusercontent.com/liaScript/docs/master/README.md"
                  target="_blank"
                >
                  <i class="bi bi-question-circle me-2" aria-hidden="true"></i>{{ $t('nav.help') }}
                </a>
              </li>
            </ul>
          </div>

          <ImportMenu ref="importMenu" hide-button />
        </template>
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
              class="lia-activity-btn"
              type="button"
              :class="{ active: showFiles }"
              :aria-pressed="showFiles"
              :title="showFiles ? $t('nav.activityBar.hideFiles') : $t('nav.activityBar.showFiles')"
              @click="showFiles = !showFiles"
            >
              <i class="bi bi-folder2-open" aria-hidden="true"></i>
              <span>{{ $t('nav.activityBar.files') }}</span>
            </button>
            <button
              class="lia-activity-btn"
              type="button"
              :class="{ active: showToolbar }"
              :aria-pressed="showToolbar"
              :title="showToolbar ? $t('nav.activityBar.hideToolbar') : $t('nav.activityBar.showToolbar')"
              @click="showToolbar = !showToolbar"
            >
              <i class="bi bi-tools" aria-hidden="true"></i>
              <span>{{ $t('nav.activityBar.tools') }}</span>
            </button>
            <button
              v-if="currentMode === 0"
              class="lia-activity-btn"
              type="button"
              :class="{ active: showDevices }"
              :aria-pressed="showDevices"
              :title="$t('preview.device.title')"
              @click="showDevices = !showDevices"
            >
              <i class="bi bi-phone" aria-hidden="true"></i>
              <span>{{ $t('nav.activityBar.devices') }}</span>
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
              @preview="previewFilePath = $event; preview?.clearMedia?.()"
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
          :device="previewDevice"
          v-model:landscape="previewLandscape"
          v-model:zoom="previewZoom"
          v-model:scaling="previewScaling"
          :bar="showDevices || currentMode > 0"
          :class="{ invisible: previewNotReady }"
        >
          <template #bar>
            <!-- no :class on the toggle (Vue would drop Bootstrap's "show", the menu
                 never closes); fixed popper so the pane's overflow can't cut the menu -->
            <div class="dropdown">
              <button
                type="button"
                class="btn btn-sm btn-outline-secondary lia-pv-btn"
                data-bs-toggle="dropdown"
                data-bs-popper-config='{"strategy":"fixed"}'
                aria-expanded="false"
                :title="$t('preview.device.title')"
                :aria-label="$t('preview.device.title')"
              >
                <i class="bi" :class="currentDevice.icon" aria-hidden="true"></i>
                <span class="lia-device-label">{{ deviceName(currentDevice) }}</span>
                <i class="bi bi-chevron-down small" aria-hidden="true"></i>
              </button>
    
              <ul class="dropdown-menu lia-device-menu">
                <li>
                  <button
                    type="button"
                    class="dropdown-item lia-device-item"
                    :class="{ active: previewDevice === RESPONSIVE.id }"
                    :aria-current="previewDevice === RESPONSIVE.id ? 'true' : null"
                    @click="previewDevice = RESPONSIVE.id"
                  >
                    <i class="bi" :class="RESPONSIVE.icon" aria-hidden="true"></i>
                    <span>{{ deviceName(RESPONSIVE) }}</span>
                  </button>
                </li>
                <template v-for="group in DEVICE_GROUPS" :key="group">
                  <li><hr class="dropdown-divider" /></li>
                  <li><h6 class="dropdown-header">{{ $t('preview.device.groups.' + group) }}</h6></li>
                  <li v-for="device in devicesIn(group)" :key="device.id">
                    <button
                      type="button"
                      class="dropdown-item lia-device-item"
                      :class="{ active: previewDevice === device.id }"
                      :aria-current="previewDevice === device.id ? 'true' : null"
                      @click="previewDevice = device.id"
                    >
                      <i class="bi" :class="device.icon" aria-hidden="true"></i>
                      <span>{{ deviceName(device) }}</span>
                      <span class="lia-device-size">{{ device.width }}×{{ device.height }}</span>
                    </button>
                  </li>
                </template>
              </ul>
            </div>
          </template>
        </Preview>
      </pane>
    </splitpanes>
  </div>

  <Modal ref="modal" />
  <ShareModal ref="shareModal" :groups="shareGroups" :course-title="storageId ? courseTitle : ''" @action="onShareAction" />
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
  <GitLabImportModal
    :visible="gitlabImportVisible"
    :storageId="$props.storageId"
    :connection="$props.connection"
    @close="gitlabImportVisible = false"
  />
  <GitLabPublishModal
    v-if="$props.storageId"
    :visible="gitlabPublishVisible"
    :storageId="$props.storageId"
    :connection="$props.connection"
    :title="meta?.meta?.title"
    @close="gitlabPublishVisible = false"
    @updated="onGitlabUpdated"
  />
  <GitLabPushModal
    v-if="meta?.meta?.gitlab"
    :visible="gitlabPushVisible"
    :storageId="$props.storageId"
    :connection="$props.connection"
    :gitlab="meta.meta.gitlab"
    @close="gitlabPushVisible = false"
    @updated="onGitlabUpdated"
  />
  <GitLabPullModal
    v-if="meta?.meta?.gitlab"
    :visible="gitlabPullVisible"
    :storageId="$props.storageId"
    :connection="$props.connection"
    :gitlab="meta.meta.gitlab"
    @close="gitlabPullVisible = false"
    @updated="onGitlabUpdated"
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

/* top bar: left = course, center = view, right = actions */
.lia-editbar {
  height: 56px;
  padding-top: 0;
  padding-bottom: 0;
}

.lia-editbar-side {
  flex: 1 1 0;
  min-width: 0;
}

/* the actions never shrink below their content; the course title gives way */
.lia-editbar-side:last-child {
  min-width: max-content;
}

@media (max-width: 575.98px) {
  .lia-view-switch button {
    padding: 0 0.55rem;
  }
  .lia-conn .bi-chevron-down {
    display: none;
  }
}

.lia-logo {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 0.5rem;
  flex-shrink: 0;
}

.lia-course {
  flex-direction: column;
  min-width: 0;
  line-height: 1.2;
}

.lia-course-crumb {
  font-size: 0.75rem;
  color: var(--lia-muted);
  text-decoration: none;
}

.lia-course-crumb:hover {
  color: var(--lia-accent);
}

.lia-course-title {
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.lia-view-switch {
  display: inline-flex;
  padding: 3px;
  background: #eef1f3;
  border-radius: 0.6rem;
}

.lia-view-switch button {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  height: 32px;
  padding: 0 0.7rem;
  border: 0;
  border-radius: 0.45rem;
  background: transparent;
  color: #3b4652;
  font-size: 0.875rem;
  font-weight: 500;
}

.lia-view-switch button .bi {
  display: inline-block;
}

.lia-view-switch button.active {
  background: #fff;
  color: #17212b;
  font-weight: 600;
  box-shadow: 0 1px 2px rgba(23, 33, 43, 0.12);
}

.lia-bar-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  height: 36px;
  white-space: nowrap;
}

/* even visible spacing: bordered buttons sit 8px apart, the borderless
   icon buttons are narrower so their glyph gets about the same room */
.lia-editbar-right {
  gap: 0.5rem;
}

.lia-editbar-right .lia-icon-btn {
  width: 28px;
  margin-inline: -5px;
}

/* the language dropdown matches the 36px bar buttons */
.lia-lang :deep(.dropdown-toggle) {
  height: 36px;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

.lia-icon-btn {
  width: 36px;
  justify-content: center;
  padding: 0;
  border: 0;
  color: #3b4652;
  font-size: 1.1rem;
}

.lia-icon-btn:hover {
  background: #eef1f3;
}

.lia-pv-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  height: 24px;
  padding: 0 0.45rem;
  font-size: 0.8rem;
  white-space: nowrap;
}

.lia-device-label {
  max-width: 10rem;
  overflow: hidden;
  text-overflow: ellipsis;
}

.lia-device-menu {
  min-width: 17rem;
}

.lia-device-item {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.lia-device-size {
  margin-left: auto;
  padding-left: 1rem;
  font-size: 0.8rem;
  color: var(--lia-muted);
  font-variant-numeric: tabular-nums;
}

.lia-device-item.active .lia-device-size {
  color: inherit;
}

.lia-conn-users {
  font-weight: 600;
}

.lia-conn-menu {
  width: min(22rem, calc(100vw - 1rem));
  white-space: normal;
}

.lia-conn-option {
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
  padding-top: 0.6rem;
  padding-bottom: 0.6rem;
  white-space: normal;
}

.lia-conn-option .bi {
  margin-top: 0.15rem;
}

.lia-conn-desc {
  color: var(--lia-muted);
}

.lia-conn-option.active .lia-conn-desc {
  color: #d5ecea;
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
  width: 4.75rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 6px 4px;
  background-color: #fff;
  border-right: 1px solid var(--lia-line);
  gap: 4px;
}

.lia-activity-btn {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 6px 2px;
  border: 0;
  border-radius: 0.5rem;
  background: transparent;
  color: #3b4652;
  font-size: 0.68rem;
  font-weight: 500;
  line-height: 1.15;
  overflow-wrap: break-word;
  hyphens: auto;
}

.lia-activity-btn .bi {
  font-size: 1.15rem;
}

.lia-activity-btn:hover {
  background: #eef1f3;
}

.lia-activity-btn.active {
  background: var(--lia-accent-soft);
  color: var(--lia-accent-ink);
  font-weight: 600;
}

/* narrow screens: icons only */
@media (max-width: 575.98px) {
  .lia-activity-bar {
    width: auto;
  }
  .lia-activity-btn span {
    display: none;
  }
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
