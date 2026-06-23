<script lang="ts">
import * as Y from "yjs";
import { IndexeddbPersistence } from "y-indexeddb";
import { LiaScriptURL } from "../ts/utils";
import { navigateTo } from "../index";
import DateFormat from "date-format-simple";

function mulberry32(a) {
  return function () {
    var t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashCode(str: string) {
  let hash = 0;
  if (str.length === 0) {
    return hash;
  }
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash;
}

function generateLines(id: string) {
  const random = mulberry32(hashCode(id));

  let html = "";

  const baseHue = random() * 360;
  const bgColor = `hsl(${baseHue}, 50%, 50%)`;
  const palette = [
    `hsl(${baseHue}, 50%, 30%)`,
    `hsl(${(baseHue + 180) % 360}, 50%, 50%)`,
    `hsl(${baseHue}, 50%, 100%)`,
  ];

  html += `<rect x='-100' y='-100' width='300' height='300' fill='${bgColor}' stroke='none'></rect>`;

  for (let i = 16; i > 0; i--) {
    const x0 = random() * 100;
    const y0 = random() * 100;
    const x1 = random() * 100;
    const y1 = random() * 100;
    const x2 = random() * 100;
    const y2 = random() * 100;
    const a = x2 - x1;
    const b = y2 - y1;
    const strokeWidth = i / 20;
    const hue = baseHue;
    const color = palette[Math.floor(random() * palette.length)];

    html += `<path fill='none' stroke='${color}' stroke-width='${strokeWidth}' stroke-linejoin='round' stroke-linecap='round' d='M ${x0} ${y0} Q ${
      x1 - b
    }  ${y1 - a} ${x1} ${y1} Q ${x1 + b} ${y1 + a} ${x2} ${y2}'/>`;
    html += `<circle cx='${x0}' cy='${y0}' r='${
      3 * strokeWidth
    }' fill='${color}'></circle>`;
  }

  return html;
}

export default {
  props: [
    "cardId",
    "cardTitle",
    "cardVersion",
    "cardTimestamp",
    "cardLogo",
    "cardComment",
    "cardGist",
    "cardGithub",
    "cardTags",
  ],
  emits: ["drop"],

  data() {
    const dateFormat = new DateFormat(new Date().getTime());
    // Remote logos (http/data/blob) are shown directly; a local project path is
    // resolved from the project store in mounted() (loadLocalLogo); otherwise we
    // fall back to the generated SVG.
    const logo = this.$props.cardLogo as string | undefined;
    const isRemote = !!logo && /^(https?:|data:|blob:|\/\/)/i.test(logo);
    const url = isRemote ? logo : null;
    const svg = url ? null : generateLines(this.$props.cardId);

    var tags = [];
    if (this.$props.cardTags) {
      tags = this.$props.cardTags.split(",").map((e: string) => e.trim().toLowerCase());
    }

    return {
      dateFormat,
      svg,
      url,
      tags,
      LiaScriptURL,
      menuOpen: false,
      modalId: `modal-${this.$props.cardId}`, // Unique modal ID for each card
    };
  },

  computed: {
    // Origin badge shown on the preview: where this course was imported from.
    source(): { label: string; icon: string; cls: string } {
      if (this.cardGithub)
        return { label: this.$t("card.source.github"), icon: "bi-github", cls: "lia-source-github" };
      if (this.cardGist)
        return { label: this.$t("card.source.gist"), icon: "bi-git", cls: "lia-source-gist" };
      return { label: this.$t("card.source.local"), icon: "bi-hdd", cls: "lia-source-local" };
    },

    displayTags(): string[] {
      return this.tags.slice(0, 3);
    },

    extraTags(): number {
      return Math.max(0, this.tags.length - 3);
    },
  },

  methods: {
    drop() {
      this.$emit("drop", this.$props.cardId);
    },

    openEditor() {
      navigateTo("?/edit/" + this.$props.cardId);
    },

    // Resolve a logo that points to a file inside the project (e.g. "img/cover.png").
    // Images live in the ProjectDoc `fileData` map keyed by their path; older
    // projects kept them in the legacy `blob` map (referenced as "/<hash>.<ext>").
    // Both are tried, then the bytes become an object URL the <img> can display.
    loadLocalLogo() {
      const logo = this.$props.cardLogo as string | undefined;
      if (!logo || /^(https?:|data:|blob:|\/\/)/i.test(logo)) return;

      const yDoc = new Y.Doc();
      const provider = new IndexeddbPersistence(this.$props.cardId, yDoc);

      // normalise "./img/x.png" | "/img/x.png" -> "img/x.png" (cf. ProjectDoc.normalize)
      const path = logo
        .split("/")
        .filter((s) => s.length > 0 && s !== ".")
        .join("/");

      provider.whenSynced.then(() => {
        const fileData = yDoc.getMap("fileData");
        const blob = yDoc.getMap("blob");
        const bytes = (fileData.get(path) ||
          fileData.get(logo) ||
          blob.get(path) ||
          blob.get(logo.replace(/^\//, ""))) as Uint8Array | undefined;

        if (bytes) {
          this.url = URL.createObjectURL(new Blob([bytes]));
        }
        provider.destroy();
        yDoc.destroy();
      });
    },

    toggleMenu() {
      this.menuOpen = !this.menuOpen;
      // tell every other card to close its menu, so only one is ever open.
      // A document event is used because @click.stop on the button keeps the
      // regular outside-click handler from seeing this click.
      if (this.menuOpen) {
        document.dispatchEvent(
          new CustomEvent("lia-card-menu", { detail: this.$props.cardId })
        );
      }
    },

    onMenuElsewhere(e: CustomEvent) {
      if (e.detail !== this.$props.cardId) {
        this.menuOpen = false;
      }
    },

    onOutsideClick(e: MouseEvent) {
      if (!(this.$el as HTMLElement).contains?.(e.target as Node)) {
        this.menuOpen = false;
      }
    },

    createDate(timestamp: number) {
      const dateObject = new Date(timestamp);

      return this.dateFormat.print(dateObject);
    },
  },

  mounted() {
    document.addEventListener("click", this.onOutsideClick);
    document.addEventListener("lia-card-menu", this.onMenuElsewhere as EventListener);
    this.loadLocalLogo();
  },

  beforeUnmount() {
    document.removeEventListener("click", this.onOutsideClick);
    document.removeEventListener("lia-card-menu", this.onMenuElsewhere as EventListener);
    if (typeof this.url === "string" && this.url.startsWith("blob:")) {
      URL.revokeObjectURL(this.url);
    }
  },
};
</script>

<template>
  <div class="col">
    <div
      class="card h-100 border-0 shadow-sm lia-card"
      role="button"
      tabindex="0"
      @click="openEditor"
      @keyup.enter="openEditor"
    >
      <div class="lia-media">
        <img
          v-if="url"
          :src="url"
          class="lia-media-img"
          loading="lazy"
          :id="cardId + '-img'"
        />
        <svg
          v-else
          class="lia-media-img"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 110 50"
          v-html="svg"
        ></svg>
      </div>

      <span class="badge lia-source" :class="source.cls">
        <i class="bi" :class="source.icon"></i> {{ source.label }}
      </span>

      <div class="dropdown lia-menu" :class="{ show: menuOpen }" @click.stop>
          <button
            type="button"
            class="btn btn-sm btn-light rounded-circle lia-menu-btn"
            :aria-label="$t('card.menu.label')"
            :aria-expanded="menuOpen"
            @click.stop="toggleMenu"
          >
            <i class="bi bi-three-dots-vertical"></i>
          </button>
          <ul class="dropdown-menu dropdown-menu-end" :class="{ show: menuOpen }">
            <li>
              <a class="dropdown-item" :href="'./?/edit/' + cardId" data-link="true">
                <i class="bi bi-pencil me-2"></i>{{ $t('card.edit') }}
              </a>
            </li>
            <li v-if="cardGithub">
              <a
                class="dropdown-item"
                :href="'https://github.com/' + cardGithub.owner + '/' + cardGithub.repo"
                target="_blank"
              >
                <i class="bi bi-github me-2"></i>{{ cardGithub.owner }}/{{ cardGithub.repo }}
              </a>
            </li>
            <li v-if="cardGist">
              <a class="dropdown-item" :href="LiaScriptURL + '?' + cardGist" target="_blank">
                <i class="bi bi-git me-2"></i>GitHub gist
              </a>
            </li>
            <li><hr class="dropdown-divider" /></li>
            <li>
              <button
                type="button"
                class="dropdown-item text-danger"
                data-bs-toggle="modal"
                :data-bs-target="`#${modalId}`"
              >
                <i class="bi bi-trash me-2"></i>{{ $t('card.delete') }}
              </button>
            </li>
            <li>
              <span class="dropdown-item-text small text-muted">ID: {{ cardId }}</span>
            </li>
          </ul>
        </div>
      <div class="card-body d-flex flex-column">
        <h6 class="lia-title mb-2">{{ cardTitle || $t('card.untitled') }}</h6>

        <div v-if="displayTags.length" class="mb-2">
          <span
            v-for="tag of displayTags"
            :key="tag"
            class="badge rounded-pill bg-secondary me-1"
            >{{ tag }}</span
          >
          <span v-if="extraTags > 0" class="badge rounded-pill bg-light text-muted">
            +{{ extraTags }}
          </span>
        </div>

        <p v-if="cardComment" class="lia-comment text-muted small mb-0">{{ cardComment }}</p>

        <div class="mt-auto pt-3 d-flex justify-content-between align-items-center">
          <small class="text-muted text-truncate me-2">
            v{{ cardVersion }} · {{ createDate(cardTimestamp) }}
          </small>
          <a
            :href="'./?/edit/' + cardId"
            class="btn btn-primary btn-sm flex-shrink-0"
            data-link="true"
            @click.stop
            >{{ $t('card.edit') }}</a
          >
        </div>
      </div>
    </div>
  </div>

  <div
    class="modal fade"
    :id="modalId"
    tabindex="-1"
    :aria-labelledby="`${modalId}-label`"
    aria-hidden="true"
  >
    <div class="modal-dialog">
      <div class="modal-content border-danger mb-5" style="border-width: 3px">
        <div class="modal-header">
          <h5 class="modal-title" :id="`${modalId}-label`">
            {{ $t('card.deleteTitle', { title: cardTitle || $t('card.untitled') }) }}
          </h5>
          <button
            type="button"
            class="btn-close"
            data-bs-dismiss="modal"
            :aria-label="$t('card.close')"
          ></button>
        </div>
        <div class="modal-body">
          {{ $t('card.deleteConfirm') }}
          <br />
          {{ $t('card.deleteWarning') }}
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
            {{ $t('card.abort') }}
          </button>
          <button
            type="button"
            class="btn btn-outline-danger"
            data-bs-dismiss="modal"
            @click="drop"
          >
            {{ $t('card.delete') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.lia-card {
  position: relative;
  border-radius: 0.75rem;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.lia-card:hover,
.lia-card:focus-visible {
  transform: translateY(-4px);
  box-shadow: 0 0.7rem 1.4rem rgba(28, 30, 179, 0.25) !important;
  outline: none;
}

.lia-media {
  height: 11rem;
  background: #f1f3f5;
  border-top-left-radius: 0.75rem;
  border-top-right-radius: 0.75rem;
  overflow: hidden;
}

.lia-media-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.lia-source {
  position: absolute;
  top: 0.6rem;
  left: 0.6rem;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-weight: 500;
  backdrop-filter: blur(2px);
}

.lia-source-github {
  background-color: rgba(33, 37, 41, 0.85);
}
.lia-source-gist {
  background-color: rgba(111, 66, 193, 0.85);
}
.lia-source-local {
  background-color: rgba(73, 80, 87, 0.8);
}

.lia-menu {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  z-index: 20;
}

.lia-menu .dropdown-menu {
  right: 0;
  left: auto;
  z-index: 30;
}

.lia-menu-btn {
  width: 2rem;
  height: 2rem;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.lia-title {
  font-weight: 600;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.lia-comment {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
