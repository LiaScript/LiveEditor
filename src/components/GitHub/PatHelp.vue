<script lang="ts">
import { defineComponent } from "vue";
import { getGithubPat, setGithubPat } from "../../ts/utils";

// Shown inside the GitHub dialogs whenever an operation fails because of an
// exhausted rate limit or missing authentication. Explains how to create a
// fine-grained Personal Access Token and lets the user store it. After saving,
// the parent re-runs the failed operation (see @saved).
export default defineComponent({
  name: "PatHelp",

  props: {
    // why the help is shown: "rate_limit" | "auth" — only changes the intro text
    reason: { type: String, default: "auth" },
    // whether write access (Contents: read & write) is required (push)
    needWrite: { type: Boolean, default: false },
    // whether the operation creates a new repository. Fine-grained tokens can
    // only target existing repos, so creating one requires a *classic* token
    // with the "repo" scope — we point the user to a different page in that case.
    needCreate: { type: Boolean, default: false },
  },

  emits: ["saved"],

  data() {
    return {
      pat: getGithubPat() || "",
      expanded: false,
    };
  },

  methods: {
    save() {
      const value = this.pat.trim();
      setGithubPat(value || undefined);
      this.$emit("saved", value || undefined);
    },
  },
});
</script>

<template>
  <div class="alert" :class="reason === 'rate_limit' ? 'alert-warning' : 'alert-danger'">
    <p class="mb-2">
      <strong>
        {{ reason === "rate_limit" ? $t("github.pat.rateLimitTitle") : $t("github.pat.authTitle") }}
      </strong>
    </p>
    <p class="mb-2 small">{{ $t("github.pat.intro") }}</p>

    <button class="btn btn-sm btn-link p-0 mb-2" type="button" @click="expanded = !expanded">
      <i class="bi" :class="expanded ? 'bi-chevron-down' : 'bi-chevron-right'"></i>
      {{ $t("github.pat.howtoToggle") }}
    </button>

    <ol v-if="expanded && needCreate" class="small">
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

    <ol v-else-if="expanded" class="small">
      <li>
        <i18n-t keypath="github.pat.step1" tag="span">
          <template #link>
            <a href="https://github.com/settings/personal-access-tokens/new" target="_blank">
              github.com/settings/personal-access-tokens
            </a>
          </template>
        </i18n-t>
      </li>
      <li>{{ $t("github.pat.step2") }}</li>
      <li>
        {{ needWrite ? $t("github.pat.step3Write") : $t("github.pat.step3Read") }}
      </li>
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
  </div>
</template>
