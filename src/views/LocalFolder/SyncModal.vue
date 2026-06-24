<script lang="ts">
import { defineComponent } from "vue";
import { getProjectDoc, releaseProjectDoc, ProjectDoc } from "../../ts/ProjectDoc";
import * as LocalFolder from "../../ts/LocalFolder";
import { computeSync, applySync, type SyncEntry } from "../../ts/localFolderSync";
import { formatBytes } from "../../ts/fileIcons";

// Bidirectional sync dialog between the editor (ProjectDoc) and a linked local
// folder. Mirrors the GitHub PushModal structure but needs no auth and no
// commit message; instead it shows per-entry direction (push/pull) and lets the
// user resolve conflicts that the 3-way diff detected.
export default defineComponent({
  name: "LocalFolderSyncModal",

  props: {
    visible: { type: Boolean, default: false },
    storageId: { type: String, required: true },
    connection: { type: String, default: undefined },
    folderName: { type: String, default: "" },
  },

  emits: ["close"],

  data() {
    return {
      step: "loading" as "loading" | "review" | "applying" | "done" | "denied",
      doc: null as ProjectDoc | null,
      handle: null as LocalFolder.DirHandle,
      manifest: new Map<string, string>(),
      entries: [] as SyncEntry[],
      selected: new Set<string>(),
      errorMessage: "",
      progress: 0,
      total: 0,
      tick: 0,
    };
  },

  computed: {
    hasEntries(): boolean {
      void this.tick;
      return this.entries.length > 0;
    },
    // selected count, excluding conflicts that still lack a resolution
    applicableCount(): number {
      void this.tick;
      return this.entries.filter((e) => this.isApplicable(e)).length;
    },
  },

  watch: {
    visible(v: boolean) {
      if (v) this.load();
      else this.cleanup();
    },
  },

  // The component may be (async-)mounted with visible already true — e.g. when
  // opened straight from the index page's folder import — in which case the
  // watch above never fires, so kick off the initial load here.
  mounted() {
    if (this.visible) this.load();
  },

  unmounted() {
    this.cleanup();
  },

  methods: {
    formatBytes,

    cleanup() {
      if (this.doc) {
        releaseProjectDoc(this.storageId);
        this.doc = null;
      }
    },

    async load() {
      this.step = "loading";
      this.errorMessage = "";
      if (!this.doc) this.doc = getProjectDoc(this.storageId, this.connection);

      const record = await LocalFolder.loadFolder(this.storageId);
      if (!record) {
        this.errorMessage = this.$t("localFolder.errors.noFolder");
        this.step = "review";
        return;
      }
      this.handle = record.handle;

      // permission may need a (re)grant after a reload; the click that opened
      // this modal counts as the required user gesture.
      const ok = await LocalFolder.verifyPermission(this.handle, true);
      if (!ok) {
        this.step = "denied";
        return;
      }

      this.manifest = await LocalFolder.loadManifest(this.storageId);
      try {
        this.entries = await computeSync(this.doc!, this.handle, this.manifest);
      } catch (err: any) {
        this.errorMessage = err?.message || String(err);
        this.step = "review";
        return;
      }
      // pre-select everything that is unambiguous (conflicts stay unchecked)
      this.selected = new Set(
        this.entries.filter((e) => e.direction !== "conflict").map((e) => e.path)
      );
      this.tick++;
      this.step = "review";
    },

    isSelected(path: string): boolean {
      void this.tick;
      return this.selected.has(path);
    },

    toggle(path: string) {
      if (this.selected.has(path)) this.selected.delete(path);
      else this.selected.add(path);
      this.tick++;
    },

    // a row contributes to the sync only when selected and (for conflicts) the
    // user has chosen a side
    isApplicable(e: SyncEntry): boolean {
      if (!this.selected.has(e.path)) return false;
      if (e.direction === "conflict") return !!e.resolution;
      return true;
    },

    resolve(e: SyncEntry, side: "editor" | "disk") {
      e.resolution = side;
      this.selected.add(e.path);
      this.tick++;
    },

    directionIcon(e: SyncEntry): string {
      if (e.direction === "conflict") return "bi-exclamation-triangle-fill";
      return e.direction === "push" ? "bi-arrow-up-circle" : "bi-arrow-down-circle";
    },

    rowClass(e: SyncEntry): string {
      if (e.direction === "conflict") return "text-danger";
      return e.direction === "push" ? "text-primary" : "text-success";
    },

    directionLabel(e: SyncEntry): string {
      return this.$t("localFolder.direction." + e.direction);
    },

    async apply() {
      const toApply = this.entries.filter((e) => this.isApplicable(e));
      if (toApply.length === 0) return;

      this.step = "applying";
      this.progress = 0;
      this.total = toApply.length;
      try {
        const newManifest = await applySync(
          this.doc!,
          this.handle,
          toApply,
          this.manifest,
          (p) => {
            this.progress = p.done;
            this.total = p.total;
          }
        );
        await LocalFolder.saveManifest(this.storageId, newManifest);
        this.manifest = newManifest;
        this.step = "done";
      } catch (err: any) {
        this.errorMessage = err?.message || String(err);
        this.step = "review";
      }
    },

    async retryPermission() {
      await this.load();
    },

    close() {
      this.$emit("close");
    },
  },
});
</script>

<template>
  <div class="lf-modal" v-if="visible">
    <div class="modal-backdrop" @click="close"></div>
    <div class="modal-container">
      <div class="modal-header">
        <h5 class="modal-title">
          <i class="bi bi-folder2-open"></i> {{ $t("localFolder.sync.title") }}
        </h5>
        <button type="button" class="btn-close" @click="close"></button>
      </div>

      <div class="modal-body">
        <div v-if="folderName" class="d-flex justify-content-between align-items-center mb-2">
          <strong><i class="bi bi-folder"></i> {{ folderName }}</strong>
        </div>

        <div v-if="step === 'loading'" class="text-center py-3">
          <span class="spinner-border"></span>
          <p class="mt-2 small text-muted">{{ $t("localFolder.sync.computing") }}</p>
        </div>

        <div v-else-if="step === 'denied'" class="alert alert-warning">
          {{ $t("localFolder.errors.permission") }}
        </div>

        <template v-else-if="step === 'review'">
          <div v-if="!hasEntries && !errorMessage" class="alert alert-info">
            {{ $t("localFolder.sync.inSync") }}
          </div>

          <ul v-if="hasEntries" class="lf-changes list-unstyled mb-2">
            <li v-for="e in entries" :key="e.path" class="lf-change-row">
              <input
                type="checkbox"
                class="form-check-input me-2"
                :checked="isSelected(e.path)"
                @change="toggle(e.path)"
              />
              <i class="bi" :class="[directionIcon(e), rowClass(e)]" :title="directionLabel(e)"></i>
              <span class="lf-change-path" :title="e.path">{{ e.path }}</span>
              <span v-if="e.size != null" class="lf-change-size">{{ formatBytes(e.size) }}</span>

              <span v-if="e.direction === 'conflict'" class="lf-resolve btn-group btn-group-sm">
                <button
                  type="button"
                  class="btn"
                  :class="e.resolution === 'editor' ? 'btn-primary' : 'btn-outline-secondary'"
                  @click="resolve(e, 'editor')"
                >
                  {{ $t("localFolder.sync.keepEditor") }}
                </button>
                <button
                  type="button"
                  class="btn"
                  :class="e.resolution === 'disk' ? 'btn-success' : 'btn-outline-secondary'"
                  @click="resolve(e, 'disk')"
                >
                  {{ $t("localFolder.sync.keepDisk") }}
                </button>
              </span>
            </li>
          </ul>

          <p v-if="hasEntries" class="small text-muted mb-0">
            <i class="bi bi-arrow-up-circle text-primary"></i> {{ $t("localFolder.direction.push") }}
            &nbsp;·&nbsp;
            <i class="bi bi-arrow-down-circle text-success"></i> {{ $t("localFolder.direction.pull") }}
            &nbsp;·&nbsp;
            <i class="bi bi-exclamation-triangle-fill text-danger"></i> {{ $t("localFolder.direction.conflict") }}
          </p>
        </template>

        <div v-else-if="step === 'applying'" class="text-center py-3">
          <span class="spinner-border"></span>
          <p class="mt-2 small text-muted">
            {{ $t("localFolder.sync.applying") }} ({{ progress }}/{{ total }})
          </p>
        </div>

        <div v-else-if="step === 'done'" class="alert alert-success">
          {{ $t("localFolder.sync.done") }}
        </div>

        <div v-if="errorMessage" class="alert alert-danger mt-2 mb-0">{{ errorMessage }}</div>
      </div>

      <div class="modal-footer-bar">
        <button
          v-if="step === 'denied'"
          class="btn btn-primary"
          @click="retryPermission"
        >
          {{ $t("localFolder.sync.grant") }}
        </button>
        <button
          v-if="step === 'review' && hasEntries"
          class="btn btn-primary"
          :disabled="applicableCount === 0"
          @click="apply"
        >
          {{ $t("localFolder.sync.applyBtn", { n: applicableCount }) }}
        </button>
        <button v-if="step === 'done'" class="btn btn-primary" @click="close">
          {{ $t("localFolder.close") }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.lf-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 2000;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 1rem;
}

.modal-backdrop {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
}

.modal-container {
  position: relative;
  width: 90%;
  max-width: 680px;
  max-height: 90vh;
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
  overflow: hidden;
  z-index: 2001;
  margin: 2rem 0;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid #dee2e6;
}

.modal-body {
  padding: 1.25rem;
  overflow-y: auto;
  flex: 1;
}

.modal-footer-bar {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem;
  border-top: 1px solid #dee2e6;
}

.modal-footer-bar:empty {
  display: none;
}

.lf-changes {
  max-height: 45vh;
  overflow: auto;
  font-size: 13px;
}

.lf-change-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 0;
}

.lf-change-path {
  flex: 1 1 auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lf-change-size {
  flex: 0 0 auto;
  font-size: 0.7rem;
  color: #999;
}

.lf-resolve {
  flex: 0 0 auto;
}

@media (prefers-color-scheme: dark) {
  .modal-container {
    background-color: #343a40;
    color: #f8f9fa;
  }
  .modal-header,
  .modal-footer-bar {
    border-color: #495057;
  }
  .btn-close {
    filter: invert(1) grayscale(100%) brightness(200%);
  }
}
</style>
