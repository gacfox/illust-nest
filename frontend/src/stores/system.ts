import { create } from "zustand";
import type { SystemSettings } from "@/types/api";

interface SystemState {
  settings: SystemSettings | null;
  setSettings: (settings: SystemSettings) => void;
  updateSetting: <K extends keyof SystemSettings>(
    key: K,
    value: SystemSettings[K],
  ) => void;
}

export const useSystemStore = create<SystemState>((set) => ({
  settings: null,
  setSettings: (settings) => set({ settings }),
  updateSetting: (key, value) =>
    set((state) => ({
      settings: state.settings ? { ...state.settings, [key]: value } : null,
    })),
}));
