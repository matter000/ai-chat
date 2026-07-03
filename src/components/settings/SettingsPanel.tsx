import { useUIStore } from '@/store/uiStore';
import { Drawer } from '@/components/ui/Drawer';
import { ProviderManager } from './ProviderManager';
import { DataManager } from './DataManager';
import { ShortcutsPanel } from './ShortcutsPanel';
import { EncryptionPanel } from './EncryptionPanel';
import { PromptManager } from './PromptManager';
import { User } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export function SettingsPanel() {
  const open = useUIStore((s) => s.settingsOpen);
  const close = useUIStore((s) => s.closeSettings);

  const openUserCenter = () => {
    window.dispatchEvent(new CustomEvent('app:open-user-center'));
  };

  return (
    <Drawer open={open} onClose={close} title="设置" width={540}>
      <div className="space-y-8">
        <section>
          <button
            onClick={openUserCenter}
            className="flex w-full items-center gap-2 rounded-lg border border-surface-border dark:border-dark-border px-3 py-2.5 text-left hover:bg-ink-50 dark:hover:bg-dark-subtle transition-colors"
          >
            <User size={15} className="text-accent" />
            <span className="text-[13px] font-medium text-ink-900 dark:text-dark-ink">用户中心</span>
            <span className="ml-auto text-[11px] text-ink-400 dark:text-dark-muted">查看资料 →</span>
          </button>
        </section>
        <section className="pt-6 border-t border-surface-border dark:border-dark-border">
          <EncryptionPanel />
        </section>
        <section className="pt-6 border-t border-surface-border dark:border-dark-border">
          <PromptManager />
        </section>
        <section className="pt-6 border-t border-surface-border dark:border-dark-border">
          <ProviderManager />
        </section>
        <section className="pt-6 border-t border-surface-border dark:border-dark-border">
          <ShortcutsPanel />
        </section>
        <section className="pt-6 border-t border-surface-border dark:border-dark-border">
          <DataManager />
        </section>
        <section className="pt-6 border-t border-surface-border dark:border-dark-border">
          <h4 className="text-[13px] font-semibold mb-2 text-ink-900 dark:text-dark-ink">关于</h4>
          <p className="text-[12px] text-ink-500 dark:text-dark-muted leading-relaxed">
            所有数据存储在你的浏览器本地（IndexedDB），不上传任何服务器。
          </p>
          <p className="text-[12px] text-ink-500 dark:text-dark-muted leading-relaxed mt-2">
            部分厂商 API 不允许浏览器直连（CORS）。如遇问题，请使用支持 CORS 的中转服务（如 OpenRouter）或本地 Ollama。
          </p>
        </section>
      </div>
    </Drawer>
  );
}