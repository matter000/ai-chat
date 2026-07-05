import { useEffect, useRef, useState, lazy, Suspense } from 'react';
import { Menu, GripVertical, ChevronsRight } from 'lucide-react';
import { nanoid } from 'nanoid';
import { Sidebar } from '@/components/sidebar/Sidebar';
import { ChatView } from '@/components/chat/ChatView';
import { ParamsDrawer } from '@/components/chat/ParamsDrawer';
import { AuthScreen } from '@/components/AuthScreen';
import { Button } from '@/components/ui/Button';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { clsx } from 'clsx';
import { useUIStore } from '@/store/uiStore';
import { applyTheme } from '@/store/uiStore';
import { providerRepo, conversationRepo, userRepo } from '@/db';
import { useShortcuts } from '@/hooks/useShortcuts';
import { useLockStore } from '@/store/lockStore';
import { getAuthState, setAuthState, type UserProfile } from '@/store/userStore';
import { unlockWithPassword, isEncryptionEnabled, hasMasterPassword, isUnlocked } from '@/services/crypto';

// 懒加载重组件：首屏不加载，按需拆分
const SettingsPanel = lazy(() => import('@/components/settings/SettingsPanel').then(m => ({ default: m.SettingsPanel })));
const CommandPalette = lazy(() => import('@/components/CommandPalette').then(m => ({ default: m.CommandPalette })));
const Onboarding = lazy(() => import('@/components/Onboarding').then(m => ({ default: m.Onboarding })));
const GlobalSearch = lazy(() => import('@/components/GlobalSearch').then(m => ({ default: m.GlobalSearch })));
const UserCenter = lazy(() => import('@/components/settings/UserCenter').then(m => ({ default: m.UserCenter })));

export default function App() {
  const [activeId, setActiveId] = useState<string>('');
  const [paramsOpen, setParamsOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [userCenterOpen, setUserCenterOpen] = useState(false);
  const [highlightMessageId, setHighlightMessageId] = useState<string | undefined>(undefined);
  const [authNeeded, setAuthNeeded] = useState<boolean | null>(null);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);

  const sidebarState = useUIStore((s) => s.sidebarState);
  const sidebarHover = useUIStore((s) => s.sidebarHover);
  const setSidebarHover = useUIStore((s) => s.setSidebarHover);
  const collapseSidebar = useUIStore((s) => s.collapseSidebar);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const expandSidebar = useUIStore((s) => s.expandSidebar);
  // 侧栏的最终显示状态：展开 OR 收起但 hover
  const sidebarShown = sidebarState === 'expanded' || (sidebarState === 'collapsed' && sidebarHover);
  const openSettings = useUIStore((s) => s.openSettings);
  const theme = useUIStore((s) => s.theme);
  const lockEnabled = useLockStore((s) => s.enabled);
  const lockUnlocked = useLockStore((s) => s.unlocked);
  const refreshLock = useLockStore((s) => s.refresh);

  // 标记刚完成登录，跳过 useEffect 对 authNeeded 的覆盖（修复竞态条件）
  const skipLockCheckRef = useRef(false);

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
          // 自动确保至少有一个会话：没有就建一个空白会话
          const list = await conversationRepo.list();
          if (list.length === 0) {
            const now = Date.now();
            await conversationRepo.create({
              id: nanoid(),
              title: '新会话',
              params: { temperature: 0.7 },
              pinned: false,
              createdAt: now,
              updatedAt: now,
            });
          }
          return;
        }
      }
      setAuthNeeded(true);
    })();
  }, []);

  useEffect(() => {
    if (skipLockCheckRef.current) {
      skipLockCheckRef.current = false;
      return;
    }
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

    // 尝试用登录密码解锁加密（登录密码与主密码相同的情况下会成功）
    if (isEncryptionEnabled() || hasMasterPassword()) {
      try {
        await unlockWithPassword(plainPassword);
      } catch {
        // 解锁失败不阻塞登录，用户可在设置 > 加密面板中手动解锁
      }
    }

    // 先刷新 lock 状态，再关闭 AuthScreen，避免 useEffect 覆盖
    refreshLock();
    skipLockCheckRef.current = true;
    setAuthNeeded(false);
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

  // 加载中：展示品牌骨架屏代替白屏
  if (authNeeded === null) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-white dark:bg-dark-bg">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-accent to-blue-500 grid place-items-center text-white text-sm font-bold shadow-lg animate-pulse">
            AI
          </div>
          <span className="text-xs text-ink-400 dark:text-dark-muted">加载中…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full overflow-hidden bg-white dark:bg-dark-bg">
      <div className="md:hidden absolute left-2 top-2 z-40">
        <Button size="icon" variant="ghost" onClick={toggleSidebar} aria-label="菜单">
          <Menu size={18} />
        </Button>
      </div>

      <div
        className={clsx(
          'md:relative absolute inset-y-0 left-0 z-30 flex',
          'transition-all duration-200 ease-out',
        )}
        style={{ width: sidebarShown ? (window.innerWidth < 768 ? '100%' : '256px') : '0px' }}
        onMouseEnter={() => setSidebarHover(true)}
        onMouseLeave={() => setSidebarHover(false)}
      >
        <div
          className={clsx(
            'h-full transition-opacity duration-200',
            sidebarShown ? 'opacity-100 w-full' : 'opacity-0 w-0 overflow-hidden pointer-events-none',
          )}
        >
          <Sidebar
            activeId={activeId}
            onSelect={(id) => {
              setActiveId(id);
              if (window.innerWidth < 768) collapseSidebar();
            }}
          />
        </div>
      </div>

      {/* 收起时的拉手条 */}
      {sidebarState === 'collapsed' && (
        <div
          onMouseEnter={() => setSidebarHover(true)}
          onMouseLeave={() => setSidebarHover(false)}
          className="hidden md:flex absolute left-0 top-0 bottom-0 w-3 z-20 items-center justify-center cursor-pointer hover:bg-accent/10 transition-colors group"
          onClick={expandSidebar}
          title="点击或 hover 展开侧栏"
        >
          <div className="flex flex-col items-center gap-2 px-1 py-3 rounded-r-md group-hover:bg-accent/20">
            <ChevronsRight size={12} className="text-ink-400 group-hover:text-accent" />
            <GripVertical size={14} className="text-ink-300 group-hover:text-accent" />
            <ChevronsRight size={12} className="text-ink-400 group-hover:text-accent" />
          </div>
        </div>
      )}

      {sidebarShown && (
        <div
          onClick={toggleSidebar}
          className="md:hidden fixed inset-0 z-20 bg-black/30 backdrop-blur-[1px]"
        />
      )}



      <main className="flex min-w-0 flex-1 flex-col">
        <ErrorBoundary>
          <ChatView
            conversationId={activeId}
            onOpenSettings={() => setParamsOpen(true)}
            highlightMessageId={highlightMessageId}
          />
        </ErrorBoundary>
      </main>

      <Suspense>
        <SettingsPanel />
      </Suspense>
      <ParamsDrawer
        open={paramsOpen}
        onClose={() => setParamsOpen(false)}
        conversationId={activeId}
      />
      <Suspense>
        <Onboarding
          open={onboardingOpen}
          onClose={() => setOnboardingOpen(false)}
          onSaved={() => setOnboardingOpen(false)}
        />
      </Suspense>
      <Suspense>
        <CommandPalette />
      </Suspense>
      <Suspense>
        <GlobalSearch
          open={searchOpen}
          onClose={() => setSearchOpen(false)}
          activeConversationId={activeId}
          onJump={handleSearchJump}
        />
      </Suspense>
      {authNeeded && (
        <AuthScreen
          open={authNeeded}
          locked={(lockEnabled && !lockUnlocked) || !!currentUser}
          onUnlocked={handleAuthUnlocked}
        />
      )}
      <Suspense>
        <UserCenter
          open={userCenterOpen}
          onClose={() => setUserCenterOpen(false)}
          onLogout={handleLogout}
        />
      </Suspense>
      <ConfirmDialog />
    </div>
  );
}