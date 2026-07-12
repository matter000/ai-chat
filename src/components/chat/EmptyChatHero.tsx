/**
 * ChatView 的空态展示：分两种
 * - 没 Provider：提示去设置添加
 * - 有 Provider + 无消息：给示例 prompt 卡片
 */
interface EmptyHeroProps {
  hasProvider: boolean;
  onOpenSettings: () => void;
  onPickPrompt?: (text: string) => void;
}

const SAMPLE_PROMPTS = [
  { icon: '💡', text: '用 3 句话解释一下量子计算' },
  { icon: '✍️', text: '帮我润色一段产品介绍文案' },
  { icon: '🐛', text: '帮我写一个 Python 抓取网页的脚本' },
  { icon: '🌐', text: '把这段中文翻译成英文：' },
];

export function EmptyChatHero({ hasProvider, onOpenSettings, onPickPrompt }: EmptyHeroProps) {
  if (!hasProvider) {
    return (
      <div className="flex flex-col items-center gap-4 py-12 px-6">
        <div className="text-[44px] opacity-80">🔧</div>
        <div className="text-center">
          <h3 className="text-[15px] font-semibold text-ink-900 dark:text-dark-ink">
            还没有配置 Provider
          </h3>
          <p className="mt-1.5 text-[12.5px] text-ink-500 dark:text-dark-muted leading-relaxed">
            按以下步骤开始你的第一次对话
          </p>
        </div>
        <ol className="space-y-2 text-[13px] text-ink-700 dark:text-dark-ink">
          <li className="flex items-center gap-2.5">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-accent-soft dark:bg-accent/15 text-[11px] font-semibold text-accent">
              1
            </span>
            在设置中添加一个 Provider（如 DeepSeek）
          </li>
          <li className="flex items-center gap-2.5">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-accent-soft dark:bg-accent/15 text-[11px] font-semibold text-accent">
              2
            </span>
            在顶部选择 Provider 和模型
          </li>
          <li className="flex items-center gap-2.5">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-accent-soft dark:bg-accent/15 text-[11px] font-semibold text-accent">
              3
            </span>
            在下方输入框输入消息开始对话
          </li>
        </ol>
        <button
          onClick={onOpenSettings}
          className="mt-2 inline-flex items-center justify-center rounded-lg bg-accent hover:bg-accent-hover px-4 h-9 text-[13px] font-medium text-white transition-colors"
        >
          打开设置
        </button>
      </div>
    );
  }

  return (
    <div className="py-12 space-y-8">
      <div className="text-center">
        <div className="text-4xl mb-3">💬</div>
        <h3 className="text-[18px] font-semibold text-ink-900 dark:text-dark-ink">
          开始一段新对话
        </h3>
        <p className="mt-1.5 text-[13px] text-ink-500 dark:text-dark-muted">
          在下方输入框输入消息，回车发送 · 或点下方示例快速开始
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-w-xl mx-auto">
        {SAMPLE_PROMPTS.map((s) => (
          <button
            key={s.text}
            onClick={() => {
              if (onPickPrompt) onPickPrompt(s.text);
              else {
                const el = document.querySelector('textarea');
                if (el instanceof HTMLTextAreaElement) el.focus();
              }
            }}
            className="flex items-start gap-2.5 text-left rounded-lg border border-surface-border dark:border-dark-border bg-white dark:bg-dark-panel p-3 hover:border-accent dark:hover:border-accent hover:bg-accent-soft/30 dark:hover:bg-accent/10 transition-colors"
          >
            <span className="text-base shrink-0 mt-0.5">{s.icon}</span>
            <span className="text-[12.5px] text-ink-700 dark:text-dark-ink leading-relaxed">
              {s.text}
            </span>
          </button>
        ))}
      </div>
      <div className="text-center text-[11px] text-ink-400 dark:text-dark-muted">
        ⌘K 打开命令面板 · / 唤起 Prompt 模板 · ⌘⇧F 全局搜索
      </div>
    </div>
  );
}
