import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";

import { enUS } from "@/i18n/locales/en-US";
import { zhCN } from "@/i18n/locales/zh-CN";
import { zhTW } from "@/i18n/locales/zh-TW";
import { jaJP } from "@/i18n/locales/ja-JP";

export const appLanguages = ["zh-CN", "zh-TW", "en-US", "ja-JP"] as const;
export type AppLanguage = (typeof appLanguages)[number];

const languageAlias: Record<string, AppLanguage> = {
  zh: "zh-CN",
  "zh-CN": "zh-CN",
  "zh-Hans": "zh-CN",
  "zh-Hans-CN": "zh-CN",
  "zh-TW": "zh-TW",
  "zh-Hant": "zh-TW",
  "zh-Hant-TW": "zh-TW",
  "zh-HK": "zh-TW",
  "zh-Hant-HK": "zh-TW",
  en: "en-US",
  "en-US": "en-US",
  ja: "ja-JP",
  "ja-JP": "ja-JP",
};

function normalizeLanguage(language?: string): AppLanguage {
  if (!language) {
    return "zh-CN";
  }
  return languageAlias[language] ?? "zh-CN";
}

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      "zh-CN": { translation: zhCN },
      "zh-TW": { translation: zhTW },
      "en-US": { translation: enUS },
      "ja-JP": { translation: jaJP },
    },
    fallbackLng: "zh-CN",
    supportedLngs: appLanguages,
    load: "currentOnly",
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ["localStorage", "navigator", "htmlTag"],
      lookupLocalStorage: "language_preference",
      caches: ["localStorage"],
    },
  });

void i18n.changeLanguage(
  normalizeLanguage(i18n.resolvedLanguage ?? i18n.language),
);
document.documentElement.lang = normalizeLanguage(i18n.language);
i18n.on("languageChanged", (language: string) => {
  document.documentElement.lang = normalizeLanguage(language);
});

export { i18n, normalizeLanguage };
