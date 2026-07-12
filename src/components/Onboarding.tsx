import { useState } from 'react';
import { providerRepo } from '@/db';
import { nanoid } from 'nanoid';
import type { Provider } from '@/types';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { clsx } from 'clsx';
import { toast } from '@/store/toastStore';

interface PresetSpec {
  name: string;
  baseUrl: string;
  model: string;
  cors?: 'allow' | 'partial';
}

const PRESETS: PresetSpec[] = [
  { name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat', cors: 'allow' },
  { name: 'Moonshot (Kimi)', baseUrl: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k', cors: 'allow' },
  { name: '智谱 GLM', baseUrl: 'https://open.bigmodel.cn/api/paas/v4/', model: 'glm-4-flash', cors: 'allow' },
  { name: '硅基流动', baseUrl: 'https://api.siliconflow.cn/v1', model: 'Qwen/Qwen2.5-7B-Instruct', cors: 'allow' },
  { name: '通义千问', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-turbo', cors: 'allow' },
  { name: '百度千帆', baseUrl: 'https://qianfan.baidubce.com/v2', model: 'ernie-speed-8k', cors: 'partial' },
  { name: '字节豆包', baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', model: 'doubao-1-5-lite-32k-250115', cors: 'partial' },
  { name: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', model: 'openai/gpt-4o-mini', cors: 'allow' },
  { name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini', cors: 'allow' },
  { name: 'Ollama (本地)', baseUrl: 'http://localhost:11434/v1', model: 'llama3.1', cors: 'allow' },
];

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function Onboarding({ open, onClose, onSaved }: Props) {
  const [name, setName] = useState('DeepSeek');
  const [baseUrl, setBaseUrl] = useState('https://api.deepseek.com/v1');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('deepseek-chat');

  const apply = (p: PresetSpec) => {
    setName(p.name);
    setBaseUrl(p.baseUrl);
    setModel(p.model);
  };

  const save = async () => {
    if (!apiKey.trim()) {
      toast.error('请填写 API Key');
      return;
    }
    const p: Provider = {
      id: nanoid(),
      name: name.trim(),
      type: 'openai-compatible',
      baseUrl: baseUrl.trim(),
      apiKey: apiKey.trim(),
      models: [model.trim()].filter(Boolean),
      enabled: true,
    };
    await providerRepo.upsert(p);
    onSaved();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="欢迎使用 AI Chat"
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            稍后
          </Button>
          <Button variant="primary" onClick={save}>
            保存并开始
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-sm">
        <p className="text-[12px] text-ink-500 dark:text-dark-muted leading-relaxed">
          所有数据存储在浏览器本地，不上传任何服务器。先添加一个 Provider 即可开始对话。
        </p>

        <div>
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink-400 dark:text-dark-muted">
            选择预设
          </div>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.name}
                onClick={() => apply(p)}
                className={clsx(
                  'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] transition-colors',
                  p.cors === 'partial'
                    ? 'border-amber-400/60 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-500/10'
                    : name === p.name
                    ? 'border-accent bg-accent-soft dark:bg-accent/15 text-accent-hover dark:text-blue-300'
                    : 'border-surface-border dark:border-dark-border text-ink-700 dark:text-dark-ink hover:bg-ink-50 dark:hover:bg-dark-subtle',
                )}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="text-[11px]">
            <div className="mb-1 font-medium text-ink-500 dark:text-dark-muted">名称</div>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="text-[11px]">
            <div className="mb-1 font-medium text-ink-500 dark:text-dark-muted">模型</div>
            <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="deepseek-chat" className="font-mono" />
          </label>
        </div>
        <label className="block text-[11px]">
          <div className="mb-1 font-medium text-ink-500 dark:text-dark-muted">Base URL</div>
          <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} className="font-mono" />
        </label>
        <label className="block text-[11px]">
          <div className="mb-1 font-medium text-ink-500 dark:text-dark-muted">API Key</div>
          <Input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-..."
            className="font-mono"
          />
        </label>
      </div>
    </Modal>
  );
}