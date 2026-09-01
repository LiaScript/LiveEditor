<script lang="ts">
import { defineComponent } from "vue";
import Dexie from "../../ts/indexDB";
import { getGitlabPat, getLastGitlabHost, setLastGitlabHost } from "../../ts/utils";
import { getProjectDoc, releaseProjectDoc, ProjectDoc } from "../../ts/ProjectDoc";
import * as GitLab from "../../ts/GitLabRepo";
import { computeChanges, pushChanges } from "../../ts/gitlabImport";
import GitHubModal from "../../components/GitHub/GitHubModal.vue";
import PatHelp from "../../components/GitLab/PatHelp.vue";

// "Publish" dialog: creates a brand new GitLab project (under the user or one
// of their groups) and pushes all project contents into it. Unlike GitHub
// (fixed host), this needs an extra first step to pick which GitLab instance
// to publish to.
export default defineComponent({
  name: "GitLabPublishModal",

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
      step: "host" as "host" | "loading" | "form" | "publishing" | "done",
      doc: null as ProjectDoc | null,
      host: getLastGitlabHost(),
      owners: [] as { login: string; namespaceId?: number }[],
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
      if (v) this.reset();
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

    reset() {
      this.step = "host";
      this.host = getLastGitlabHost();
      this.errorMessage = "";
      this.patReason = "";
      this.resultUrl = "";
    },

    sanitizeName(name: string): string {
      const cleaned = (name || "")
        .trim()
        .replace(/[^A-Za-z0-9._-]+/g, "-")
        .replace(/^-+|-+$/g, "");
      return cleaned || "liascript-course";
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

    manageToken() {
      this.errorMessage = "";
      this.patReason = "manage";
    },

    async chooseHost() {
      const host = this.host.trim().replace(/^https?:\/\//, "").replace(/\/+$/, "");
      if (!host) return;
      this.host = host;
      setLastGitlabHost(host);
      await this.load();
    },

    async load() {
      this.step = "loading";
      this.errorMessage = "";
      this.patReason = "";
      this.resultUrl = "";
      if (!this.doc) this.doc = getProjectDoc(this.storageId, this.connection);
      this.repoName = this.sanitizeName(this.title);

      const pat = getGitlabPat(this.host);
      if (!pat) {
        // creating a project always requires authentication
        this.patReason = "auth";
        this.step = "form";
        return;
      }

      const user = await GitLab.getAuthUser(this.host, pat);
      if (GitLab.isError(user)) {
        this.handleError(user);
        this.step = "form";
        return;
      }
      const groups = await GitLab.listGroups(this.host, pat);
      const groupList = GitLab.isError(groups) ? [] : groups;

      this.owners = [
        { login: user.username, namespaceId: undefined },
        ...groupList.map((g) => ({ login: g.fullPath, namespaceId: g.id })),
      ];
      this.ownerLogin = user.username;
      this.step = "form";
    },

    async publish() {
      const pat = getGitlabPat(this.host);
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
        this.statusText = this.$t("gitlab.publish.creating");
        const repo = await GitLab.createRepo(
          this.host,
          name,
          {
            visibility: this.isPrivate ? "private" : "public",
            description: this.description,
            namespaceId: owner.namespaceId,
          },
          pat
        );
        if (GitLab.isError(repo)) return this.fail(repo);

        this.statusText = this.$t("gitlab.publish.pushing");
        const tree = await GitLab.loadRepoTree(repo.host, repo.projectPath, repo.branch, pat);
        if (GitLab.isError(tree)) return this.fail(tree);

        const changes = await computeChanges(this.doc!, tree.items);
        const result = await pushChanges(
          this.doc!,
          repo.host,
          repo.projectPath,
          repo.branch,
          this.$t("gitlab.publish.commitMessage"),
          changes,
          pat
        );
        if (GitLab.isError(result)) return this.fail(result);

        const link = {
          host: repo.host,
          projectPath: repo.projectPath,
          branch: repo.branch,
          commitSha: result.commitSha,
        };
        const database = new Dexie();
        await database.put(this.storageId, { gitlab: link });
        this.$emit("updated", link);

        this.resultUrl = repo.webUrl;
        this.busy = false;
        this.step = "done";
      } finally {
        this.busy = false;
      }
    },

    fail(err: GitLab.GitLabError) {
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
  <GitHubModal :visible="visible" :title="$t('gitlab.publish.title')" icon="bi-gitlab" @close="close">
    <template v-if="step === 'host'">
      <p class="small text-muted">{{ $t("gitlab.publish.intro") }}</p>
      <label class="form-label small">{{ $t("gitlab.publish.host") }}</label>
      <input
        v-model="host"
        type="text"
        class="form-control form-control-sm"
        placeholder="gitlab.com"
        @keyup.enter="chooseHost"
      />
      <p class="form-text">{{ $t("gitlab.publish.hostHint") }}</p>
    </template>

    <div v-else-if="step === 'loading'" class="text-center py-3">
      <span class="spinner-border"></span>
    </div>

    <template v-else-if="step === 'form'">
      <div v-if="owners.length" class="d-flex justify-content-between align-items-center mb-2">
        <span class="small text-muted">{{ host }}</span>
        <button
          class="btn btn-sm btn-link p-0"
          type="button"
          :title="$t('gitlab.pat.manageTitle')"
          @click="manageToken"
        >
          <i class="bi bi-key"></i>
        </button>
      </div>

      <template v-if="owners.length">
        <div class="mb-2">
          <label class="form-label small">{{ $t("gitlab.publish.owner") }}</label>
          <select v-model="ownerLogin" class="form-select form-select-sm">
            <option v-for="o in owners" :key="o.login" :value="o.login">
              {{ o.login }}{{ o.namespaceId ? " (group)" : "" }}
            </option>
          </select>
        </div>

        <div class="mb-2">
          <label class="form-label small">{{ $t("gitlab.publish.repoName") }}</label>
          <input v-model="repoName" type="text" class="form-control form-control-sm" />
        </div>

        <div class="mb-2">
          <label class="form-label small">{{ $t("gitlab.publish.description") }}</label>
          <input v-model="description" type="text" class="form-control form-control-sm" />
        </div>

        <div class="form-check">
          <input id="gl-pub-private" v-model="isPrivate" class="form-check-input" type="checkbox" />
          <label class="form-check-label small" for="gl-pub-private">
            {{ $t("gitlab.publish.private") }}
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
        {{ $t("gitlab.publish.done") }}
        <div class="mt-1">
          <a :href="resultUrl" target="_blank" style="word-break: break-all">{{ resultUrl }}</a>
        </div>
      </div>
    </template>

    <PatHelp
      v-if="patReason"
      :reason="patReason"
      :host="host"
      @saved="onPatSaved"
    />
    <div v-if="errorMessage" class="alert alert-danger mt-2 mb-0">{{ errorMessage }}</div>

    <template #footer>
      <button v-if="step === 'host'" class="btn btn-primary" :disabled="!host.trim()" @click="chooseHost">
        {{ $t("gitlab.publish.continue") }}
      </button>
      <button
        v-if="step === 'form' && owners.length"
        class="btn btn-primary"
        :disabled="busy || !ownerLogin || !repoName.trim()"
        @click="publish"
      >
        {{ $t("gitlab.publish.publishBtn") }}
      </button>
      <button v-if="step === 'done'" class="btn btn-primary" @click="close">
        {{ $t("gitlab.close") }}
      </button>
    </template>
  </GitHubModal>
</template>
