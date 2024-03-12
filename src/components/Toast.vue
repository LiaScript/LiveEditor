<script lang="ts">
export default {
  name: "Toast",

  data() {
    return { visible: true };
  },

  methods: {
    close() {
      this.visible = false;
    },
  },
};
</script>

<template>
  <div
    :v-if="visible"
    class="position-fixed bottom-0 end-0 p-3"
    :style="visible ? 'z-index: 11' : 'z-index: -10'"
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
          aria-label="Close"
          @click="close"
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
