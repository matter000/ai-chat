import { useRef } from 'react';
import { Download, Upload, Trash2 } from 'lucide-react';
import { exportAll, importAll, conversationRepo } from '@/db';
import { Button } from '@/components/ui/Button';
import { toast } from '@/store/toastStore';
import { confirmDialog } from '@/store/confirmStore';

export function DataManager() {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    const data = await exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-chat-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => fileRef.current?.click();

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;

    // 第一道确认：覆盖
    if (!confirm('导入将覆盖当前全部数据，确认继续？')) {
      e.target.value = '';
      return;
    }

    try {
      const text = await f.text();
      const data = JSON.parse(text);
      await importAll(data);

      // 第二道提示：API Key 状态
      const providerCount = Array.isArray(data?.providers) ? data.providers.length : 0;
      const hadEncryptedKeys = Array.isArray(data?.providers)
        ? data.providers.some((p: { apiKey?: string }) => p?.apiKey === '(已加密的 API Key)')
        : false;

      let extra = '\n\n导入完成。';
      if (hadEncryptedKeys) {
        extra +=
          '\n\n⚠️ 原数据包含已加密的 API Key，为安全起见导入时已清空。\n请到「设置 → Provider 管理」逐个重新输入 Key。';
      } else if (providerCount > 0) {
        extra +=
          '\n\n⚠️ 原数据中 ' +
          providerCount +
          ' 个 Provider 的 API Key 在导出时已被遮罩，需要重新输入。';
      }
      alert(extra);

      location.reload();
    } catch (err: any) {
      alert(`导入失败：${err?.message || err}`);
    } finally {
      e.target.value = '';
    }
  };

  const handleClear = async () => {
    const ok = await confirmDialog({
      title: '清空全部会话',
      message: '将清空全部会话与消息（Provider 配置保留），确认？',
      confirmLabel: '清空',
      danger: true,
    });
    if (!ok) return;
    await conversationRepo.clear();
    toast.success('已清空会话');
    location.reload();
  };

  return (
    <div className="space-y-3">
      <h4 className="text-[13px] font-semibold text-ink-900 dark:text-dark-ink">数据管理</h4>
      <p className="text-[11.5px] text-ink-500 dark:text-dark-muted leading-relaxed">
        所有数据仅保存在浏览器本地（IndexedDB）。导出文件中的 API Key 已做遮罩或标记为"已加密"。
      </p>
      <div className="flex flex-wrap gap-2 pt-1">
        <Button size="sm" variant="outline" onClick={handleExport}>
          <Download size={13} />
          导出全部
        </Button>
        <Button size="sm" variant="outline" onClick={handleImportClick}>
          <Upload size={13} />
          导入
        </Button>
        <input ref={fileRef} type="file" accept="application/json" hidden onChange={handleFile} />
        <Button size="sm" variant="danger" onClick={handleClear}>
          <Trash2 size={13} />
          清空会话
        </Button>
      </div>
    </div>
  );
}