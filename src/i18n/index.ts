import { createI18n } from 'vue-i18n'
import en from './en.json'
import de from './de.json'
import uk from './uk.json'
import es from './es.json'
import fr from './fr.json'
import zh from './zh.json'
import ja from './ja.json'
import ko from './ko.json'
import ar from './ar.json'
import pt from './pt.json'
import bg from './bg.json'
import cs from './cs.json'
import da from './da.json'
import el from './el.json'
import hu from './hu.json'
import it from './it.json'
import nl from './nl.json'
import pl from './pl.json'
import sv from './sv.json'
import tr from './tr.json'
import sw from './sw.json'
import ha from './ha.json'
import am from './am.json'
import yo from './yo.json'
import om from './om.json'
import ff from './ff.json'
import ig from './ig.json'

const messages = {
  en,
  de,
  uk,
  es,
  fr,
  zh,
  ja,
  ko,
  ar,
  pt,
  bg,
  cs,
  da,
  el,
  hu,
  it,
  nl,
  pl,
  sv,
  tr,
  sw,
  ha,
  am,
  yo,
  om,
  ff,
  ig,
}
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
