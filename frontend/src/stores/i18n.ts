import { create } from "zustand";
import { persist } from "zustand/middleware";

import { i18n, normalizeLanguage, type AppLanguage } from "@/i18n";

interface I18nState {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
}

const initialLanguage = normalizeLanguage(
  i18n.resolvedLanguage ?? i18n.language,
);

export const useI18nStore = create<I18nState>()(
  persist(
    (set) => ({
      language: initialLanguage,
      setLanguage: (language) => {
        const normalized = normalizeLanguage(language);
        void i18n.changeLanguage(normalized);
        set({ language: normalized });
      },
    }),
    {
      name: "i18n-storage",
      onRehydrateStorage: () => (state) => {
        if (!state) {
          return;
        }
        const normalized = normalizeLanguage(state.language);
        void i18n.changeLanguage(normalized);
      },
    },
  ),
);
