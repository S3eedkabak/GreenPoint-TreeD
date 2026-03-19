/**
 * useTranslation hook
 *
 * Provides:
 *   t(keyPath)          — resolves a dot-path string like 'map.trees' and returns
 *                         the value (string OR function). Strings are returned as-is;
 *                         functions must be called by the caller with their args.
 *   language            — current language code ('en' | 'de')
 *   setLanguage(code)   — persists and broadcasts a language change
 *   toggleLanguage()    — convenience toggle between 'en' and 'de'
 *
 * Persistence: AsyncStorage key '@treed_language'
 *
 * Usage:
 *   const { t, language, toggleLanguage } = useTranslation();
 *   <Text>{t('map.confirmLocation')}</Text>
 *   <Text>{t('map.trees')(5)}</Text>          ← function value, call it
 *   <Text>{t('settings.syncWaiting')(3)}</Text>
 */

import { useState, useEffect, useContext, createContext, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { translations } from './translations';

const STORAGE_KEY = '@treed_language'; // AsyncStorage key for persistance 
const DEFAULT_LANG = 'en';

// ── Context ────────────────────────────────────────────────────────────────────
const LanguageContext = createContext({
  language: DEFAULT_LANG,
  setLanguage: () => {},
});

// ── Provider (wrap your NavigationContainer in App.js) ─────────────────────────
export const LanguageProvider = ({ children }) => {
  const [language, setLanguageState] = useState(DEFAULT_LANG);

  // Load persisted language on mount
  useEffect(() => { // RESTORING 
    AsyncStorage.getItem(STORAGE_KEY) // get from AsyncStorage
      .then((saved) => {
        if (saved === 'en' || saved === 'de') { // validate value
          setLanguageState(saved); // set state if valid
        }
      })
      .catch(() => {/* ignore — use default */});
  }, []);

  const setLanguage = useCallback(async (code) => { // Setting new language
    if (code !== 'en' && code !== 'de') return;
    setLanguageState(code); // update state immediately
    try {
      await AsyncStorage.setItem(STORAGE_KEY, code); 
    } catch {/* ignore storage errors */}
  }, []);

  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
};

// ── Hook ────────────────────────────────────────────────────────────────────────
export const useTranslation = () => {
  const { language, setLanguage } = useContext(LanguageContext);

  /**
   * Resolve a dot-path key against the current language's translation object.
   * Falls back to English if the key is missing in the current language.
   * Returns the raw value — string or function — caller decides how to use it.
   */
  const t = useCallback(
    (keyPath) => { // e.g. setitngs.subtitle
      const keys = keyPath.split('.'); // ['settings', 'subtitle']
      let value = translations[language]; // start with the current language's root
      for (const k of keys) { // traverse down keys until we find the correct key
        if (value == null) break;
        value = value[k];
      }
      // Fallback to English
      if (value == null) { // error in current language, try English
        value = translations[DEFAULT_LANG];
        for (const k of keys) {
          if (value == null) break; // if English also missing, stop
          value = value[k];
        }
      }
      if (value == null) {
        console.warn(`[i18n] Missing translation key: "${keyPath}"`);
        return keyPath; // Return key itself as last resort
      }
      return value;
    },
    [language]
  );

  const toggleLanguage = useCallback(() => {
    setLanguage(language === 'en' ? 'de' : 'en');
  }, [language, setLanguage]);

  return { t, language, setLanguage, toggleLanguage };
};