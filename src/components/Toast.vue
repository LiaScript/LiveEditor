<template>
  <div
    class="position-fixed bottom-0 end-0 p-3"
    style="z-index: 11"
  >
    <div
      id="liveToast"
      class="toast show"
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
    >
      <div class="toast-header">
        <strong class="me-auto">Information</strong>
        <button
          type="button"
          class="btn-close"
          data-bs-dismiss="toast"
          aria-label="Close"
        ></button>
      </div>
      <div class="toast-body">
        <small>
          <slot></slot>
        </small>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
export default {
  name: "Toast",
};
</script>