import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UIState {
  sidebarOpen: boolean;
  settingsOpen: boolean;
  theme: 'light' | 'dark' | 'system';
  toggleSidebar: () => void;
  openSettings: () => void;
  closeSettings: () => void;
  setTheme: (t: 'light' | 'dark' | 'system') => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      settingsOpen: false,
      theme: 'system',
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      openSettings: () => set({ settingsOpen: true }),
      closeSettings: () => set({ settingsOpen: false }),
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'ai-chat-ui',
      partialize: (s) => ({ theme: s.theme, sidebarOpen: s.sidebarOpen }),
    },
  ),
);

// 把 theme 同步到 <html> 的 class
export function applyTheme(theme: 'light' | 'dark' | 'system') {
  const root = document.documentElement;
  const mql = window.matchMedia('(prefers-color-scheme: dark)');
  const apply = () => {
    const isDark = theme === 'dark' || (theme === 'system' && mql.matches);
    root.classList.toggle('dark', isDark);
  };
  apply();
  mql.addEventListener('change', apply);
}