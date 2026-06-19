<script lang="ts">
const localeNames: Record<string, string> = {
  en: 'English',
  de: 'Deutsch',
  uk: 'Українська',
  es: 'Español',
  fr: 'Français',
  zh: '中文（简体）',
  ja: '日本語',
  ko: '한국어',
  ar: 'العربية',
  pt: 'Português',
  bg: 'Български',
  cs: 'Čeština',
  da: 'Dansk',
  el: 'Ελληνικά',
  hu: 'Magyar',
  it: 'Italiano',
  nl: 'Nederlands',
  pl: 'Polski',
  sv: 'Svenska',
  tr: 'Türkçe',
  sw: 'Kiswahili',
  ha: 'Hausa',
  am: 'አማርኛ',
  yo: 'Yorùbá',
  om: 'Afaan Oromoo',
  ff: 'Fulfulde',
  ig: 'Igbo',
}

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

    localeLabel(locale: string) {
      const code = locale.toUpperCase();
      return `${code} - ${localeNames[locale] ?? code}`;
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
      style="left: 50%; transform: translateX(-50%); max-height: calc(100vh - 4rem); overflow-y: auto; overscroll-behavior: contain;"
    >
      <li v-for="locale in $i18n.availableLocales" :key="locale">
        <button
          class="dropdown-item"
          :class="{ active: $i18n.locale === locale }"
          @click="changeLocale(locale)"
        >{{ localeLabel(locale) }}</button>
      </li>
    </ul>
  </div>
</template>
