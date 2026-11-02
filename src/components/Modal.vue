<script lang="ts">
import { Modal } from "bootstrap/js/index.esm.js";

// Result dialog for the share actions (collaboration link, snapshot URL,
// data-URI, embed code, ...): a short explanation, then one box per link or
// code snippet with "Copy" (and "Open" for links), plus an optional warning.

export interface ResultEntry {
  /** small heading above the box, e.g. "Shortest version (recommended)" */
  label?: string;
  value: string;
  /** "link" = single-line URL with an Open button, "code" = HTML snippet */
  kind?: "link" | "code";
}

export interface ResultContent {
  title: string;
  intro?: string;
  entries: ResultEntry[];
  /** highlighted hint below the boxes (e.g. "messengers may cut long links") */
  warning?: string;
  /** plain hint below the boxes */
  note?: string;
}

export default {
  data() {
    return {
      content: { title: "", entries: [] } as ResultContent,
      copied: -1,
      modal: null as any,
    };
  },

  methods: {
    show(content: ResultContent) {
      this.content = content;
      this.copied = -1;
      if (!this.modal) this.modal = new Modal(this.$refs.el as Element);
      this.modal.show();
    },

    async copy(index: number) {
      const value = this.content.entries[index]?.value || "";
      try {
        await navigator.clipboard.writeText(value);
      } catch {
        // clipboard API blocked: select the text so the user can press Ctrl+C
        const el = (this.$refs.fields as HTMLElement[] | undefined)?.[index] as
          | HTMLInputElement
          | HTMLTextAreaElement
          | undefined;
        el?.focus();
        el?.select();
        return;
      }
      this.copied = index;
      setTimeout(() => {
        if (this.copied === index) this.copied = -1;
      }, 2000);
    },

    selectAll(e: Event) {
      (e.target as HTMLInputElement).select();
    },

    lengthOf(value: string): string {
      return this.$t("result.length", { n: value.length.toLocaleString(this.$i18n.locale) });
    },
  },
};
</script>

<template>
  <div
    ref="el"
    class="modal fade"
    tabindex="-1"
    aria-labelledby="lia-result-title"
    aria-hidden="true"
  >
    <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-lg">
      <div class="modal-content">
        <div class="modal-header">
          <h2 class="modal-title h5 fw-bold" id="lia-result-title">{{ content.title }}</h2>
          <button
            type="button"
            class="btn-close"
            data-bs-dismiss="modal"
            :aria-label="$t('modal.close')"
          ></button>
        </div>
        <div class="modal-body d-flex flex-column gap-3">
          <p v-if="content.intro" class="mb-0">{{ content.intro }}</p>

          <div v-for="(entry, i) in content.entries" :key="i" class="lia-result-entry">
            <div class="d-flex justify-content-between align-items-baseline gap-2 mb-1">
              <span v-if="entry.label" class="fw-semibold small">{{ entry.label }}</span>
              <span v-if="entry.value.length > 2000" class="small text-body-secondary ms-auto">
                {{ lengthOf(entry.value) }}
              </span>
            </div>
            <textarea
              v-if="entry.kind === 'code'"
              ref="fields"
              class="form-control font-monospace small"
              rows="3"
              readonly
              :value="entry.value"
              :aria-label="entry.label || content.title"
              @focus="selectAll"
            ></textarea>
            <input
              v-else
              ref="fields"
              class="form-control font-monospace small"
              readonly
              :value="entry.value"
              :aria-label="entry.label || content.title"
              @focus="selectAll"
            />
            <div class="d-flex gap-2 mt-2">
              <button type="button" class="btn btn-sm btn-primary" @click="copy(i)">
                <i class="bi" :class="copied === i ? 'bi-check-lg' : 'bi-clipboard'" aria-hidden="true"></i>
                {{ copied === i ? $t('result.copied') : $t('result.copy') }}
              </button>
              <a
                v-if="entry.kind !== 'code'"
                class="btn btn-sm btn-outline-secondary"
                :href="entry.value"
                target="_blank"
              >
                <i class="bi bi-box-arrow-up-right" aria-hidden="true"></i>
                {{ $t('result.open') }}
              </a>
            </div>
          </div>

          <div v-if="content.warning" class="lia-result-warning" role="note">
            <i class="bi bi-exclamation-triangle" aria-hidden="true"></i>
            <span>{{ content.warning }}</span>
          </div>
          <p v-if="content.note" class="small text-body-secondary mb-0">{{ content.note }}</p>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">
            {{ $t('modal.close') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.lia-result-entry .form-control {
  word-break: break-all;
}

.lia-result-entry .btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.lia-result-warning {
  display: flex;
  gap: 0.6rem;
  align-items: flex-start;
  padding: 0.75rem 1rem;
  border-radius: 0.6rem;
  background: var(--lia-note-bg);
  border: 1px solid var(--lia-note-border);
  color: var(--lia-note-ink);
  font-size: 0.9rem;
  line-height: 1.45;
}
</style>
