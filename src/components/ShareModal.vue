<script lang="ts">
import { defineComponent, PropType } from "vue";
import Modal from "bootstrap/js/dist/modal";

// The editor's "Share & export" dialog. Actions are grouped by what the user
// wants to achieve (edit together, publish, GitHub/GitLab, folder, export):
// a goal list on the left, the matching actions on the right. The component is
// purely presentational — the parent builds the (already translated) groups
// from its reactive state and handles the emitted action ids.

export interface ShareTag {
  text: string;
  /** "good" = advantage, "warn" = limitation, default = neutral fact */
  tone?: "good" | "warn";
}

export interface ShareItem {
  id: string;
  icon: string;
  label: string;
  desc?: string;
  tags?: ShareTag[];
  /** technical name shown small, for people who look for it (e.g. "data-URI") */
  tech?: string;
  /** button text */
  action: string;
  /** highlight as the recommended action of its group */
  primary?: boolean;
  /** external link instead of an emitted action */
  href?: string;
  disabled?: boolean;
  /** why the item is disabled */
  reason?: string;
  /** what to do about it: emitted like a normal action */
  fix?: { id: string; label: string };
}

export interface ShareSection {
  heading?: string;
  items: ShareItem[];
  /** shown when `items` is empty */
  empty?: string;
}

export interface ShareGroup {
  id: string;
  icon: string;
  label: string;
  sub: string;
  intro: string;
  sections: ShareSection[];
}

export default defineComponent({
  name: "ShareModal",

  props: {
    groups: {
      type: Array as PropType<ShareGroup[]>,
      required: true,
    },
    courseTitle: {
      type: String,
      default: "",
    },
  },

  emits: ["action"],

  data() {
    return {
      active: "" as string,
      modal: null as Modal | null,
    };
  },

  computed: {
    current(): ShareGroup | undefined {
      return this.groups.find((g) => g.id === this.active) || this.groups[0];
    },
  },

  methods: {
    /** Open the dialog, optionally on a given group (e.g. "export"). */
    open(groupId?: string) {
      if (groupId) this.active = groupId;
      else if (!this.active && this.groups.length) this.active = this.groups[0].id;
      if (!this.modal) {
        this.modal = new Modal(this.$refs.el as Element);
      }
      this.modal.show();
    },

    close() {
      this.modal?.hide();
    },

    run(id: string) {
      this.modal?.hide();
      this.$emit("action", id);
    },
  },
});
</script>

<template>
  <div ref="el" class="modal fade" tabindex="-1" aria-hidden="true" aria-labelledby="lia-share-title">
    <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable lia-share-dialog">
      <div class="modal-content">
        <div class="modal-header align-items-start">
          <div>
            <h2 id="lia-share-title" class="modal-title h5 fw-bold">{{ $t("share.modalTitle") }}</h2>
            <p v-if="courseTitle" class="mb-0 small text-body-secondary">
              {{ $t("share.dialogSub", { title: courseTitle }) }}
            </p>
          </div>
          <button
            type="button"
            class="btn-close"
            data-bs-dismiss="modal"
            :aria-label="$t('card.close')"
          ></button>
        </div>

        <div class="modal-body p-0 lia-share-body">
          <nav class="lia-share-nav" :aria-label="$t('share.goalsAria')">
            <button
              v-for="group in groups"
              :key="group.id"
              type="button"
              class="lia-share-goal"
              :class="{ active: current && current.id === group.id }"
              :aria-current="current && current.id === group.id ? 'true' : null"
              @click="active = group.id"
            >
              <i class="bi" :class="group.icon" aria-hidden="true"></i>
              <span class="d-flex flex-column">
                <span class="lia-share-goal-label">{{ group.label }}</span>
                <span class="lia-share-goal-sub">{{ group.sub }}</span>
              </span>
            </button>
          </nav>

          <div v-if="current" class="lia-share-content">
            <p class="lia-share-intro">{{ current.intro }}</p>

            <section v-for="(section, i) in current.sections" :key="current.id + i" class="lia-share-section">
              <h3 v-if="section.heading" class="lia-share-heading">{{ section.heading }}</h3>
              <p v-if="section.items.length === 0 && section.empty" class="small text-body-secondary mb-0">
                {{ section.empty }}
              </p>

              <div
                v-for="item in section.items"
                :key="item.id"
                class="lia-share-row"
                :class="{ 'lia-share-row--disabled': item.disabled }"
              >
                <i class="bi lia-share-icon" :class="item.icon" aria-hidden="true"></i>

                <div class="lia-share-text">
                  <span class="lia-share-label">{{ item.label }}</span>
                  <span v-if="item.desc" class="lia-share-desc">{{ item.desc }}</span>
                  <span v-if="item.disabled && item.reason" class="lia-share-reason">
                    <i class="bi bi-info-circle" aria-hidden="true"></i> {{ item.reason }}
                  </span>
                  <span v-if="!item.disabled && (item.tags?.length || item.tech)" class="lia-share-tags">
                    <span
                      v-for="tag in item.tags || []"
                      :key="tag.text"
                      class="lia-share-tag"
                      :class="tag.tone ? 'lia-share-tag--' + tag.tone : ''"
                    >{{ tag.text }}</span>
                    <span v-if="item.tech" class="lia-share-tech">{{ item.tech }}</span>
                  </span>
                </div>

                <div class="lia-share-action">
                  <button
                    v-if="item.disabled && item.fix"
                    type="button"
                    class="btn btn-link btn-sm fw-semibold"
                    @click="run(item.fix.id)"
                  >
                    {{ item.fix.label }} <i class="bi bi-arrow-right" aria-hidden="true"></i>
                  </button>
                  <a
                    v-else-if="!item.disabled && item.href"
                    class="btn btn-sm"
                    :class="item.primary ? 'btn-primary' : 'btn-outline-secondary'"
                    :href="item.href"
                    target="_blank"
                    @click="close"
                  >
                    {{ item.action }} <i class="bi bi-box-arrow-up-right" aria-hidden="true"></i>
                  </a>
                  <button
                    v-else-if="!item.disabled"
                    type="button"
                    class="btn btn-sm"
                    :class="item.primary ? 'btn-primary' : 'btn-outline-secondary'"
                    @click="run(item.id)"
                  >
                    {{ item.action }}
                  </button>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.lia-share-dialog {
  max-width: min(60rem, calc(100vw - 1rem));
}

/* fixed height, so the dialog does not jump when switching goals; the
   action list scrolls on its own */
.lia-share-body {
  display: flex;
  height: min(36rem, calc(100vh - 10rem));
  overflow: hidden;
}

.lia-share-nav {
  flex: 0 0 16.5rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 1rem 0.75rem;
  background: #fafbfb;
  border-right: 1px solid var(--lia-line);
}

.lia-share-goal {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  width: 100%;
  padding: 0.7rem 0.75rem;
  border: 0;
  border-radius: 0.6rem;
  background: transparent;
  color: inherit;
  text-align: left;
}

.lia-share-goal .bi {
  font-size: 1.15rem;
  color: var(--lia-muted);
  line-height: 1.3;
}

.lia-share-goal:hover {
  background: #eef1f3;
}

.lia-share-goal.active {
  background: var(--lia-accent-soft);
  color: var(--lia-accent-ink);
}

.lia-share-goal.active .bi {
  color: var(--lia-accent-ink);
}

.lia-share-goal-label {
  font-weight: 600;
  font-size: 0.95rem;
}

.lia-share-goal-sub {
  font-size: 0.8rem;
  color: var(--lia-muted);
}

.lia-share-goal.active .lia-share-goal-sub {
  color: #2c6b69;
}

.lia-share-content {
  flex: 1 1 auto;
  min-width: 0;
  overflow-y: auto;
  padding: 1.25rem 1.5rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.lia-share-intro {
  margin: 0;
  color: #3b4652;
}

.lia-share-section {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.lia-share-heading {
  margin: 0.25rem 0 0;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: #3b4652;
}

.lia-share-row {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  padding: 0.85rem 1rem;
  border: 1px solid var(--lia-line);
  border-radius: 0.75rem;
  background: #fff;
}

.lia-share-row--disabled {
  background: #fafbfb;
}

.lia-share-row--disabled .lia-share-label,
.lia-share-row--disabled .lia-share-icon {
  color: var(--lia-muted);
}

.lia-share-icon {
  flex: 0 0 auto;
  font-size: 1.35rem;
  color: var(--lia-accent);
  align-self: flex-start;
  line-height: 1.2;
}

.lia-share-text {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.lia-share-label {
  font-weight: 600;
}

.lia-share-desc,
.lia-share-reason {
  font-size: 0.875rem;
  line-height: 1.45;
  color: #4a5560;
}

.lia-share-tags {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem;
  margin-top: 0.15rem;
}

.lia-share-tag {
  padding: 0.1rem 0.55rem;
  border-radius: 999px;
  background: #eef1f3;
  color: #3b4652;
  font-size: 0.75rem;
  font-weight: 500;
}

.lia-share-tag--good {
  background: var(--lia-accent-soft);
  color: var(--lia-accent-ink);
}

.lia-share-tag--warn {
  background: var(--lia-note-bg);
  color: #6b4c00;
}

.lia-share-tech {
  font-size: 0.75rem;
  color: var(--lia-muted);
}

.lia-share-action {
  flex: 0 0 auto;
}

.lia-share-action .btn {
  white-space: nowrap;
  min-height: 36px;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

/* phones / narrow windows: goals become a scrollable strip on top */
@media (max-width: 767.98px) {
  .lia-share-body {
    flex-direction: column;
    height: auto;
    overflow: visible;
  }

  .lia-share-nav {
    flex: 0 0 auto;
    flex-direction: row;
    overflow-x: auto;
    border-right: 0;
    border-bottom: 1px solid var(--lia-line);
    padding: 0.5rem;
    scrollbar-width: none;
  }

  .lia-share-goal {
    width: auto;
    flex: 0 0 auto;
    align-items: center;
  }

  .lia-share-goal-sub {
    display: none;
  }

  .lia-share-content {
    padding: 1rem;
    overflow: visible;
  }

  .lia-share-text {
    flex: 1 1 0;
  }

  .lia-share-row {
    flex-wrap: wrap;
  }

  .lia-share-action {
    flex-basis: 100%;
    padding-left: 2.25rem;
  }
}
</style>
