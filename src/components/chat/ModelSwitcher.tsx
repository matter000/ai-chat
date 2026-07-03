import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Check, Cpu } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { conversationRepo, providerRepo } from '@/db';
import { clsx } from 'clsx';
import { Button } from '@/components/ui/Button';
import { useLockStore } from '@/store/lockStore';

interface Props {
  conversationId?: string;
  onOpenParams: () => void;
}

/**
 * 主区顶部的"模型快速切换"组件。
 * - 极简胶囊按钮：Provider · 模型
 * - 点击展开：上方选 Provider，下方选模型（实时联动）
 */
export function ModelSwitcher({ conversationId, onOpenParams }: Props) {
  const conv = useLiveQuery(
    () => (conversationId ? conversationRepo.get(conversationId) : Promise.resolve(undefined)),
    [conversationId],
  );
  const providers = useLiveQuery(() => providerRepo.list(), []);
  // 解锁状态变化时强制重读
  const lockUnlocked = useLockStore((s) => s.unlocked);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    setTick((t) => t + 1);
  }, [lockUnlocked]);
  const providersReloaded = useLiveQuery(
    async () => {
      void tick;
      return providerRepo.list();
    },
    [tick],
  );
  const effectiveProviders = providersReloaded ?? providers;

  const [open, setOpen] = useState(false);
  const [draftProviderId, setDraftProviderId] = useState('');
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (open) setDraftProviderId(conv?.providerId || '');
  }, [open, conv?.providerId]);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const activeProvider = useMemo(
    () => effectiveProviders?.find((p) => p.id === conv?.providerId),
    [effectiveProviders, conv?.providerId],
  );
  const draftProvider = useMemo(
    () => effectiveProviders?.find((p) => p.id === draftProviderId),
    [effectiveProviders, draftProviderId],
  );

  const currentLabel = !activeProvider
    ? '选择模型'
    : !conv?.model
    ? `${activeProvider.name} · 选择模型`
    : `${activeProvider.name} · ${conv.model}`;

  const chooseModel = async (modelName: string) => {
    if (!conv) return;
    await conversationRepo.update(conv.id, {
      providerId: draftProviderId || conv.providerId,
      model: modelName,
    });
    setOpen(false);
  };

  const chooseProvider = async (id: string) => {
    setDraftProviderId(id);
    const p = effectiveProviders?.find((x) => x.id === id);
    if (p && p.models.length > 0 && conv) {
      const stillValid = p.models.includes(conv.model || '');
      if (!stillValid) {
        await conversationRepo.update(conv.id, { providerId: id, model: p.models[0] });
        setOpen(false);
        return;
      }
    }
  };

  return (
    <div className="relative" ref={rootRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={!conv || !effectiveProviders?.length}
        className={clsx(
          'inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md text-xs font-medium',
          'text-ink-700 dark:text-dark-ink',
          'hover:bg-ink-100 dark:hover:bg-dark-subtle',
          'transition-colors duration-fast ease-out',
          'disabled:opacity-40 disabled:cursor-not-allowed',
          open && 'bg-ink-100 dark:bg-dark-subtle',
        )}
        title="点击切换 Provider / 模型"
      >
        <Cpu size={13} className="opacity-60" />
        <span className="truncate max-w-[220px]">{currentLabel}</span>
        <ChevronDown
          size={12}
          className={clsx('opacity-60 transition-transform duration-fast', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div
          className={clsx(
            'absolute right-0 top-full z-30 mt-1.5 w-[320px]',
            'rounded-xl border border-surface-border dark:border-dark-border',
            'bg-white dark:bg-dark-panel shadow-md',
            'animate-fade-in overflow-hidden',
          )}
        >
          {/* Provider 列表 */}
          <div className="p-2 border-b border-surface-border dark:border-dark-border">
            <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-ink-400 dark:text-dark-muted">
              Provider
            </div>
            {effectiveProviders?.length === 0 ? (
              <div className="px-2 py-3 text-xs text-ink-500 dark:text-dark-muted">
                还没有 Provider，
                <button onClick={onOpenParams} className="text-accent hover:underline">
                  去设置
                </button>
              </div>
            ) : (
              <div className="max-h-44 overflow-y-auto">
                {effectiveProviders?.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => chooseProvider(p.id)}
                    className={clsx(
                      'flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs transition-colors',
                      draftProviderId === p.id
                        ? 'bg-accent-soft dark:bg-accent/15 text-accent-hover dark:text-blue-300'
                        : 'hover:bg-ink-50 dark:hover:bg-dark-subtle',
                    )}
                  >
                    <span className="truncate font-medium">{p.name}</span>
                    <span className="ml-2 shrink-0 text-[10px] text-ink-400 dark:text-dark-muted">
                      {p.models.length} 模型
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 模型列表 */}
          <div className="p-2">
            <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-ink-400 dark:text-dark-muted">
              模型{draftProvider ? ` · ${draftProvider.name}` : ''}
            </div>
            {!draftProvider ? (
              <div className="px-2 py-3 text-xs text-ink-500 dark:text-dark-muted">
                先在上方选一个 Provider
              </div>
            ) : draftProvider.models.length === 0 ? (
              <div className="px-2 py-3 text-center text-xs text-ink-500 dark:text-dark-muted">
                <p className="mb-2">该 Provider 还没有配置模型</p>
                <button
                  onClick={onOpenParams}
                  className="inline-flex items-center gap-1 rounded-md bg-accent-soft dark:bg-accent/15 px-2.5 py-1 text-[11px] text-accent-hover dark:text-blue-300 hover:brightness-95 transition-colors"
                >
                  去设置添加模型
                </button>
              </div>
            ) : (
              <div className="max-h-56 overflow-y-auto">
                {draftProvider.models.map((m) => (
                  <button
                    key={m}
                    onClick={() => chooseModel(m)}
                    className={clsx(
                      'flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs transition-colors',
                      conv?.model === m && conv?.providerId === draftProvider.id
                        ? 'bg-accent-soft dark:bg-accent/15 text-accent-hover dark:text-blue-300'
                        : 'hover:bg-ink-50 dark:hover:bg-dark-subtle font-mono',
                    )}
                  >
                    <span className="truncate">{m}</span>
                    {conv?.model === m && conv?.providerId === draftProvider.id && (
                      <Check size={12} className="shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="px-3 h-9 border-t border-surface-border dark:border-dark-border flex items-center justify-end bg-surface-alt/50 dark:bg-dark-subtle/30">
            <Button size="xs" variant="ghost" onClick={() => setOpen(false)}>
              关闭
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}