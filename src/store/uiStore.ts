import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type SidebarState = 'expanded' | 'collapsed';

interface UIState {
  sidebarState: SidebarState;
  settingsOpen: boolean;
  theme: 'light' | 'dark' | 'system';
  /** 鼠标 hover 屏幕左边缘时短暂展开（不是持久状态，只是临时显示） */
  sidebarHover: boolean;
  toggleSidebar: () => void;
  expandSidebar: () => void;
  collapseSidebar: () => void;
  setSidebarHover: (v: boolean) => void;
  openSettings: () => void;
  closeSettings: () => void;
  setTheme: (t: 'light' | 'dark' | 'system') => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarState: 'expanded',
      settingsOpen: false,
      theme: 'system',
      sidebarHover: false,
      toggleSidebar: () =>
        set((s) => ({
          sidebarState: s.sidebarState === 'expanded' ? 'collapsed' : 'expanded',
        })),
      expandSidebar: () => set({ sidebarState: 'expanded' }),
      collapseSidebar: () => set({ sidebarState: 'collapsed' }),
      setSidebarHover: (v) => set({ sidebarHover: v }),
      openSettings: () => set({ settingsOpen: true }),
      closeSettings: () => set({ settingsOpen: false }),
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'ai-chat-ui',
      partialize: (s) => ({ theme: s.theme, sidebarState: s.sidebarState }),
    },
  ),
);

// 主题同步函数：把 theme 状态应用到 <html> 的 dark class
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