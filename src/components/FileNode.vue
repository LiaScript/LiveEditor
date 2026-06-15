<script lang="ts">
import { defineComponent, type PropType } from "vue";

export interface TreeNode {
  name: string;
  path: string;
  type: "file" | "folder";
  mime?: string;
  children: TreeNode[];
}

const EXT_ICONS: Record<string, string> = {
  // Markup / Docs
  md: "bi-filetype-md", markdown: "bi-filetype-md", lia: "bi-filetype-md",
  txt: "bi-filetype-txt", text: "bi-filetype-txt", log: "bi-filetype-txt",
  pdf: "bi-filetype-pdf",
  csv: "bi-filetype-csv", tsv: "bi-filetype-csv",
  // Web
  html: "bi-filetype-html", htm: "bi-filetype-html",
  css: "bi-filetype-css",
  scss: "bi-filetype-scss",
  sass: "bi-filetype-sass",
  xml: "bi-filetype-xml",
  svg: "bi-filetype-svg",
  // JavaScript / TypeScript
  js: "bi-filetype-js", mjs: "bi-filetype-js", cjs: "bi-filetype-js",
  jsx: "bi-filetype-jsx",
  ts: "bi-filetype-tsx", tsx: "bi-filetype-tsx",
  // Data
  json: "bi-filetype-json", jsonc: "bi-filetype-json",
  yml: "bi-filetype-yml", yaml: "bi-filetype-yml",
  // Languages
  py: "bi-filetype-py",
  php: "bi-filetype-php",
  rb: "bi-filetype-rb",
  java: "bi-filetype-java",
  sh: "bi-filetype-sh", bash: "bi-filetype-sh", zsh: "bi-filetype-sh",
  sql: "bi-filetype-sql",
  // Images
  png: "bi-filetype-png",
  jpg: "bi-filetype-jpg", jpeg: "bi-filetype-jpg",
  gif: "bi-filetype-gif",
  bmp: "bi-file-earmark-image", webp: "bi-file-earmark-image",
  avif: "bi-file-earmark-image", ico: "bi-file-earmark-image",
  // Videos
  mp4: "bi-filetype-mp4",
  mov: "bi-filetype-mov",
  webm: "bi-file-earmark-play",
  ogv: "bi-file-earmark-play", ogg: "bi-file-earmark-play",
  avi: "bi-file-earmark-play", mkv: "bi-file-earmark-play", m4v: "bi-file-earmark-play",
  // Audio
  mp3: "bi-filetype-mp3",
  wav: "bi-filetype-wav",
  aac: "bi-file-earmark-music",
  // Code (generic)
  vue: "bi-file-earmark-code",
};

export default defineComponent({
  name: "FileNode",

  props: {
    node: { type: Object as PropType<TreeNode>, required: true },
    depth: { type: Number, default: 0 },
  },

  inject: ["explorer"],

  computed: {
    api(): any {
      return (this as any).explorer;
    },
    isFolder(): boolean {
      return this.node.type === "folder";
    },
    expanded(): boolean {
      return this.api.isExpanded(this.node.path);
    },
    indent(): string {
      return 6 + this.depth * 12 + "px";
    },
    icon(): string {
      if (this.isFolder) return this.expanded ? "bi-folder2-open" : "bi-folder";
      const mime = (this.node.mime || "").toLowerCase();
      if (mime.startsWith("image/")) return "bi-file-earmark-image";
      if (mime.startsWith("video/")) return "bi-file-earmark-play";
      if (mime.startsWith("audio/")) return "bi-file-earmark-music";
      const ext = this.node.name.split(".").pop()?.toLowerCase() || "";
      return EXT_ICONS[ext] ?? "bi-file-earmark";
    },
  },

  methods: {
    onClick() {
      if (this.isFolder) {
        this.api.toggle(this.node.path);
      } else {
        this.api.open(this.node);
      }
    },

    onDragStart(event: DragEvent) {
      event.dataTransfer?.setData("application/x-lia-path", this.node.path);
      if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
    },

    onDrop(event: DragEvent) {
      event.preventDefault();
      event.stopPropagation();
      const from = event.dataTransfer?.getData("application/x-lia-path");
      // dropping onto a folder moves into it, onto a file moves next to it
      const targetFolder = this.isFolder
        ? this.node.path
        : this.node.path.split("/").slice(0, -1).join("/");
      if (from) this.api.move(from, targetFolder);
    },
  },
});
</script>

<template>
  <li class="lia-node">
    <div
      class="lia-node-row"
      :class="{ folder: isFolder }"
      :style="{ paddingLeft: indent }"
      draggable="true"
      @click="onClick"
      @dragstart="onDragStart"
      @dragover.prevent
      @drop="onDrop"
    >
      <i
        v-if="isFolder"
        class="bi lia-chevron"
        :class="expanded ? 'bi-chevron-down' : 'bi-chevron-right'"
      ></i>
      <span v-else class="lia-chevron"></span>

      <i class="bi" :class="icon"></i>
      <span class="lia-node-label" :title="node.path">{{ node.name }}</span>

      <span class="lia-node-actions">
        <i
          v-if="isFolder"
          class="bi bi-file-earmark-plus"
          title="New file"
          @click.stop="api.createFile(node.path)"
        ></i>
        <i
          v-if="isFolder"
          class="bi bi-folder-plus"
          title="New folder"
          @click.stop="api.createFolder(node.path)"
        ></i>
        <i
          class="bi bi-pencil"
          title="Rename"
          @click.stop="api.rename(node)"
        ></i>
        <i
          class="bi bi-download"
          title="Download"
          @click.stop="api.download(node)"
        ></i>
        <i
          class="bi bi-trash"
          title="Delete"
          @click.stop="api.remove(node)"
        ></i>
      </span>
    </div>

    <ul v-if="isFolder && expanded && node.children.length" class="lia-node-children">
      <FileNode
        v-for="child in node.children"
        :key="child.path"
        :node="child"
        :depth="depth + 1"
      />
    </ul>
  </li>
</template>

<style scoped>
.lia-node {
  list-style: none;
}

.lia-node-children {
  margin: 0;
  padding: 0;
}

.lia-node-row {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  cursor: pointer;
  white-space: nowrap;
  font-size: 13px;
  user-select: none;
}

.lia-node-row:hover {
  background-color: rgba(0, 0, 0, 0.06);
}

.lia-chevron {
  display: inline-block;
  width: 12px;
  font-size: 10px;
  color: #888;
  flex: 0 0 auto;
}

.lia-node-label {
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1 1 auto;
}

.lia-node-actions {
  display: none;
  gap: 6px;
  flex: 0 0 auto;
}

.lia-node-row:hover .lia-node-actions {
  display: inline-flex;
}

.lia-node-actions .bi:hover {
  color: var(--bs-primary, #0d6efd);
}
</style>
