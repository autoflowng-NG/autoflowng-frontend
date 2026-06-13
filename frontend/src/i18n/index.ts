/**
 * AutoFlowNG — i18n Configuration (Update-001)
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
 */

import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';

// Language → locale mapping for Intl APIs
export const LANGUAGE_LOCALES: Record<string, string> = {
  en: 'en-US',
  fr: 'fr-FR',
  yo: 'yo-NG',
  ig: 'ig-NG',
  ha: 'ha-NG',
  sw: 'sw-KE',
};

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English',   flag: '🇺🇸', nativeLabel: 'English' },
  { code: 'fr', label: 'French',    flag: '🇫🇷', nativeLabel: 'Français' },
  { code: 'yo', label: 'Yoruba',    flag: '🇳🇬', nativeLabel: 'Yorùbá' },
  { code: 'ig', label: 'Igbo',      flag: '🇳🇬', nativeLabel: 'Igbo' },
  { code: 'ha', label: 'Hausa',     flag: '🇳🇬', nativeLabel: 'Hausa' },
  { code: 'sw', label: 'Swahili',   flag: '🇰🇪', nativeLabel: 'Kiswahili' },
];

// Country → default language
const COUNTRY_LANGUAGE: Record<string, string> = {
  FR: 'fr', CI: 'fr', SN: 'fr', CM: 'fr',
  TZ: 'sw',
  NG: 'en', GH: 'en', KE: 'en', ZA: 'en',
  US: 'en', GB: 'en', CA: 'en', AU: 'en',
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
  if (saveToAccount) {
    try { await saveToAccount(); } catch { /* non-fatal */ }
  }
}

i18next
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
    },
    lng: detectLanguage(),
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false, // React handles XSS
    },
    // Lazy-load other languages on demand
    partialBundledLanguages: true,
  });

export default i18next;
