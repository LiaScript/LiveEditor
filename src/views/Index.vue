<script lang="ts">
import Dexie from "../ts/indexDB";
import Card from "../components/Card.vue";
import Footer from "../components/Footer.vue";
import LanguageDropdown from "../components/LanguageDropdown.vue";
import * as Y from "yjs";
import { IndexeddbPersistence } from "y-indexeddb";

import MiniSearch from "minisearch";

import logoImg from "url:../../assets/logo.png";

function waitForSync(provider) {
  return new Promise<void>((resolve) => {
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
      logoImg,
      database,
      search,
      results: [],
      courses: [] as Array<{
        id: string;
        timestamp: number;
        meta: {
          title: string;
          logo: string;
          version: string;
          macro?: { comment: string; tags: string };
          gist_url: string;
          github?: { owner: string; repo: string; branch: string; commitSha: string };
        };
      }>,
      coursesFiltered: [] as Array<{
        id: string;
        timestamp: number;
        meta: {
          title: string;
          logo: string;
          version: string;
          macro?: { comment: string; tags: string };
          gist_url: string;
          github?: { owner: string; repo: string; branch: string; commitSha: string };
        };
      }>,
      searchText: "",
      tags: [] as Array<{ name: string; active: boolean }>,
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

    newCourse() {
      window.location.href = "./?/edit";
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

  components: { Card, Footer, LanguageDropdown },
};
</script>

<template>
  <nav class="navbar navbar-expand-lg navbar-light bg-light">
    <div class="container-fluid">
      <a class="navbar-brand">
        <img :src="logoImg" alt="LiaScript" height="28" />
        LiaEdit
      </a>

      <div class="flex-grow-1 d-flex justify-content-center">
        <LanguageDropdown />
      </div>

      <button class="btn btn-primary" @click="newCourse">{{ $t('index.newCourse') }}</button>
    </div>
  </nav>

  <div
    class="container mx-0 px-0 pb-5"
    style="max-width: 100vw !important; height: 100%; overflow: scroll"
  >
    <div class="input-group" style="padding: 2rem 5rem 0rem 5rem">
      <input
        class="form-control"
        :placeholder="$t('index.searchPlaceholder')"
        @input="handleSearch"
        v-model="searchText"
        :aria-label="$t('index.searchAriaLabel')"
        :disabled="courses.length === 0"
      />

      <div class="input-group-append">
        <button
          class="btn btn-icon"
          style="border: 0px"
          type="button"
          @click="searchText = ''"
          :aria-label="$t('index.clearSearchAria')"
          :disabled="courses.length === 0 || searchText.length === 0"
        >
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
        :card-github="item.meta.github"
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
        :card-github="item.meta.github"
        :card-tags="item.meta.macro?.tags"
        @drop="drop"
      />
    </div>

    <Footer>
      <i18n-t keypath="index.footer" tag="span">
        <template #liascript>
          <a href="https://LiaScript.github.io" target="_blank">LiaScript</a>
        </template>
        <template #examples>
          <a href="./examples.html">{{ $t('index.footerExamples') }}</a>
        </template>
        <template #templates>
          <a href="https://github.com/topics/liascript-template" target="_blank">{{ $t('index.footerTemplates') }}</a>
        </template>
        <template #courses>
          <a href="https://github.com/topics/liascript-course" target="_blank">{{ $t('index.footerCourses') }}</a>
        </template>
      </i18n-t>
    </Footer>
  </div>
</template>
