<template>
  <nav class="navbar navbar-expand-lg navbar-light bg-light">
    <div class="container-fluid">
      <a class="navbar-brand">
        LiaEdit
      </a>

      <a
        type="button"
        class="btn btn-primary"
        href="./?/edit"
        data-link
      >
        New note
      </a>
    </div>
  </nav>

  <div
    class="container mx-0 px-0 pb-5"
    style="max-width: 100vw !important; height:100%; overflow: scroll"
  >
    <div class="row row-cols-1 row-cols-md-3 row-cols-lg-4 g-8 m-5">

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
        @drop="drop"
      />

    </div>

    <Footer>
      This is a collaborative online editor for <a
        href="https://LiaScript.github.io"
        target="_blank"
      >LiaScript</a>.
      All content is stored only within your browser.
      If you need some inspiration, check out some of our <a href="./examples.html">examples</a>.
    </Footer>
  </div>

</template>


<script lang="ts">
import Dexie from "../ts/indexDB";
import Card from "../components/Card.vue";
import Footer from "../components/Footer.vue";

export default {
  data() {
    const database = new Dexie();
    const self = this;
    database.watch(null, (e: any) => {
      self.init();
    });

    return {
      database,
      courses: [],
    };
  },

  methods: {
    async init() {
      this.courses = await this.database.getAll();
    },

    drop(id: string) {
      this.database.drop(id);
      window.indexedDB.deleteDatabase(id);
      this.init();
    },
  },

  async created() {
    await this.init();
  },

  components: { Card, Footer },
};
</script>