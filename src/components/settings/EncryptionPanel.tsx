import { useState } from 'react';
import { ShieldCheck, Lock, KeyRound, Trash2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useLockStore } from '@/store/lockStore';
import { providerRepo } from '@/db';
import { useUIStore } from '@/store/uiStore';
import { hasMasterPassword } from '@/services/crypto';
import { useLiveQuery } from 'dexie-react-hooks';

export function EncryptionPanel() {
  const enabled = useLockStore((s) => s.enabled);
  const unlocked = useLockStore((s) => s.unlocked);
  const setMasterPwd = useLockStore((s) => s.setPassword);
  const remove = useLockStore((s) => s.remove);
  const unlock = useLockStore((s) => s.unlock);
  const refresh = useLockStore((s) => s.refresh);

  const [pwd, setPwd] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  const providerCount = useLiveQuery(() => providerRepo.list().then((l) => l.length), []);

  const submitSet = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setHint(null);
    if (pwd.length < 6) {
      setError('主密码至少 6 位');
      return;
    }
    if (pwd !== confirm) {
      setError('两次输入不一致');
      return;
    }
    setBusy(true);
    try {
      await setMasterPwd(pwd);
      const migrated = await providerRepo.encryptAllPlaintext();
      setHint(`已设置主密码，已加密 ${migrated} 个 Provider 的 Key`);
      setPwd('');
      setConfirm('');
      refresh();
    } catch (e: any) {
      setError(e?.message || '设置失败');
    } finally {
      setBusy(false);
    }
  };

  const submitUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const ok = await unlock(pwd);
      if (!ok) {
        setError('主密码错误');
        setPwd('');
      } else {
        setHint('已解锁');
        setPwd('');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = () => {
    if (
      !window.confirm(
        '确定要关闭加密吗？\n关闭后所有 Key 会重新以明文存储（直到下次再设主密码并迁移）。\n你的会话内容不受影响。',
      )
    )
      return;
    remove();
    setHint('已关闭加密，所有 Key 已变回明文存储');
    refresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ShieldCheck
          size={14}
          className={
            enabled
              ? 'text-green-600 dark:text-green-400'
              : 'text-ink-500 dark:text-dark-muted'
          }
        />
        <h4 className="text-[13px] font-semibold text-ink-900 dark:text-dark-ink">API Key 加密</h4>
        <span
          className={
            'ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] ' +
            (enabled
              ? 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400'
              : 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400')
          }
        >
          {enabled ? '已启用' : '未启用（明文存储）'}
        </span>
      </div>

      {!enabled ? (
        // ── 未启用：设置主密码 ───────────────────────────────
        <form
          onSubmit={submitSet}
          className="rounded-lg border border-surface-border dark:border-dark-border p-4 space-y-3 bg-surface-alt dark:bg-dark-subtle/40"
        >
          <div className="flex items-start gap-2.5 rounded-md bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 px-3 py-2.5">
            <AlertTriangle
              size={14}
              className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400"
            />
            <div className="text-[11.5px] text-amber-800 dark:text-amber-200 leading-relaxed">
              当前 {providerCount ?? 0} 个 Provider 的 API Key 以<b>明文</b>存在浏览器本地。
              设置主密码后会立即用 AES-GCM 加密所有 Key。
            </div>
          </div>

          <label className="block text-[11px]">
            <div className="mb-1 font-medium text-ink-500 dark:text-dark-muted">
              主密码（至少 6 位）
            </div>
            <Input
              type="password"
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              placeholder="••••••"
              autoComplete="new-password"
            />
          </label>
          <label className="block text-[11px]">
            <div className="mb-1 font-medium text-ink-500 dark:text-dark-muted">确认主密码</div>
            <Input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••"
              autoComplete="new-password"
            />
          </label>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[11.5px] text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
              {error}
            </div>
          )}
          {hint && (
            <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-[11.5px] text-green-700 dark:border-green-500/30 dark:bg-green-500/10 dark:text-green-300">
              {hint}
            </div>
          )}

          <Button type="submit" variant="primary" disabled={busy || !pwd} className="w-full" size="md">
            <KeyRound size={13} />
            {busy ? '加密中…' : '设置主密码并加密所有 Key'}
          </Button>

          <p className="text-[10.5px] text-ink-400 dark:text-dark-muted leading-relaxed">
            <b>请务必牢记主密码</b>，它只存在你的浏览器中，遗忘后无法恢复 Key，会需要你重新输入。
          </p>
        </form>
      ) : (
        // ── 已启用：状态 + 解锁 / 重设 / 关闭 ────────────────
        <div className="rounded-lg border border-surface-border dark:border-dark-border p-4 space-y-3 bg-surface-alt dark:bg-dark-subtle/40">
          {!unlocked ? (
            <form onSubmit={submitUnlock} className="space-y-2">
              <div className="text-[12px] text-ink-700 dark:text-dark-ink">
                <Lock size={12} className="inline -mt-0.5 mr-1" />
                当前已加密但未解锁，请输入主密码。
              </div>
              <Input
                type="password"
                autoFocus
                value={pwd}
                onChange={(e) => setPwd(e.target.value)}
                placeholder="主密码"
              />
              {error && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[11.5px] text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
                  {error}
                </div>
              )}
              <Button type="submit" variant="primary" disabled={busy || !pwd} className="w-full">
                解锁
              </Button>
            </form>
          ) : (
            <div className="flex items-center gap-2 text-[12px] text-ink-700 dark:text-dark-ink">
              <ShieldCheck size={14} className="text-green-600 dark:text-green-400" />
              已解锁，Key 正在受 AES-GCM 256 加密保护。
            </div>
          )}
          {hint && (
            <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-[11.5px] text-green-700 dark:border-green-500/30 dark:bg-green-500/10 dark:text-green-300">
              {hint}
            </div>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            {unlocked && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  useLockStore.getState().lockNow();
                  refresh();
                  setHint('已锁定，下次需要输入主密码');
                }}
              >
                <Lock size={12} />
                立即锁定
              </Button>
            )}
            <Button size="sm" variant="danger" onClick={handleRemove}>
              <Trash2 size={12} />
              关闭加密（明文存储）
            </Button>
          </div>
          <p className="text-[10.5px] text-ink-400 dark:text-dark-muted leading-relaxed">
            加密算法：AES-GCM 256，密钥派生：PBKDF2-SHA256 (100,000 轮)。
            <br />
            关闭加密会清除盐和验证值，所有 Key 恢复为明文。
          </p>
        </div>
      )}
    </div>
  );
}