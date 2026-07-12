import { useState } from 'react';
import { Plus, Trash2, Save, Eye, EyeOff, ExternalLink, AlertTriangle, Lock } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { nanoid } from 'nanoid';
import { providerRepo } from '@/db';
import type { Provider } from '@/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { clsx } from 'clsx';
import { isEncryptionEnabled } from '@/services/crypto';
import { toast } from '@/store/toastStore';
import { confirmDialog } from '@/store/confirmStore';

/**
 * 国内主流厂商预设。
 * 全部走 OpenAI 兼容协议（chat/completions + SSE），无需新增 Adapter。
 * 注意：Base URL 与默认模型会随厂商更新而变化，请以官方文档为准。
 */
interface PresetSpec {
  name: string;
  baseUrl: string;
  models: string[];
  doc?: string;
  cors?: 'allow' | 'partial' | 'block';
  note?: string;
  type?: 'openai-compatible' | 'anthropic' | 'gemini';
}

const PRESETS: PresetSpec[] = [
  // ── 海外（保留兼容） ─────────────────────────────────────
  {
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    doc: 'https://platform.openai.com/',
    cors: 'allow',
  },

  // ── 国内主流（OpenAI 兼容） ───────────────────────────────
  {
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    doc: 'https://platform.deepseek.com/',
    cors: 'allow',
  },
  {
    name: 'Moonshot (Kimi)',
    baseUrl: 'https://api.moonshot.cn/v1',
    models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
    doc: 'https://platform.moonshot.cn/',
    cors: 'allow',
  },
  {
    name: '智谱 GLM',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4/',
    models: ['glm-4-plus', 'glm-4-0520', 'glm-4-air', 'glm-4-airx', 'glm-4-flash'],
    doc: 'https://bigmodel.cn/',
    cors: 'allow',
  },
  {
    name: '硅基流动 (SiliconFlow)',
    baseUrl: 'https://api.siliconflow.cn/v1',
    models: [
      'Qwen/Qwen2.5-72B-Instruct',
      'Qwen/Qwen2.5-32B-Instruct',
      'Qwen/Qwen2.5-7B-Instruct',
      'deepseek-ai/DeepSeek-V2.5',
      'THUDM/glm-4-9b-chat',
    ],
    doc: 'https://siliconflow.cn/',
    cors: 'allow',
  },
  {
    name: '通义千问 (DashScope · 兼容模式)',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    models: [
      'qwen-plus',
      'qwen-turbo',
      'qwen-max',
      'qwen-long',
      'qwen2.5-72b-instruct',
      'qwen2.5-32b-instruct',
      'qwen2.5-14b-instruct',
      'qwen2.5-7b-instruct',
    ],
    doc: 'https://help.aliyun.com/zh/model-studio/developer-reference/use-qwen-by-calling-api',
    cors: 'allow',
  },
  {
    name: '百度千帆 (Qianfan · 兼容)',
    baseUrl: 'https://qianfan.baidubce.com/v2',
    models: ['ernie-4.5-8k', 'ernie-4.0-8k', 'ernie-3.5-8k', 'ernie-speed-8k', 'ernie-lite-8k'],
    doc: 'https://cloud.baidu.com/doc/qianfan/s/hlrk4akp7',
    cors: 'partial',
    note: '部分入口限制来源鉴权，浏览器直连可能 403',
  },
  {
    name: '字节豆包 (Volcengine Ark · 兼容)',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    models: ['doubao-1-5-pro-32k-250115', 'doubao-1-5-lite-32k-250115'],
    doc: 'https://www.volcengine.com/docs/82379/1099455',
    cors: 'partial',
    note: '模型名为你在 Ark 控制台创建的"接入点 ID"',
  },
  {
    name: '讯飞星火 (Spark · 兼容)',
    baseUrl: 'https://spark-api-open.xf-yun.com/v1',
    models: ['generalv3.5', 'generalv3', 'pro-128k', 'lite', 'max-32k'],
    doc: 'https://www.xfyun.cn/doc/spark/AI01.html',
    cors: 'partial',
  },
  {
    name: '腾讯混元 (Hunyuan · 兼容)',
    baseUrl: 'https://api.hunyuan.cloud.tencent.com/v1',
    models: ['hunyuan-turbo', 'hunyuan-pro', 'hunyuan-standard', 'hunyuan-longtext'],
    doc: 'https://cloud.tencent.com/document/product/1729',
    cors: 'partial',
  },
  {
    name: 'MiniMax',
    baseUrl: 'https://api.MiniMax.chat/v1',
    models: ['MiniMax-abab6.5s-chat', 'MiniMax-abab6.5-chat'],
    doc: 'https://api.MiniMax.chat/',
    cors: 'allow',
  },

  // ── 中转 / 聚合 ────────────────────────────────────────
  {
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    models: ['openai/gpt-4o-mini', 'anthropic/claude-3.5-sonnet', 'google/gemini-2.0-flash'],
    doc: 'https://openrouter.ai/',
    cors: 'allow',
  },

  // ── 海外（原生协议）────────────────────────────────────
  {
    name: 'Anthropic',
    baseUrl: 'https://api.anthropic.com',
    models: ['claude-3-5-sonnet-latest', 'claude-3-5-haiku-latest', 'claude-3-opus-latest'],
    doc: 'https://docs.anthropic.com/',
    cors: 'allow',
    note: '原生 Messages API（不走 OpenAI 兼容）',
    type: 'anthropic',
  },
  {
    name: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    models: ['gemini-2.0-flash-exp', 'gemini-1.5-pro', 'gemini-1.5-flash'],
    doc: 'https://ai.google.dev/',
    cors: 'allow',
    note: '原生 streamGenerateContent',
    type: 'gemini',
  },

  // ── 本地 ────────────────────────────────────────────
  {
    name: 'Ollama (本地)',
    baseUrl: 'http://localhost:11434/v1',
    models: ['llama3.1', 'qwen2.5'],
    cors: 'allow',
  },
];

export function ProviderManager() {
  const providers = useLiveQuery(() => providerRepo.list(), []);
  const [editing, setEditing] = useState<Provider | null>(null);
  const [showKey, setShowKey] = useState(false);

  const createBlank = () => {
    setEditing({
      id: nanoid(),
      name: '',
      type: 'openai-compatible',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: '',
      models: [],
      enabled: true,
    });
  };

  const applyPreset = (preset: PresetSpec) => {
    setEditing({
      id: nanoid(),
      name: preset.name,
      type: preset.type ?? 'openai-compatible',
      baseUrl: preset.baseUrl,
      apiKey: '',
      models: [...preset.models],
      enabled: true,
    });
  };

  const save = async () => {
    if (!editing) return;
    if (!editing.name.trim() || !editing.baseUrl.trim()) {
      toast.error('名称和 Base URL 不能为空');
      return;
    }
    await providerRepo.upsert(editing);
    setEditing(null);
  };

  const remove = async (id: string) => {
    const ok = await confirmDialog({
      title: '删除 Provider',
      message: '确认删除该 Provider？已有的会话不受影响，但该 Provider 下的模型将不再可选。',
      confirmLabel: '删除',
      danger: true,
    });
    if (!ok) return;
    await providerRepo.delete(id);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-[13px] font-semibold text-ink-900 dark:text-dark-ink">Provider 管理</h4>
        <Button size="sm" variant="primary" onClick={createBlank}>
          <Plus size={13} />
          添加
        </Button>
      </div>

      {/* 预设模板 */}
      <div>
        <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink-400 dark:text-dark-muted">
          快速添加预设
        </div>
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.name}
              onClick={() => applyPreset(p)}
              title={
                p.cors === 'partial'
                  ? `⚠️ ${p.note ?? '浏览器直连可能受限'}`
                  : p.doc
                  ? `${p.baseUrl}\n${p.doc}`
                  : p.baseUrl
              }
              className={clsx(
                'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] transition-colors',
                p.cors === 'partial'
                  ? 'border-amber-400/60 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-500/10'
                  : 'border-surface-border dark:border-dark-border text-ink-700 dark:text-dark-ink hover:bg-ink-50 dark:hover:bg-dark-subtle',
              )}
            >
              {p.cors === 'partial' && <AlertTriangle size={10} />}
              {p.name}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[10.5px] leading-relaxed text-ink-400 dark:text-dark-muted">
          <span className="text-amber-600 dark:text-amber-400 font-medium">⚠️ 黄色</span> 的预设可能存在浏览器直连限制（CORS），
          遇到报错时建议改用支持 CORS 的中转服务（如 OpenRouter）或本地 Ollama。
        </p>
      </div>

      <div className="space-y-1.5">
        {providers?.length === 0 && (
          <div className="rounded-lg border border-dashed border-surface-border dark:border-dark-border px-3 py-6 text-center text-xs text-ink-400 dark:text-dark-muted">
            还没有配置 Provider，点击上方预设快速添加，或手动添加
          </div>
        )}
        {providers?.map((p) => {
          const hasKey = !!p.apiKey;
          const encrypted = isEncryptionEnabled() && hasKey;
          return (
          <div
            key={p.id}
            className="flex items-center justify-between rounded-lg border border-surface-border dark:border-dark-border px-3 py-2 hover:border-ink-300 dark:hover:border-dark-border transition-colors"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-[13px] font-medium text-ink-900 dark:text-dark-ink">{p.name}</span>
                {encrypted && (
                  <span
                    title="API Key 已加密存储"
                    className="inline-flex items-center gap-0.5 rounded-full bg-green-50 dark:bg-green-500/10 px-1.5 py-0 text-[10px] text-green-700 dark:text-green-400"
                  >
                    <Lock size={9} />
                    已加密
                  </span>
                )}
                {!hasKey && (
                  <span className="rounded-full bg-amber-50 dark:bg-amber-500/10 px-1.5 py-0 text-[10px] text-amber-700 dark:text-amber-400">
                    未配置 Key
                  </span>
                )}
              </div>
              <div className="truncate text-[11px] text-ink-400 dark:text-dark-muted font-mono">
                {p.baseUrl} · {p.models.length} 个模型
              </div>
            </div>
            <div className="flex gap-1 shrink-0">
              <Button size="xs" variant="ghost" onClick={() => setEditing(p)}>
                编辑
              </Button>
              <Button size="icon" variant="danger" onClick={() => remove(p.id)}>
                <Trash2 size={12} />
              </Button>
            </div>
          </div>
          );
        })}
      </div>

      {editing && (
        <div className="rounded-lg border border-surface-border dark:border-dark-border p-4 space-y-3 bg-surface-alt dark:bg-dark-subtle/40">
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[11px]">
              <div className="mb-1 font-medium text-ink-500 dark:text-dark-muted">名称</div>
              <Input
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                placeholder="DeepSeek"
              />
            </label>
            <label className="text-[11px]">
              <div className="mb-1 font-medium text-ink-500 dark:text-dark-muted">类型</div>
              <select
                value={editing.type}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    type: e.target.value as Provider['type'],
                  })
                }
                className="w-full h-8 rounded-md bg-white dark:bg-dark-subtle border border-surface-border dark:border-dark-border px-2.5 text-[13px] text-ink-900 dark:text-dark-ink focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
              >
                <option value="openai-compatible">OpenAI 兼容（国内厂商 + OpenRouter 等）</option>
                <option value="anthropic">Anthropic 原生（Claude）</option>
                <option value="gemini">Google Gemini 原生</option>
              </select>
            </label>
          </div>
          <label className="block text-[11px]">
            <div className="mb-1 font-medium text-ink-500 dark:text-dark-muted">Base URL</div>
            <Input
              value={editing.baseUrl}
              onChange={(e) => setEditing({ ...editing, baseUrl: e.target.value })}
              placeholder={
                editing.type === 'anthropic'
                  ? 'https://api.anthropic.com'
                  : editing.type === 'gemini'
                  ? 'https://generativelanguage.googleapis.com/v1beta'
                  : 'https://api.deepseek.com/v1'
              }
            />
          </label>
          <label className="block text-[11px]">
            <div className="mb-1 font-medium text-ink-500 dark:text-dark-muted">API Key</div>
            <div className="relative">
              <Input
                type={showKey ? 'text' : 'password'}
                value={editing.apiKey}
                onChange={(e) => setEditing({ ...editing, apiKey: e.target.value })}
                placeholder="sk-..."
                className="pr-9 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowKey((s) => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-700 dark:hover:text-dark-ink"
                aria-label="切换可见"
              >
                {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </label>
          <label className="block text-[11px]">
            <div className="mb-1 font-medium text-ink-500 dark:text-dark-muted">模型列表（逗号分隔）</div>
            <Input
              value={editing.models.join(',')}
              onChange={(e) =>
                setEditing({
                  ...editing,
                  models: e.target.value
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
              placeholder="deepseek-chat, deepseek-reasoner"
              className="font-mono"
            />
          </label>
          {editing.baseUrl && (
            <div className="flex items-center gap-1 text-[10.5px] text-ink-400 dark:text-dark-muted">
              <span>测试连通性：</span>
              <a
                href={editing.baseUrl.replace(/\/+$/, '') + '/models'}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-0.5 text-accent hover:underline"
              >
                <ExternalLink size={10} />
                {editing.baseUrl.replace(/\/+$/, '') + '/models'}
              </a>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
              取消
            </Button>
            <Button size="sm" variant="primary" onClick={save}>
              <Save size={12} />
              保存
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}