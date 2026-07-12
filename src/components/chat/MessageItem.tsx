import type { Message } from '@/types';
import { MarkdownView } from './MarkdownView';
import { Copy, RefreshCw, Trash2, Check, ImageOff, FileText, FileType2, Pencil, X, ArrowUp } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { clsx } from 'clsx';

interface Props {
  message: Message;
  streaming?: boolean;
  onRegenerate?: () => void;
  onDelete?: () => void;
  onEdit?: (newContent: string) => void;
  highlighted?: boolean;
}

/**
 * Claude 风格消息项：
 * - 用户：靠右，左侧 2px 蓝色 accent 细线 + 蓝色文字
 * - 助手：靠左，无背景框，纯 markdown 排版
 * - 操作按钮：hover 才出现，紧贴底部
 */
export function MessageItem({ message, streaming, onRegenerate, onDelete, onEdit, highlighted }: Props) {
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [editing, setEditing] = useState(false);
  const [editDraft, setEditDraft] = useState('');
  const editRef = useRef<HTMLTextAreaElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [pulse, setPulse] = useState(false);
  const isUser = message.role === 'user';

  useEffect(() => {
    if (!highlighted) {
      setPulse(false);
      return;
    }
    setPulse(true);
    const t = setTimeout(() => setPulse(false), 1600);
    return () => clearTimeout(t);
  }, [highlighted]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  return (
    <div
      ref={wrapRef}
      data-message-id={message.id}
      className={clsx(
        'group relative animate-fade-in rounded-lg transition-colors duration-fast',
        pulse && 'ring-2 ring-amber-300/70 bg-amber-50/50 dark:bg-amber-500/10',
        isUser ? 'flex justify-end items-start gap-2 sm:gap-3' : 'flex justify-start items-start gap-2 sm:gap-3',
      )}
    >
      {/* AI 头像：左边 */}
      {!isUser && (
        <div className="shrink-0 mt-0.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 text-white text-[11px] font-semibold shadow-sm select-none">
            AI
          </div>
        </div>
      )}

      <div className={clsx('max-w-[760px] w-full', isUser ? 'flex justify-end' : '')}>
        {/* 用户消息：左侧蓝色细线 + 文字 + 可选"已删除图片"占位 */}
        {isUser ? (
          <div className="max-w-[85%] pl-3 border-l-2 border-accent">
            {message.hasAttachments && message.attachments && message.attachments.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {message.attachments.map((a) => {
                  const Icon =
                    a.kind === 'pdf' ? FileType2 : a.kind === 'image' ? ImageOff : FileText;
                  return (
                    <div
                      key={a.id}
                      className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-ink-300 dark:border-dark-border bg-ink-50 dark:bg-dark-subtle px-2 py-1 text-[11px] text-ink-500 dark:text-dark-muted"
                      title="原始文件已从内存清除，仅保留理解结果"
                    >
                      <Icon size={11} />
                      <span className="max-w-[180px] truncate">
                        {a.name}
                        <span className="ml-1 opacity-60">· 已焚</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
            {message.hasAttachments && !message.attachments && (
              <div
                className="mb-2 inline-flex items-center gap-1.5 rounded-md border border-dashed border-ink-300 dark:border-dark-border bg-ink-50 dark:bg-dark-subtle px-2 py-1 text-[11px] text-ink-500 dark:text-dark-muted"
              >
                <ImageOff size={11} />
                <span>附件已阅后即焚</span>
              </div>
            )}
            {editing ? (
              <div className="space-y-2">
                <textarea
                  ref={editRef}
                  value={editDraft}
                  onChange={(e) => setEditDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.nativeEvent as any).isComposing) return; // BUG-4: IME
                    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
                      e.preventDefault();
                      const trimmed = editDraft.trim();
                      if (!trimmed) return; // BUG-6: 空白不收
                      onEdit?.(trimmed);
                      setEditing(false);
                    } else if (e.key === 'Escape') {
                      setEditing(false);
                    }
                  }}
                  className="w-full resize-none rounded-md border border-accent bg-white dark:bg-dark-panel px-3 py-2 text-[14px] leading-relaxed text-ink-900 dark:text-dark-ink focus:outline-none focus:ring-2 focus:ring-accent/20 min-h-[48px]"
                  rows={3}
                  autoFocus
                />
                <div className="flex items-center gap-1 text-[10.5px] text-ink-400 dark:text-dark-muted">
                  <span>Enter 保存 · Esc 取消 · Shift+Enter 换行</span>
                  <button
                    onClick={() => {
                      const trimmed = editDraft.trim();
                      if (!trimmed) return; // BUG-6
                      onEdit?.(trimmed);
                      setEditing(false);
                    }}
                    className="ml-auto inline-flex items-center gap-1 rounded-md bg-accent px-2 py-0.5 text-[11px] text-white hover:bg-accent-hover"
                  >
                    <ArrowUp size={10} />
                    保存并重发
                  </button>
                  <button
                    onClick={() => setEditing(false)}
                    className="rounded-md px-2 py-0.5 text-[11px] text-ink-500 hover:bg-ink-100 dark:hover:bg-dark-subtle"
                  >
                    取消
                  </button>
                </div>
              </div>
            ) : (
              <div className="whitespace-pre-wrap break-words text-[14.5px] leading-relaxed text-ink-900 dark:text-dark-ink">
                {message.content}
              </div>
            )}
          </div>
        ) : (
          // 助手消息：纯 markdown，无背景框
          <MarkdownView content={message.content} streaming={streaming} />
        )}

        {/* 操作栏：hover 才出现 */}
        <div
          className={clsx(
            'mt-2 flex items-center gap-0.5',
            'opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-fast',
            isUser ? 'justify-end' : '',
          )}
        >
          {!isUser && onRegenerate && (
            <Button size="icon" variant="ghost" onClick={onRegenerate} aria-label="重新生成">
              <RefreshCw size={13} />
            </Button>
          )}
          {isUser && onEdit && (
            <Button
              size="icon"
              variant="ghost"
              onClick={() => { setEditDraft(message.content); setEditing(true); }}
              aria-label="编辑"
            >
              <Pencil size={12} />
            </Button>
          )}
          <Button size="icon" variant="ghost" onClick={handleCopy} aria-label="复制">
            {copied ? <Check size={13} className="text-green-600" /> : <Copy size={13} />}
          </Button>
          {onDelete && (
            <Button size="icon" variant="ghost" onClick={onDelete} aria-label="删除">
              <Trash2 size={13} />
            </Button>
          )}
        </div>
      </div>

      {/* 用户头像：右边 */}
      {isUser && (
        <div className="shrink-0 mt-0.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 text-white text-[11px] font-semibold shadow-sm select-none">
            我
          </div>
        </div>
      )}
    </div>
  );
}