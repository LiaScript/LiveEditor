<template>
  <div
    class="modal fade"
    id="modal"
    tabindex="-1"
    aria-labelledby="exampleModalLabel"
    aria-hidden="true"
  >
    <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-xl">
      <div class="modal-content">
        <div class="modal-header">
          <h5
            class="modal-title"
            id="exampleModalLabel"
          >{{title}}</h5>
          <button
            type="button"
            class="btn-close"
            data-bs-dismiss="modal"
            aria-label="Close"
          ></button>
        </div>
        <div class="modal-body">
          <div v-html="body"></div>
        </div>
        <div class="modal-footer">
          <button
            type="button"
            class="btn btn-secondary"
            data-bs-dismiss="modal"
          >Close</button>
          <!--button type="button" class="btn btn-primary">Save changes</button-->
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
export default {
  props: ["modalTitle"],

  data() {
    return {
      title: "",
      body: "",
    };
  },

  methods: {
    show(title: string, body: string) {
      this.title = title;
      this.body = body;
      const modal = new bootstrap.Modal(document.getElementById("modal"), {
        "data-bs-toggle": "modal",
      });

      modal.show();
    },
  },
};
</script>


