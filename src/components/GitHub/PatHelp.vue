<script lang="ts">
import { defineComponent } from "vue";
import { getGithubPat, setGithubPat } from "../../ts/utils";

// Shown inside the GitHub dialogs whenever an operation fails because of an
// exhausted rate limit or missing/invalid authentication, and also on demand
// (reason "manage") so a stored token can be replaced or cleared before it
// ever fails — e.g. because it expired or was mistyped. Explains how to
// create a classic Personal Access Token and lets the user store it. After
// saving, the parent re-runs the failed operation (see @saved).
export default defineComponent({
  name: "PatHelp",

  props: {
    // why the help is shown: "rate_limit" | "auth" | "manage" — only changes
    // the title/intro text and alert color, "manage" is the neutral on-demand case
    reason: { type: String, default: "auth" },
  },

  emits: ["saved"],

  data() {
    return {
      pat: getGithubPat() || "",
      // jump straight to the how-to when the user asked to manage the token
      // themselves; a reactive error already has their attention, so it stays collapsed
      expanded: this.reason === "manage",
    };
  },

  computed: {
    alertClass(): string {
      return this.reason === "rate_limit"
        ? "alert-warning"
        : this.reason === "manage"
        ? "alert-secondary"
        : "alert-danger";
    },
    title(): string {
      return this.reason === "rate_limit"
        ? this.$t("github.pat.rateLimitTitle")
        : this.reason === "manage"
        ? this.$t("github.pat.manageTitle")
        : this.$t("github.pat.authTitle");
    },
  },

  methods: {
    save() {
      const value = this.pat.trim();
      setGithubPat(value || undefined);
      this.$emit("saved", value || undefined);
    },

    clear() {
      this.pat = "";
      setGithubPat(undefined);
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
    <p class="mb-2 small">{{ $t("github.pat.intro") }}</p>

    <button class="btn btn-sm btn-link p-0 mb-2" type="button" @click="expanded = !expanded">
      <i class="bi" :class="expanded ? 'bi-chevron-down' : 'bi-chevron-right'"></i>
      {{ $t("github.pat.howtoToggle") }}
    </button>

    <ol v-if="expanded" class="small">
      <li>
        <i18n-t keypath="github.pat.step1" tag="span">
          <template #link>
            <a
              href="https://github.com/settings/tokens/new?scopes=repo&description=LiaScript"
              target="_blank"
            >
              github.com/settings/tokens
            </a>
          </template>
        </i18n-t>
      </li>
      <li>{{ $t("github.pat.step2Classic") }}</li>
      <li>{{ $t("github.pat.step3Classic") }}</li>
      <li>{{ $t("github.pat.step4") }}</li>
    </ol>

    <div class="input-group input-group-sm mt-2">
      <input
        v-model="pat"
        type="password"
        class="form-control"
        :placeholder="$t('github.pat.placeholder')"
        autocomplete="off"
        @keyup.enter="save"
      />
      <button class="btn btn-primary" type="button" :disabled="!pat.trim()" @click="save">
        {{ $t("github.pat.save") }}
      </button>
    </div>
    <button
      v-if="pat.trim()"
      class="btn btn-sm btn-link text-danger p-0 mt-2"
      type="button"
      @click="clear"
    >
      {{ $t("github.pat.clear") }}
    </button>
  </div>
</template>
