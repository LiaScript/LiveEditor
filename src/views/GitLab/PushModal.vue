<script lang="ts">
import { defineComponent, type PropType } from "vue";
import { editor as monacoEditor } from "monaco-editor";
import Dexie from "../../ts/indexDB";
import { getGitlabPat } from "../../ts/utils";
import { getProjectDoc, releaseProjectDoc, ProjectDoc } from "../../ts/ProjectDoc";
import * as GitLab from "../../ts/GitLabRepo";
import { computeChanges, pushChanges, type FileChange } from "../../ts/gitlabImport";
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
  name: "GitLabPushModal",

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
      step: "loading" as "loading" | "review" | "pushing" | "done",
      doc: null as ProjectDoc | null,
      headSha: "",
      remoteDrift: false,
      changes: [] as FileChange[],
      selected: new Set<string>(),
      commitMessage: "",
      busy: false,
      errorMessage: "",
      patReason: "" as "" | "rate_limit" | "auth",
      diffPath: "",
      tick: 0,
    };
  },

  computed: {
    hasChanges(): boolean {
      return this.changes.length > 0;
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
      this.disposeDiff();
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
      this.commitMessage = this.$t("gitlab.push.defaultMessage");
      if (!this.doc) this.doc = getProjectDoc(this.storageId, this.connection);
      const { host, projectPath, branch, commitSha } = this.gitlab;
      const pat = getGitlabPat(host);

      const head = await GitLab.getBranchHead(host, projectPath, branch, pat);
      if (GitLab.isError(head)) {
        this.handleError(head);
        this.step = "review";
        return;
      }
      this.headSha = head;
      this.remoteDrift = !!commitSha && head !== commitSha;

      const tree = await GitLab.getTree(host, projectPath, head, pat);
      if (GitLab.isError(tree)) {
        this.handleError(tree);
        this.step = "review";
        return;
      }

      this.changes = await computeChanges(this.doc!, tree.items);
      this.selected = new Set(this.changes.map((c) => c.path));
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

    statusClass(status: string): string {
      return status === "added"
        ? "text-success"
        : status === "deleted"
        ? "text-danger"
        : "text-warning";
    },

    statusLabel(status: string): string {
      return this.$t("gitlab.push." + status);
    },

    manageToken() {
      this.errorMessage = "";
      this.patReason = "manage";
    },

    // ---- Monaco diff for modified text files --------------------------------
    async openDiff(change: FileChange) {
      if (!change.isText || change.status === "added") return;
      this.diffPath = change.path;
      const { host, projectPath } = this.gitlab;
      const pat = getGitlabPat(host);
      const remoteBytes =
        change.status === "deleted" || change.remoteSha
          ? await GitLab.getBlob(host, projectPath, change.remoteSha!, pat)
          : new Uint8Array();
      if (GitLab.isError(remoteBytes)) {
        this.handleError(remoteBytes);
        this.diffPath = "";
        return;
      }
      const remoteText = new TextDecoder().decode(remoteBytes);
      const localBytes =
        change.status === "deleted" ? new Uint8Array() : this.doc!.readFileData(change.path);
      const localText = localBytes ? new TextDecoder().decode(localBytes) : "";

      this.$nextTick(() => {
        this.disposeDiff();
        const container = this.$refs.diffContainer as HTMLElement;
        if (!container) return;
        const diff = monacoEditor.createDiffEditor(container, {
          readOnly: true,
          automaticLayout: true,
          renderSideBySide: true,
          fontSize: 12,
        });
        diff.setModel({
          original: monacoEditor.createModel(remoteText),
          modified: monacoEditor.createModel(localText),
        });
        (this as any)._diff = diff;
      });
    },

    disposeDiff() {
      const diff = (this as any)._diff;
      if (diff) {
        const model = diff.getModel();
        model?.original?.dispose();
        model?.modified?.dispose();
        diff.dispose();
        (this as any)._diff = null;
      }
    },

    closeDiff() {
      this.disposeDiff();
      this.diffPath = "";
    },

    // ---- the actual push ----------------------------------------------------
    async push() {
      const { host, projectPath, branch } = this.gitlab;
      const pat = getGitlabPat(host);
      if (!pat) {
        this.patReason = "auth";
        return;
      }
      const selected = this.changes.filter((c) => this.selected.has(c.path));
      if (selected.length === 0) return;

      this.step = "pushing";
      this.busy = true;
      this.errorMessage = "";
      this.patReason = "";

      try {
        const result = await pushChanges(
          this.doc!,
          host,
          projectPath,
          branch,
          this.commitMessage || this.$t("gitlab.push.defaultMessage"),
          selected,
          pat
        );
        if (GitLab.isError(result)) return this.fail(result);

        // persist the new head so future push/pull diff against it
        const database = new Dexie();
        await database.put(this.storageId, {
          gitlab: { host, projectPath, branch, commitSha: result.commitSha },
        });
        this.$emit("updated", { ...this.gitlab, commitSha: result.commitSha });

        this.busy = false;
        this.step = "done";
      } finally {
        this.busy = false;
      }
    },

    fail(err: GitLab.GitLabError) {
      this.busy = false;
      this.step = "review";
      this.handleError(err);
    },

    onPatSaved() {
      if (this.step === "review" && this.changes.length === 0) this.load();
      else this.push();
    },

    close() {
      this.$emit("close");
    },
  },
});
</script>

<template>
  <GitHubModal :visible="visible" :title="$t('gitlab.push.title')" icon="bi-gitlab" @close="close">
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
      <p class="mt-2 small text-muted">{{ $t("gitlab.push.computing") }}</p>
    </div>

    <template v-else-if="step === 'review'">
      <div v-if="remoteDrift" class="alert alert-warning py-1 px-2 small">
        {{ $t("gitlab.push.remoteDrift") }}
      </div>

      <div v-if="!hasChanges && !errorMessage && !patReason" class="alert alert-info">
        {{ $t("gitlab.push.noChanges") }}
      </div>

      <ul v-if="hasChanges" class="gl-changes list-unstyled mb-3">
        <li v-for="c in changes" :key="c.path" class="gl-change-row">
          <input
            type="checkbox"
            class="form-check-input me-2"
            :checked="isSelected(c.path)"
            @change="toggle(c.path)"
          />
          <span class="gl-status" :class="statusClass(c.status)">{{ statusLabel(c.status) }}</span>
          <span class="gl-change-path" :title="c.path">{{ c.path }}</span>
          <span v-if="c.size != null" class="gl-change-size">{{ formatBytes(c.size) }}</span>
          <button
            v-if="c.isText && c.status !== 'added'"
            class="btn btn-sm btn-link p-0 gl-diff-btn"
            @click="openDiff(c)"
          >
            {{ $t("gitlab.push.viewDiff") }}
          </button>
        </li>
      </ul>

      <div v-if="diffPath" class="gl-diff-wrap mb-3">
        <div class="d-flex justify-content-between align-items-center mb-1">
          <small class="text-muted">{{ diffPath }} · {{ $t("gitlab.push.diffHint") }}</small>
          <button class="btn btn-sm btn-outline-secondary" @click="closeDiff">
            {{ $t("gitlab.close") }}
          </button>
        </div>
        <div ref="diffContainer" class="gl-diff-container"></div>
      </div>

      <div v-if="hasChanges" class="mb-2">
        <label class="form-label small">{{ $t("gitlab.push.commitMessage") }}</label>
        <input v-model="commitMessage" type="text" class="form-control" />
      </div>
    </template>

    <div v-else-if="step === 'pushing'" class="text-center py-3">
      <span class="spinner-border"></span>
      <p class="mt-2 small text-muted">{{ $t("gitlab.push.pushing") }}</p>
    </div>

    <div v-else-if="step === 'done'" class="alert alert-success">
      {{ $t("gitlab.push.done") }}
    </div>

    <PatHelp v-if="patReason" :reason="patReason" :host="gitlab.host" @saved="onPatSaved" />
    <div v-if="errorMessage" class="alert alert-danger mt-2 mb-0">{{ errorMessage }}</div>

    <template #footer>
      <button
        v-if="step === 'review' && hasChanges"
        class="btn btn-primary"
        :disabled="busy || selectedCount === 0"
        @click="push"
      >
        {{ $t("gitlab.push.pushBtn", { n: selectedCount }) }}
      </button>
      <button v-if="step === 'done'" class="btn btn-primary" @click="close">
        {{ $t("gitlab.close") }}
      </button>
    </template>
  </GitHubModal>
</template>

<style scoped>
.gl-changes {
  max-height: 40vh;
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
  flex: 0 0 70px;
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

.gl-diff-btn {
  flex: 0 0 auto;
}

.gl-diff-container {
  height: 300px;
  border: 1px solid #dee2e6;
  border-radius: 4px;
}
</style>
