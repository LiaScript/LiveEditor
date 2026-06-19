<script lang="ts">
import { defineComponent } from "vue";
import Dexie from "../../ts/indexDB";
import { navigateTo } from "../../index";
import { randomString, getGithubPat } from "../../ts/utils";
import { getProjectDoc, releaseProjectDoc } from "../../ts/ProjectDoc";
import * as GitHub from "../../ts/GitHubRepo";
import type { TreeItem } from "../../ts/GitHubRepo";
import { importPaths } from "../../ts/githubImport";
import GitHubModal from "../../components/GitHub/GitHubModal.vue";
import GitHubFileTree from "../../components/GitHub/GitHubFileTree.vue";
import PatHelp from "../../components/GitHub/PatHelp.vue";

export default defineComponent({
  name: "ImportModal",

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
      owner: "",
      repo: "",
      branch: "",
      commitSha: "",
      items: [] as TreeItem[],
      truncated: false,
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
      this.errorMessage = "";
      this.patReason = "";
    },

    /** Translate a GitHubError into either an inline PAT prompt or a message. */
    handleError(err: GitHub.GitHubError): boolean {
      if (err.error === "rate_limit" || err.error === "auth") {
        this.patReason = err.error;
        this.errorMessage = "";
        return true;
      }
      this.patReason = "";
      this.errorMessage =
        err.error === "not_found"
          ? this.$t("github.errors.notFound")
          : err.error === "network"
          ? this.$t("github.errors.network")
          : err.message;
      return true;
    },

    async load() {
      const ref = GitHub.parseRepoUrl(this.repoInput);
      if (!ref) {
        this.errorMessage = this.$t("github.errors.badUrl");
        return;
      }
      this.busy = true;
      this.errorMessage = "";
      this.patReason = "";
      const pat = getGithubPat();

      this.owner = ref.owner;
      this.repo = ref.repo;

      let branch = ref.branch;
      if (!branch) {
        const info = await GitHub.getRepoInfo(ref.owner, ref.repo, pat);
        if (GitHub.isError(info)) {
          this.busy = false;
          this.handleError(info);
          return;
        }
        branch = info.default_branch;
      }
      this.branch = branch!;

      const head = await GitHub.getRef(ref.owner, ref.repo, branch!, pat);
      if (GitHub.isError(head)) {
        this.busy = false;
        this.handleError(head);
        return;
      }
      this.commitSha = head;

      const tree = await GitHub.getTree(ref.owner, ref.repo, head, pat);
      this.busy = false;
      if (GitHub.isError(tree)) {
        this.handleError(tree);
        return;
      }

      let items = tree.items;
      if (ref.path) {
        const prefix = ref.path.replace(/\/$/, "") + "/";
        items = items.filter((i) => i.path === ref.path || i.path.startsWith(prefix));
      }
      this.items = items;
      this.truncated = tree.truncated;
      this.step = "select";
    },

    onSelectionChange(paths: string[]) {
      this.selected = paths;
    },

    selectAll(value: boolean) {
      (this.$refs.tree as any)?.selectAll(value);
    },

    async startImport() {
      if (this.selected.length === 0) return;
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
        const result = await importPaths(
          doc,
          this.owner,
          this.repo,
          this.items,
          this.selected,
          getGithubPat(),
          (p) => (this.progress = p)
        );

        if (GitHub.isError(result)) {
          this.busy = false;
          this.step = "select";
          this.handleError(result);
          return;
        }

        this.importedCount = result.imported;

        // persist the repo link so push/pull can target it automatically
        const database = new Dexie();
        await database.put(targetId, {
          github: {
            owner: this.owner,
            repo: this.repo,
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
  <GitHubModal :visible="visible" :title="$t('github.import.title')" @close="close">
    <!-- step: enter repository -->
    <template v-if="step === 'input'">
      <label class="form-label small">{{ $t("github.import.repoLabel") }}</label>
      <div class="input-group mb-2">
        <input
          v-model="repoInput"
          type="text"
          class="form-control"
          :placeholder="$t('github.import.repoPlaceholder')"
          @keyup.enter="load"
        />
        <button class="btn btn-primary" type="button" :disabled="busy || !repoInput.trim()" @click="load">
          <span v-if="busy" class="spinner-border spinner-border-sm"></span>
          {{ $t("github.import.load") }}
        </button>
      </div>
      <p class="form-text">{{ $t("github.import.repoHint") }}</p>
    </template>

    <!-- step: choose files -->
    <template v-else-if="step === 'select'">
      <div class="d-flex justify-content-between align-items-center mb-2">
        <strong>{{ owner }}/{{ repo }}</strong>
        <span class="badge bg-secondary">{{ branch }}</span>
      </div>

      <div v-if="truncated" class="alert alert-warning py-1 px-2 small">
        {{ $t("github.import.truncated") }}
      </div>

      <div class="d-flex gap-2 mb-2">
        <button class="btn btn-sm btn-outline-secondary" @click="selectAll(true)">
          {{ $t("github.import.selectAll") }}
        </button>
        <button class="btn btn-sm btn-outline-secondary" @click="selectAll(false)">
          {{ $t("github.import.selectNone") }}
        </button>
        <span class="ms-auto small text-muted align-self-center">
          {{ $t("github.import.selectedCount", { n: selected.length }) }}
        </span>
      </div>

      <GitHubFileTree ref="tree" :items="items" @change="onSelectionChange" />

      <div v-if="storageId" class="mt-3">
        <label class="form-label small d-block">{{ $t("github.import.targetLabel") }}</label>
        <div class="form-check form-check-inline">
          <input id="gh-target-current" v-model="target" class="form-check-input" type="radio" value="current" />
          <label class="form-check-label" for="gh-target-current">{{ $t("github.import.targetCurrent") }}</label>
        </div>
        <div class="form-check form-check-inline">
          <input id="gh-target-new" v-model="target" class="form-check-input" type="radio" value="new" />
          <label class="form-check-label" for="gh-target-new">{{ $t("github.import.targetNew") }}</label>
        </div>
      </div>
    </template>

    <!-- step: importing -->
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

    <!-- step: done -->
    <template v-else-if="step === 'done'">
      <div class="alert alert-success">
        {{ $t("github.import.done", { n: importedCount }) }}
      </div>
    </template>

    <!-- inline errors / PAT prompt (any step) -->
    <PatHelp v-if="patReason" :reason="patReason" @saved="onPatSaved" />
    <div v-if="errorMessage" class="alert alert-danger mt-2 mb-0">{{ errorMessage }}</div>

    <template #footer>
      <button v-if="step === 'select'" class="btn btn-secondary" @click="step = 'input'">
        {{ $t("github.back") }}
      </button>
      <button
        v-if="step === 'select'"
        class="btn btn-primary"
        :disabled="busy || selected.length === 0"
        @click="startImport"
      >
        {{ $t("github.import.importBtn", { n: selected.length }) }}
      </button>
      <button v-if="step === 'done'" class="btn btn-primary" @click="close">
        {{ $t("github.close") }}
      </button>
    </template>
  </GitHubModal>
</template>
