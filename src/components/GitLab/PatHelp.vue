<script lang="ts">
import { defineComponent } from "vue";
import { getGitlabPat, setGitlabPat } from "../../ts/utils";

// Shown inside the GitLab dialogs whenever an operation fails because of an
// exhausted rate limit or missing/invalid authentication, and also on demand
// (reason "manage") so a stored token can be replaced or cleared before it
// ever fails — e.g. because it expired or was mistyped. Explains how to
// create a Personal Access Token on the given host and lets the user store
// it. After saving, the parent re-runs the failed operation (see @saved).
export default defineComponent({
  name: "GitLabPatHelp",

  props: {
    // why the help is shown: "rate_limit" | "auth" | "manage" — only changes
    // the title/intro text and alert color, "manage" is the neutral on-demand case
    reason: { type: String, default: "auth" },
    host: { type: String, required: true },
  },

  emits: ["saved"],

  data() {
    return {
      pat: getGitlabPat(this.host) || "",
      // jump straight to the how-to when the user asked to manage the token
      // themselves; a reactive error already has their attention, so it stays collapsed
      expanded: this.reason === "manage",
    };
  },

  computed: {
    tokenUrl(): string {
      return `https://${this.host}/-/user_settings/personal_access_tokens?scopes=api`;
    },
    alertClass(): string {
      return this.reason === "rate_limit"
        ? "alert-warning"
        : this.reason === "manage"
        ? "alert-secondary"
        : "alert-danger";
    },
    title(): string {
      return this.reason === "rate_limit"
        ? this.$t("gitlab.pat.rateLimitTitle")
        : this.reason === "manage"
        ? this.$t("gitlab.pat.manageTitle")
        : this.$t("gitlab.pat.authTitle");
    },
  },

  methods: {
    save() {
      const value = this.pat.trim();
      setGitlabPat(this.host, value || undefined);
      this.$emit("saved", value || undefined);
    },

    clear() {
      this.pat = "";
      setGitlabPat(this.host, undefined);
      this.$emit("saved", undefined);
    },
  },
});
</script>

<template>
  <div class="alert" :class="alertClass">
    <p class="mb-2">
      <strong>{{ title }}</strong>
    </p>
    <p class="mb-2 small">{{ $t("gitlab.pat.intro") }}</p>

    <button class="btn btn-sm btn-link p-0 mb-2" type="button" @click="expanded = !expanded">
      <i class="bi" :class="expanded ? 'bi-chevron-down' : 'bi-chevron-right'"></i>
      {{ $t("gitlab.pat.howtoToggle") }}
    </button>

    <ol v-if="expanded" class="small">
      <li>
        <i18n-t keypath="gitlab.pat.step1" tag="span">
          <template #link>
            <a :href="tokenUrl" target="_blank">{{ host }}/-/user_settings/personal_access_tokens</a>
          </template>
        </i18n-t>
      </li>
      <li>{{ $t("gitlab.pat.step2") }}</li>
      <li>{{ $t("gitlab.pat.step3") }}</li>
      <li>{{ $t("gitlab.pat.step4") }}</li>
      <li>{{ $t("gitlab.pat.step5") }}</li>
    </ol>

    <div class="input-group input-group-sm mt-2">
      <input
        v-model="pat"
        type="password"
        class="form-control"
        :placeholder="$t('gitlab.pat.placeholder')"
        autocomplete="off"
        @keyup.enter="save"
      />
      <button class="btn btn-primary" type="button" :disabled="!pat.trim()" @click="save">
        {{ $t("gitlab.pat.save") }}
      </button>
    </div>
    <button
      v-if="pat.trim()"
      class="btn btn-sm btn-link text-danger p-0 mt-2"
      type="button"
      @click="clear"
    >
      {{ $t("gitlab.pat.clear") }}
    </button>
  </div>
</template>
