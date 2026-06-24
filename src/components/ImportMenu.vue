<script lang="ts">
import { defineComponent } from "vue";
import { importSources, ImportSource } from "../ts/importSources";
import ImportUrlModal from "./ImportUrlModal.vue";

// Split button on the index page: the primary action creates a new empty
// course, the dropdown lists every registered import source. New sources are
// picked up automatically from the importSources registry.
export default defineComponent({
  name: "ImportMenu",

  components: { ImportUrlModal },

  data() {
    return {
      open: false,
      sources: importSources,
      primary: importSources.find((s) => s.id === "new") as ImportSource,
      acceptFor: "" as string,
      pendingOnFiles: null as ((files: FileList) => Promise<void>) | null,
      busy: false,
    };
  },

  computed: {
    extraSources(): ImportSource[] {
      return this.sources.filter(
        (s) => s.id !== "new" && (s.available ? s.available() : true)
      );
    },
  },

  methods: {
    select(source: ImportSource) {
      this.open = false;
      if (source.kind === "navigate") {
        source.onSelect?.();
      } else if (source.kind === "fileInput") {
        this.acceptFor = source.accept || "";
        this.pendingOnFiles = source.onFiles || null;
        this.$nextTick(() => (this.$refs.file as HTMLInputElement)?.click());
      } else if (source.kind === "modal") {
        (this.$refs.modal as any)?.open(source);
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

    onOutsideClick(e: MouseEvent) {
      if (!(this.$el as HTMLElement).contains(e.target as Node)) {
        this.open = false;
      }
    },
  },

  mounted() {
    document.addEventListener("click", this.onOutsideClick);
  },

  beforeUnmount() {
    document.removeEventListener("click", this.onOutsideClick);
  },
});
</script>

<template>
  <div class="btn-group" :class="{ show: open }">
    <button class="btn btn-primary" type="button" :disabled="busy" @click="select(primary)">
      <span v-if="busy" class="spinner-border spinner-border-sm me-1"></span>
      <i v-else class="bi" :class="primary.icon"></i>
      {{ $t(primary.labelKey) }}
    </button>
    <button
      class="btn btn-primary dropdown-toggle dropdown-toggle-split"
      type="button"
      :aria-expanded="open"
      :aria-label="$t('index.import.more')"
      @click.stop="open = !open"
    ></button>
    <ul class="dropdown-menu dropdown-menu-end" :class="{ show: open }">
      <li>
        <h6 class="dropdown-header">{{ $t('index.import.heading') }}</h6>
      </li>
      <li v-for="source in extraSources" :key="source.id">
        <button class="dropdown-item" type="button" @click="select(source)">
          <i class="bi me-2" :class="source.icon"></i>{{ $t(source.labelKey) }}
        </button>
      </li>
    </ul>

    <input
      ref="file"
      type="file"
      class="d-none"
      :accept="acceptFor"
      @change="onFileChange"
    />

    <ImportUrlModal ref="modal" />
  </div>
</template>

<style scoped>
/* We toggle the menu manually (no Bootstrap Popper), so dropdown-menu-end has
   no effect — force right alignment so the menu opens inside the viewport. */
.dropdown-menu {
  right: 0;
  left: auto;
}
</style>
