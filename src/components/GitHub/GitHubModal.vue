<script lang="ts">
import { defineComponent } from "vue";

// Lightweight modal shell shared by the GitHub import/push/pull dialogs.
// Mirrors the Nostr modal markup (backdrop + centered container) so styling
// stays consistent. Body and footer are provided via slots.
export default defineComponent({
  name: "GitHubModal",

  props: {
    visible: { type: Boolean, default: false },
    title: { type: String, default: "" },
  },

  emits: ["close"],
});
</script>

<template>
  <div class="gh-modal" v-if="visible">
    <div class="modal-backdrop" @click="$emit('close')"></div>
    <div class="modal-container">
      <div class="modal-header">
        <h5 class="modal-title">
          <i class="bi bi-github"></i> {{ title }}
        </h5>
        <button type="button" class="btn-close" @click="$emit('close')"></button>
      </div>
      <div class="modal-body">
        <slot></slot>
      </div>
      <div class="modal-footer-bar">
        <slot name="footer"></slot>
      </div>
    </div>
  </div>
</template>

<style scoped>
.gh-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 2000;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 1rem;
}

.modal-backdrop {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
}

.modal-container {
  position: relative;
  width: 90%;
  max-width: 680px;
  max-height: 90vh;
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
  overflow: hidden;
  z-index: 2001;
  margin: 2rem 0;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid #dee2e6;
}

.modal-body {
  padding: 1.25rem;
  overflow-y: auto;
  flex: 1;
}

.modal-footer-bar {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem;
  border-top: 1px solid #dee2e6;
}

.modal-footer-bar:empty {
  display: none;
}

@media (prefers-color-scheme: dark) {
  .modal-container {
    background-color: #343a40;
    color: #f8f9fa;
  }
  .modal-header,
  .modal-footer-bar {
    border-color: #495057;
  }
  .btn-close {
    filter: invert(1) grayscale(100%) brightness(200%);
  }
}
</style>
