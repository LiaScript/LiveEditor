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
  <nav class="navbar bg-white border-bottom">
    <div class="container-fluid gap-2">
      <a class="navbar-brand d-flex align-items-center gap-2 me-auto" href="./">
        <img :src="logoImg" alt="" height="28" />
        <span class="fw-semibold">{{ $t('app.title') }}</span>
      </a>

      <LanguageDropdown align="end" />
      <a class="btn btn-primary btn-sm" href="./?/edit">
        <i class="bi bi-plus-lg" aria-hidden="true"></i> {{ $t('index.newCourse') }}
      </a>
    </div>
  </nav>

  <main class="lia-examples">
    <a class="lia-back" href="./">
      <i class="bi bi-arrow-left" aria-hidden="true"></i> {{ $t('nav.myCourses') }}
    </a>
    <h1 class="lia-examples-title">{{ $t('index.footerExamples') }}</h1>
    <p class="lia-examples-intro">{{ $t('examples.intro') }}</p>

    <div class="row row-cols-1 row-cols-sm-2 row-cols-lg-3 g-4">
      <div v-for="item of examples" :key="item.link" class="col">
        <article class="lia-example">
          <img :src="item.logo" alt="" class="lia-example-img" loading="lazy" />
          <div class="lia-example-body">
            <h2 class="lia-example-name">{{ item.title }}</h2>
            <p class="lia-example-info">{{ item.info }}</p>
            <a :href="'./?/show/file/' + item.link" class="btn btn-primary btn-sm align-self-start mt-auto">
              {{ $t('examples.show') }}
            </a>
          </div>
        </article>
      </div>
    </div>
  </main>

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
</template>

<style scoped>
.lia-examples {
  max-width: 1240px;
  margin: 0 auto;
  padding: 1.5rem 1rem 1rem;
}

.lia-back {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.9rem;
  text-decoration: none;
}

.lia-examples-title {
  font-size: 2rem;
  font-weight: 700;
  margin: 0.75rem 0 0.4rem;
}

.lia-examples-intro {
  max-width: 46rem;
  color: var(--lia-muted);
  font-size: 1.05rem;
  margin-bottom: 1.75rem;
}

.lia-example {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #fff;
  border: 1px solid var(--lia-line);
  border-radius: 0.75rem;
  overflow: hidden;
}

.lia-example-img {
  width: 100%;
  height: 11rem;
  object-fit: cover;
  background: var(--lia-ground);
}

.lia-example-body {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 1rem 1.1rem 1.1rem;
}

.lia-example-name {
  font-size: 1.05rem;
  font-weight: 600;
  margin: 0;
}

.lia-example-info {
  font-size: 0.9rem;
  line-height: 1.45;
  color: #4a5560;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
