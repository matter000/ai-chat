// 累计 Token 用量统计（按模型分别统计），存 localStorage
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ModelUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  calls: number;
  lastUsed: number;
}

export interface UsageState {
  byModel: Record<string, ModelUsage>;
  total: ModelUsage;
  record: (model: string, prompt: number, completion: number) => void;
  reset: () => void;
}

function emptyUsage(): ModelUsage {
  return { promptTokens: 0, completionTokens: 0, totalTokens: 0, calls: 0, lastUsed: 0 };
}

export const useUsageStore = create<UsageState>()(
  persist(
    (set) => ({
      byModel: {},
      total: emptyUsage(),
      record: (model, promptTokens, completionTokens) => {
        const total = promptTokens + completionTokens;
        set((s) => {
          const prev = s.byModel[model] ?? emptyUsage();
          const next: ModelUsage = {
            promptTokens: prev.promptTokens + promptTokens,
            completionTokens: prev.completionTokens + completionTokens,
            totalTokens: prev.totalTokens + total,
            calls: prev.calls + 1,
            lastUsed: Date.now(),
          };
          const tp = s.total.promptTokens + promptTokens;
          const tc = s.total.completionTokens + completionTokens;
          return {
            byModel: { ...s.byModel, [model]: next },
            total: { ...s.total, promptTokens: tp, completionTokens: tc, totalTokens: tp + tc, calls: s.total.calls + 1, lastUsed: Date.now() },
          };
        });
      },
      reset: () => set({ byModel: {}, total: emptyUsage() }),
    }),
    { name: 'ai-chat-usage' },
  ),
);

// 估算费用（USD，1k token 单价，可手动改）
export const PRICING: Record<string, { input: number; output: number }> = {
  // OpenAI
  'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
  'gpt-4o': { input: 0.0025, output: 0.01 },
  'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
  // Anthropic
  'claude-3-5-sonnet-latest': { input: 0.003, output: 0.015 },
  'claude-3-5-haiku-latest': { input: 0.0008, output: 0.004 },
  // Google
  'gemini-1.5-flash': { input: 0.000075, output: 0.0003 },
  'gemini-1.5-pro': { input: 0.00125, output: 0.005 },
  // DeepSeek
  'deepseek-chat': { input: 0.00014, output: 0.00028 },
  'deepseek-reasoner': { input: 0.00055, output: 0.00219 },
  // 默认（猜一个保守值）
  default: { input: 0.001, output: 0.003 },
};

export function estimateCost(model: string, prompt: number, completion: number): number {
  const p = PRICING[model] ?? PRICING.default;
  return (prompt / 1000) * p.input + (completion / 1000) * p.output;
}

export function formatTokens(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return (n / 1000).toFixed(1) + 'K';
  return (n / 1_000_000).toFixed(2) + 'M';
}

export function formatCost(usd: number): string {
  if (usd < 0.01) return '$' + usd.toFixed(4);
  return '$' + usd.toFixed(2);
}
