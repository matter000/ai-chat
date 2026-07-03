import { useEffect } from 'react';

export type ShortcutMap = Record<string, (e: KeyboardEvent) => void>;

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

function normalizeKey(e: KeyboardEvent): string {
  const parts: string[] = [];
  const ctrlOrMeta = isMac ? e.metaKey : e.ctrlKey;
  if (ctrlOrMeta) parts.push(isMac ? 'cmd' : 'ctrl');
  if (e.shiftKey) parts.push('shift');
  if (e.altKey) parts.push('alt');
  const k = e.key.toLowerCase();
  // 过滤单独按 shift / ctrl 之类
  if (['shift', 'control', 'meta', 'alt'].includes(k)) return '';
  if (k === ' ') parts.push('space');
  else parts.push(k);
  return parts.join('+');
}

/**
 * 全局快捷键 hook。
 * 每个键是 `ctrl+shift+k` 这样的字符串，回调里 e.preventDefault() 由调用方决定。
 * 当焦点在输入框 / textarea（IME 组合中）时自动跳过，避免干扰中文输入。
 */
export function useShortcuts(map: ShortcutMap, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      // IME 组合中，跳过
      if ((e as any).isComposing || e.keyCode === 229) return;
      const target = e.target as HTMLElement;
      const tag = target?.tagName?.toLowerCase();
      const isEditable =
        tag === 'input' ||
        tag === 'textarea' ||
        target?.isContentEditable ||
        target?.getAttribute('role') === 'textbox';
      // 输入框里只允许 cmd+enter / cmd+/ 这类带 cmd 的快捷键生效
      const key = normalizeKey(e);
      if (!key) return;
      const handler = map[key];
      if (!handler) return;
      // 输入框内：只放行带 modifier 的快捷键
      if (isEditable && !(key.includes('cmd') || key.includes('ctrl') || key.includes('alt'))) {
        return;
      }
      e.preventDefault();
      handler(e);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [map, enabled]);
}

export function formatShortcut(key: string): string {
  // 把 'cmd+shift+k' 渲染成用户看的形式
  const isMacEnv = isMac;
  return key
    .split('+')
    .map((p) => {
      if (p === 'cmd') return isMacEnv ? '⌘' : 'Ctrl';
      if (p === 'ctrl') return isMacEnv ? '⌃' : 'Ctrl';
      if (p === 'shift') return isMacEnv ? '⇧' : 'Shift';
      if (p === 'alt') return isMacEnv ? '⌥' : 'Alt';
      if (p === 'enter') return '↵';
      if (p === 'escape') return 'Esc';
      if (p === 'space') return 'Space';
      return p.toUpperCase();
    })
    .join(isMacEnv ? '' : '+');
}