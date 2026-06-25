<script lang="ts">
import { defineComponent } from "vue";
import { ImportSource } from "../ts/importSources";
import ImportModal from "./ImportModal.vue";
import ImportUrlModal from "./ImportUrlModal.vue";

// "New" button on the index page. The button opens a card chooser (ImportModal)
// that lists every registered import source — including the blank-document
// option. Picking a card dispatches here: navigate runs immediately, fileInput
// triggers the hidden <input>, and modal opens the shared text-input dialog.
export default defineComponent({
  name: "ImportMenu",

  components: { ImportModal, ImportUrlModal },

  data() {
    return {
      acceptFor: "" as string,
      pendingOnFiles: null as ((files: FileList) => Promise<void>) | null,
      busy: false,
    };
  },

  methods: {
    openChooser() {
      (this.$refs.chooser as any)?.open();
    },

    select(source: ImportSource) {
      if (source.kind === "navigate") {
        source.onSelect?.();
      } else if (source.kind === "fileInput") {
        this.acceptFor = source.accept || "";
        this.pendingOnFiles = source.onFiles || null;
        this.$nextTick(() => (this.$refs.file as HTMLInputElement)?.click());
      } else if (source.kind === "modal") {
        // The chooser modal is closing; wait a tick so its backdrop is gone
        // before the text-input modal opens.
        this.$nextTick(() => (this.$refs.modal as any)?.open(source));
      }
    },

    async onFileChange(e: Event) {
      const input = e.target as HTMLInputElement;
      if (!input.files || input.files.length === 0 || !this.pendingOnFiles) return;
      this.busy = true;
      try {
        await this.pendingOnFiles(input.files);
      } catch (err) {
        console.warn(err);
        this.busy = false;
      }
      input.value = "";
    },
  },
});
</script>

<template>
  <div>
    <button
      class="btn btn-primary btn-sm"
      type="button"
      :disabled="busy"
      @click="openChooser"
    >
      <span v-if="busy" class="spinner-border spinner-border-sm me-1"></span>
      <i v-else class="bi bi-file-earmark-plus-fill"></i>
      {{ $t("index.import.new") }}
    </button>

    <input
      ref="file"
      type="file"
      class="d-none"
      :accept="acceptFor"
      @change="onFileChange"
    />

    <ImportModal ref="chooser" @select="select" />
    <ImportUrlModal ref="modal" />
  </div>
</template>
