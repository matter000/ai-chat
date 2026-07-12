import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { nanoid } from 'nanoid';
import { Lock, UserPlus, Mail, KeyRound, HelpCircle, ArrowLeft, Loader2, Smile } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { userRepo } from '@/db';
import { hashUserPassword, verifyUserPassword } from '@/services/crypto';
import type { UserProfile } from '@/store/userStore';
import { setAuthState, getAuthState } from '@/store/userStore';

type Mode = 'login' | 'register' | 'forgot' | 'locked';

interface Props {
  open: boolean;
  locked: boolean;
  onUnlocked: (profile: UserProfile, plainPassword: string) => void;
}

export function AuthScreen({ open, locked, onUnlocked }: Props) {
  const [mode, setMode] = useState<Mode>(locked ? 'locked' : 'login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [hint, setHint] = useState('');
  const [avatar, setAvatar] = useState('😊');
  const [error, setError] = useState<string | null>(null);
  const [hintShown, setHintShown] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // 如果已有用户（之前登录过），自动跳到登录页
  const existingUser = useLiveQuery(async () => {
    const list = await userRepo.list();
    return list.length > 0 ? list[0] : undefined;
  }, []);

  // 回复到 locked 状态（表示要登录）
  useEffect(() => {
    if (existingUser) {
      setMode('locked');
      setEmail(existingUser.email);
    }
  }, [existingUser?.id]);

  const avatars = ['😊', '🦊', '🐱', '🐶', '🐼', '🐨', '🦁', '🐸', '🐵', '🦄', '👾', '🤖', '👤', '👩‍💻', '🧑‍🎨'];

  const resetForm = () => {
    setError(null);
    setHintShown(null);
    setName('');
    setEmail('');
    setPassword('');
    setConfirmPw('');
    setHint('');
  };

  // ≡≡≡ 注册 ≡≡≡
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !email.trim() || !password) {
      setError('请填写所有必填字段');
      return;
    }
    if (password.length < 6) {
      setError('密码至少 6 位');
      return;
    }
    if (password !== confirmPw) {
      setError('两次输入的密码不一致');
      return;
    }
    if (!hint.trim()) {
      setError('请设置密码恢复提示（忘记密码时帮你回忆）');
      return;
    }
    setBusy(true);
    try {
      const existing = await userRepo.findByEmail(email.trim().toLowerCase());
      if (existing) {
        setError('该邮箱已注册，请直接登录');
        setBusy(false);
        return;
      }
      const hash = await hashUserPassword(password);
      const profile: UserProfile = {
        id: nanoid(),
        name: name.trim(),
        email: email.trim().toLowerCase(),
        avatarEmoji: avatar,
        passwordHash: hash,
        recoveryHint: hint.trim(),
        createdAt: Date.now(),
      };
      await userRepo.upsert(profile);
      setAuthState({ loggedIn: true, userId: profile.id });
      onUnlocked(profile, password);
    } catch (err: any) {
      setError(err?.message || '注册失败');
    } finally {
      setBusy(false);
    }
  };

  // ≡≡≡ 登录 ≡≡≡
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError('请输入邮箱和密码');
      return;
    }
    setBusy(true);
    try {
      const user = await userRepo.findByEmail(email.trim().toLowerCase());
      if (!user) {
        setError('用户不存在，请先注册');
        setBusy(false);
        return;
      }
      const ok = await verifyUserPassword(password, user.passwordHash);
      if (!ok) {
        setError('密码错误');
        setBusy(false);
        return;
      }
      setAuthState({ loggedIn: true, userId: user.id });
      onUnlocked(user, password);
    } catch (err: any) {
      setError(err?.message || '登录失败');
    } finally {
      setBusy(false);
    }
  };

  // ≡≡≡ 忘记密码 ≡≡≡
  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setHintShown(null);
    if (!email.trim()) {
      setError('请输入注册时使用的邮箱');
      return;
    }
    setBusy(true);
    try {
      const user = await userRepo.findByEmail(email.trim().toLowerCase());
      if (!user) {
        setError('该邮箱未注册');
        setBusy(false);
        return;
      }
      setHintShown(user.recoveryHint || '未设置密码提示');
      setError(null);
    } catch (err: any) {
      setError(err?.message || '查询失败');
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  const isLocked = mode === 'locked' || (existingUser && mode !== 'register');

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-white/98 dark:bg-dark-bg/98 backdrop-blur-md animate-fade-in">
      <form
        onSubmit={
          mode === 'register' ? handleRegister :
          mode === 'forgot' ? handleForgot :
          handleLogin
        }
        className="w-[380px] max-w-[94vw] rounded-2xl border border-surface-border dark:border-dark-border bg-white dark:bg-dark-panel shadow-lg p-8 animate-slide-up"
      >
        {/* 头像 / Logo */}
        <div className="flex flex-col items-center text-center mb-6">
          {mode === 'register' ? (
            <div className="flex flex-wrap justify-center gap-1.5 mb-3">
              {avatars.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setAvatar(a)}
                  className={`flex h-9 w-9 items-center justify-center rounded-lg text-lg transition-colors ${
                    avatar === a
                      ? 'bg-accent-soft dark:bg-accent/20 ring-2 ring-accent'
                      : 'hover:bg-ink-100 dark:hover:bg-dark-subtle'
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
          ) : (
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-accent to-blue-600 text-white mb-3 shadow-sm">
              {isLocked ? <Lock size={20} /> : <UserPlus size={20} />}
            </div>
          )}
          <h2 className="text-base font-semibold tracking-tight text-ink-900 dark:text-dark-ink">
            {mode === 'register' ? '创建账号' :
             mode === 'forgot' ? '找回密码' :
             isLocked ? `欢迎回来，${existingUser?.name || ''}` : '登录'}
          </h2>
          <p className="mt-1 text-[12px] text-ink-500 dark:text-dark-muted">
            {mode === 'register'
              ? '所有数据存储在你的浏览器本地'
              : mode === 'forgot'
              ? '输入注册邮箱查看密码提示'
              : '输入密码解锁本地数据'}
          </p>
        </div>

        {/* 表单 */}
        <div className="space-y-3">
          {mode === 'register' && (
            <label className="block text-[11px]">
              <div className="mb-1 font-medium text-ink-500 dark:text-dark-muted">昵称</div>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="你的昵称"
                autoFocus
              />
            </label>
          )}

          {!isLocked && (
            <label className="block text-[11px]">
              <div className="mb-1 font-medium text-ink-500 dark:text-dark-muted">
                <Mail size={11} className="inline mr-1" />
                邮箱
              </div>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoFocus={!isLocked}
                disabled={isLocked}
                autoComplete={isLocked ? 'username' : 'email'}
              />
            </label>
          )}

          {isLocked && existingUser && (
            <div className="rounded-md bg-accent-soft dark:bg-accent/10 px-3 py-2 text-[12px] text-ink-700 dark:text-dark-ink flex items-center gap-2">
              <span className="text-lg">{existingUser.avatarEmoji}</span>
              <span>{existingUser.email}</span>
            </div>
          )}

          {mode !== 'forgot' && (
            <label className="block text-[11px]">
              <div className="mb-1 font-medium text-ink-500 dark:text-dark-muted">
                <KeyRound size={11} className="inline mr-1" />
                密码
              </div>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="至少 6 位"
                autoFocus={isLocked}
                autoComplete={isLocked ? 'current-password' : 'new-password'}
              />
            </label>
          )}

          {mode === 'register' && (
            <>
              <label className="block text-[11px]">
                <div className="mb-1 font-medium text-ink-500 dark:text-dark-muted">确认密码</div>
                <Input
                  type="password"
                  value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)}
                  placeholder="再次输入密码"
                  autoComplete="new-password"
                />
              </label>
              <label className="block text-[11px]">
                <div className="mb-1 font-medium text-ink-500 dark:text-dark-muted">
                  <HelpCircle size={11} className="inline mr-1" />
                  密码恢复提示
                </div>
                <Input
                  value={hint}
                  onChange={(e) => setHint(e.target.value)}
                  placeholder="例如：我的第一只猫的名字"
                />
              </label>
            </>
          )}

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[11.5px] text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
              {error}
            </div>
          )}
          {hintShown && (
            <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-[11.5px] text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300">
              💡 密码提示：{hintShown}
            </div>
          )}

          <Button
            type="submit"
            variant="primary"
            disabled={busy}
            className="w-full mt-2"
            size="md"
          >
            {busy ? (
              <><Loader2 size={14} className="animate-spin" /> 处理中…</>
            ) : mode === 'register' ? (
              '注册'
            ) : mode === 'forgot' ? (
              '查看提示'
            ) : (
              '解锁'
            )}
          </Button>
        </div>

        {/* 底部切换 */}
        <div className="mt-5 flex flex-col items-center gap-2 text-[11.5px] text-ink-500 dark:text-dark-muted">
          {mode === 'login' ? (
            <>
              <button type="button" onClick={() => { resetForm(); setMode('register'); }} className="text-accent hover:underline">
                没有账号？注册
              </button>
              <button type="button" onClick={() => { resetForm(); setMode('forgot'); }} className="text-ink-400 dark:text-dark-muted hover:underline">
                忘记密码？
              </button>
            </>
          ) : mode === 'register' ? (
            <button type="button" onClick={() => { resetForm(); setMode('login'); }} className="inline-flex items-center gap-1 text-accent hover:underline">
              <ArrowLeft size={11} />
              已有账号？登录
            </button>
          ) : mode === 'forgot' ? (
            <button type="button" onClick={() => { resetForm(); setMode('login'); }} className="inline-flex items-center gap-1 text-accent hover:underline">
              <ArrowLeft size={11} />
              返回登录
            </button>
          ) : isLocked ? (
            <button type="button" onClick={() => { resetForm(); setMode('forgot'); }} className="text-ink-400 dark:text-dark-muted hover:underline">
              忘记密码？
            </button>
          ) : null}

          {mode === 'register' && (
            <div className="mt-1 text-[10.5px] text-ink-400 dark:text-dark-muted leading-relaxed text-center max-w-[260px]">
              你的密码只存在本地浏览器中，不会上传给任何服务器。请务必记住密码。
            </div>
          )}
        </div>
      </form>
    </div>
  );
}