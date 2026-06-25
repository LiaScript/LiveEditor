<script lang="ts">
import { defineComponent } from "vue";
import Dexie from "../../ts/indexDB";
import { getGithubPat } from "../../ts/utils";
import { getProjectDoc, releaseProjectDoc, ProjectDoc } from "../../ts/ProjectDoc";
import * as GitHub from "../../ts/GitHubRepo";
import { computeChanges, pushChanges } from "../../ts/githubImport";
import GitHubModal from "../../components/GitHub/GitHubModal.vue";
import PatHelp from "../../components/GitHub/PatHelp.vue";

// "Publish" dialog: creates a brand new GitHub repository (under the user or one
// of their organizations) and pushes all project contents into it.
export default defineComponent({
  name: "PublishModal",

  components: { GitHubModal, PatHelp },

  props: {
    visible: { type: Boolean, default: false },
    storageId: { type: String, required: true },
    connection: { type: String, default: undefined },
    title: { type: String, default: "" },
  },

  emits: ["close", "updated"],

  data() {
    return {
      step: "loading" as "loading" | "form" | "publishing" | "done",
      doc: null as ProjectDoc | null,
      owners: [] as { login: string; isOrg: boolean }[],
      ownerLogin: "",
      repoName: "",
      isPrivate: false,
      description: "",
      statusText: "",
      resultUrl: "",
      busy: false,
      errorMessage: "",
      patReason: "" as "" | "rate_limit" | "auth",
    };
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
    cleanup() {
      if (this.doc) {
        releaseProjectDoc(this.storageId);
        this.doc = null;
      }
    },

    sanitizeName(name: string): string {
      const cleaned = (name || "")
        .trim()
        .replace(/[^A-Za-z0-9._-]+/g, "-")
        .replace(/^-+|-+$/g, "");
      return cleaned || "liascript-course";
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
      this.resultUrl = "";
      if (!this.doc) this.doc = getProjectDoc(this.storageId, this.connection);
      this.repoName = this.sanitizeName(this.title);

      const pat = getGithubPat();
      if (!pat) {
        // creating a repository always requires authentication
        this.patReason = "auth";
        this.step = "form";
        return;
      }

      const user = await GitHub.getAuthUser(pat);
      if (GitHub.isError(user)) {
        this.handleError(user);
        this.step = "form";
        return;
      }
      const orgs = await GitHub.listOrgs(pat);
      const orgList = GitHub.isError(orgs) ? [] : orgs;

      this.owners = [
        { login: user.login, isOrg: false },
        ...orgList.map((o) => ({ login: o.login, isOrg: true })),
      ];
      this.ownerLogin = user.login;
      this.step = "form";
    },

    async publish() {
      const pat = getGithubPat();
      if (!pat) {
        this.patReason = "auth";
        return;
      }
      const owner = this.owners.find((o) => o.login === this.ownerLogin);
      const name = this.sanitizeName(this.repoName);
      if (!owner || !name) return;

      this.step = "publishing";
      this.busy = true;
      this.errorMessage = "";
      this.patReason = "";

      try {
        this.statusText = this.$t("github.publish.creating");
        const repo = await GitHub.createRepo(
          owner.login,
          name,
          { private: this.isPrivate, description: this.description, isOrg: owner.isOrg },
          pat
        );
        if (GitHub.isError(repo)) return this.fail(repo);

        this.statusText = this.$t("github.publish.pushing");
        const tree = await GitHub.loadRepoTree(repo.owner, repo.repo, repo.branch, pat);
        if (GitHub.isError(tree)) return this.fail(tree);

        const changes = await computeChanges(this.doc!, tree.items);
        const result = await pushChanges(
          this.doc!,
          repo.owner,
          repo.repo,
          repo.branch,
          this.$t("github.publish.commitMessage"),
          changes,
          pat
        );
        if (GitHub.isError(result)) return this.fail(result);

        const link = {
          owner: repo.owner,
          repo: repo.repo,
          branch: repo.branch,
          commitSha: result.commitSha,
        };
        const database = new Dexie();
        await database.put(this.storageId, { github: link });
        this.$emit("updated", link);

        this.resultUrl = repo.htmlUrl;
        this.busy = false;
        this.step = "done";
      } finally {
        this.busy = false;
      }
    },

    fail(err: GitHub.GitHubError) {
      this.busy = false;
      this.step = "form";
      this.handleError(err);
    },

    onPatSaved() {
      // re-load the owner list (and retry) now that a token is available
      this.load();
    },

    close() {
      this.$emit("close");
    },
  },
});
</script>

<template>
  <GitHubModal :visible="visible" :title="$t('github.publish.title')" @close="close">
    <div v-if="step === 'loading'" class="text-center py-3">
      <span class="spinner-border"></span>
    </div>

    <template v-else-if="step === 'form'">
      <p class="small text-muted">{{ $t("github.publish.intro") }}</p>

      <template v-if="owners.length">
        <div class="mb-2">
          <label class="form-label small">{{ $t("github.publish.owner") }}</label>
          <select v-model="ownerLogin" class="form-select form-select-sm">
            <option v-for="o in owners" :key="o.login" :value="o.login">
              {{ o.login }}{{ o.isOrg ? " (org)" : "" }}
            </option>
          </select>
        </div>

        <div class="mb-2">
          <label class="form-label small">{{ $t("github.publish.repoName") }}</label>
          <input v-model="repoName" type="text" class="form-control form-control-sm" />
        </div>

        <div class="mb-2">
          <label class="form-label small">{{ $t("github.publish.description") }}</label>
          <input v-model="description" type="text" class="form-control form-control-sm" />
        </div>

        <div class="form-check">
          <input id="gh-pub-private" v-model="isPrivate" class="form-check-input" type="checkbox" />
          <label class="form-check-label small" for="gh-pub-private">
            {{ $t("github.publish.private") }}
          </label>
        </div>
      </template>
    </template>

    <div v-else-if="step === 'publishing'" class="text-center py-3">
      <span class="spinner-border"></span>
      <p class="mt-2 small text-muted">{{ statusText }}</p>
    </div>

    <template v-else-if="step === 'done'">
      <div class="alert alert-success">
        {{ $t("github.publish.done") }}
        <div class="mt-1">
          <a :href="resultUrl" target="_blank" style="word-break: break-all">{{ resultUrl }}</a>
        </div>
      </div>
    </template>

    <PatHelp
      v-if="patReason"
      :reason="patReason"
      :need-write="true"
      :need-create="true"
      @saved="onPatSaved"
    />
    <div v-if="errorMessage" class="alert alert-danger mt-2 mb-0">{{ errorMessage }}</div>

    <template #footer>
      <button
        v-if="step === 'form' && owners.length"
        class="btn btn-primary"
        :disabled="busy || !ownerLogin || !repoName.trim()"
        @click="publish"
      >
        {{ $t("github.publish.publishBtn") }}
      </button>
      <button v-if="step === 'done'" class="btn btn-primary" @click="close">
        {{ $t("github.close") }}
      </button>
    </template>
  </GitHubModal>
</template>
