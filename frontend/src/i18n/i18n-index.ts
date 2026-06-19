/**
 * AutoFlowNG — i18n Configuration
 *
 * Handles language detection, loading, and switching.
 * All user-facing strings must go through t() — never hardcoded in JSX.
 *
 * Detection order:
 *   1. User's saved preferred_language (from account, if logged in)
 *   2. localStorage 'autoflowng_lang'
 *   3. navigator.language
 *   4. Country default from geo-detection
 *   5. Fallback: 'en'
 *
 * Supported: 18 languages (en + 17 translations)
 */

import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import ar from './ar.json';
import de from './de.json';
import es from './es.json';
import fr from './fr.json';
import ha from './ha.json';
import hi from './hi.json';
import id from './id.json';
import ig from './ig.json';
import it from './it.json';
import ja from './ja.json';
import ko from './ko.json';
import pt from './pt.json';
import ru from './ru.json';
import sw from './sw.json';
import tr from './tr.json';
import yo from './yo.json';
import zh from './zh.json';

// Language → locale mapping for Intl APIs
export const LANGUAGE_LOCALES: Record<string, string> = {
  en: 'en-US',
  ar: 'ar-SA',
  de: 'de-DE',
  es: 'es-ES',
  fr: 'fr-FR',
  ha: 'ha-NG',
  hi: 'hi-IN',
  id: 'id-ID',
  ig: 'ig-NG',
  it: 'it-IT',
  ja: 'ja-JP',
  ko: 'ko-KR',
  pt: 'pt-PT',
  ru: 'ru-RU',
  sw: 'sw-KE',
  tr: 'tr-TR',
  yo: 'yo-NG',
  zh: 'zh-CN',
};

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English',    flag: '🇺🇸', nativeLabel: 'English'    },
  { code: 'ar', label: 'Arabic',     flag: '🇸🇦', nativeLabel: 'العربية'    },
  { code: 'de', label: 'German',     flag: '🇩🇪', nativeLabel: 'Deutsch'    },
  { code: 'es', label: 'Spanish',    flag: '🇪🇸', nativeLabel: 'Español'    },
  { code: 'fr', label: 'French',     flag: '🇫🇷', nativeLabel: 'Français'   },
  { code: 'ha', label: 'Hausa',      flag: '🇳🇬', nativeLabel: 'Hausa'      },
  { code: 'hi', label: 'Hindi',      flag: '🇮🇳', nativeLabel: 'हिन्दी'     },
  { code: 'id', label: 'Indonesian', flag: '🇮🇩', nativeLabel: 'Bahasa Indonesia' },
  { code: 'ig', label: 'Igbo',       flag: '🇳🇬', nativeLabel: 'Igbo'       },
  { code: 'it', label: 'Italian',    flag: '🇮🇹', nativeLabel: 'Italiano'   },
  { code: 'ja', label: 'Japanese',   flag: '🇯🇵', nativeLabel: '日本語'      },
  { code: 'ko', label: 'Korean',     flag: '🇰🇷', nativeLabel: '한국어'      },
  { code: 'pt', label: 'Portuguese', flag: '🇵🇹', nativeLabel: 'Português'  },
  { code: 'ru', label: 'Russian',    flag: '🇷🇺', nativeLabel: 'Русский'    },
  { code: 'sw', label: 'Swahili',    flag: '🇰🇪', nativeLabel: 'Kiswahili'  },
  { code: 'tr', label: 'Turkish',    flag: '🇹🇷', nativeLabel: 'Türkçe'     },
  { code: 'yo', label: 'Yoruba',     flag: '🇳🇬', nativeLabel: 'Yorùbá'     },
  { code: 'zh', label: 'Chinese',    flag: '🇨🇳', nativeLabel: '中文'        },
];

// RTL languages — consumers can use this to set dir="rtl" on the document
export const RTL_LANGUAGES = new Set(['ar']);

// Country → default language
const COUNTRY_LANGUAGE: Record<string, string> = {
  // Arabic-speaking
  SA: 'ar', EG: 'ar', AE: 'ar', MA: 'ar', DZ: 'ar', TN: 'ar', JO: 'ar', LB: 'ar', IQ: 'ar', KW: 'ar', QA: 'ar',
  // European
  DE: 'de', AT: 'de', CH: 'de',
  ES: 'es', MX: 'es', AR: 'es', CO: 'es', PE: 'es', CL: 'es', VE: 'es',
  FR: 'fr', CI: 'fr', SN: 'fr', CM: 'fr', BE: 'fr',
  IT: 'it',
  PT: 'pt', BR: 'pt',
  RU: 'ru',
  TR: 'tr',
  // Asian
  IN: 'hi',
  ID: 'id',
  JP: 'ja',
  KR: 'ko',
  CN: 'zh', TW: 'zh', SG: 'zh',
  // African
  NG: 'en', GH: 'en',
  TZ: 'sw', KE: 'sw',
  // English default
  US: 'en', GB: 'en', CA: 'en', AU: 'en', NZ: 'en', ZA: 'en',
};

export function detectLanguage(geoCountry?: string | null): string {
  // 1. localStorage preference
  const stored = localStorage.getItem('autoflowng_lang');
  if (stored && LANGUAGE_LOCALES[stored]) return stored;

  // 2. navigator.language
  const browserLang = navigator.language?.split('-')[0];
  if (browserLang && LANGUAGE_LOCALES[browserLang]) return browserLang;

  // 3. Geo-detected country
  if (geoCountry && COUNTRY_LANGUAGE[geoCountry]) {
    return COUNTRY_LANGUAGE[geoCountry];
  }

  return 'en';
}

export async function setLanguage(langCode: string, saveToAccount?: () => Promise<void>) {
  await i18next.changeLanguage(langCode);
  localStorage.setItem('autoflowng_lang', langCode);

  // Apply RTL direction to <html> when switching to Arabic
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('dir', RTL_LANGUAGES.has(langCode) ? 'rtl' : 'ltr');
    document.documentElement.setAttribute('lang', langCode);
  }

  if (saveToAccount) {
    try { await saveToAccount(); } catch { /* non-fatal */ }
  }
}

i18next
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      ar: { translation: ar },
      de: { translation: de },
      es: { translation: es },
      fr: { translation: fr },
      ha: { translation: ha },
      hi: { translation: hi },
      id: { translation: id },
      ig: { translation: ig },
      it: { translation: it },
      ja: { translation: ja },
      ko: { translation: ko },
      pt: { translation: pt },
      ru: { translation: ru },
      sw: { translation: sw },
      tr: { translation: tr },
      yo: { translation: yo },
      zh: { translation: zh },
    },
    lng: detectLanguage(),
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false, // React handles XSS
    },
  });

// Set initial dir/lang attributes
if (typeof document !== 'undefined') {
  const initialLang = i18next.language || 'en';
  document.documentElement.setAttribute('dir', RTL_LANGUAGES.has(initialLang) ? 'rtl' : 'ltr');
  document.documentElement.setAttribute('lang', initialLang);
}

export default i18next;
