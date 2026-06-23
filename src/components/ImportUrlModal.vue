<script lang="ts">
import { defineComponent } from "vue";
import Modal from "bootstrap/js/dist/modal";
import type { ImportSource } from "../ts/importSources";

// Generic text-input modal shared by every "modal" import source (GitHub repo,
// URL, gist). The parent calls open(source); on submit it delegates to the
// source's onSubmit handler, which on success navigates away (so the modal
// simply disappears with the unmounted view).
export default defineComponent({
  name: "ImportUrlModal",

  data() {
    return {
      source: null as ImportSource | null,
      input: "",
      busy: false,
      error: "",
      modal: null as Modal | null,
    };
  },

  methods: {
    open(source: ImportSource) {
      this.source = source;
      this.input = "";
      this.error = "";
      this.busy = false;
      if (!this.modal) {
        this.modal = new Modal(this.$refs.el as Element);
      }
      this.modal.show();
      this.$nextTick(() => (this.$refs.field as HTMLInputElement)?.focus());
    },

    async submit() {
      if (!this.source || !this.input.trim() || this.busy) return;
      this.busy = true;
      this.error = "";
      try {
        await this.source.onSubmit!(this.input);
        this.modal?.hide();
      } catch (e: any) {
        const key = "index.import.errors." + (e?.message || "");
        const translated = this.$t(key);
        this.error = translated === key ? e?.message || this.$t("index.import.errors.generic") : translated;
        this.busy = false;
      }
    },
  },
});
</script>

<template>
  <div ref="el" class="modal fade" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">
            <i class="bi" :class="source?.icon"></i>
            {{ source ? $t(source.labelKey) : "" }}
          </h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal" :aria-label="$t('card.close')"></button>
        </div>
        <div class="modal-body">
          <input
            ref="field"
            v-model="input"
            class="form-control"
            :placeholder="source?.placeholderKey ? $t(source.placeholderKey) : ''"
            :disabled="busy"
            @keyup.enter="submit"
          />
          <small v-if="source?.hintKey" class="text-muted d-block mt-2">
            {{ $t(source.hintKey) }}
          </small>
          <div v-if="error" class="alert alert-danger py-2 px-3 mt-3 mb-0 small">{{ error }}</div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" data-bs-dismiss="modal" :disabled="busy">
            {{ $t("card.abort") }}
          </button>
          <button type="button" class="btn btn-primary" :disabled="busy || !input.trim()" @click="submit">
            <span v-if="busy" class="spinner-border spinner-border-sm me-1"></span>
            {{ $t("index.import.submit") }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
