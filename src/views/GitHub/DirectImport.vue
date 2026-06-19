<script lang="ts">
import { defineComponent } from "vue";
import Dexie from "../../ts/indexDB";
import { navigateTo } from "../../index";
import { randomString, getGithubPat } from "../../ts/utils";
import { getProjectDoc, releaseProjectDoc } from "../../ts/ProjectDoc";
import * as GitHub from "../../ts/GitHubRepo";
import type { TreeItem } from "../../ts/GitHubRepo";
import { importPaths, seedEmptyReadme } from "../../ts/githubImport";
import PatHelp from "../../components/GitHub/PatHelp.vue";

// Full-page view for the ?/github/owner/repo route: creates a brand new project
// from a repository (importing every non-hidden, importable file) and then
// hands it over to the editor.
export default defineComponent({
  name: "DirectImport",

  components: { PatHelp },

  props: {
    owner: { type: String, required: true },
    repo: { type: String, required: true },
  },

  data() {
    return {
      status: "loading" as "loading" | "importing" | "error",
      progress: { done: 0, total: 0, path: "" },
      errorMessage: "",
      patReason: "" as "" | "rate_limit" | "auth",
    };
  },

  created() {
    this.run();
  },

  methods: {
    handleError(err: GitHub.GitHubError) {
      this.status = "error";
      if (err.error === "rate_limit" || err.error === "auth") {
        this.patReason = err.error;
        this.errorMessage = "";
      } else {
        this.patReason = "";
        this.errorMessage =
          err.error === "not_found"
            ? this.$t("github.errors.notFound")
            : err.error === "network"
            ? this.$t("github.errors.network")
            : err.message;
      }
    },

    async run() {
      this.status = "loading";
      this.errorMessage = "";
      this.patReason = "";
      const pat = getGithubPat();

      const repo = await GitHub.loadRepoTree(this.owner, this.repo, undefined, pat);
      if (GitHub.isError(repo)) return this.handleError(repo);

      const paths = repo.items
        .filter(
          (i: TreeItem) =>
            i.type === "blob" &&
            (i.size || 0) <= GitHub.MAX_BLOB &&
            !i.path.split("/").some((seg) => seg.startsWith("."))
        )
        .map((i) => i.path);

      const storageId = randomString(24);
      // We intentionally keep this reference: the editor view (after navigateTo)
      // acquires the same shared ProjectDoc, so it is never destroyed in between
      // and the freshly imported data stays persisted.
      const doc = getProjectDoc(storageId);
      this.status = "importing";

      if (repo.empty) {
        // empty repository: start the project with an empty README.md
        seedEmptyReadme(doc);
      } else {
        const result = await importPaths(
          doc,
          this.owner,
          this.repo,
          repo.items,
          paths,
          pat,
          (p) => (this.progress = p)
        );
        if (GitHub.isError(result)) {
          releaseProjectDoc(storageId);
          return this.handleError(result);
        }
      }

      const database = new Dexie();
      await database.put(storageId, {
        title: this.repo,
        github: { owner: this.owner, repo: this.repo, branch: repo.branch, commitSha: repo.commitSha },
      });

      navigateTo("?/edit/" + storageId);
    },

    onPatSaved() {
      this.run();
    },
  },
});
</script>

<template>
  <div class="gh-direct">
    <div class="gh-direct-box">
      <h4><i class="bi bi-github"></i> {{ owner }}/{{ repo }}</h4>

      <template v-if="status === 'loading'">
        <span class="spinner-border"></span>
        <p class="mt-2 text-muted">{{ $t("github.import.loadingRepo") }}</p>
      </template>

      <template v-else-if="status === 'importing'">
        <p>{{ $t("github.import.importing") }}</p>
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

      <template v-else-if="status === 'error'">
        <PatHelp v-if="patReason" :reason="patReason" @saved="onPatSaved" />
        <div v-if="errorMessage" class="alert alert-danger">{{ errorMessage }}</div>
        <a class="btn btn-secondary" href="./">{{ $t("github.import.backHome") }}</a>
      </template>
    </div>
  </div>
</template>

<style scoped>
.gh-direct {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 1rem;
}

.gh-direct-box {
  width: 100%;
  max-width: 520px;
  text-align: center;
}
</style>
