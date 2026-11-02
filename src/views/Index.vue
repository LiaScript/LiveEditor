<script lang="ts">
import Dexie from "../ts/indexDB";
import Card from "../components/Card.vue";
import Footer from "../components/Footer.vue";
import LanguageDropdown from "../components/LanguageDropdown.vue";
import ImportMenu from "../components/ImportMenu.vue";
import * as Y from "yjs";
import { IndexeddbPersistence } from "y-indexeddb";

import MiniSearch from "minisearch";

import logoImg from "url:../../assets/logo.png";
import { importSources } from "../ts/importSources";

const WELCOME_HIDDEN_KEY = "liaeditor:welcomeHidden";

// localStorage can throw (private mode, blocked site data): the welcome block
// then simply shows again, which is harmless.
function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function writeFlag(key: string) {
  try {
    localStorage.setItem(key, "1");
  } catch {}
}

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

// Loads the whole project (incl. media), so it is closed again right after
// reading the course text.
async function getTextFor(id: string) {
  const yDoc = new Y.Doc();
  const provider = new IndexeddbPersistence(id, yDoc);
  await waitForSync(provider);
  const text = yDoc.getText(id).toString();
  provider.destroy();
  yDoc.destroy();
  return text;
}

export default {
  data() {
    const database = new Dexie();

    const self = this;
    this.unwatch = database.watch(null, (e: any) => {
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
          gitlab?: { host: string; projectPath: string; branch: string; commitSha: string };
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
          gitlab?: { host: string; projectPath: string; branch: string; commitSha: string };
        };
      }>,
      searchText: "",
      tags: [] as Array<{ name: string; active: boolean }>,
      // false until the course list has been read once, so the welcome block
      // does not flash for returning users
      loaded: false,
      welcomeHidden: readFlag(WELCOME_HIDDEN_KEY),
    };
  },

  computed: {
    // the welcome block is always shown while there is nothing else to see
    showWelcome(): boolean {
      return this.loaded && (this.courses.length === 0 || !this.welcomeHidden);
    },

    filtering(): boolean {
      return this.searchText.length > 0 || this.tags.some((t) => t.active);
    },

    visibleCourses(): any[] {
      return this.filtering ? this.coursesFiltered : this.courses;
    },
  },

  mounted() {
    this.initSearch();
  },

  unmounted() {
    this.unwatch?.();
  },
  methods: {
    hideWelcome() {
      this.welcomeHidden = true;
      writeFlag(WELCOME_HIDDEN_KEY);
    },

    // welcome cards reuse the import sources of the "New course" chooser
    startWith(id: string) {
      const source = importSources.find((s) => s.id === id);
      if (source) (this.$refs.importMenu as any)?.select(source);
    },

    openChooser() {
      (this.$refs.importMenu as any)?.openChooser();
    },

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

      // one project at a time, so only one is in memory at once
      for (const item of db) {
        const text = await getTextFor(item.id);
        this.search.add({ id: item.id, text });
      }
    },

    async init() {
      this.courses = await this.database.getAll();
      this.loaded = true;

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

  components: { Card, Footer, LanguageDropdown, ImportMenu },
};
</script>


<template>
  <nav class="navbar bg-white border-bottom lia-topbar">
    <div class="container-fluid gap-2">
      <a class="navbar-brand d-flex align-items-center gap-2 me-auto" href="./" data-link="true">
        <img :src="logoImg" alt="" height="28" />
        <span class="fw-semibold">{{ $t('app.title') }}</span>
      </a>

      <LanguageDropdown align="end" />
      <ImportMenu ref="importMenu" />
    </div>
  </nav>

  <div class="lia-index-scroll">
    <main class="lia-index">
      <section v-if="showWelcome" class="lia-welcome" aria-labelledby="lia-welcome-title">
        <div class="d-flex flex-wrap justify-content-between align-items-start gap-3">
          <div class="lia-welcome-text">
            <h1 id="lia-welcome-title" class="lia-welcome-title">{{ $t('index.welcome.title') }}</h1>
            <p class="lia-welcome-lead">{{ $t('index.welcome.lead') }}</p>
          </div>
          <button
            v-if="courses.length > 0"
            type="button"
            class="btn btn-outline-secondary"
            @click="hideWelcome"
          >
            {{ $t('index.welcome.hide') }}
          </button>
        </div>

        <div class="lia-start-grid">
          <button type="button" class="lia-start lia-start--primary" @click="startWith('template')">
            <i class="bi bi-journal-richtext" aria-hidden="true"></i>
            <span class="lia-start-title">{{ $t('index.import.template') }}</span>
            <span class="lia-start-desc">{{ $t('index.import.templateDesc') }}</span>
          </button>
          <button type="button" class="lia-start" @click="startWith('upload')">
            <i class="bi bi-upload" aria-hidden="true"></i>
            <span class="lia-start-title">{{ $t('index.welcome.open') }}</span>
            <span class="lia-start-desc">{{ $t('index.welcome.openDesc') }}</span>
          </button>
          <button type="button" class="lia-start" @click="openChooser">
            <i class="bi bi-cloud-download" aria-hidden="true"></i>
            <span class="lia-start-title">{{ $t('index.welcome.remote') }}</span>
            <span class="lia-start-desc">{{ $t('index.welcome.remoteDesc') }}</span>
          </button>
        </div>

        <a href="./examples.html" class="lia-welcome-examples">
          {{ $t('index.welcome.examples') }} <i class="bi bi-arrow-right" aria-hidden="true"></i>
        </a>
      </section>

      <section class="lia-storage-note" role="note">
        <i class="bi bi-hdd" aria-hidden="true"></i>
        <p class="mb-0">
          <strong>{{ $t('index.storage.title') }}</strong>
          {{ $t('index.storage.body') }}
        </p>
      </section>

      <section v-if="courses.length > 0" aria-labelledby="lia-courses-title" class="d-flex flex-column gap-3">
        <div class="lia-courses-head">
          <h2 id="lia-courses-title" class="h4 mb-0 fw-bold">{{ $t('index.courses') }}</h2>
          <span class="text-body-secondary small">
            {{ $t('index.courseCount', { n: courses.length }, courses.length) }}
          </span>
          <div class="flex-grow-1"></div>
          <div class="lia-search">
            <i class="bi bi-search" aria-hidden="true"></i>
            <input
              type="search"
              class="form-control"
              :placeholder="$t('index.searchPlaceholder')"
              :aria-label="$t('index.searchAriaLabel')"
              v-model="searchText"
              @input="handleSearch"
            />
          </div>
        </div>

        <div v-if="tags.length > 0" class="d-flex flex-wrap gap-2">
          <button
            v-for="tag of tags"
            :key="tag.name"
            type="button"
            class="btn btn-sm rounded-pill"
            :class="tag.active ? 'btn-primary' : 'btn-outline-secondary'"
            :aria-pressed="tag.active"
            @click="
              tag.active = !tag.active;
              handleSearch();
            "
          >
            {{ tag.name }}
          </button>
        </div>

        <div class="row row-cols-1 row-cols-sm-2 row-cols-lg-3 row-cols-xl-4 g-4">
          <div v-if="!filtering" class="col">
            <button type="button" class="lia-new-card" @click="openChooser">
              <span class="lia-new-card-icon"><i class="bi bi-plus-lg" aria-hidden="true"></i></span>
              <span class="fw-semibold">{{ $t('index.newCourse') }}</span>
              <span class="small text-body-secondary">{{ $t('index.newCourseDesc') }}</span>
            </button>
          </div>

          <Card
            v-for="item of visibleCourses"
            :key="item.id"
            :card-id="item.id"
            :card-timestamp="item.timestamp"
            :card-title="item.meta.title"
            :card-logo="item.meta.logo"
            :card-version="item.meta.version"
            :card-comment="item.meta.macro?.comment"
            :card-gist="item.meta.gist_url"
            :card-github="item.meta.github"
            :card-gitlab="item.meta.gitlab"
            :card-folder="item.meta.localFolder"
            :card-tags="item.meta.macro?.tags"
            @drop="drop"
          />
        </div>
      </section>
    </main>

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

<style scoped>
.lia-topbar {
  min-height: 56px;
}

/* the body is position:fixed (see index.html), so the page scrolls in here */
.lia-index-scroll {
  height: calc(100vh - 56px);
  overflow-y: auto;
  background: var(--lia-ground);
}

.lia-index {
  max-width: 1240px;
  margin: 0 auto;
  padding: 2rem 1rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 1.75rem;
}

.lia-welcome {
  background: #fff;
  border: 1px solid var(--lia-line);
  border-radius: 1rem;
  padding: 2rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.lia-welcome-text {
  max-width: 46rem;
}

.lia-welcome-title {
  font-size: clamp(1.6rem, 1.2rem + 1.4vw, 2.25rem);
  font-weight: 700;
  line-height: 1.15;
  margin-bottom: 0.6rem;
}

.lia-welcome-lead {
  font-size: 1.05rem;
  line-height: 1.55;
  color: var(--lia-muted);
  margin: 0;
}

.lia-start-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
  gap: 1rem;
}

.lia-start {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.4rem;
  padding: 1.25rem;
  text-align: left;
  border: 1px solid var(--lia-line);
  border-radius: 0.75rem;
  background: #fff;
  color: inherit;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.lia-start .bi {
  font-size: 1.5rem;
  color: var(--lia-accent);
}

.lia-start:hover,
.lia-start:focus-visible {
  border-color: var(--lia-accent);
  box-shadow: 0 0 0 0.2rem rgba(var(--lia-accent-rgb), 0.15);
  outline: none;
}

.lia-start--primary {
  background: var(--lia-accent);
  border-color: var(--lia-accent);
  color: #fff;
}

.lia-start--primary .bi {
  color: #fff;
}

.lia-start--primary .lia-start-desc {
  color: #d5ecea;
}

.lia-start--primary:hover,
.lia-start--primary:focus-visible {
  background: var(--lia-accent-hover);
}

.lia-start-title {
  font-size: 1.05rem;
  font-weight: 600;
}

.lia-start-desc {
  font-size: 0.9rem;
  line-height: 1.45;
  color: var(--lia-muted);
}

.lia-welcome-examples {
  align-self: flex-start;
  font-weight: 500;
  text-decoration: none;
}

.lia-storage-note {
  display: flex;
  align-items: flex-start;
  gap: 0.9rem;
  padding: 1rem 1.25rem;
  border-radius: 0.75rem;
  background: var(--lia-note-bg);
  border: 1px solid var(--lia-note-border);
  color: var(--lia-note-ink);
  line-height: 1.5;
}

.lia-storage-note .bi {
  font-size: 1.3rem;
  line-height: 1.2;
}

.lia-courses-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem 1rem;
}

.lia-search {
  position: relative;
  flex: 0 1 22rem;
  min-width: 14rem;
}

.lia-search .bi {
  position: absolute;
  left: 0.85rem;
  top: 50%;
  transform: translateY(-50%);
  color: var(--lia-muted);
  pointer-events: none;
}

.lia-search .form-control {
  padding-left: 2.4rem;
  min-height: 44px;
}

.lia-new-card {
  width: 100%;
  height: 100%;
  min-height: 18rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  border: 2px dashed #b9c3c8;
  border-radius: 0.75rem;
  background: #fff;
  color: var(--lia-accent);
  transition: border-color 0.15s ease;
}

.lia-new-card:hover,
.lia-new-card:focus-visible {
  border-color: var(--lia-accent);
  outline: none;
}

.lia-new-card-icon {
  width: 3.25rem;
  height: 3.25rem;
  border-radius: 0.9rem;
  background: var(--lia-accent-soft);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
}
</style>
