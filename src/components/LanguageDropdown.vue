<script lang="ts">
export default {
  name: 'LanguageDropdown',

  data() {
    return { open: false }
  },

  methods: {
    changeLocale(locale: string) {
      this.$i18n.locale = locale;
      localStorage.setItem('locale', locale);
      this.open = false;
    },

    onOutsideClick(e: MouseEvent) {
      if (!(this.$el as HTMLElement).contains(e.target as Node)) {
        this.open = false;
      }
    },
  },

  mounted() {
    document.addEventListener('click', this.onOutsideClick);
  },

  beforeUnmount() {
    document.removeEventListener('click', this.onOutsideClick);
  },
}
</script>

<template>
  <div class="dropdown" :class="{ show: open }">
    <button
      class="btn btn-sm btn-outline-secondary dropdown-toggle"
      type="button"
      @click.stop="open = !open"
      :aria-expanded="open"
    >{{ $i18n.locale.toUpperCase() }}</button>
    <ul
      class="dropdown-menu"
      :class="{ show: open }"
      style="z-index: 1000; left: 50%; transform: translateX(-50%)"
    >
      <li v-for="locale in $i18n.availableLocales" :key="locale">
        <button
          class="dropdown-item"
          :class="{ active: $i18n.locale === locale }"
          @click="changeLocale(locale)"
        >{{ locale.toUpperCase() }}</button>
      </li>
    </ul>
  </div>
</template>
