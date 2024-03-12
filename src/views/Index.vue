<script lang="ts">
import Dexie from "../ts/indexDB";
import Card from "../components/Card.vue";
import Footer from "../components/Footer.vue";
import * as Y from "yjs";
import { IndexeddbPersistence } from "y-indexeddb";

import MiniSearch from "minisearch";

function waitForSync(provider) {
  return new Promise((resolve) => {
    if (provider.synced) {
      resolve();
    } else {
      provider.on("synced", () => {
        resolve();
      });
    }
  });
}

function getTextFor(id: string) {
  const yDoc = new Y.Doc();
  const provider = new IndexeddbPersistence(id, yDoc);

  return new Promise((resolve) => {
    waitForSync(provider).then(() => {
      resolve(yDoc.getText(id).toString()); // Now you can safely access the data
    });
  });
}

export default {
  data() {
    const database = new Dexie();

    const self = this;
    database.watch(null, (e: any) => {
      self.init();
    });

    const search = new MiniSearch({
      idField: "id",
      fields: ["text"],
      storeFields: [],
      searchOptions: {
        boost: { id: 2 },
      },
    });

    return {
      database,
      search,
      results: [],
      courses: [],
      coursesFiltered: [],
      searchText: "",
      tags: [],
    };
  },

  mounted() {
    this.initSearch();
  },
  methods: {
    handleSearch() {
      const results = this.search.search(this.searchText, {
        fuzzy: 0.2,
        prefix: true,
        combineWith: "AND",
      });

      this.coursesFiltered = [];
      for (const item of results) {
        const course = this.courses.find((c) => c.id === item.id);

        if (course) this.coursesFiltered.push(course);
      }

      const activeTags = this.tags.filter((t) => t.active).map((t) => t.name);
      if (this.searchText.length === 0 && activeTags.length > 0) {
        this.coursesFiltered = this.courses;
      }

      if (activeTags.length > 0) {
        this.coursesFiltered = this.coursesFiltered.filter((c) => {
          const localTags = c.meta.macro?.tags;
          if (localTags) {
            const localTagsArray = localTags
              .split(",")
              .map((t) => t.trim().toLowerCase());
            return localTagsArray.some((t) => activeTags.includes(t));
          }
          return false;
        });
      }
    },

    async initSearch() {
      const db = await this.database.getAll();

      for (const item of db) {
        getTextFor(item.id).then((text) => {
          this.search.add({ id: item.id, text });
        });
      }
    },

    async init() {
      this.courses = await this.database.getAll();

      var tags = new Set();
      for (const course of this.courses) {
        let localTags = course.meta.macro?.tags;

        if (localTags) {
          localTags = localTags.split(",").map((t) => t.trim().toLowerCase());
          localTags.forEach((t) => tags.add(t));
        }
      }

      this.tags = Array.from(tags)
        .sort()
        .map((t) => {
          return { name: t, active: false };
        });
    },

    drop(id: string) {
      this.database.drop(id);
      window.indexedDB.deleteDatabase(id);
      this.init();

      const self = this;

      setTimeout(() => {
        self.handleSearch();
      }, 100);
    },
  },

  async created() {
    await this.init();
  },

  components: { Card, Footer },
};
</script>

<template>
  <nav class="navbar navbar-expand-lg navbar-light bg-light">
    <div class="container-fluid">
      <a class="navbar-brand">
        <img src="../../assets/logo.png" alt="LiaScript" height="28" />
        LiaEdit
      </a>

      <a type="button" class="btn btn-primary" href="./?/edit" data-link> New note </a>
    </div>
  </nav>

  <div
    class="container mx-0 px-0 pb-5"
    style="max-width: 100vw !important; height: 100%; overflow: scroll"
  >
    <div class="input-group" style="padding: 2rem 5rem 0rem 5rem">
      <input
        class="form-control"
        placeholder="Type to search..."
        @input="handleSearch"
        v-model="searchText"
      />

      <div class="input-group-append">
        <button class="btn btn-icon" type="button" @click="searchText = ''">
          <i class="bi bi-x-lg"> </i>
        </button>
      </div>
    </div>

    <div :v-if="tags.length > 0" style="text-align: center; padding: 2rem 5rem 0rem 5rem">
      <button
        v-for="tag of tags"
        class="btn badge rounded-pill"
        :class="{ 'bg-primary': tag.active, 'bg-secondary': !tag.active }"
        @click="
          tag.active = !tag.active;
          handleSearch();
        "
        style="margin-right: 0.25rem"
      >
        {{ tag.name }}
      </button>
    </div>

    <div
      class="row row-cols-1 row-cols-md-3 row-cols-lg-4 g-8 m-4"
      v-if="searchText.length > 0 || coursesFiltered.length > 0"
    >
      <Card
        v-for="item of coursesFiltered"
        :key="item.id"
        :card-id="item.id"
        :card-timestamp="item.timestamp"
        :card-title="item.meta.title"
        :card-logo="item.meta.logo"
        :card-version="item.meta.version"
        :card-comment="item.meta.macro?.comment"
        :card-gist="item.meta.gist_url"
        :card-tags="item.meta.macro?.tags"
        @drop="drop"
      />
    </div>

    <div class="row row-cols-1 row-cols-md-3 row-cols-lg-4 g-8 m-4" v-else>
      <Card
        v-for="item of courses"
        :key="item.id"
        :card-id="item.id"
        :card-timestamp="item.timestamp"
        :card-title="item.meta.title"
        :card-logo="item.meta.logo"
        :card-version="item.meta.version"
        :card-comment="item.meta.macro?.comment"
        :card-gist="item.meta.gist_url"
        :card-tags="item.meta.macro?.tags"
        @drop="drop"
      />
    </div>

    <Footer>
      This is a collaborative online editor for
      <a href="https://LiaScript.github.io" target="_blank">LiaScript</a>. All content is
      stored only within your browser. If you need some inspiration, check out some of our
      <a href="./examples.html">examples</a>, search for embedable
      <a href="https://github.com/topics/liascript-template" target="_blank">templates</a
      >, or already published
      <a href="https://github.com/topics/liascript-course" target="_blank">courses</a>.
    </Footer>
  </div>
</template>
