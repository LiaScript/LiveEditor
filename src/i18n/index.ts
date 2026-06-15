import { createI18n } from 'vue-i18n'
import en from './en.json'
import de from './de.json'

const messages = { en, de }
type Locale = keyof typeof messages

function detectLocale(): Locale {
  const saved = localStorage.getItem('locale') as Locale | null
  if (saved && saved in messages) return saved

  const browser = navigator.language.split('-')[0] as Locale
  if (browser in messages) return browser

  return 'en'
}

export const i18n = createI18n({
  legacy: true,
  locale: detectLocale(),
  fallbackLocale: 'en',
  messages,
})
