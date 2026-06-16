<script lang="ts">
import Footer from "../components/Footer.vue";
import LanguageDropdown from "../components/LanguageDropdown.vue";
import logoImg from "url:../../assets/logo.png";

interface Example {
  title: string;
  info: string;
  link: string;
  logo: string;
}

export default {
  name: "Examples",
  data() {
    return {
      logoImg,
      examples: [],
    };
  },
  methods: {
    init: function (examples: Example[]) {
      for (let i = 0; i < examples.length; i++) {
        this.examples.push(examples[i]);
      }
    },
  },
  expose: ["init"],
  components: { Footer, LanguageDropdown },
};
</script>

<template>
  <nav class="navbar navbar-expand-lg navbar-light bg-light">
    <div class="container-fluid">
      <a class="navbar-brand" href="./" data-link="">
        <img :src="logoImg" alt="LiaScript" height="28" />
        {{ $t('app.title') }}
      </a>

      <div class="flex-grow-1 d-flex justify-content-center">
        <LanguageDropdown />
      </div>

      <a type="button" class="btn btn-primary" href="./?/edit" data-link>{{ $t('index.newCourse') }}</a>
    </div>
  </nav>

  <div class="container mt-4">
    <div id="card-container" class="row row-cols-1 row-cols-md-2 g-4">
      <div v-for="item of examples" :key="item.link" class="col-sm-6 mb-4">
        <div class="card h-100 shadow bg-body rounded">
          <img
            :src="item.logo"
            class="card-img-top img-fluid"
            style="height: 16rem; object-fit: cover"
            loading="lazy"
          />
          <div class="card-body">
            <h5 class="card-title">{{ item.title }}</h5>
            <p class="card-text">{{ item.info }}</p>
            <a :href="'./?/show/file/' + item.link" class="stretched-link">{{ $t('examples.show') }}</a>
          </div>
        </div>
      </div>
    </div>

    <Footer>
      <i18n-t keypath="examples.footer" tag="span">
        <template #liascript>
          <a href="https://LiaScript.github.io" target="_blank">LiaScript</a>
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
