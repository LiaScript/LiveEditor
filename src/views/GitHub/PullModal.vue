<script lang="ts">
import { defineComponent, type PropType } from "vue";
import Dexie from "../../ts/indexDB";
import { getGithubPat } from "../../ts/utils";
import { getProjectDoc, releaseProjectDoc, ProjectDoc } from "../../ts/ProjectDoc";
import * as GitHub from "../../ts/GitHubRepo";
import type { TreeItem } from "../../ts/GitHubRepo";
import { computeChanges, importPaths, type FileChange } from "../../ts/githubImport";
import { formatBytes } from "../../ts/fileIcons";
import GitHubModal from "../../components/GitHub/GitHubModal.vue";
import PatHelp from "../../components/GitHub/PatHelp.vue";

interface RepoLink {
  owner: string;
  repo: string;
  branch: string;
  commitSha: string;
}

export default defineComponent({
  name: "PullModal",

  components: { GitHubModal, PatHelp },

  props: {
    visible: { type: Boolean, default: false },
    storageId: { type: String, required: true },
    connection: { type: String, default: undefined },
    github: { type: Object as PropType<RepoLink>, default: null },
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

    handleError(err: GitHub.GitHubError) {
      if (err.error === "rate_limit" || err.error === "auth") {
        this.patReason = err.error;
        this.errorMessage = "";
      } else {
        this.patReason = "";
        this.errorMessage =
          err.error === "network" ? this.$t("github.errors.network") : err.message;
      }
    },

    async load() {
      this.step = "loading";
      this.errorMessage = "";
      this.patReason = "";
      if (!this.doc) this.doc = getProjectDoc(this.storageId, this.connection);
      const pat = getGithubPat();
      const { owner, repo, branch } = this.github;

      const result = await GitHub.loadRepoTree(owner, repo, branch, pat);
      if (GitHub.isError(result)) {
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
      return this.$t("github.pull." + status);
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
      const { owner, repo, branch } = this.github;

      const result = await importPaths(
        this.doc!,
        owner,
        repo,
        this.items,
        paths,
        getGithubPat(),
        (p) => (this.progress = p)
      );

      if (GitHub.isError(result)) {
        this.busy = false;
        this.step = "review";
        this.handleError(result);
        return;
      }
      this.importedCount = result.imported;

      const database = new Dexie();
      await database.put(this.storageId, {
        github: { owner, repo, branch, commitSha: this.headSha },
      });
      this.$emit("updated", { ...this.github, commitSha: this.headSha });

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
  <GitHubModal :visible="visible" :title="$t('github.pull.title')" @close="close">
    <div v-if="github" class="d-flex justify-content-between align-items-center mb-2">
      <strong>{{ github.owner }}/{{ github.repo }}</strong>
      <span class="badge bg-secondary">{{ github.branch }}</span>
    </div>

    <div v-if="step === 'loading'" class="text-center py-3">
      <span class="spinner-border"></span>
      <p class="mt-2 small text-muted">{{ $t("github.pull.checking") }}</p>
    </div>

    <template v-else-if="step === 'review'">
      <div v-if="!hasIncoming && !errorMessage && !patReason" class="alert alert-info">
        {{ $t("github.pull.upToDate") }}
      </div>

      <template v-if="hasIncoming">
        <p class="small">{{ $t("github.pull.changesFound", { n: incoming.length }) }}</p>
        <ul class="gh-changes list-unstyled mb-0">
          <li v-for="c in incoming" :key="c.path" class="gh-change-row">
            <input
              type="checkbox"
              class="form-check-input me-2"
              :checked="isSelected(c.path)"
              @change="toggle(c.path)"
            />
            <span class="gh-status" :class="statusClass(c.status)">{{ statusLabel(c.status) }}</span>
            <span class="gh-change-path" :title="c.path">{{ c.path }}</span>
            <span v-if="c.size != null" class="gh-change-size">{{ formatBytes(c.size) }}</span>
          </li>
        </ul>
      </template>
    </template>

    <template v-else-if="step === 'importing'">
      <p>{{ $t("github.pull.importing") }}</p>
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
      {{ $t("github.pull.done", { n: importedCount }) }}
    </div>

    <PatHelp v-if="patReason" :reason="patReason" @saved="onPatSaved" />
    <div v-if="errorMessage" class="alert alert-danger mt-2 mb-0">{{ errorMessage }}</div>

    <template #footer>
      <button
        v-if="step === 'review' && hasIncoming"
        class="btn btn-primary"
        :disabled="busy || selectedCount === 0"
        @click="startPull"
      >
        {{ $t("github.pull.pullBtn", { n: selectedCount }) }}
      </button>
      <button v-if="step === 'done'" class="btn btn-primary" @click="close">
        {{ $t("github.close") }}
      </button>
    </template>
  </GitHubModal>
</template>

<style scoped>
.gh-changes {
  max-height: 45vh;
  overflow: auto;
  font-size: 13px;
}

.gh-change-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 2px 0;
}

.gh-status {
  flex: 0 0 60px;
  font-size: 0.7rem;
  text-transform: uppercase;
  font-weight: 600;
}

.gh-change-path {
  flex: 1 1 auto;
  overflow: hidden;
  text-overflow: ellipsis;
}

.gh-change-size {
  flex: 0 0 auto;
  font-size: 0.7rem;
  color: #999;
}
</style>
