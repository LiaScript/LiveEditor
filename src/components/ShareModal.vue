<script lang="ts">
import { defineComponent, PropType } from "vue";
import Modal from "bootstrap/js/dist/modal";

// A share/action item rendered as a card. `href` items open an external link
// (e.g. a previous export); the others emit their `id` so the parent (the editor)
// runs the matching method. `disabled` items render greyed-out and inert.
export interface ShareItem {
  id: string;
  icon: string;
  /** i18n key for the card title; ignored when `label` is given. */
  labelKey?: string;
  /** pre-translated title (use when the label needs interpolation). */
  label?: string;
  descriptionKey?: string;
  disabled?: boolean;
  href?: string;
}

export interface ShareSection {
  headingKey?: string;
  items: ShareItem[];
}

export interface ShareTab {
  id: string;
  labelKey: string;
  sections: ShareSection[];
}

// Tabbed card chooser that replaces the editor's old "menu" dropdown. It groups
// every share / publish / GitHub / local-folder action into tabs of cards. The
// component is purely presentational: the parent passes the tabs (built from its
// reactive state) and handles the emitted action ids.
export default defineComponent({
  name: "ShareModal",

  props: {
    tabs: {
      type: Array as PropType<ShareTab[]>,
      required: true,
    },
  },

  emits: ["action"],

  data() {
    return {
      active: "" as string,
      modal: null as Modal | null,
    };
  },

  methods: {
    open() {
      if (!this.active && this.tabs.length) this.active = this.tabs[0].id;
      if (!this.modal) {
        this.modal = new Modal(this.$refs.el as Element);
      }
      this.modal.show();
    },

    cardTag(item: ShareItem): string {
      return !item.disabled && item.href ? "a" : "button";
    },

    onCardClick(item: ShareItem) {
      if (item.disabled) return;
      // href cards keep their default behaviour (open in a new tab); just close
      // the modal. Action cards emit their id for the parent to handle.
      this.modal?.hide();
      if (!item.href) this.$emit("action", item.id);
    },
  },
});
</script>

<template>
  <div ref="el" class="modal fade" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-lg modal-dialog-centered">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">{{ $t("share.modalTitle") }}</h5>
          <button
            type="button"
            class="btn-close"
            data-bs-dismiss="modal"
            :aria-label="$t('card.close')"
          ></button>
        </div>
        <div class="modal-body">
          <ul class="nav nav-tabs mb-3">
            <li v-for="tab in tabs" :key="tab.id" class="nav-item">
              <button
                type="button"
                class="nav-link"
                :class="{ active: active === tab.id }"
                @click="active = tab.id"
              >
                {{ $t(tab.labelKey) }}
              </button>
            </li>
          </ul>

          <template v-for="tab in tabs" :key="tab.id">
            <div v-if="active === tab.id">
              <template v-for="(section, i) in tab.sections" :key="i">
                <h6
                  v-if="section.headingKey"
                  class="share-section-heading text-uppercase text-muted"
                >
                  {{ $t(section.headingKey) }}
                </h6>
                <div class="row row-cols-1 row-cols-sm-2 row-cols-md-3 g-3 mb-2">
                  <div v-for="item in section.items" :key="item.id" class="col">
                    <component
                      :is="cardTag(item)"
                      class="share-card"
                      :class="{ 'share-card--disabled': item.disabled }"
                      :href="!item.disabled && item.href ? item.href : null"
                      :target="item.href ? '_blank' : null"
                      :disabled="item.disabled || null"
                      @click="onCardClick(item)"
                    >
                      <i class="bi share-card-icon" :class="item.icon"></i>
                      <span class="share-card-title">
                        {{ item.label || (item.labelKey ? $t(item.labelKey) : "") }}
                      </span>
                      <small
                        v-if="item.descriptionKey"
                        class="share-card-desc text-muted"
                      >
                        {{ $t(item.descriptionKey) }}
                      </small>
                    </component>
                  </div>
                </div>
              </template>
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.share-section-heading {
  font-size: 0.75rem;
  letter-spacing: 0.04em;
  margin: 0.75rem 0 0.4rem;
}

.share-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  width: 100%;
  height: 100%;
  gap: 0.4rem;
  padding: 1.1rem 0.9rem;
  background: var(--bs-body-bg, #fff);
  border: 1px solid var(--bs-border-color, #dee2e6);
  border-radius: 0.75rem;
  cursor: pointer;
  text-decoration: none;
  color: inherit;
  transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
}

.share-card:hover,
.share-card:focus-visible {
  transform: translateY(-3px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.12);
  border-color: var(--bs-primary, #0d6efd);
  outline: none;
  color: inherit;
}

.share-card--disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.share-card--disabled:hover,
.share-card--disabled:focus-visible {
  transform: none;
  box-shadow: none;
  border-color: var(--bs-border-color, #dee2e6);
}

.share-card--disabled .share-card-icon {
  color: var(--bs-secondary, #6c757d);
}

.share-card-icon {
  font-size: 2rem;
  line-height: 1;
  color: var(--bs-primary, #0d6efd);
}

.share-card-title {
  font-weight: 600;
}

.share-card-desc {
  font-size: 0.8125rem;
  line-height: 1.3;
}
</style>
