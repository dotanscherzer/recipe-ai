import { create } from 'zustand';

interface AppState {
  locale: 'he' | 'en';
  sidebarOpen: boolean;
  setLocale: (locale: 'he' | 'en') => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  locale: 'he',
  sidebarOpen: false,
  setLocale: (locale) => {
    document.documentElement.dir = locale === 'he' ? 'rtl' : 'ltr';
    document.documentElement.lang = locale;
    set({ locale });
  },
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
}));
