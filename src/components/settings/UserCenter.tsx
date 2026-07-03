import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Smile, Mail, KeyRound, HelpCircle, LogOut, Trash2, Save, Loader2,
} from 'lucide-react';
import { userRepo } from '@/db';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { hashUserPassword, verifyUserPassword } from '@/services/crypto';
import { getAuthState, clearAuthState, type UserProfile } from '@/store/userStore';
import { conversationRepo, providerRepo } from '@/db';
import { clsx } from 'clsx';

interface Props {
  open: boolean;
  onClose: () => void;
  onLogout: () => void;
}

const AVATARS = ['😊', '🦊', '🐱', '🐶', '🐼', '🐨', '🦁', '🐸', '🐵', '🦄', '👾', '🤖', '👤', '👩‍💻', '🧑‍🎨'];

export function UserCenter({ open, onClose, onLogout }: Props) {
  const auth = getAuthState();
  const user = useLiveQuery(
    () => (auth.userId ? userRepo.get(auth.userId) : Promise.resolve(undefined)),
    [auth.userId],
  );

  const [tab, setTab] = useState<'profile' | 'password'>('profile');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  // 编辑资料
  const [editName, setEditName] = useState('');
  const [editAvatar, setEditAvatar] = useState('😊');
  const [editing, setEditing] = useState(false);

  // 改密码
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');

  // 初始化编辑值
  const startEdit = () => {
    if (!user) return;
    setEditName(user.name);
    setEditAvatar(user.avatarEmoji);
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setError(null);
  };

  const saveProfile = async () => {
    if (!user || !editName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await userRepo.upsert({ ...user, name: editName.trim(), avatarEmoji: editAvatar });
      setEditing(false);
    } catch (e: any) {
      setError(e?.message || '保存失败');
    } finally {
      setBusy(false);
    }
  };

  const changePw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setError(null);
    setHint(null);
    if (!oldPw || !newPw || !confirmPw) {
      setError('请填写所有字段');
      return;
    }
    if (newPw.length < 6) {
      setError('新密码至少 6 位');
      return;
    }
    if (newPw !== confirmPw) {
      setError('两次新密码不一致');
      return;
    }
    setBusy(true);
    try {
      const ok = await verifyUserPassword(oldPw, user.passwordHash);
      if (!ok) {
        setError('当前密码错误');
        setBusy(false);
        return;
      }
      const hash = await hashUserPassword(newPw);
      await userRepo.upsert({ ...user, passwordHash: hash });
      setOldPw('');
      setNewPw('');
      setConfirmPw('');
      setHint('密码已更新');
    } catch (e: any) {
      setError(e?.message || '修改失败');
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = () => {
    if (!confirm('确定要退出登录吗？')) return;
    clearAuthState();
    onLogout();
    onClose();
    location.reload();
  };

  const [busyDelete, setBusyDelete] = useState(false);

  const handleDeleteAccount = () => {
    if (!user || busyDelete) return;
    if (
      !confirm(
        '⚠️ 这将永久删除你的账号、所有会话、消息和 Provider 配置。\n\n此操作不可撤销。确定要删除账号吗？',
      )
    )
      return;
    setBusyDelete(true);
    (async () => {
      try {
        await conversationRepo.clear();
        const list = await providerRepo.list();
        for (const p of list) await providerRepo.delete(p.id);
        await userRepo.delete(user.id);
        clearAuthState();
        location.reload();
      } catch (e: any) {
        alert(`删除失败：${e?.message || e}`);
        setBusyDelete(false);
      }
    })();
  };

  if (!user) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title="用户中心"
    >
      {/* 头像 + 基本信息 */}
      <div className="flex flex-col items-center mb-6">
        {editing ? (
          <div className="flex flex-wrap justify-center gap-1.5 mb-3">
            {AVATARS.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setEditAvatar(a)}
                className={`flex h-9 w-9 items-center justify-center rounded-lg text-lg transition-colors ${
                  editAvatar === a
                    ? 'bg-accent-soft dark:bg-accent/20 ring-1 ring-accent'
                    : 'hover:bg-ink-100 dark:hover:bg-dark-subtle'
                }`}
              >
                {a}
              </button>
            ))}
          </div>
        ) : (
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft dark:bg-accent/15 text-2xl mb-2">
            {user.avatarEmoji}
          </div>
        )}
        {editing ? (
          <div className="flex items-center gap-2 w-full max-w-[200px]">
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="昵称"
              className="text-center text-sm"
            />
          </div>
        ) : (
          <h3 className="text-base font-semibold text-ink-900 dark:text-dark-ink">{user.name}</h3>
        )}
        <div className="mt-1 flex items-center gap-1 text-[12px] text-ink-500 dark:text-dark-muted">
          <Mail size={11} />
          {user.email}
        </div>
      </div>

      {/* Tab 导航 */}
      <div className="flex items-center border-b border-surface-border dark:border-dark-border mb-4">
        <button
          onClick={() => setTab('profile')}
          className={clsx(
            'px-3 py-2 text-[12.5px] font-medium border-b-2 transition-colors -mb-px',
            tab === 'profile'
              ? 'border-accent text-accent-hover dark:text-blue-300'
              : 'border-transparent text-ink-500 dark:text-dark-muted hover:text-ink-700',
          )}
        >
          个人资料
        </button>
        <button
          onClick={() => setTab('password')}
          className={clsx(
            'px-3 py-2 text-[12.5px] font-medium border-b-2 transition-colors -mb-px',
            tab === 'password'
              ? 'border-accent text-accent-hover dark:text-blue-300'
              : 'border-transparent text-ink-500 dark:text-dark-muted hover:text-ink-700',
          )}
        >
          修改密码
        </button>
      </div>

      {/* Tab 内容 */}
      {tab === 'profile' && (
        <div className="space-y-4">
          {!editing ? (
            <div className="space-y-3">
              <div className="rounded-lg border border-surface-border dark:border-dark-border p-3 text-[12.5px]">
                <div className="flex items-center gap-2 text-ink-500 dark:text-dark-muted mb-1">
                  <HelpCircle size={12} />
                  密码恢复提示
                </div>
                <div className="text-ink-900 dark:text-dark-ink">
                  {user.recoveryHint || '未设置'}
                </div>
              </div>

              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={startEdit} className="flex-1">
                  <Smile size={12} />
                  编辑资料
                </Button>
                <Button size="sm" variant="outline" onClick={handleLogout} className="flex-1">
                  <LogOut size={12} />
                  退出登录
                </Button>
              </div>
              <Button size="sm" variant="danger" onClick={handleDeleteAccount} className="w-full" disabled={busyDelete}>
                <Trash2 size={12} />
                删除账号
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {error && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[11.5px] text-red-700">
                  {error}
                </div>
              )}
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={cancelEdit}>
                  取消
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={saveProfile}
                  disabled={busy}
                  className="flex-1"
                >
                  {busy ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                  保存
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'password' && (
        <form onSubmit={changePw} className="space-y-3">
          <label className="block text-[11px]">
            <div className="mb-1 font-medium text-ink-500 dark:text-dark-muted">
              <KeyRound size={11} className="inline mr-1" />
              当前密码
            </div>
            <Input
              type="password"
              value={oldPw}
              onChange={(e) => setOldPw(e.target.value)}
              placeholder="输入当前密码"
              autoComplete="current-password"
            />
          </label>
          <label className="block text-[11px]">
            <div className="mb-1 font-medium text-ink-500 dark:text-dark-muted">新密码</div>
            <Input
              type="password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              placeholder="至少 6 位"
              autoComplete="new-password"
            />
          </label>
          <label className="block text-[11px]">
            <div className="mb-1 font-medium text-ink-500 dark:text-dark-muted">确认新密码</div>
            <Input
              type="password"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              placeholder="再次输入"
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

          <Button type="submit" variant="primary" disabled={busy} className="w-full" size="md">
            {busy ? <Loader2 size={12} className="animate-spin" /> : null}
            更新密码
          </Button>
        </form>
      )}
    </Modal>
  );
}