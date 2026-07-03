import type { ChatRequestParams, ChatResult, Provider } from '@/types';
import { chatOpenAICompatible } from './openai';
import { chatAnthropic } from './anthropic';
import { chatGemini } from './gemini';

export async function dispatchChat(
  provider: Provider,
  params: Omit<ChatRequestParams, 'provider'>,
): Promise<ChatResult> {
  switch (provider.type) {
    case 'openai-compatible':
      return chatOpenAICompatible({ ...params, provider });
    case 'anthropic':
      return chatAnthropic({ ...params, provider });
    case 'gemini':
      return chatGemini({ ...params, provider });
    default:
      throw new Error(`未实现的 Adapter 类型：${provider.type}`);
  }
}