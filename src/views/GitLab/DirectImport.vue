<script lang="ts">
import { defineComponent } from "vue";
import Dexie from "../../ts/indexDB";
import { navigateTo } from "../../index";
import { randomString, getGitlabPat } from "../../ts/utils";
import { getProjectDoc, releaseProjectDoc } from "../../ts/ProjectDoc";
import * as GitLab from "../../ts/GitLabRepo";
import type { TreeItem } from "../../ts/GitLabRepo";
import { importPaths, seedEmptyReadme } from "../../ts/gitlabImport";
import GitHubFileTree from "../../components/GitHub/GitHubFileTree.vue";
import PatHelp from "../../components/GitLab/PatHelp.vue";

// Full-page view for the ?/gitlab/<host>/<projectPath> route: lets the user
// choose which repository files to import, then creates a new project from
// the selection and hands it over to the editor.
export default defineComponent({
  name: "GitLabDirectImport",

  components: { GitHubFileTree, PatHelp },

  props: {
    // the whole route tail, e.g. "gitlab.com/group/subgroup/project"
    target: { type: String, required: true },
  },

  data() {
    return {
      host: "",
      projectPath: "",
      step: "loading" as "loading" | "select" | "importing" | "error",
      branch: "",
      commitSha: "",
      items: [] as TreeItem[],
      truncated: false,
      emptyRepo: false,
      selected: [] as string[],
      progress: { done: 0, total: 0, path: "" },
      errorMessage: "",
      patReason: "" as "" | "rate_limit" | "auth",
    };
  },

  created() {
    const ref = GitLab.parseGitLabUrl("https://" + this.target);
    if (!ref) {
      this.step = "error";
      this.errorMessage = this.$t("gitlab.errors.badUrl");
      return;
    }
    this.host = ref.host;
    this.projectPath = ref.projectPath;
    this.load();
  },

  methods: {
    handleError(err: GitLab.GitLabError) {
      this.step = "error";
      if (err.error === "rate_limit" || err.error === "auth") {
        this.patReason = err.error;
        this.errorMessage = "";
      } else {
        this.patReason = "";
        this.errorMessage =
          err.error === "not_found"
            ? this.$t("gitlab.errors.notFound")
            : err.error === "network"
            ? this.$t("gitlab.errors.network")
            : err.message;
      }
    },

    async load() {
      this.step = "loading";
      this.errorMessage = "";
      this.patReason = "";
      const pat = getGitlabPat(this.host);

      const repo = await GitLab.loadRepoTree(this.host, this.projectPath, undefined, pat);
      if (GitLab.isError(repo)) return this.handleError(repo);

      this.branch = repo.branch;
      this.commitSha = repo.commitSha;
      this.items = repo.items;
      this.truncated = repo.truncated;
      this.emptyRepo = repo.empty;
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

      const storageId = randomString(24);
      // We intentionally keep this reference: the editor view (after navigateTo)
      // acquires the same shared ProjectDoc, so it is never destroyed in between
      // and the freshly imported data stays persisted.
      const doc = getProjectDoc(storageId);
      this.step = "importing";
      this.patReason = "";
      this.errorMessage = "";

      if (this.emptyRepo) {
        seedEmptyReadme(doc);
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
          releaseProjectDoc(storageId);
          this.handleError(result); // sets patReason/errorMessage and step="error"
          // for a recoverable PAT error, keep the file selection visible for retry
          if (this.patReason) this.step = "select";
          return;
        }
      }

      const database = new Dexie();
      await database.put(storageId, {
        title: this.projectPath.split("/").pop(),
        gitlab: { host: this.host, projectPath: this.projectPath, branch: this.branch, commitSha: this.commitSha },
      });

      navigateTo("?/edit/" + storageId);
    },

    onPatSaved() {
      // retry whichever stage failed
      if (this.step === "select") this.startImport();
      else this.load();
    },
  },
});
</script>

<template>
  <div class="gl-direct">
    <div class="gl-direct-box">
      <h4 class="mb-3"><i class="bi bi-gitlab"></i> {{ projectPath }}</h4>

      <template v-if="step === 'loading'">
        <div class="text-center">
          <span class="spinner-border"></span>
          <p class="mt-2 text-muted">{{ $t("gitlab.import.loadingRepo") }}</p>
        </div>
      </template>

      <template v-else-if="step === 'select'">
        <div v-if="emptyRepo" class="alert alert-info text-start">
          {{ $t("gitlab.import.emptyRepo") }}
        </div>

        <template v-else>
          <div class="d-flex align-items-center mb-2">
            <span class="badge bg-secondary me-2">{{ branch }}</span>
            <div class="d-flex gap-2">
              <button class="btn btn-sm btn-outline-secondary" @click="selectAll(true)">
                {{ $t("gitlab.import.selectAll") }}
              </button>
              <button class="btn btn-sm btn-outline-secondary" @click="selectAll(false)">
                {{ $t("gitlab.import.selectNone") }}
              </button>
              <button
                class="btn btn-sm btn-link p-0"
                type="button"
                :title="$t('gitlab.pat.manageTitle')"
                @click="manageToken"
              >
                <i class="bi bi-key"></i>
              </button>
            </div>
            <span class="ms-auto small text-muted">
              {{ $t("gitlab.import.selectedCount", { n: selected.length }) }}
            </span>
          </div>

          <div v-if="truncated" class="alert alert-warning py-1 px-2 small text-start">
            {{ $t("gitlab.import.truncated") }}
          </div>

          <GitHubFileTree ref="tree" :items="items" @change="onSelectionChange" />
        </template>

        <PatHelp v-if="patReason" :reason="patReason" :host="host" class="mt-3 text-start" @saved="onPatSaved" />

        <div class="d-flex justify-content-between mt-3">
          <a class="btn btn-secondary" href="./">{{ $t("gitlab.import.backHome") }}</a>
          <button
            class="btn btn-primary"
            :disabled="!emptyRepo && selected.length === 0"
            @click="startImport"
          >
            {{ emptyRepo ? $t("gitlab.import.createEmpty") : $t("gitlab.import.importBtn", { n: selected.length }) }}
          </button>
        </div>
      </template>

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

      <template v-else-if="step === 'error'">
        <PatHelp v-if="patReason" :reason="patReason" :host="host" class="text-start" @saved="onPatSaved" />
        <div v-if="errorMessage" class="alert alert-danger">{{ errorMessage }}</div>
        <a class="btn btn-secondary" href="./">{{ $t("gitlab.import.backHome") }}</a>
      </template>
    </div>
  </div>
</template>

<style scoped>
.gl-direct {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  min-height: 100vh;
  padding: 2rem 1rem;
}

.gl-direct-box {
  width: 100%;
  max-width: 680px;
  text-align: center;
}
</style>
