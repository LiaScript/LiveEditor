<script lang="ts">
import { defineComponent } from "vue";
import Dexie from "../../ts/indexDB";
import { navigateTo } from "../../index";
import { randomString, getGithubPat } from "../../ts/utils";
import { getProjectDoc, releaseProjectDoc, handOffProjectDoc } from "../../ts/ProjectDoc";
import * as GitHub from "../../ts/GitHubRepo";
import type { TreeItem } from "../../ts/GitHubRepo";
import { importPaths, seedEmptyReadme } from "../../ts/githubImport";
import GitHubFileTree from "../../components/GitHub/GitHubFileTree.vue";
import LanguageDropdown from "../../components/LanguageDropdown.vue";
import logoImg from "url:../../../assets/logo.png";
import PatHelp from "../../components/GitHub/PatHelp.vue";

// Full-page view for the ?/github/owner/repo route: lets the user choose which
// repository files to import, then creates a new project from the selection and
// hands it over to the editor.
export default defineComponent({
  name: "DirectImport",

  components: { GitHubFileTree, PatHelp, LanguageDropdown },

  props: {
    owner: { type: String, required: true },
    repo: { type: String, required: true },
  },

  data() {
    return {
      logoImg,
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
    this.load();
  },

  methods: {
    handleError(err: GitHub.GitHubError) {
      this.step = "error";
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

    async load() {
      this.step = "loading";
      this.errorMessage = "";
      this.patReason = "";
      const pat = getGithubPat();

      const repo = await GitHub.loadRepoTree(this.owner, this.repo, undefined, pat);
      if (GitHub.isError(repo)) return this.handleError(repo);

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
      // This reference is handed off to the editor view on success (see
      // handOffProjectDoc), so the doc is never destroyed in between and the
      // freshly imported data stays persisted.
      const doc = getProjectDoc(storageId);
      this.step = "importing";
      this.patReason = "";
      this.errorMessage = "";

      if (this.emptyRepo) {
        seedEmptyReadme(doc);
      } else {
        const result = await importPaths(
          doc,
          this.owner,
          this.repo,
          this.items,
          this.selected,
          getGithubPat(),
          (p) => (this.progress = p),
          this.commitSha
        );
        if (GitHub.isError(result)) {
          releaseProjectDoc(storageId);
          this.handleError(result); // sets patReason/errorMessage and step="error"
          // for a recoverable PAT error, keep the file selection visible for retry
          if (this.patReason) this.step = "select";
          return;
        }
      }

      const database = new Dexie();
      await database.put(storageId, {
        title: this.repo,
        github: { owner: this.owner, repo: this.repo, branch: this.branch, commitSha: this.commitSha },
      });

      handOffProjectDoc(storageId); // the editor view takes over our reference
      navigateTo("?/edit/" + storageId);
    },

    onPatSaved() {
      // just managing the token must not start a push/import/pull
      if (this.patReason === "manage") {
        this.patReason = "";
        return;
      }
      // retry whichever stage failed
      if (this.step === "select") this.startImport();
      else this.load();
    },
  },
});
</script>

<template>
  <div class="lia-direct">
    <nav class="navbar bg-white border-bottom">
      <div class="container-fluid gap-2">
        <a class="navbar-brand d-flex align-items-center gap-2 me-auto" href="./">
          <img :src="logoImg" alt="" height="28" />
          <span class="fw-semibold">{{ $t('app.title') }}</span>
        </a>
        <LanguageDropdown align="end" />
      </div>
    </nav>

    <main class="lia-direct-main">
      <a class="lia-back" href="./">
        <i class="bi bi-arrow-left" aria-hidden="true"></i> {{ $t('nav.myCourses') }}
      </a>

      <section class="lia-direct-card">
        <header class="lia-direct-head">
          <i class="bi bi-github lia-direct-icon" aria-hidden="true"></i>
          <div class="min-w-0">
            <h1 class="h5 fw-bold mb-0">{{ $t("github.import.title") }}</h1>
            <p class="small text-body-secondary mb-0 mt-1 text-break">{{ owner }}/{{ repo }}</p>
          </div>
        </header>

        <div class="lia-direct-body">
          <div v-if="step === 'loading'" class="text-center py-4">
            <span class="spinner-border"></span>
            <p class="mt-2 text-muted">{{ $t("github.import.loadingRepo") }}</p>
          </div>

          <template v-else-if="step === 'select'">
            <div v-if="emptyRepo" class="alert alert-info">
              {{ $t("github.import.emptyRepo") }}
            </div>

            <template v-else>
              <div class="d-flex flex-wrap align-items-center gap-2 mb-2">
                <span class="badge bg-secondary">{{ branch }}</span>
                <button class="btn btn-sm btn-outline-secondary" @click="selectAll(true)">
                  {{ $t("github.import.selectAll") }}
                </button>
                <button class="btn btn-sm btn-outline-secondary" @click="selectAll(false)">
                  {{ $t("github.import.selectNone") }}
                </button>
                <span class="ms-auto small text-muted">
                  {{ $t("github.import.selectedCount", { n: selected.length }) }}
                </span>
              </div>

              <div v-if="truncated" class="alert alert-warning py-1 px-2 small">
                {{ $t("github.import.truncated") }}
              </div>

              <GitHubFileTree ref="tree" :items="items" @change="onSelectionChange" />
            </template>

            <p class="small text-muted mt-3 mb-0">
              {{ $t("github.import.targetLabel") }}: <strong>{{ $t("github.import.targetNew") }}</strong>
            </p>

            <PatHelp v-if="patReason" :reason="patReason" class="mt-3" @saved="onPatSaved" />
          </template>

          <template v-else-if="step === 'importing'">
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

          <template v-else-if="step === 'error'">
            <PatHelp v-if="patReason" :reason="patReason" @saved="onPatSaved" />
            <div v-if="errorMessage" class="alert alert-danger mb-0">{{ errorMessage }}</div>
          </template>
        </div>

        <footer v-if="step === 'select' || step === 'error'" class="lia-direct-foot">
          <button
            class="btn btn-sm btn-link p-0 me-auto small text-decoration-none"
            type="button"
            :title="$t('github.pat.manageTitle')"
            @click="manageToken"
          >
            <i class="bi bi-key"></i> {{ $t('github.pat.manageTitle') }}
          </button>
          <a class="btn btn-outline-secondary" href="./">{{ $t("github.import.backHome") }}</a>
          <button
            v-if="step === 'select'"
            class="btn btn-primary"
            :disabled="!emptyRepo && selected.length === 0"
            @click="startImport"
          >
            {{ emptyRepo ? $t("github.import.createEmpty") : $t("github.import.importBtn", { n: selected.length }) }}
          </button>
        </footer>
      </section>
    </main>
  </div>
</template>

<style scoped>
.lia-direct {
  min-height: 100vh;
  background: var(--lia-ground);
}

.lia-direct-main {
  max-width: 46rem;
  margin: 0 auto;
  padding: 1.5rem 1rem 2rem;
}

.lia-back {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.9rem;
  text-decoration: none;
}

.lia-direct-card {
  margin-top: 0.75rem;
  background: #fff;
  border: 1px solid var(--lia-line);
  border-radius: 1rem;
  overflow: hidden;
}

.lia-direct-head {
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
  padding: 1.1rem 1.25rem;
  border-bottom: 1px solid var(--lia-line);
}

.lia-direct-icon {
  font-size: 1.3rem;
  line-height: 1.2;
  color: var(--lia-accent);
}

.min-w-0 {
  min-width: 0;
}

.lia-direct-body {
  padding: 1.25rem;
}

.lia-direct-foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 0.85rem 1.25rem;
  border-top: 1px solid var(--lia-line);
  background: #fafbfb;
}
</style>
