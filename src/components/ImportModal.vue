<script lang="ts">
import { defineComponent } from "vue";
import Modal from "bootstrap/js/dist/modal";
import { importSources, ImportSource } from "../ts/importSources";

// Card chooser shown when the user clicks "New" on the index page. It renders one
// card per registered import source (including the blank-document option) with a
// large icon, a label and a plain-language description so non-technical users
// understand what each option does. Picking a card hands the source back to the
// parent (ImportMenu) whose select() dispatches navigate / fileInput / modal.
export default defineComponent({
  name: "ImportModal",

  emits: ["select"],

  data() {
    return {
      sources: importSources,
      modal: null as Modal | null,
    };
  },

  methods: {
    // Every source stays visible so users discover all options; the ones whose
    // available() gate fails (e.g. local folder outside Chromium) render disabled
    // with an explanatory note instead of being hidden.
    isDisabled(source: ImportSource): boolean {
      return source.available ? !source.available() : false;
    },

    open() {
      if (!this.modal) {
        this.modal = new Modal(this.$refs.el as Element);
      }
      this.modal.show();
    },

    pick(source: ImportSource) {
      if (this.isDisabled(source)) return;
      // Hide the chooser first; the parent opens the follow-up text-input modal
      // (GitHub / URL / Gist) on $nextTick to avoid stacked-backdrop glitches.
      this.modal?.hide();
      this.$emit("select", source);
    },
  },
});
</script>

<template>
  <div ref="el" class="modal fade" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-lg modal-dialog-centered">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">{{ $t("index.import.title") }}</h5>
          <button
            type="button"
            class="btn-close"
            data-bs-dismiss="modal"
            :aria-label="$t('card.close')"
          ></button>
        </div>
        <div class="modal-body">
          <div class="row row-cols-1 row-cols-sm-2 row-cols-md-3 g-3">
            <div v-for="source in sources" :key="source.id" class="col">
              <button
                type="button"
                class="import-card"
                :class="{
                  'import-card--disabled': isDisabled(source),
                  'import-card--featured': source.featured,
                }"
                :disabled="isDisabled(source)"
                @click="pick(source)"
              >
                <i class="bi import-card-icon" :class="source.icon"></i>
                <span class="import-card-title">{{ $t(source.labelKey) }}</span>
                <small v-if="source.descriptionKey" class="import-card-desc text-muted">
                  {{ $t(source.descriptionKey) }}
                </small>
                <span v-if="isDisabled(source)" class="badge text-bg-secondary import-card-badge">
                  {{ $t("index.import.unavailable") }}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.import-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  width: 100%;
  height: 100%;
  gap: 0.4rem;
  padding: 1.25rem 1rem;
  background: var(--bs-body-bg, #fff);
  border: 1px solid var(--bs-border-color, #dee2e6);
  border-radius: 0.75rem;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
}

.import-card:hover,
.import-card:focus-visible {
  transform: translateY(-3px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.12);
  border-color: var(--bs-primary, #0d6efd);
  outline: none;
}

/* the primary "blank document" card stands out even without hover */
.import-card--featured {
  border-color: var(--bs-primary, #0d6efd);
  border-width: 2px;
  background: rgba(13, 110, 253, 0.06);
}

.import-card--disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

/* keep disabled cards flat — no hover lift, no primary accent */
.import-card--disabled:hover,
.import-card--disabled:focus-visible {
  transform: none;
  box-shadow: none;
  border-color: var(--bs-border-color, #dee2e6);
}

.import-card--disabled .import-card-icon {
  color: var(--bs-secondary, #6c757d);
}

.import-card-badge {
  margin-top: 0.15rem;
  font-weight: 500;
}

.import-card-icon {
  font-size: 2.25rem;
  line-height: 1;
  color: var(--bs-primary, #0d6efd);
}

.import-card-title {
  font-weight: 600;
}

.import-card-desc {
  font-size: 0.8125rem;
  line-height: 1.3;
}
</style>
