import { useState } from 'react';
import { Lock, ShieldCheck, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useLockStore } from '@/store/lockStore';

export function LockScreen() {
  const unlock = useLockStore((s) => s.unlock);
  const [pwd, setPwd] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!pwd) return;
    setBusy(true);
    setError(null);
    try {
      // PBKDF2 100k 迭代需要点时间，给点提示
      const ok = await unlock(pwd);
      if (!ok) {
        setError('主密码错误');
        setPwd('');
      }
    } catch (e: any) {
      setError(e?.message || '解锁失败');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/95 dark:bg-dark-bg/95 backdrop-blur-md animate-fade-in">
      <form
        onSubmit={submit}
        className="w-[360px] max-w-[92vw] rounded-2xl border border-surface-border dark:border-dark-border bg-white dark:bg-dark-panel shadow-lg p-8 animate-slide-up"
      >
        <div className="flex flex-col items-center text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft dark:bg-accent/15 text-accent-hover dark:text-blue-300 mb-3">
            <Lock size={20} />
          </div>
          <h2 className="text-base font-semibold tracking-tight text-ink-900 dark:text-dark-ink">
            已加密 · 请解锁
          </h2>
          <p className="mt-1 text-[12px] text-ink-500 dark:text-dark-muted">
            你的 API Key 已使用主密码加密存储，输入密码后才能使用。
          </p>
        </div>

        <div className="mt-6">
          <Input
            type="password"
            autoFocus
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
            placeholder="主密码"
            disabled={busy}
            className="text-center"
          />
        </div>

        {error && (
          <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
            {error}
          </div>
        )}

        <Button
          type="submit"
          variant="primary"
          disabled={busy || !pwd}
          className="mt-4 w-full"
          size="md"
        >
          {busy ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              解密中…
            </>
          ) : (
            <>
              <ShieldCheck size={14} />
              解锁
            </>
          )}
        </Button>

        <p className="mt-5 text-center text-[10.5px] text-ink-400 dark:text-dark-muted leading-relaxed">
          主密码<b>不会</b>保存到任何服务器，遗忘后将无法恢复 Key，请妥善保管。
        </p>
      </form>
    </div>
  );
}