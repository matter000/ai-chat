import { useEffect, useRef, useState, useCallback, type KeyboardEvent } from 'react';
import { ArrowUp, Square, Plus, X, ImagePlus, FileText, FileType2, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import {
  pickAttachments,
  disposeAttachments,
  prepareAttachments,
  humanSize,
  MAX_TOTAL_FILES,
  type Attachment,
} from '@/services/image';
import { renderPrompt } from '@/services/promptRender';
import { promptRepo } from '@/db';
import { intakeFromDataTransfer, type IntakeProgress } from '@/services/fileIntake';
import { PromptPicker } from './PromptPicker';

interface Props {
  onSend: (text: string, attachments?: Attachment[]) => void;
  onStop?: () => void;
  streaming?: boolean;
  placeholder?: string;
}

export function ChatInput({ onSend, onStop, streaming, placeholder }: Props) {
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [picker, setPicker] = useState<{ open: boolean; filter: string }>({
    open: false,
    filter: '',
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [intake, setIntake] = useState<IntakeProgress>({
    count: 0,
    dirs: 0,
    loading: false,
  });
  const ref = useRef<HTMLTextAreaElement>(null);
  const fileImageRef = useRef<HTMLInputElement>(null);
  const fileTextRef = useRef<HTMLInputElement>(null);
  const filePdfRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const intakeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const addFiles = useCallback(async (rawFiles: File[]) => {
    if (!rawFiles?.length) return;
    const picked = await pickAttachments(rawFiles);
    if (!picked.length) {
      alert('所选文件类型不被支持');
      return;
    }
    setAttachments((prev) => [...prev, ...picked]);
    setMenuOpen(false);
  }, []);

  const handleFiles = (
    e: React.ChangeEvent<HTMLInputElement>,
    accept: (f: File) => boolean,
  ) => {
    const fs = e.target.files;
    if (!fs?.length) return;
    const filtered = Array.from(fs).filter(accept);
    e.target.value = '';
    if (filtered.length) addFiles(filtered);
  };

  useEffect(() => {
    return () => {
      setAttachments((curr) => {
        if (curr.length) disposeAttachments(curr);
        return curr;
      });
    };
  }, []);

  // 点击外部关闭菜单
  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: Event) => {
      if ((e as unknown as KeyboardEvent).key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey as EventListener);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey as EventListener);
    };
  }, [menuOpen]);

  // 高度自适应：
  // 1) Chrome 123+ / Edge 123+ / Safari 18+ 走 field-sizing: content，CSS 直接撑高
  // 2) Firefox 等不支持的浏览器 → JS 兜底测 scrollHeight 限到 220px
  const supportsFieldSizing = (() => {
    if (typeof CSS === 'undefined' || typeof (CSS as any).supports !== 'function') return false;
    try {
      return (CSS as any).supports('field-sizing');
    } catch {
      return false;
    }
  })();

  const autoResize = () => {
    const el = ref.current;
    if (!el || supportsFieldSizing) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 220) + 'px';
  };

  const submit = async () => {
    const t = text.trim();
    if (!t && attachments.length === 0) return;
    setPicker({ open: false, filter: '' });
    setMenuOpen(false);

    const prepared = await prepareAttachments(attachments);

    onSend(t, prepared);

    disposeAttachments(attachments);
    setAttachments([]);
    setText('');
    requestAnimationFrame(() => {
      if (ref.current) ref.current.style.height = 'auto';
    });
  };

  const updatePicker = (next: string) => {
    const match = next.match(/(^|\s)\/(\w*)$/);
    if (match) setPicker({ open: true, filter: match[2] });
    else setPicker({ open: false, filter: '' });
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value;
    setText(v);
    autoResize();
    updatePicker(v);
  };

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (picker.open) {
      if (e.key === 'Escape') {
        e.preventDefault();
        setPicker({ open: false, filter: '' });
        return;
      }
      if (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === 'ArrowUp') return;
    }
    if (e.key === 'Enter' && !e.shiftKey && !(e.ctrlKey || e.metaKey || e.altKey)) {
      e.preventDefault();
      submit();
    }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      submit();
    }
  };

  const handlePick = (rendered: string) => {
    setText(rendered);
    setPicker({ open: false, filter: '' });
    requestAnimationFrame(() => {
      ref.current?.focus();
      autoResize();
    });
  };

  useEffect(() => {
    if (!picker.open) return;
    const onKey = async (e: globalThis.KeyboardEvent) => {
      // IME 组合中（中文拼音）跳过，避免方向键 / 回车被劫持
      if ((e as unknown as { isComposing?: boolean }).isComposing || e.keyCode === 229) return;
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Enter') return;
      const all = (await promptRepo.list()).filter((t) => t.enabled);
      const f = picker.filter.toLowerCase().trim();
      const filtered = !f
        ? all
        : all.filter(
            (t) =>
              t.command.toLowerCase().includes(f) ||
              t.title.toLowerCase().includes(f) ||
              (t.description || '').toLowerCase().includes(f),
          );
      if (filtered.length === 0) return;
      e.preventDefault();
      if (e.key === 'Enter') {
        const beforeSlash = text.replace(/\/[\w-]*$/, '');
        const t = filtered[0];
        const rendered = renderPrompt(t.content, beforeSlash);
        handlePick(rendered);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [picker.open, picker.filter, text]);

  // 拖拽：在容器内接收 dragged file / directory
  useEffect(() => {
    const drop = dropRef.current;
    if (!drop) return;
    const targets = new Set<EventTarget>();
    const onDragEnter = (e: DragEvent) => {
      if (!e.dataTransfer?.types?.includes('Files')) return;
      targets.add(e.target as EventTarget);
      e.preventDefault();
      setDragOver(true);
      setIntake({ count: 0, dirs: 0, loading: false });
    };
    const onDragLeave = (e: DragEvent) => {
      targets.delete(e.target as EventTarget);
      if (targets.size === 0) setDragOver(false);
    };
    const onDragOver = (e: DragEvent) => {
      if (!e.dataTransfer?.types?.includes('Files')) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    };
    const onDrop = async (e: DragEvent) => {
      e.preventDefault();
      targets.clear();
      setDragOver(false);
      const dt = e.dataTransfer;
      if (!dt) return;
      try {
        setIntake({ count: 0, dirs: 0, loading: true });
        const files = await intakeFromDataTransfer(dt, (p) =>
          setIntake({ ...p }),
        );
        setIntake({ count: files.length, dirs: 0, loading: false });
        if (files.length) {
          addFiles(files);
          ref.current?.focus();
        }
        if (intakeTimerRef.current) clearTimeout(intakeTimerRef.current);
        intakeTimerRef.current = window.setTimeout(
          () => setIntake({ count: 0, dirs: 0, loading: false }),
          1500,
        );
      } catch (err) {
        console.error('intakeFromDataTransfer failed', err);
        setIntake({ count: 0, dirs: 0, loading: false });
      }
    };
    drop.addEventListener('dragenter', onDragEnter);
    drop.addEventListener('dragleave', onDragLeave);
    drop.addEventListener('dragover', onDragOver);
    drop.addEventListener('drop', onDrop);
    return () => {
      drop.removeEventListener('dragenter', onDragEnter);
      drop.removeEventListener('dragleave', onDragLeave);
      drop.removeEventListener('dragover', onDragOver);
      drop.removeEventListener('drop', onDrop);
    };
  }, [addFiles]);

  // 粘贴：接图片 / PDF / 文本 / 代码
  useEffect(() => {
    const ACCEPT = /\.(txt|md|markdown|json|ya?ml|toml|csv|tsv|log|env|ini|conf|html?|css|scss|less|js|jsx|ts|tsx|vue|svelte|py|rb|rs|go|java|kt|swift|c|h|cc|cpp|hpp|cs|php|sh|bash|zsh|sql|xml|tex|pdf|png|jpe?g|webp|gif)$/i;
    const isAcceptable = (f: File) =>
      f.type.startsWith('image/') ||
      f.type === 'application/pdf' ||
      f.type.startsWith('text/') ||
      (!f.type && ACCEPT.test(f.name.toLowerCase()));

    const onPaste = (e: ClipboardEvent) => {
      const dt = e.clipboardData;
      if (!dt) return;

      const files: File[] = [];
      for (let i = 0; i < dt.items.length; i++) {
        const it = dt.items[i];
        if (it.kind !== 'file') continue;
        const f = it.getAsFile();
        if (f && isAcceptable(f)) files.push(f);
      }

      // 没有任何可接管文件 → 走浏览器默认行为（不要吞 Ctrl+V）
      if (files.length === 0) return;

      // 接管：阻止默认插入，避免把二进制塞进文本框
      e.preventDefault();

      // 命名兜底（截图工具通常没 filename）
      files.forEach((f, i) => {
        if (!f.name || f.name === 'image.png') {
          const ts = new Date()
            .toISOString()
            .replace(/[:.]/g, '-')
            .slice(0, 19);
          const ext =
            f.type === 'application/pdf' ? 'pdf' :
            f.type.startsWith('image/') ? (f.type.split('/')[1] || 'png') :
            'txt';
          const renamed = new File([f], `paste-${ts}-${i + 1}.${ext}`, { type: f.type });
          files[i] = renamed;
        }
      });
      addFiles(files);
    };
    document.addEventListener('paste', onPaste as EventListener);
    return () => document.removeEventListener('paste', onPaste as EventListener);
  }, [addFiles]);

  const removeAttachment = (id: string) => {
    setAttachments((prev) => {
      const target = prev.find((a) => a.id === id);
      if (target) {
        try {
          if (target.previewUrl) URL.revokeObjectURL(target.previewUrl);
        } catch { /* ignore */ }
      }
      return prev.filter((a) => a.id !== id);
    });
  };

  const canSend = streaming || !!text.trim() || attachments.length > 0;

  return (
    <div className="relative border-t border-surface-border dark:border-dark-border bg-surface-alt dark:bg-dark-bg px-4 py-3">
      <div
        ref={dropRef}
        className={clsx(
          'relative mx-auto max-w-3xl',
          'rounded-2xl border bg-white dark:bg-dark-panel',
          'transition-all duration-fast ease-out',
          dragOver || intake.loading || intake.count > 0
            ? 'border-accent border-dashed bg-accent-soft/40 dark:bg-accent/10'
            : 'border-surface-border dark:border-dark-border focus-within:border-ink-300 dark:focus-within:border-dark-border focus-within:shadow-sm',
        )}
      >
        {/* 拖拽状态：顶部小 chip，不再全屏覆盖 */}
        {(dragOver || intake.loading || intake.count > 0) && (
          <div className="pointer-events-none absolute left-3 right-3 top-2 z-20 flex items-center gap-2 rounded-md bg-accent px-3 py-1.5 text-xs text-white shadow animate-fade-in">
            {intake.loading ? (
              <>
                <Loader2 size={12} className="animate-spin" />
                <span>扫描中…</span>
                {intake.dirs > 0 && (
                  <span className="ml-1 opacity-80">（{intake.dirs} 个目录）</span>
                )}
                <span className="ml-auto tabular-nums">{intake.count}</span>
              </>
            ) : intake.count > 0 ? (
              <>
                <span>✅ 已识别 {intake.count} 个文件</span>
                {intake.count >= MAX_TOTAL_FILES && (
                  <span className="ml-1 opacity-80">（已达上限 {MAX_TOTAL_FILES}）</span>
                )}
                <span className="ml-auto text-[10px] opacity-80">+{intake.count}</span>
              </>
            ) : (
              <>
                <UploadIcon />
                <span>松开鼠标上传 · 支持目录递归</span>
                <span className="ml-auto text-[10px] opacity-80">+N</span>
              </>
            )}
          </div>
        )}
        {/* 附件预览 */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 px-4 pt-3">
            {attachments.map((a) =>
              a.kind === 'image' && a.previewUrl ? (
                <div
                  key={a.id}
                  className="group relative h-16 w-16 overflow-hidden rounded-lg border border-surface-border dark:border-dark-border bg-ink-50 dark:bg-dark-subtle"
                  title={a.name}
                >
                  <img
                    src={a.previewUrl}
                    alt={a.name}
                    className="h-full w-full object-cover"
                  />
                  <span className="absolute bottom-0 left-0 right-0 truncate bg-black/60 px-1 py-0.5 text-[9px] text-white">
                    {a.name}
                  </span>
                  <button
                    onClick={() => removeAttachment(a.id)}
                    aria-label="移除"
                    className="absolute right-0.5 top-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black/80"
                  >
                    <X size={11} />
                  </button>
                </div>
              ) : (
                <div
                  key={a.id}
                  className="group relative flex items-center gap-2 max-w-[260px] rounded-lg border border-surface-border dark:border-dark-border bg-ink-50 dark:bg-dark-subtle px-2 py-1.5"
                  title={a.name}
                >
                  {a.kind === 'pdf' ? (
                    <FileType2 size={14} className="shrink-0 text-red-500" />
                  ) : (
                    <FileText size={14} className="shrink-0 text-ink-500 dark:text-dark-muted" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[11.5px] text-ink-900 dark:text-dark-ink">
                      {a.name}
                    </div>
                    <div className="text-[10px] text-ink-500 dark:text-dark-muted">
                      {a.kind === 'pdf' ? 'PDF · ' : '文本 · '}
                      {humanSize(a.size)}
                    </div>
                  </div>
                  <button
                    onClick={() => removeAttachment(a.id)}
                    aria-label="移除"
                    className="ml-1 rounded p-0.5 text-ink-500 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black/10 dark:hover:bg-white/10"
                  >
                    <X size={11} />
                  </button>
                </div>
              ),
            )}
          </div>
        )}

        {/* wrapper：控制最小/最大高度；textarea 用 field-sizing:content + align-items 让 placeholder 居中 */}
        <div
          className={clsx(
            'relative w-full',
            attachments.length > 0
              ? 'min-h-[56px]'
              : dragOver || intake.loading || intake.count > 0
              ? 'min-h-[88px]'
              : 'min-h-[56px]',
            'max-h-[220px] flex items-stretch',
          )}
        >
          <textarea
            ref={ref}
            value={text}
            onChange={handleChange}
            onKeyDown={handleKey}
            placeholder={placeholder ?? '输入 / 唤起模板，或直接输入消息'}
            rows={1}
            className={clsx(
              'w-full resize-none bg-transparent',
              'pl-12 pr-16 py-3 text-[14.5px] leading-relaxed',
              'text-ink-900 dark:text-dark-ink',
              // placeholder 颜色 + 居中
              'placeholder:text-ink-400 dark:placeholder:text-dark-muted',
              'focus:outline-none',
              // CSS field-sizing: content — Chrome 123+ / Edge / Safari 18+
              // 不支持的浏览器走 JS 测高（autoResize）作为兜底
              'field-sizing-content',
            )}
          />
        </div>

        {/* 加号菜单 + 字数 */}
        <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              disabled={streaming}
              aria-label="添加附件"
              title="添加附件（图片 / 文本 / PDF）"
              className={clsx(
                'inline-flex h-8 w-8 items-center justify-center rounded-lg',
                'text-ink-500 dark:text-dark-muted',
                'hover:bg-ink-100 dark:hover:bg-dark-subtle',
                'transition-colors duration-fast ease-out',
                'disabled:opacity-40 disabled:cursor-not-allowed',
                menuOpen && 'bg-ink-100 dark:bg-dark-subtle text-ink-900 dark:text-dark-ink',
              )}
            >
              <Plus size={17} className={clsx('transition-transform', menuOpen && 'rotate-45')} />
            </button>

            {menuOpen && (
              <div
                className={clsx(
                  'absolute z-30 left-0 bottom-full mb-2 w-[240px]',
                  'rounded-xl border border-surface-border dark:border-dark-border',
                  'bg-white dark:bg-dark-panel shadow-lg overflow-hidden',
                  'p-1.5 animate-slide-up',
                )}
              >
                <button
                  type="button"
                  onClick={() => {
                    fileImageRef.current?.click();
                  }}
                  className="flex w-full items-start gap-3 rounded-md px-2.5 py-2 text-left hover:bg-ink-50 dark:hover:bg-dark-subtle transition-colors"
                >
                  <div className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent-soft dark:bg-accent/15 text-accent-hover dark:text-blue-300">
                    <ImagePlus size={14} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[12.5px] font-medium text-ink-900 dark:text-dark-ink">上传图片</div>
                    <div className="mt-0.5 truncate text-[10.5px] text-ink-500 dark:text-dark-muted">
                      PNG / JPG / WEBP / GIF · ≤8MB
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    filePdfRef.current?.click();
                  }}
                  className="flex w-full items-start gap-3 rounded-md px-2.5 py-2 text-left hover:bg-ink-50 dark:hover:bg-dark-subtle transition-colors"
                >
                  <div className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400">
                    <FileType2 size={14} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[12.5px] font-medium text-ink-900 dark:text-dark-ink">上传 PDF</div>
                    <div className="mt-0.5 truncate text-[10.5px] text-ink-500 dark:text-dark-muted">
                      当图片传给视觉模型 · ≤8MB
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    fileTextRef.current?.click();
                  }}
                  className="flex w-full items-start gap-3 rounded-md px-2.5 py-2 text-left hover:bg-ink-50 dark:hover:bg-dark-subtle transition-colors"
                >
                  <div className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-ink-100 dark:bg-dark-subtle text-ink-700 dark:text-dark-ink">
                    <FileText size={14} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[12.5px] font-medium text-ink-900 dark:text-dark-ink">上传文档</div>
                    <div className="mt-0.5 truncate text-[10.5px] text-ink-500 dark:text-dark-muted">
                      文本 / 代码 / Markdown / JSON ...
                    </div>
                  </div>
                </button>

                <div className="mt-1 border-t border-surface-border dark:border-dark-border px-2 py-1.5 text-[10px] text-ink-400 dark:text-dark-muted leading-relaxed">
                  阅后即焚：发送后立即从浏览器内存中删除
                </div>
              </div>
            )}
          </div>

          <input
            ref={fileImageRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            multiple
            hidden
            onChange={(e) =>
              handleFiles(e, (f) => f.type.startsWith('image/'))
            }
          />
          <input
            ref={filePdfRef}
            type="file"
            accept="application/pdf,.pdf"
            multiple
            hidden
            onChange={(e) =>
              handleFiles(e, (f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'))
            }
          />
          <input
            ref={fileTextRef}
            type="file"
            accept=".txt,.md,.markdown,.json,.csv,.tsv,.yaml,.yml,.log,.xml,.html,.css,.scss,.js,.jsx,.ts,.tsx,.vue,.py,.rb,.rs,.go,.java,.kt,.swift,.c,.cpp,.h,.hpp,.cs,.php,.sh,.bash,.sql,.toml,.env,.ini,.conf"
            multiple
            hidden
            onChange={(e) =>
              handleFiles(e, (f) =>
                f.type.startsWith('text/') || !f.type || f.type === '',
              )
            }
          />

          {(attachments.length > 0 || text.length > 0) && (
            <span className="ml-0.5 text-[10px] text-ink-400 dark:text-dark-muted tabular-nums">
              {attachments.length > 0 && `${attachments.length} 个附件 · `}
              {text.length > 0 && `${text.length} 字`}
            </span>
          )}
        </div>

        {/* 发送按钮 */}
        <button
          onClick={streaming ? onStop : submit}
          disabled={!canSend || (!streaming && !text.trim() && attachments.length === 0)}
          aria-label={streaming ? '停止生成' : '发送'}
          className={clsx(
            'absolute right-3 top-1/2 -translate-y-1/2',
            'inline-flex h-11 w-11 items-center justify-center rounded-2xl',
            'transition-all duration-fast ease-out',
            'shadow-md',
            streaming
              ? 'bg-ink-700 hover:bg-ink-900 text-white'
              : 'bg-accent hover:bg-accent-hover text-white',
            'disabled:opacity-30 disabled:cursor-not-allowed',
            'active:scale-95',
          )}
        >
          {streaming ? (
            <Square size={16} fill="currentColor" />
          ) : (
            <ArrowUp size={22} strokeWidth={2.5} />
          )}
        </button>
      </div>

      {picker.open && (
        <PromptPicker
          text={text}
          filter={picker.filter}
          onPick={(rendered) => handlePick(rendered)}
          onClose={() => setPicker({ open: false, filter: '' })}
        />
      )}
    </div>
  );
}

function UploadIcon() {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-accent"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}