<script lang="ts">
import { defineComponent } from "vue";
import Dexie from "../../ts/indexDB";
import { navigateTo } from "../../index";
import { randomString, getGitlabPat } from "../../ts/utils";
import { getProjectDoc, releaseProjectDoc } from "../../ts/ProjectDoc";
import * as GitLab from "../../ts/GitLabRepo";
import type { TreeItem } from "../../ts/GitLabRepo";
import { importPaths, seedEmptyReadme } from "../../ts/gitlabImport";
import GitHubModal from "../../components/GitHub/GitHubModal.vue";
import GitHubFileTree from "../../components/GitHub/GitHubFileTree.vue";
import PatHelp from "../../components/GitLab/PatHelp.vue";

export default defineComponent({
  name: "GitLabImportModal",

  components: { GitHubModal, GitHubFileTree, PatHelp },

  props: {
    visible: { type: Boolean, default: false },
    storageId: { type: String, default: "" },
    connection: { type: String, default: undefined },
  },

  emits: ["close"],

  data() {
    return {
      step: "input" as "input" | "select" | "importing" | "done",
      repoInput: "",
      target: this.storageId ? "current" : "new",
      busy: false,
      // loaded repo state
      host: "",
      projectPath: "",
      branch: "",
      commitSha: "",
      items: [] as TreeItem[],
      truncated: false,
      emptyRepo: false,
      selected: [] as string[],
      // import progress
      progress: { done: 0, total: 0, path: "" },
      importedCount: 0,
      // error / PAT handling
      errorMessage: "",
      patReason: "" as "" | "rate_limit" | "auth",
    };
  },

  watch: {
    visible(v: boolean) {
      if (v) this.reset();
    },
  },

  methods: {
    reset() {
      this.step = "input";
      this.repoInput = "";
      this.target = this.storageId ? "current" : "new";
      this.busy = false;
      this.items = [];
      this.selected = [];
      this.truncated = false;
      this.emptyRepo = false;
      this.errorMessage = "";
      this.patReason = "";
    },

    /** Translate a GitLabError into either an inline PAT prompt or a message. */
    handleError(err: GitLab.GitLabError): boolean {
      if (err.error === "rate_limit" || err.error === "auth") {
        this.patReason = err.error;
        this.errorMessage = "";
        return true;
      }
      this.patReason = "";
      this.errorMessage =
        err.error === "not_found"
          ? this.$t("gitlab.errors.notFound")
          : err.error === "network"
          ? this.$t("gitlab.errors.network")
          : err.message;
      return true;
    },

    async load() {
      const ref = GitLab.parseGitLabUrl(this.repoInput);
      if (!ref) {
        this.errorMessage = this.$t("gitlab.errors.badUrl");
        return;
      }
      this.busy = true;
      this.errorMessage = "";
      this.patReason = "";

      this.host = ref.host;
      this.projectPath = ref.projectPath;
      const pat = getGitlabPat(this.host);

      const result = await GitLab.loadRepoTree(ref.host, ref.projectPath, ref.branch, pat);
      this.busy = false;
      if (GitLab.isError(result)) {
        this.handleError(result);
        return;
      }

      this.branch = result.branch;
      this.commitSha = result.commitSha;
      this.emptyRepo = result.empty;

      let items = result.items;
      if (ref.path) {
        const prefix = ref.path.replace(/\/$/, "") + "/";
        items = items.filter((i) => i.path === ref.path || i.path.startsWith(prefix));
      }
      this.items = items;
      this.truncated = result.truncated;
      this.step = "select";
    },

    onSelectionChange(paths: string[]) {
      this.selected = paths;
    },

    selectAll(value: boolean) {
      (this.$refs.tree as any)?.selectAll(value);
    },

    manageToken() {
      this.errorMessage = "";
      this.patReason = "manage";
    },

    async startImport() {
      if (!this.emptyRepo && this.selected.length === 0) return;
      this.step = "importing";
      this.busy = true;
      this.errorMessage = "";
      this.patReason = "";

      // pick the target ProjectDoc (current project, or a freshly created one)
      const isNew = this.target === "new";
      const targetId = isNew ? randomString(24) : this.storageId;
      const doc = getProjectDoc(targetId, isNew ? undefined : this.connection);
      // For a NEW project we keep our reference until the editor view has taken
      // over: releasing it here (refCount -> 0) would destroy the Yjs doc and its
      // IndexedDB persistence before the freshly imported data is handed off.
      let release = !isNew;

      try {
        if (this.emptyRepo) {
          // empty repository: start the project with an empty README.md
          seedEmptyReadme(doc);
          this.importedCount = 1;
        } else {
          const result = await importPaths(
            doc,
            this.host,
            this.projectPath,
            this.items,
            this.selected,
            getGitlabPat(this.host),
            (p) => (this.progress = p)
          );

          if (GitLab.isError(result)) {
            this.busy = false;
            this.step = "select";
            this.handleError(result);
            return;
          }

          this.importedCount = result.imported;
        }

        // persist the repo link so push/pull can target it automatically
        const database = new Dexie();
        await database.put(targetId, {
          gitlab: {
            host: this.host,
            projectPath: this.projectPath,
            branch: this.branch,
            commitSha: this.commitSha,
          },
        });

        this.busy = false;
        this.step = "done";

        if (isNew) {
          // hand the new project (and our still-held reference) over to the editor
          navigateTo("?/edit/" + targetId);
        }
      } finally {
        if (release) releaseProjectDoc(targetId);
      }
    },

    onPatSaved() {
      // retry whichever stage failed
      if (this.step === "select") {
        this.startImport();
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
  <GitHubModal :visible="visible" :title="$t('gitlab.import.title')" icon="bi-gitlab" @close="close">
    <!-- step: enter repository -->
    <template v-if="step === 'input'">
      <label class="form-label small">{{ $t("gitlab.import.repoLabel") }}</label>
      <div class="input-group mb-2">
        <input
          v-model="repoInput"
          type="text"
          class="form-control"
          :placeholder="$t('gitlab.import.repoPlaceholder')"
          @keyup.enter="load"
        />
        <button class="btn btn-primary" type="button" :disabled="busy || !repoInput.trim()" @click="load">
          <span v-if="busy" class="spinner-border spinner-border-sm"></span>
          {{ $t("gitlab.import.load") }}
        </button>
      </div>
      <p class="form-text">{{ $t("gitlab.import.repoHint") }}</p>
    </template>

    <!-- step: choose files -->
    <template v-else-if="step === 'select'">
      <div class="d-flex justify-content-between align-items-center mb-2">
        <strong>{{ projectPath }}</strong>
        <div class="d-flex align-items-center gap-2">
          <span class="badge bg-secondary">{{ branch }}</span>
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

      <div v-if="emptyRepo" class="alert alert-info">
        {{ $t("gitlab.import.emptyRepo") }}
      </div>

      <template v-else>
        <div v-if="truncated" class="alert alert-warning py-1 px-2 small">
          {{ $t("gitlab.import.truncated") }}
        </div>

        <div class="d-flex gap-2 mb-2">
          <button class="btn btn-sm btn-outline-secondary" @click="selectAll(true)">
            {{ $t("gitlab.import.selectAll") }}
          </button>
          <button class="btn btn-sm btn-outline-secondary" @click="selectAll(false)">
            {{ $t("gitlab.import.selectNone") }}
          </button>
          <span class="ms-auto small text-muted align-self-center">
            {{ $t("gitlab.import.selectedCount", { n: selected.length }) }}
          </span>
        </div>

        <GitHubFileTree ref="tree" :items="items" @change="onSelectionChange" />
      </template>

      <div v-if="storageId" class="mt-3">
        <label class="form-label small d-block">{{ $t("gitlab.import.targetLabel") }}</label>
        <div class="form-check form-check-inline">
          <input id="gl-target-current" v-model="target" class="form-check-input" type="radio" value="current" />
          <label class="form-check-label" for="gl-target-current">{{ $t("gitlab.import.targetCurrent") }}</label>
        </div>
        <div class="form-check form-check-inline">
          <input id="gl-target-new" v-model="target" class="form-check-input" type="radio" value="new" />
          <label class="form-check-label" for="gl-target-new">{{ $t("gitlab.import.targetNew") }}</label>
        </div>
      </div>
    </template>

    <!-- step: importing -->
    <template v-else-if="step === 'importing'">
      <p>{{ $t("gitlab.import.importing") }}</p>
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

    <!-- step: done -->
    <template v-else-if="step === 'done'">
      <div class="alert alert-success">
        {{ $t("gitlab.import.done", { n: importedCount }) }}
      </div>
    </template>

    <!-- inline errors / PAT prompt (any step) -->
    <PatHelp v-if="patReason" :reason="patReason" :host="host" @saved="onPatSaved" />
    <div v-if="errorMessage" class="alert alert-danger mt-2 mb-0">{{ errorMessage }}</div>

    <template #footer>
      <button v-if="step === 'select'" class="btn btn-secondary" @click="step = 'input'">
        {{ $t("gitlab.back") }}
      </button>
      <button
        v-if="step === 'select'"
        class="btn btn-primary"
        :disabled="busy || (!emptyRepo && selected.length === 0)"
        @click="startImport"
      >
        {{ emptyRepo ? $t("gitlab.import.createEmpty") : $t("gitlab.import.importBtn", { n: selected.length }) }}
      </button>
      <button v-if="step === 'done'" class="btn btn-primary" @click="close">
        {{ $t("gitlab.close") }}
      </button>
    </template>
  </GitHubModal>
</template>
