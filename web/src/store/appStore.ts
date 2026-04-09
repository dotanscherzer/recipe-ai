import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { setLanguage } from '../i18n';

interface AppState {
  locale: 'he' | 'en';
  sidebarOpen: boolean;
  setLocale: (locale: 'he' | 'en') => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      locale: 'he',
      sidebarOpen: false,
      setLocale: (locale) => {
        set({ locale });
        setLanguage(locale);
      },
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
    }),
    {
      name: 'recipe-ai-app',
      partialize: (state) => ({ locale: state.locale }),
      onRehydrateStorage: () => (state) => {
        if (state && (state.locale === 'he' || state.locale === 'en')) {
          setLanguage(state.locale);
        }
      },
    }
  )
);
