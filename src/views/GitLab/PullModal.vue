<script lang="ts">
import { defineComponent, type PropType } from "vue";
import Dexie from "../../ts/indexDB";
import { getGitlabPat } from "../../ts/utils";
import { getProjectDoc, releaseProjectDoc, ProjectDoc } from "../../ts/ProjectDoc";
import * as GitLab from "../../ts/GitLabRepo";
import type { TreeItem } from "../../ts/GitLabRepo";
import { computeChanges, importPaths, type FileChange } from "../../ts/gitlabImport";
import { formatBytes } from "../../ts/fileIcons";
import GitHubModal from "../../components/GitHub/GitHubModal.vue";
import PatHelp from "../../components/GitLab/PatHelp.vue";

interface RepoLink {
  host: string;
  projectPath: string;
  branch: string;
  commitSha: string;
}

export default defineComponent({
  name: "GitLabPullModal",

  components: { GitHubModal, PatHelp },

  props: {
    visible: { type: Boolean, default: false },
    storageId: { type: String, required: true },
    connection: { type: String, default: undefined },
    gitlab: { type: Object as PropType<RepoLink>, default: null },
  },

  emits: ["close", "updated"],

  data() {
    return {
      step: "loading" as "loading" | "review" | "importing" | "done",
      doc: null as ProjectDoc | null,
      headSha: "",
      items: [] as TreeItem[],
      // only remote-incoming changes (new on remote / modified) are pullable
      incoming: [] as FileChange[],
      selected: new Set<string>(),
      progress: { done: 0, total: 0, path: "" },
      importedCount: 0,
      busy: false,
      errorMessage: "",
      patReason: "" as "" | "rate_limit" | "auth",
      tick: 0,
    };
  },

  computed: {
    hasIncoming(): boolean {
      return this.incoming.length > 0;
    },
    selectedCount(): number {
      void this.tick;
      return this.selected.size;
    },
  },

  watch: {
    visible(v: boolean) {
      if (v) this.load();
      else this.cleanup();
    },
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

    handleError(err: GitLab.GitLabError) {
      if (err.error === "rate_limit" || err.error === "auth") {
        this.patReason = err.error;
        this.errorMessage = "";
      } else {
        this.patReason = "";
        this.errorMessage =
          err.error === "network" ? this.$t("gitlab.errors.network") : err.message;
      }
    },

    async load() {
      this.step = "loading";
      this.errorMessage = "";
      this.patReason = "";
      if (!this.doc) this.doc = getProjectDoc(this.storageId, this.connection);
      const { host, projectPath, branch } = this.gitlab;
      const pat = getGitlabPat(host);

      const result = await GitLab.loadRepoTree(host, projectPath, branch, pat);
      if (GitLab.isError(result)) {
        this.handleError(result);
        this.step = "review";
        return;
      }
      this.headSha = result.commitSha;
      this.items = result.items;

      // empty repository: nothing to pull, treat as up to date instead of erroring
      const changes = result.empty ? [] : await computeChanges(this.doc!, result.items);
      // "deleted" (local-centric) means the file exists only on the remote -> new;
      // "modified" means the remote differs. Both are things we can pull in.
      this.incoming = changes
        .filter((c) => c.status === "deleted" || c.status === "modified")
        .map((c) => ({
          ...c,
          status: c.status === "deleted" ? "added" : "modified",
        }));
      this.selected = new Set(this.incoming.map((c) => c.path));
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

    statusLabel(status: string): string {
      return this.$t("gitlab.pull." + status);
    },

    manageToken() {
      this.errorMessage = "";
      this.patReason = "manage";
    },

    statusClass(status: string): string {
      return status === "added" ? "text-success" : "text-warning";
    },

    async startPull() {
      const paths = this.incoming
        .filter((c) => this.selected.has(c.path))
        .map((c) => c.path);
      if (paths.length === 0) return;

      this.step = "importing";
      this.busy = true;
      this.errorMessage = "";
      this.patReason = "";
      const { host, projectPath, branch } = this.gitlab;

      const result = await importPaths(
        this.doc!,
        host,
        projectPath,
        this.items,
        paths,
        getGitlabPat(host),
        (p) => (this.progress = p)
      );

      if (GitLab.isError(result)) {
        this.busy = false;
        this.step = "review";
        this.handleError(result);
        return;
      }
      this.importedCount = result.imported;

      const database = new Dexie();
      await database.put(this.storageId, {
        gitlab: { host, projectPath, branch, commitSha: this.headSha },
      });
      this.$emit("updated", { ...this.gitlab, commitSha: this.headSha });

      this.busy = false;
      this.step = "done";
    },

    onPatSaved() {
      if (this.step === "importing" || (this.step === "review" && this.hasIncoming)) {
        this.startPull();
      } else {
        this.load();
      }
    },

    close() {
      this.$emit("close");
    },
  },
});
</script>

<template>
  <GitHubModal :visible="visible" :title="$t('gitlab.pull.title')" icon="bi-gitlab" @close="close">
    <div v-if="gitlab" class="d-flex justify-content-between align-items-center mb-2">
      <strong>{{ gitlab.projectPath }}</strong>
      <div class="d-flex align-items-center gap-2">
        <span class="badge bg-secondary">{{ gitlab.branch }}</span>
        <button
          class="btn btn-sm btn-link p-0"
          type="button"
          :title="$t('gitlab.pat.manageTitle')"
          @click="manageToken"
        >
          <i class="bi bi-key"></i>
        </button>
      </div>
    </div>

    <div v-if="step === 'loading'" class="text-center py-3">
      <span class="spinner-border"></span>
      <p class="mt-2 small text-muted">{{ $t("gitlab.pull.checking") }}</p>
    </div>

    <template v-else-if="step === 'review'">
      <div v-if="!hasIncoming && !errorMessage && !patReason" class="alert alert-info">
        {{ $t("gitlab.pull.upToDate") }}
      </div>

      <template v-if="hasIncoming">
        <p class="small">{{ $t("gitlab.pull.changesFound", { n: incoming.length }) }}</p>
        <ul class="gl-changes list-unstyled mb-0">
          <li v-for="c in incoming" :key="c.path" class="gl-change-row">
            <input
              type="checkbox"
              class="form-check-input me-2"
              :checked="isSelected(c.path)"
              @change="toggle(c.path)"
            />
            <span class="gl-status" :class="statusClass(c.status)">{{ statusLabel(c.status) }}</span>
            <span class="gl-change-path" :title="c.path">{{ c.path }}</span>
            <span v-if="c.size != null" class="gl-change-size">{{ formatBytes(c.size) }}</span>
          </li>
        </ul>
      </template>
    </template>

    <template v-else-if="step === 'importing'">
      <p>{{ $t("gitlab.pull.importing") }}</p>
      <div class="progress">
        <div
          class="progress-bar progress-bar-striped progress-bar-animated"
          :style="{ width: progress.total ? (progress.done / progress.total) * 100 + '%' : '0%' }"
        >
          {{ progress.done }} / {{ progress.total }}
        </div>
      </div>
      <p class="small text-muted mt-2 text-truncate">{{ progress.path }}</p>
    </template>

    <div v-else-if="step === 'done'" class="alert alert-success">
      {{ $t("gitlab.pull.done", { n: importedCount }) }}
    </div>

    <PatHelp v-if="patReason" :reason="patReason" :host="gitlab.host" @saved="onPatSaved" />
    <div v-if="errorMessage" class="alert alert-danger mt-2 mb-0">{{ errorMessage }}</div>

    <template #footer>
      <button
        v-if="step === 'review' && hasIncoming"
        class="btn btn-primary"
        :disabled="busy || selectedCount === 0"
        @click="startPull"
      >
        {{ $t("gitlab.pull.pullBtn", { n: selectedCount }) }}
      </button>
      <button v-if="step === 'done'" class="btn btn-primary" @click="close">
        {{ $t("gitlab.close") }}
      </button>
    </template>
  </GitHubModal>
</template>

<style scoped>
.gl-changes {
  max-height: 45vh;
  overflow: auto;
  font-size: 13px;
}

.gl-change-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 2px 0;
}

.gl-status {
  flex: 0 0 60px;
  font-size: 0.7rem;
  text-transform: uppercase;
  font-weight: 600;
}

.gl-change-path {
  flex: 1 1 auto;
  overflow: hidden;
  text-overflow: ellipsis;
}

.gl-change-size {
  flex: 0 0 auto;
  font-size: 0.7rem;
  color: #999;
}
</style>
