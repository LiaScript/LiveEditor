<script lang="ts">
import { defineComponent } from "vue";
// jszip is only used for the folder-download action — load it on demand
// (see downloadFolderZip) instead of in the startup bundle.

import {
  getProjectDoc,
  releaseProjectDoc,
  ProjectDoc,
  type FileEntry,
} from "../ts/ProjectDoc";
import FileNode, { type TreeNode } from "./FileNode.vue";

export default defineComponent({
  name: "FileExplorer",

  components: { FileNode },

  props: {
    storageId: { type: String, required: true },
    connection: { type: String, default: undefined },
    mainName: { type: String, default: "README.md" },
  },

  emits: ["open-main", "open-asset"],

  data() {
    return {
      doc: null as ProjectDoc | null,
      tree: [] as TreeNode[],
      expandedSet: new Set<string>(),
      activePath: "" as string,
    };
  },

  provide() {
    const self = this as any;
    return {
      explorer: {
        isActive: (path: string) => self.activePath === path,
        isExpanded: (path: string) => self.expandedSet.has(path),
        toggle: (path: string) => self.toggle(path),
        open: (node: TreeNode) => self.openNode(node),
        createFile: (folder: string) => self.createFile(folder),
        createFolder: (folder: string) => self.createFolder(folder),
        rename: (node: TreeNode) => self.rename(node),
        remove: (node: TreeNode) => self.remove(node),
        download: (node: TreeNode) => self.download(node),
        move: (from: string, toFolder: string) => self.move(from, toFolder),
      },
    };
  },

  created() {
    this.doc = getProjectDoc(this.storageId, this.connection);
    // highlight the main course document by default (the editor opens it first)
    this.activePath = this.doc.getMainPath();
    this.rebuild();
    this.doc.files.observe(this.rebuild);
    // the main document's path lives in `meta` (rename updates it there)
    this.doc.meta.observe(this.rebuild);
  },

  unmounted() {
    if (this.doc) {
      this.doc.files.unobserve(this.rebuild);
      this.doc.meta.unobserve(this.rebuild);
      releaseProjectDoc(this.storageId);
      this.doc = null;
    }
  },

  methods: {
    rebuild() {
      if (!this.doc) return;
      this.tree = this.buildTree(this.doc.entries());
    },

    buildTree(entries: FileEntry[]): TreeNode[] {
      const root: TreeNode = { name: "", path: "", type: "folder", children: [] };
      const lookup = new Map<string, TreeNode>();
      lookup.set("", root);

      for (const { path, meta } of entries) {
        const segments = path.split("/");
        let prefix = "";
        let parent = root;
        for (let i = 0; i < segments.length; i++) {
          prefix = prefix ? prefix + "/" + segments[i] : segments[i];
          let node = lookup.get(prefix);
          if (!node) {
            node = {
              name: segments[i],
              path: prefix,
              type: "folder",
              children: [],
            };
            lookup.set(prefix, node);
            parent.children.push(node);
          }
          parent = node;
        }
        // the final node carries the real metadata
        parent.type = meta.type;
        parent.mime = meta.mime;
        parent.main = (meta as any).main;
      }

      const sort = (nodes: TreeNode[]) => {
        nodes.sort((a, b) => {
          if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
          return a.name.localeCompare(b.name);
        });
        nodes.forEach((n) => sort(n.children));
      };
      sort(root.children);
      return root.children;
    },

    toggle(path: string) {
      if (this.expandedSet.has(path)) {
        this.expandedSet.delete(path);
      } else {
        this.expandedSet.add(path);
      }
    },

    openNode(node: TreeNode) {
      if (node.type === "folder") {
        this.toggle(node.path);
        return;
      }
      this.activePath = node.path;
      // the main course document opens through the dedicated editor path so the
      // preview/compile keep their "main" semantics, even after a rename
      if (node.main) {
        this.$emit("open-main");
      } else {
        this.$emit("open-asset", { path: node.path, mime: node.mime });
      }
    },

    // -- operations ----------------------------------------------------------

    createFile(folder = "") {
      const name = window.prompt(this.$t("fileExplorer.newFileName"), this.$t("fileExplorer.newFileDefault"));
      if (!name) return;
      const path = folder ? folder + "/" + name : name;
      const created = this.doc?.createFile(path) || path;
      if (folder) this.expandedSet.add(folder);
      // open the freshly created file for editing
      this.activePath = created;
      this.$emit("open-asset", { path: created });
    },

    createFolder(folder = "") {
      const name = window.prompt(this.$t("fileExplorer.newFolderName"), this.$t("fileExplorer.newFolderDefault"));
      if (!name) return;
      const path = folder ? folder + "/" + name : name;
      this.doc?.createFolder(path);
      this.expandedSet.add(path);
      if (folder) this.expandedSet.add(folder);
    },

    rename(node: TreeNode) {
      const next = window.prompt(this.$t("fileExplorer.renameTo"), node.name);
      if (!next || next === node.name) return;
      const parent = node.path.split("/").slice(0, -1).join("/");
      const target = parent ? parent + "/" + next : next;
      this.doc?.renamePath(node.path, target);
    },

    remove(node: TreeNode) {
      const label = node.type === "folder"
        ? this.$t("fileExplorer.labelFolder")
        : this.$t("fileExplorer.labelFile");
      if (!window.confirm(this.$t("fileExplorer.deleteConfirm", { label, path: node.path }))) return;
      this.doc?.deletePath(node.path);
    },

    move(from: string, toFolder: string) {
      this.doc?.movePath(from, toFolder);
      if (toFolder) this.expandedSet.add(toFolder);
    },

    download(node: TreeNode) {
      if (node.type === "file") {
        const data = this.doc?.readFileData(node.path);
        if (data) this.saveBytes(node.name, data, node.mime);
      } else {
        this.downloadFolderZip(node);
      }
    },

    async downloadFolderZip(folder: TreeNode) {
      if (!this.doc) return;
      // jszip's browser build exposes the constructor as the imported namespace
      // itself (not under `.default`), so pick whichever is callable.
      const mod: any = await import("jszip");
      const JSZip = typeof mod === "function" ? mod : mod.default;
      const zip = new JSZip();
      const prefix = folder.path + "/";
      this.doc.files.forEach((meta, path) => {
        if (meta.type === "file" && path.startsWith(prefix)) {
          const data = this.doc!.readFileData(path);
          if (data) zip.file(path.slice(prefix.length), data);
        }
      });
      const blob = await zip.generateAsync({ type: "blob" });
      this.saveBlob(folder.name + ".zip", blob);
    },

    saveBytes(name: string, data: Uint8Array, mime?: string) {
      this.saveBlob(name, new Blob([data], { type: mime || "application/octet-stream" }));
    },

    saveBlob(name: string, blob: Blob) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },

    // -- upload --------------------------------------------------------------

    triggerUpload() {
      (this.$refs.fileInput as HTMLInputElement)?.click();
    },

    onFileInput(event: Event) {
      const input = event.target as HTMLInputElement;
      if (input.files) this.uploadFiles(Array.from(input.files));
      input.value = "";
    },

    onRootDrop(event: DragEvent) {
      // ignore internal node moves (those carry our custom mime type)
      if (event.dataTransfer?.types.includes("application/x-lia-path")) return;
      event.preventDefault();
      const files = event.dataTransfer?.files;
      if (files && files.length) this.uploadFiles(Array.from(files));
    },

    async uploadFiles(files: File[], folder = "") {
      if (!this.doc) return;
      for (const file of files) {
        const buffer = await file.arrayBuffer();
        const desired = folder ? folder + "/" + file.name : file.name;
        // Avoid clobbering existing files; text files become editable Y.Text,
        // binary files (images, ...) are stored as bytes.
        const path = this.doc.uniquePath(desired);
        this.doc.importFile(path, new Uint8Array(buffer), file.type);
      }
    },
  },
});
</script>

<template>
  <div
    class="lia-explorer"
    @dragover.prevent
    @drop="onRootDrop"
  >
    <div class="lia-explorer-header">
      <span class="lia-explorer-title">{{ $t('fileExplorer.title') }}</span>
      <span class="lia-explorer-tools">
        <i
          class="bi bi-file-earmark-plus"
          :title="$t('fileExplorer.newFile')"
          @click="createFile('')"
        ></i>
        <i
          class="bi bi-folder-plus"
          :title="$t('fileExplorer.newFolder')"
          @click="createFolder('')"
        ></i>
        <i class="bi bi-upload" :title="$t('fileExplorer.upload')" @click="triggerUpload"></i>
      </span>
    </div>

    <ul class="lia-explorer-tree">
      <FileNode v-for="node in tree" :key="node.path" :node="node" :depth="0" />
    </ul>

    <input
      ref="fileInput"
      type="file"
      multiple
      style="display: none"
      @change="onFileInput"
    />
  </div>
</template>

<style scoped>
.lia-explorer {
  height: 100%;
  overflow: auto;
  background-color: #f6f6f6;
  border-right: solid lightgray 1px;
  font-size: 13px;
}

.lia-explorer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 8px;
  position: sticky;
  top: 0;
  background-color: #ececec;
  border-bottom: solid lightgray 1px;
  z-index: 1;
}

.lia-explorer-title {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.05em;
  color: #555;
}

.lia-explorer-tools {
  display: inline-flex;
  gap: 8px;
}

.lia-explorer-tools .bi {
  cursor: pointer;
  color: #555;
}

.lia-explorer-tools .bi:hover {
  color: var(--bs-primary, #0d6efd);
}

.lia-explorer-tree {
  margin: 0;
  padding: 0;
}

.lia-node {
  list-style: none;
}

.lia-node-row {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  cursor: pointer;
  white-space: nowrap;
  user-select: none;
}

.lia-node-row:hover {
  background-color: rgba(0, 0, 0, 0.06);
}

.lia-node-row.active {
  background-color: rgba(13, 110, 253, 0.12);
}

.lia-chevron {
  display: inline-block;
  width: 12px;
  flex: 0 0 auto;
}

.lia-node-label {
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
