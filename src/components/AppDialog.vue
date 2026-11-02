<script lang="ts">
import { defineComponent } from "vue";

// Dialog shell shared by the GitHub/GitLab, local folder, exporter and Nostr
// dialogs, so they all look and behave the same: backdrop, header with icon,
// title and optional subtitle, scrolling body, optional footer (slot), close
// on backdrop click or Escape. Uses the app's light theme only.
export default defineComponent({
  name: "AppDialog",

  props: {
    visible: { type: Boolean, default: false },
    title: { type: String, default: "" },
    subtitle: { type: String, default: "" },
    icon: { type: String, default: "" },
    /** "md" (default, 680px), "lg" (900px) or "xl" (full height, the body
     *  becomes a flex column so an embedded frame can fill it) */
    size: { type: String, default: "md" },
  },

  emits: ["close"],

  watch: {
    visible: {
      immediate: true,
      handler(open: boolean) {
        if (open) document.addEventListener("keydown", this.onKey);
        else document.removeEventListener("keydown", this.onKey);
      },
    },
  },

  beforeUnmount() {
    document.removeEventListener("keydown", this.onKey);
  },

  methods: {
    onKey(e: KeyboardEvent) {
      if (e.key === "Escape") this.$emit("close");
    },
  },
});
</script>

<template>
  <div v-if="visible" class="lia-dialog">
    <div class="lia-dialog-backdrop" @click="$emit('close')"></div>
    <div
      class="lia-dialog-box"
      :class="'lia-dialog-box--' + size"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lia-dialog-title"
    >
      <div class="lia-dialog-header">
        <div class="d-flex align-items-start gap-2 min-w-0">
          <i v-if="icon" class="bi lia-dialog-icon" :class="icon" aria-hidden="true"></i>
          <div class="min-w-0">
            <h2 id="lia-dialog-title" class="h5 fw-bold mb-0">{{ title }}</h2>
            <p v-if="subtitle" class="small text-body-secondary mb-0 mt-1">{{ subtitle }}</p>
          </div>
        </div>
        <button
          type="button"
          class="btn-close"
          :aria-label="$t('modal.close')"
          @click="$emit('close')"
        ></button>
      </div>
      <div class="lia-dialog-body" :class="{ 'lia-dialog-body--fill': size === 'xl' }">
        <slot></slot>
      </div>
      <div v-if="$slots.footer" class="lia-dialog-footer">
        <slot name="footer"></slot>
      </div>
    </div>
  </div>
</template>

<style scoped>
.lia-dialog {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.lia-dialog-backdrop {
  position: absolute;
  inset: 0;
  background-color: rgba(23, 33, 43, 0.5);
}

.lia-dialog-box {
  position: relative;
  width: 100%;
  max-height: calc(100vh - 2rem);
  background-color: #fff;
  color: #17212b;
  border-radius: 1rem;
  box-shadow: 0 0.75rem 2.5rem rgba(23, 33, 43, 0.2);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.lia-dialog-box--md {
  max-width: 42.5rem;
}

.lia-dialog-box--lg {
  max-width: 56rem;
}

.lia-dialog-box--xl {
  max-width: 69rem;
  height: calc(100vh - 2rem);
}

.lia-dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  padding: 1.1rem 1.25rem;
  border-bottom: 1px solid var(--lia-line);
}

.lia-dialog-icon {
  font-size: 1.3rem;
  line-height: 1.2;
  color: var(--lia-accent);
}

.min-w-0 {
  min-width: 0;
}

.lia-dialog-body {
  padding: 1.25rem;
  overflow-y: auto;
  flex: 1;
}

.lia-dialog-body--fill {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.lia-dialog-footer {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding: 0.85rem 1.25rem;
  border-top: 1px solid var(--lia-line);
  background: #fafbfb;
}

.lia-dialog-footer:empty {
  display: none;
}
</style>
