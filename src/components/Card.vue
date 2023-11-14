<script lang="ts">
import DateFormat from "date-format-simple";

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

    return {
      dateFormat,
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
      <div
        class="card-body"
        style="margin-bottom: -26px"
      >
        <div class="d-flex justify-content-between">
          <h6
            class="h6 text-truncate"
            style="margin-right: 10px"
          >
            {{ cardTitle || 'Untitled'}}
          </h6>
          <button
            type="button"
            class="btn btn-close btn-sm"
            aria-label="Delete"
            @click="drop"
          ></button>
        </div>
      </div>
      <hr>
      <div
        class="card-body pt-0"
        style="height: 12rem; overflow: auto"
      >
        <img
          :src="cardLogo"
          style="width:100%"
          :hidden="cardLogo ? false : true"
          loading="lazy"
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

        <hr :hidden="cardComment ? false : true">
        <p class="mb-0 text-muted"><small>ID: {{ cardId }}</small></p>
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
            class="btn btn-primary btn-sm"
            data-link="true"
          >Edit</a>
        </div>
      </div>
    </div>
  </div>

</template>

