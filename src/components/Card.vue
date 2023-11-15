<script lang="ts">
import * as Y from "yjs";
import { IndexeddbPersistence } from "y-indexeddb";

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
  ],
  emits: ["drop"],

  data() {
    const dateFormat = new DateFormat(new Date().getTime());
    let url = this.$props.cardLogo;
    const svg = url ? null : generateLines(this.$props.cardId);

    if (
      this.$props.cardLogo &&
      this.$props.cardLogo.match(/\/[a-f,0-9]+\.[^.]*/)
    ) {
      const yDoc = new Y.Doc();
      const indexeddbProvider = new IndexeddbPersistence(
        this.$props.cardId,
        yDoc
      );

      const id = this.$props.cardLogo.slice(1);

      indexeddbProvider.whenSynced.then(() => {
        const blob = yDoc.getMap("blob").get(id) as Uint8Array;
        if (blob) {
          url = URL.createObjectURL(new Blob([blob]));

          // @ts-ignore
          document.getElementById(this.$props.cardId + "-img").src = url;
        }
      });
    }

    return {
      dateFormat,
      svg,
      url,
    };
  },

  methods: {
    drop() {
      this.$emit("drop", this.$props.cardId);
    },

    createDate(timestamp: number) {
      const dateObject = new Date(timestamp);

      return this.dateFormat.print(dateObject);
    },
  },
};
</script>


<template>
  <div
    class="col-12 p-2 col-sm-6 col-md-6 col-lg-4 col-xl-3"
    style="height: inherit"
  >
    <div class="card shadow bg-body rounded">
      <img
        v-if="url"
        :src="url"
        class="card-img-top img-fluid"
        style="height: 12rem; object-fit: cover;"
        loading="lazy"
        :id="cardId+'-img'"
      >
      <svg
        v-if="svg"
        class="card-img-top img-fluid"
        xmlns='http://www.w3.org/2000/svg'
        viewBox='0 0 110 50'
        style="height: 12rem;"
        v-html="svg"
      ></svg>

      <button
        type="button"
        class="btn btn-close btn-secondary"
        aria-label="Delete"
        data-bs-toggle="modal"
        data-bs-target="#exampleModal"
        style="position: absolute; top: 3px; right: 4px; z-index: 10; background-color: white;"
      ></button>

      <p
        style="padding-left: 5px; position: absolute; top: 10.5rem; left: 0; z-index: 10; background-color: rgba(255, 255, 255, 0.5); width:100%"
        class="mb-0 text-muted"
      ><small>ID: {{ cardId }}</small></p>
      <div
        class="card-body"
        style="margin-bottom: -16px"
      >

        <div class="d-flex justify-content-between">
          <h6
            class="h6 text-truncate"
            style="margin-right: 10px"
          >
            {{ cardTitle || 'Untitled'}}
          </h6>

        </div>
      </div>

      <div
        class="card-body pt-0"
        style="height: 4rem; overflow: auto"
      >
        <p class="mb-0">
          <small>
            {{ cardComment || '' }}
          </small>
        </p>

        <div :hidden="cardGist ? false : true">
          <hr>
          <small>
            Exports:
          </small>

          <p class="mb-0">
            <small>
              <a
                :href="'https://LiaScript.github.io/course/?' + cardGist"
                target="_blank"
              >GitHub gist</a>
            </small>
          </p>
        </div>

      </div>

      <div class="row m-1">
        <p class="col-9 card-text my-2 text-truncate">
          <small class="text-muted">
            [v {{ cardVersion }}] - {{ createDate(cardTimestamp) }}
          </small>
        </p>
        <div class="col gap-2 d-sm-flex justify-content-end p-1">
          <a
            :href="'./?/edit/' + cardId"
            class="btn btn-primary btn-sm stretched-link"
            data-link="true"
          >Edit</a>
        </div>
      </div>
    </div>
  </div>

  <div
    class="modal fade"
    id="exampleModal"
    tabindex="-1"
    aria-labelledby="exampleModalLabel"
    aria-hidden="true"
  >
    <div class="modal-dialog">
      <div
        class="modal-content border-danger mb-5"
        style="border-width: 3px;"
      >
        <div class="modal-header">
          <h5
            class="modal-title"
            id="exampleModalLabel"
          >Delete: "{{ cardTitle || "Untitled" }}"</h5>
          <button
            type="button"
            class="btn-close"
            data-bs-dismiss="modal"
            aria-label="Close"
          ></button>
        </div>
        <div class="modal-body">
          Are you sure you that want to delete this document forever?
          <br>
          It cannot be restored!
        </div>
        <div class="modal-footer">
          <button
            type="button"
            class="btn btn-secondary"
            data-bs-dismiss="modal"
          >Abort</button>
          <button
            type="button"
            class="btn btn-outline-danger"
            data-bs-dismiss="modal"
            @click="drop"
          >Delete</button>
        </div>
      </div>
    </div>
  </div>

</template>

<style scoped>
.card:hover {
  box-shadow: 0 0.7rem 1.2rem rgba(28, 30, 179, 0.432) !important;
}
</style>