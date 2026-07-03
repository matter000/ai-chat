import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { conversationRepo, providerRepo } from '@/db';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import type { ModelParams } from '@/types';
import { clsx } from 'clsx';

interface Props {
  conversationId?: string;
  onClose: () => void;
}

export function ConversationParams({ conversationId, onClose }: Props) {
  const conv = useLiveQuery(
    () => (conversationId ? conversationRepo.get(conversationId) : Promise.resolve(undefined)),
    [conversationId],
  );
  const providers = useLiveQuery(() => providerRepo.list(), []);

  const [systemPrompt, setSystemPrompt] = useState('');
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState<number | ''>('');
  const [topP, setTopP] = useState(1);
  const [providerId, setProviderId] = useState('');
  const [model, setModel] = useState('');

  useEffect(() => {
    if (!conv) return;
    setSystemPrompt(conv.systemPrompt || '');
    setTemperature(conv.params.temperature ?? 0.7);
    setMaxTokens(conv.params.max_tokens ?? '');
    setTopP(conv.params.top_p ?? 1);
    setProviderId(conv.providerId || '');
    setModel(conv.model || '');
  }, [conv?.id]);

  const activeProvider = useMemo(
    () => providers?.find((p) => p.id === providerId),
    [providers, providerId],
  );

  useEffect(() => {
    if (!activeProvider) return setModel('');
    if (activeProvider.models.includes(model)) return;
    setModel(activeProvider.models[0] ?? '');
  }, [activeProvider?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!conv) {
    return <div className="text-sm text-ink-400 dark:text-dark-muted">请选择一个会话</div>;
  }

  const save = async () => {
    const params: ModelParams = {
      temperature,
      top_p: topP,
      max_tokens: maxTokens === '' ? undefined : Number(maxTokens),
    };
    await conversationRepo.update(conv.id, {
      systemPrompt: systemPrompt || undefined,
      params,
      providerId: providerId || undefined,
      model: model || undefined,
    });
    onClose();
  };

  return (
    <div className="space-y-5">
      <section>
        <div className="mb-1.5 text-[11px] font-medium text-ink-500 dark:text-dark-muted">Provider</div>
        <select
          value={providerId}
          onChange={(e) => setProviderId(e.target.value)}
          className="w-full h-8 rounded-md bg-white dark:bg-dark-subtle border border-surface-border dark:border-dark-border px-2.5 text-[13px] text-ink-900 dark:text-dark-ink focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-colors"
        >
          <option value="">— 未选择 —</option>
          {providers?.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </section>

      <section>
        <div className="mb-1.5 text-[11px] font-medium text-ink-500 dark:text-dark-muted">模型</div>
        <Input
          list="models-list"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder={activeProvider?.models?.[0] || '输入模型名'}
          className="font-mono"
        />
        <datalist id="models-list">
          {activeProvider?.models?.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
        {activeProvider && activeProvider.models.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {activeProvider.models.map((m) => (
              <button
                key={m}
                onClick={() => setModel(m)}
                className={clsx(
                  'rounded-full border px-2.5 py-0.5 text-[11px] font-mono transition-colors',
                  model === m
                    ? 'border-accent bg-accent-soft dark:bg-accent/15 text-accent-hover dark:text-blue-300'
                    : 'border-surface-border dark:border-dark-border text-ink-700 dark:text-dark-ink hover:bg-ink-50 dark:hover:bg-dark-subtle',
                )}
              >
                {m}
              </button>
            ))}
          </div>
        )}
        {!activeProvider && (
          <div className="mt-1.5 text-[11px] text-amber-600 dark:text-amber-400">
            ⚠️ 请先选择一个 Provider
          </div>
        )}
        {activeProvider && !model && (
          <div className="mt-1.5 text-[11px] text-amber-600 dark:text-amber-400">
            ⚠️ 未选择模型，将无法发送消息
          </div>
        )}
      </section>

      <section>
        <div className="mb-1.5 text-[11px] font-medium text-ink-500 dark:text-dark-muted">
          System Prompt（系统提示词）
        </div>
        <Textarea
          rows={5}
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          placeholder="你是一个有帮助的助手…"
        />
      </section>

      <section className="space-y-3">
        <div>
          <div className="mb-1.5 flex items-center justify-between text-[11px] font-medium text-ink-500 dark:text-dark-muted">
            <span>Temperature</span>
            <span className="font-mono text-ink-700 dark:text-dark-ink">{temperature.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min={0}
            max={2}
            step={0.05}
            value={temperature}
            onChange={(e) => setTemperature(Number(e.target.value))}
            className="w-full accent-accent"
          />
        </div>
        <div>
          <div className="mb-1.5 flex items-center justify-between text-[11px] font-medium text-ink-500 dark:text-dark-muted">
            <span>Top P</span>
            <span className="font-mono text-ink-700 dark:text-dark-ink">{topP.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={topP}
            onChange={(e) => setTopP(Number(e.target.value))}
            className="w-full accent-accent"
          />
        </div>
        <div>
          <div className="mb-1.5 text-[11px] font-medium text-ink-500 dark:text-dark-muted">
            Max Tokens（留空由模型决定）
          </div>
          <Input
            type="number"
            min={1}
            value={maxTokens}
            onChange={(e) => setMaxTokens(e.target.value === '' ? '' : Number(e.target.value))}
          />
        </div>
      </section>

      <div className="flex justify-end gap-2 pt-2">
        <Button size="sm" variant="ghost" onClick={onClose}>
          取消
        </Button>
        <Button size="md" variant="primary" onClick={save}>
          保存
        </Button>
      </div>
    </div>
  );
}