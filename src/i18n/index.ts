import { createI18n } from 'vue-i18n'
import en from './en.json'

// Only English (the fallback) is bundled; every other locale is its own chunk,
// loaded on demand, so the startup bundle doesn't carry ~640 KB of translations.
const loaders: Record<string, () => Promise<any>> = {
  de: () => import('./de.json'),
  uk: () => import('./uk.json'),
  es: () => import('./es.json'),
  fr: () => import('./fr.json'),
  zh: () => import('./zh.json'),
  ja: () => import('./ja.json'),
  ko: () => import('./ko.json'),
  ar: () => import('./ar.json'),
  pt: () => import('./pt.json'),
  bg: () => import('./bg.json'),
  cs: () => import('./cs.json'),
  da: () => import('./da.json'),
  el: () => import('./el.json'),
  hu: () => import('./hu.json'),
  it: () => import('./it.json'),
  nl: () => import('./nl.json'),
  pl: () => import('./pl.json'),
  sv: () => import('./sv.json'),
  tr: () => import('./tr.json'),
  sw: () => import('./sw.json'),
  ha: () => import('./ha.json'),
  am: () => import('./am.json'),
  yo: () => import('./yo.json'),
  om: () => import('./om.json'),
  ff: () => import('./ff.json'),
  ig: () => import('./ig.json'),
}

export const locales = ['en', ...Object.keys(loaders)].sort()

function detectLocale(): string {
  const saved = localStorage.getItem('locale')
  if (saved && locales.includes(saved)) return saved

  const browser = navigator.language.split('-')[0]
  if (locales.includes(browser)) return browser

  return 'en'
}

export const i18n = createI18n({
  legacy: true,
  locale: 'en',
  fallbackLocale: 'en',
  messages: { en },
})

/** Load a locale's messages (once) and switch to it. */
export async function setLocale(locale: string) {
  const global = i18n.global as any
  if (!global.availableLocales.includes(locale) && loaders[locale]) {
    const mod = await loaders[locale]()
    global.setLocaleMessage(locale, mod.default ?? mod)
  }
  global.locale = locale
  // lets the browser hyphenate and screen readers pronounce the UI language
  document.documentElement.lang = locale
}

/** Resolves once the detected startup locale is loaded. */
export const i18nReady = setLocale(detectLocale()).catch(console.error)
