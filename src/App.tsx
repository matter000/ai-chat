import { useEffect, useState } from 'react';
import { Menu, PanelLeftOpen } from 'lucide-react';
import { nanoid } from 'nanoid';
import { Sidebar } from '@/components/sidebar/Sidebar';
import { ChatView } from '@/components/chat/ChatView';
import { SettingsPanel } from '@/components/settings/SettingsPanel';
import { ParamsDrawer } from '@/components/chat/ParamsDrawer';
import { Onboarding } from '@/components/Onboarding';
import { CommandPalette } from '@/components/CommandPalette';
import { AuthScreen } from '@/components/AuthScreen';
import { GlobalSearch } from '@/components/GlobalSearch';
import { UserCenter } from '@/components/settings/UserCenter';
import { Button } from '@/components/ui/Button';
import { clsx } from 'clsx';
import { useUIStore, applyTheme } from '@/store/uiStore';
import { providerRepo, conversationRepo, userRepo } from '@/db';
import { useShortcuts } from '@/hooks/useShortcuts';
import { useLockStore } from '@/store/lockStore';
import { getAuthState, setAuthState, type UserProfile } from '@/store/userStore';
import { unlockWithPassword, isEncryptionEnabled, hasMasterPassword, isUnlocked } from '@/services/crypto';

export default function App() {
  const [activeId, setActiveId] = useState<string>('');
  const [paramsOpen, setParamsOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [userCenterOpen, setUserCenterOpen] = useState(false);
  const [highlightMessageId, setHighlightMessageId] = useState<string | undefined>(undefined);
  const [authNeeded, setAuthNeeded] = useState<boolean | null>(null);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);

  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const openSettings = useUIStore((s) => s.openSettings);
  const theme = useUIStore((s) => s.theme);
  const lockEnabled = useLockStore((s) => s.enabled);
  const lockUnlocked = useLockStore((s) => s.unlocked);
  const refreshLock = useLockStore((s) => s.refresh);

  // 启动时：检查是否需要 AuthScreen
  useEffect(() => {
    (async () => {
      refreshLock();
      const auth = getAuthState();
      // 已登录 + 无加密 或 加密已解锁 → 跳过
      if (auth.loggedIn && auth.userId && (!isEncryptionEnabled() || isUnlocked())) {
        const user = await userRepo.get(auth.userId);
        if (user) {
          setCurrentUser(user);
          setAuthNeeded(false);
          return;
        }
      }
      setAuthNeeded(true);
    })();
  }, []);

  useEffect(() => {
    if (authNeeded === false && isEncryptionEnabled() && !lockUnlocked) {
      setAuthNeeded(true);
    }
  }, [lockEnabled, lockUnlocked, authNeeded]);

  useEffect(() => {
    refreshLock();
  }, [refreshLock]);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    (async () => {
      const list = await providerRepo.list();
      if (list.length === 0) setOnboardingOpen(true);
    })();
  }, []);

  const handleAuthUnlocked = async (profile: UserProfile, plainPassword: string) => {
    setCurrentUser(profile);
    setAuthNeeded(false);
    if (isEncryptionEnabled() || hasMasterPassword()) {
      await unlockWithPassword(plainPassword);
    }
    refreshLock();
  };

  // 监听命令面板派发的事件
  useEffect(() => {
    const onOpenParams = () => setParamsOpen(true);
    const onFocusInput = () => {
      const el = document.querySelector<HTMLTextAreaElement>(
        'textarea[placeholder^="输入"], textarea[placeholder^="请先"]',
      );
      el?.focus();
    };
    const onFocusSidebarSearch = () => {
      const el = document.querySelector<HTMLInputElement>('input[placeholder="搜索会话"]');
      el?.focus();
      el?.select();
    };
    const onSelectLatest = async () => {
      const list = await conversationRepo.list();
      if (list.length) {
        list.sort((a, b) => b.updatedAt - a.updatedAt);
        setActiveId(list[0].id);
      }
    };
    const onOpenGlobalSearch = () => setSearchOpen(true);
    const onOpenUserCenter = () => setUserCenterOpen(true);
    window.addEventListener('app:open-params', onOpenParams);
    window.addEventListener('app:focus-input', onFocusInput);
    window.addEventListener('app:focus-sidebar-search', onFocusSidebarSearch);
    window.addEventListener('app:select-latest', onSelectLatest);
    window.addEventListener('app:open-global-search', onOpenGlobalSearch);
    window.addEventListener('app:open-user-center', onOpenUserCenter);
    return () => {
      window.removeEventListener('app:open-params', onOpenParams);
      window.removeEventListener('app:focus-input', onFocusInput);
      window.removeEventListener('app:focus-sidebar-search', onFocusSidebarSearch);
      window.removeEventListener('app:select-latest', onSelectLatest);
      window.removeEventListener('app:open-global-search', onOpenGlobalSearch);
      window.removeEventListener('app:open-user-center', onOpenUserCenter);
    };
  }, []);

  useShortcuts({
    'mod+shift+f': () => setSearchOpen(true),
    'mod+shift+o': () => {
      (async () => {
        const now = Date.now();
        await conversationRepo.create({
          id: nanoid(),
          title: '新会话',
          params: { temperature: 0.7 },
          pinned: false,
          createdAt: now,
          updatedAt: now,
        });
        const list = await conversationRepo.list();
        if (list.length) {
          list.sort((a, b) => b.updatedAt - a.updatedAt);
          setActiveId(list[0].id);
        }
      })();
    },
    'mod+,': () => openSettings(),
    'mod+/': () => setParamsOpen(true),
    'mod+shift+k': () => {
      const el = document.querySelector<HTMLInputElement>('input[placeholder="搜索会话"]');
      el?.focus();
      el?.select();
    },
    'mod+enter': () => {
      const el = document.querySelector<HTMLTextAreaElement>(
        'textarea[placeholder^="输入"], textarea[placeholder^="请先"]',
      );
      el?.focus();
    },
    escape: () => {
      setParamsOpen(false);
      setSearchOpen(false);
      useUIStore.getState().closeSettings();
    },
  });

  const handleSearchJump = (conversationId: string, messageId: string) => {
    setActiveId(conversationId);
    setHighlightMessageId(messageId);
    window.setTimeout(() => setHighlightMessageId(undefined), 2200);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setAuthNeeded(true);
  };

  // 加载中
  if (authNeeded === null) return null;

  return (
    <div className="flex h-full w-full overflow-hidden bg-white dark:bg-dark-bg">
      <div className="md:hidden absolute left-2 top-2 z-40">
        <Button size="icon" variant="ghost" onClick={toggleSidebar} aria-label="菜单">
          <Menu size={18} />
        </Button>
      </div>

      <div
        className={clsx(
          'md:relative absolute inset-y-0 left-0 z-30',
          'transition-transform duration-200 ease-out',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <Sidebar
          activeId={activeId}
          onSelect={(id) => {
            setActiveId(id);
            if (window.innerWidth < 768) toggleSidebar();
          }}
        />
      </div>

      {sidebarOpen && (
        <div
          onClick={toggleSidebar}
          className="md:hidden fixed inset-0 z-20 bg-black/30 backdrop-blur-[1px]"
        />
      )}

      {!sidebarOpen && (
        <button
          type="button"
          onClick={toggleSidebar}
          aria-label="展开侧栏"
          title="展开侧栏"
          className="hidden md:flex absolute left-2 top-2 z-20 h-8 w-8 items-center justify-center rounded-md bg-white dark:bg-dark-panel text-ink-500 dark:text-dark-muted border border-surface-border dark:border-dark-border shadow-sm hover:bg-ink-50 dark:hover:bg-dark-subtle"
        >
          <PanelLeftOpen size={16} />
        </button>
      )}

      <main className="flex min-w-0 flex-1 flex-col">
        <ChatView
          conversationId={activeId}
          onOpenSettings={() => setParamsOpen(true)}
          highlightMessageId={highlightMessageId}
        />
      </main>

      <SettingsPanel />
      <ParamsDrawer
        open={paramsOpen}
        onClose={() => setParamsOpen(false)}
        conversationId={activeId}
      />
      <Onboarding
        open={onboardingOpen}
        onClose={() => setOnboardingOpen(false)}
        onSaved={() => setOnboardingOpen(false)}
      />
      <CommandPalette />
      <GlobalSearch
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        activeConversationId={activeId}
        onJump={handleSearchJump}
      />
      {authNeeded && (
        <AuthScreen
          open={authNeeded}
          locked={(lockEnabled && !lockUnlocked) || !!currentUser}
          onUnlocked={handleAuthUnlocked}
        />
      )}
      <UserCenter
        open={userCenterOpen}
        onClose={() => setUserCenterOpen(false)}
        onLogout={handleLogout}
      />
    </div>
  );
}