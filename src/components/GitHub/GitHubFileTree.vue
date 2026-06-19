<script lang="ts">
import { defineComponent, type PropType } from "vue";
import { LARGE_FILE, MAX_BLOB, type TreeItem } from "../../ts/GitHubRepo";
import { iconFor, formatBytes } from "../../ts/fileIcons";

interface Node {
  path: string;
  name: string;
  isFolder: boolean;
  size?: number;
  sha?: string;
  depth: number;
  children: Node[];
}

function isHidden(path: string): boolean {
  return path.split("/").some((seg) => seg.startsWith("."));
}

export default defineComponent({
  name: "GitHubFileTree",

  props: {
    items: { type: Array as PropType<TreeItem[]>, required: true },
  },

  emits: ["change"],

  data() {
    return {
      root: [] as Node[],
      expanded: new Set<string>(),
      selected: new Set<string>(),
      // bump to force recomputation of folder checkbox states after mutations
      tick: 0,
    };
  },

  computed: {
    // Flatten the tree into the rows that are currently visible (respecting
    // collapsed folders) for simple v-for rendering.
    visibleRows(): Node[] {
      const rows: Node[] = [];
      const walk = (nodes: Node[]) => {
        for (const n of nodes) {
          rows.push(n);
          if (n.isFolder && this.expanded.has(n.path)) walk(n.children);
        }
      };
      walk(this.root);
      return rows;
    },
  },

  watch: {
    items: {
      immediate: true,
      handler() {
        this.build();
      },
    },
  },

  methods: {
    formatBytes,
    iconFor,
    isHidden,

    build() {
      const rootNodes: Node[] = [];
      const lookup = new Map<string, Node>();

      const ensureFolder = (path: string): Node => {
        let node = lookup.get(path);
        if (node) return node;
        const segments = path.split("/");
        const name = segments[segments.length - 1];
        node = {
          path,
          name,
          isFolder: true,
          depth: segments.length - 1,
          children: [],
        };
        lookup.set(path, node);
        if (segments.length === 1) {
          rootNodes.push(node);
        } else {
          const parent = ensureFolder(segments.slice(0, -1).join("/"));
          parent.children.push(node);
        }
        return node;
      };

      for (const item of this.items) {
        const segments = item.path.split("/");
        const name = segments[segments.length - 1];
        if (item.type === "tree") {
          ensureFolder(item.path);
          continue;
        }
        const node: Node = {
          path: item.path,
          name,
          isFolder: false,
          size: item.size,
          sha: item.sha,
          depth: segments.length - 1,
          children: [],
        };
        lookup.set(item.path, node);
        if (segments.length === 1) {
          rootNodes.push(node);
        } else {
          const parent = ensureFolder(segments.slice(0, -1).join("/"));
          parent.children.push(node);
        }
      }

      const sort = (nodes: Node[]) => {
        nodes.sort((a, b) => {
          if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
          return a.name.localeCompare(b.name);
        });
        nodes.forEach((n) => n.isFolder && sort(n.children));
      };
      sort(rootNodes);

      this.root = rootNodes;
      this.expanded = new Set();
      // expand top-level folders by default so the listing isn't fully collapsed
      rootNodes.forEach((n) => {
        if (n.isFolder) this.expanded.add(n.path);
      });

      // default selection: every non-hidden, importable file
      const selected = new Set<string>();
      for (const item of this.items) {
        if (item.type !== "blob") continue;
        if (isHidden(item.path)) continue;
        if ((item.size || 0) > MAX_BLOB) continue;
        selected.add(item.path);
      }
      this.selected = selected;
      this.emitChange();
    },

    fileNodes(node: Node): Node[] {
      // all selectable (<= MAX_BLOB) file descendants of a folder (or self)
      if (!node.isFolder) {
        return (node.size || 0) > MAX_BLOB ? [] : [node];
      }
      const out: Node[] = [];
      const walk = (n: Node) => {
        for (const c of n.children) {
          if (c.isFolder) walk(c);
          else if ((c.size || 0) <= MAX_BLOB) out.push(c);
        }
      };
      walk(node);
      return out;
    },

    folderState(node: Node): "checked" | "unchecked" | "mixed" {
      // referencing tick keeps this reactive to selection changes
      void this.tick;
      const files = this.fileNodes(node);
      if (files.length === 0) return "unchecked";
      let sel = 0;
      for (const f of files) if (this.selected.has(f.path)) sel++;
      if (sel === 0) return "unchecked";
      if (sel === files.length) return "checked";
      return "mixed";
    },

    isSelected(node: Node): boolean {
      void this.tick;
      return this.selected.has(node.path);
    },

    toggleExpand(node: Node) {
      if (!node.isFolder) return;
      if (this.expanded.has(node.path)) this.expanded.delete(node.path);
      else this.expanded.add(node.path);
      this.expanded = new Set(this.expanded);
    },

    toggleNode(node: Node) {
      if (node.isFolder) {
        const files = this.fileNodes(node);
        const allSelected = files.every((f) => this.selected.has(f.path));
        for (const f of files) {
          if (allSelected) this.selected.delete(f.path);
          else this.selected.add(f.path);
        }
      } else {
        if ((node.size || 0) > MAX_BLOB) return;
        if (this.selected.has(node.path)) this.selected.delete(node.path);
        else this.selected.add(node.path);
      }
      this.tick++;
      this.emitChange();
    },

    selectAll(value: boolean) {
      if (!value) {
        this.selected = new Set();
      } else {
        const all = new Set<string>();
        for (const item of this.items) {
          if (item.type === "blob" && (item.size || 0) <= MAX_BLOB) all.add(item.path);
        }
        this.selected = all;
      }
      this.tick++;
      this.emitChange();
    },

    emitChange() {
      this.$emit("change", Array.from(this.selected));
    },

    /** Public: the currently selected file paths. */
    getSelected(): string[] {
      return Array.from(this.selected);
    },

    isLarge(node: Node): boolean {
      return !node.isFolder && (node.size || 0) >= LARGE_FILE && (node.size || 0) <= MAX_BLOB;
    },

    isTooBig(node: Node): boolean {
      return !node.isFolder && (node.size || 0) > MAX_BLOB;
    },
  },
});
</script>

<template>
  <div class="gh-tree">
    <div
      v-for="node in visibleRows"
      :key="node.path"
      class="gh-row"
      :class="{ hidden: isHidden(node.path) }"
      :style="{ paddingLeft: 4 + node.depth * 16 + 'px' }"
    >
      <input
        type="checkbox"
        class="gh-check"
        :checked="node.isFolder ? folderState(node) === 'checked' : isSelected(node)"
        :indeterminate="node.isFolder && folderState(node) === 'mixed'"
        :disabled="isTooBig(node)"
        @change="toggleNode(node)"
      />

      <i
        v-if="node.isFolder"
        class="bi gh-chevron"
        :class="expanded.has(node.path) ? 'bi-chevron-down' : 'bi-chevron-right'"
        @click="toggleExpand(node)"
      ></i>
      <span v-else class="gh-chevron"></span>

      <i
        class="bi gh-icon"
        :class="iconFor(node.name, node.isFolder, expanded.has(node.path))"
        @click="toggleExpand(node)"
      ></i>

      <span class="gh-label" :title="node.path" @click="toggleExpand(node)">
        {{ node.name }}
      </span>

      <span v-if="isTooBig(node)" class="badge bg-danger gh-badge">
        {{ $t("github.tree.tooBig") }} · {{ formatBytes(node.size) }}
      </span>
      <span v-else-if="isLarge(node)" class="badge bg-warning text-dark gh-badge">
        {{ $t("github.tree.large") }} · {{ formatBytes(node.size) }}
      </span>
      <span v-else-if="!node.isFolder && node.size" class="gh-size">
        {{ formatBytes(node.size) }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.gh-tree {
  font-size: 13px;
  max-height: 45vh;
  overflow: auto;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  padding: 4px 0;
}

.gh-row {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 1px 8px 1px 0;
  white-space: nowrap;
}

.gh-row:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

.gh-row.hidden .gh-label,
.gh-row.hidden .gh-icon {
  opacity: 0.55;
  font-style: italic;
}

.gh-check {
  width: 14px;
  height: 14px;
  cursor: pointer;
  flex: 0 0 auto;
}

.gh-chevron {
  display: inline-block;
  width: 12px;
  font-size: 10px;
  color: #888;
  flex: 0 0 auto;
  cursor: pointer;
}

.gh-icon {
  flex: 0 0 auto;
  cursor: pointer;
  color: #555;
}

.gh-label {
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1 1 auto;
  cursor: pointer;
}

.gh-badge {
  flex: 0 0 auto;
  font-size: 0.65rem;
}

.gh-size {
  flex: 0 0 auto;
  font-size: 0.7rem;
  color: #999;
}
</style>
