import { Keyboard } from 'lucide-react';
import { formatShortcut } from '@/hooks/useShortcuts';

const SHORTCUTS: Array<{ keys: string; label: string; desc?: string }> = [
  { keys: 'mod+k', label: '打开命令面板', desc: '搜索所有快捷操作' },
  { keys: 'mod+shift+f', label: '全局搜索消息', desc: '跨所有会话的内容搜索' },
  { keys: 'mod+shift+o', label: '新建会话' },
  { keys: 'mod+shift+k', label: '聚焦侧栏搜索' },
  { keys: 'mod+/', label: '打开会话参数' },
  { keys: 'mod+,', label: '打开设置' },
  { keys: 'mod+enter', label: '聚焦输入框 / 发送消息' },
  { keys: 'enter', label: '发送消息（输入框内）' },
  { keys: 'shift+enter', label: '换行（输入框内）' },
  { keys: 'escape', label: '关闭抽屉 / 命令面板 / 全局搜索' },
];

export function ShortcutsPanel() {
  const isMac =
    typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <Keyboard size={14} className="text-ink-500 dark:text-dark-muted" />
        <h4 className="text-[13px] font-semibold text-ink-900 dark:text-dark-ink">键盘快捷键</h4>
        <span className="text-[10.5px] text-ink-400 dark:text-dark-muted">
          {isMac ? 'macOS' : 'Windows / Linux'}
        </span>
      </div>
      <div className="rounded-lg border border-surface-border dark:border-dark-border overflow-hidden">
        <table className="w-full text-[12.5px]">
          <tbody>
            {SHORTCUTS.map((s, i) => (
              <tr
                key={s.keys}
                className={
                  i % 2 === 0
                    ? 'bg-white dark:bg-dark-panel'
                    : 'bg-ink-50/50 dark:bg-dark-subtle/30'
                }
              >
                <td className="px-3 py-2 text-ink-700 dark:text-dark-ink">{s.label}</td>
                <td className="px-3 py-2 text-right">
                  <kbd className="inline-flex items-center justify-center min-w-[28px] text-[10.5px] text-ink-700 dark:text-dark-ink bg-ink-50 dark:bg-dark-subtle px-1.5 py-0.5 rounded border border-surface-border dark:border-dark-border font-mono">
                    {formatShortcut(s.keys)}
                  </kbd>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[10.5px] text-ink-400 dark:text-dark-muted leading-relaxed">
        <code className="font-mono">mod</code> 表示 macOS 上的 <code className="font-mono">⌘</code> ，
        其他平台上的 <code className="font-mono">Ctrl</code>。
      </p>
    </div>
  );
}