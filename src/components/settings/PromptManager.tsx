import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Sparkles, Plus, Trash2, Save, Pencil, X, ToggleLeft, ToggleRight } from 'lucide-react';
import { promptRepo } from '@/db';
import type { PromptTemplate } from '@/types';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { nanoid } from 'nanoid';
import { clsx } from 'clsx';
import { toast } from '@/store/toastStore';

const CATEGORIES: PromptTemplate['category'][] = ['通用', '写作', '编程', '翻译', '角色', '自定义'];

export function PromptManager() {
  const list = useLiveQuery(async () => {
    const all = await promptRepo.list();
    return all.sort((a, b) => {
      if (a.builtin !== b.builtin) return a.builtin ? -1 : 1;
      return a.command.localeCompare(b.command);
    });
  }, []);

  const [editing, setEditing] = useState<PromptTemplate | null>(null);
  const [creating, setCreating] = useState(false);

  const createNew = () => {
    setCreating(true);
    setEditing({
      id: nanoid(),
      command: '',
      title: '',
      description: '',
      category: '自定义',
      content: '',
      builtin: false,
      enabled: true,
      createdAt: Date.now(),
    });
  };

  const edit = (t: PromptTemplate) => {
    setCreating(false);
    setEditing({ ...t });
  };

  const cancel = () => {
    setEditing(null);
    setCreating(false);
  };

  const save = async () => {
    if (!editing) return;
    if (!editing.command.trim() || !editing.title.trim() || !editing.content.trim()) {
      toast.error('命令、标题、内容不能为空');
      return;
    }
    const command = editing.command.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
    await promptRepo.upsert({ ...editing, command });
    cancel();
  };

  const remove = async (id: string) => {
    if (!confirm('删除该 Prompt 模板？')) return;
    await promptRepo.delete(id);
  };

  const toggleEnabled = async (t: PromptTemplate) => {
    await promptRepo.setEnabled(t.id, !t.enabled);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-ink-500 dark:text-dark-muted" />
          <h4 className="text-[13px] font-semibold text-ink-900 dark:text-dark-ink">
            Prompt 模板
          </h4>
          <span className="text-[10.5px] text-ink-400 dark:text-dark-muted">
            在输入框输入 / 唤起
          </span>
        </div>
        <Button size="sm" variant="primary" onClick={createNew}>
          <Plus size={13} />
          新建
        </Button>
      </div>

      {/* 列表 */}
      <div className="space-y-1.5">
        {list?.length === 0 && (
          <div className="rounded-lg border border-dashed border-surface-border dark:border-dark-border px-3 py-6 text-center text-xs text-ink-400 dark:text-dark-muted">
            还没有模板
          </div>
        )}
        {list?.map((t) => (
          <div
            key={t.id}
            className={clsx(
              'rounded-lg border border-surface-border dark:border-dark-border px-3 py-2 flex items-center justify-between transition-colors',
              !t.enabled && 'opacity-50',
            )}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <code className="rounded bg-ink-100 dark:bg-dark-subtle px-1.5 py-0 font-mono text-[11px] text-accent-hover dark:text-blue-300">
                  /{t.command}
                </code>
                <span className="truncate text-[13px] font-medium text-ink-900 dark:text-dark-ink">
                  {t.title}
                </span>
                <span className="rounded-full bg-ink-100 dark:bg-dark-subtle px-1.5 py-0 text-[10px] text-ink-500 dark:text-dark-muted">
                  {t.category}
                </span>
                {t.builtin && (
                  <span className="rounded-full bg-blue-50 dark:bg-blue-500/10 px-1.5 py-0 text-[10px] text-blue-700 dark:text-blue-300">
                    内置
                  </span>
                )}
              </div>
              {t.description && (
                <div className="mt-0.5 truncate text-[11px] text-ink-400 dark:text-dark-muted">
                  {t.description}
                </div>
              )}
            </div>
            <div className="flex shrink-0 gap-1">
              <Button size="icon" variant="ghost" onClick={() => toggleEnabled(t)} aria-label="启用">
                {t.enabled ? <ToggleRight size={14} className="text-green-600" /> : <ToggleLeft size={14} />}
              </Button>
              <Button size="icon" variant="ghost" onClick={() => edit(t)} aria-label="编辑">
                <Pencil size={12} />
              </Button>
              {!t.builtin && (
                <Button size="icon" variant="danger" onClick={() => remove(t.id)} aria-label="删除">
                  <Trash2 size={12} />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 编辑表单 */}
      {editing && (
        <div className="rounded-lg border border-surface-border dark:border-dark-border p-4 space-y-3 bg-surface-alt dark:bg-dark-subtle/40 animate-fade-in">
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-500 dark:text-dark-muted">
              {creating ? '新建模板' : `编辑：/${editing.command || '?'}`}
            </div>
            <button
              onClick={cancel}
              className="rounded p-1 text-ink-400 hover:bg-ink-100 dark:hover:bg-dark-subtle"
            >
              <X size={14} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className="text-[11px]">
              <div className="mb-1 font-medium text-ink-500 dark:text-dark-muted">
                命令 (英文，仅字母数字和-)
              </div>
              <Input
                value={editing.command}
                onChange={(e) =>
                  setEditing({ ...editing, command: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })
                }
                placeholder="code-review"
                disabled={!creating && editing.builtin}
                className="font-mono"
              />
            </label>
            <label className="text-[11px]">
              <div className="mb-1 font-medium text-ink-500 dark:text-dark-muted">分类</div>
              <select
                value={editing.category}
                onChange={(e) =>
                  setEditing({ ...editing, category: e.target.value as PromptTemplate['category'] })
                }
                disabled={!creating && editing.builtin}
                className="w-full h-8 rounded-md bg-white dark:bg-dark-subtle border border-surface-border dark:border-dark-border px-2.5 text-[13px] text-ink-900 dark:text-dark-ink focus:outline-none focus:border-accent"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="block text-[11px]">
            <div className="mb-1 font-medium text-ink-500 dark:text-dark-muted">标题</div>
            <Input
              value={editing.title}
              onChange={(e) => setEditing({ ...editing, title: e.target.value })}
              placeholder="代码评审"
              disabled={!creating && editing.builtin}
            />
          </label>
          <label className="block text-[11px]">
            <div className="mb-1 font-medium text-ink-500 dark:text-dark-muted">说明（可选）</div>
            <Input
              value={editing.description || ''}
              onChange={(e) => setEditing({ ...editing, description: e.target.value })}
              placeholder="评审一段代码，给出改进建议"
              disabled={!creating && editing.builtin}
            />
          </label>
          <label className="block text-[11px]">
            <div className="mb-1 font-medium text-ink-500 dark:text-dark-muted">
              模板内容 · 支持 <code className="font-mono">{'{{input}}'}</code> /{' '}
              <code className="font-mono">{'{{date}}'}</code> /{' '}
              <code className="font-mono">{'{{lang|中文}}'}</code>
            </div>
            <Textarea
              value={editing.content}
              onChange={(e) => setEditing({ ...editing, content: e.target.value })}
              placeholder="请对下面这段代码进行严格评审…"
              rows={5}
              disabled={!creating && editing.builtin}
            />
          </label>
          <div className="flex items-center justify-between gap-2 pt-1">
            <label className="inline-flex items-center gap-2 text-[11px] text-ink-500 dark:text-dark-muted">
              <input
                type="checkbox"
                checked={editing.enabled}
                onChange={(e) => setEditing({ ...editing, enabled: e.target.checked })}
              />
              启用（开启后输入框输入 / 会显示）
            </label>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={cancel}>
                取消
              </Button>
              <Button size="sm" variant="primary" onClick={save}>
                <Save size={12} />
                保存
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}