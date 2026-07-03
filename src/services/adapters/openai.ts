import type { ChatRequestParams, ChatResult } from '@/types';

// OpenAI 兼容协议 Adapter
// 适用于 OpenAI 本身以及大多数国内外厂商（DeepSeek、Moonshot、硅基流动、本地 Ollama 等）

function normalizeBaseUrl(url: string) {
  return url.replace(/\/+$/, '');
}

export async function chatOpenAICompatible(params: ChatRequestParams): Promise<ChatResult> {
  const { provider, model, messages, systemPrompt, params: mp, signal, onDelta } = params;
  const url = `${normalizeBaseUrl(provider.baseUrl)}/chat/completions`;

  // 对多模态 content，PDF/图片走 image_url；文本块直接传
  const normalizedMessages = messages.map((m) => {
    if (typeof m.content === 'string') return { role: m.role, content: m.content };
    return { role: m.role, content: m.content };
  });

  const body: Record<string, unknown> = {
    model,
    messages: [
      ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
      ...normalizedMessages,
    ],
    stream: true,
  };
  if (mp.temperature !== undefined) body.temperature = mp.temperature;
  if (mp.top_p !== undefined) body.top_p = mp.top_p;
  if (mp.max_tokens !== undefined) body.max_tokens = mp.max_tokens;
  if (mp.presence_penalty !== undefined) body.presence_penalty = mp.presence_penalty;
  if (mp.frequency_penalty !== undefined) body.frequency_penalty = mp.frequency_penalty;

  const res = await fetch(url, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${provider.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok || !res.body) {
    let detail = '';
    try {
      detail = await res.text();
    } catch {
      /* ignore */
    }
    throw new Error(`请求失败 ${res.status}: ${detail || res.statusText}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let full = '';
  let promptTokens: number | undefined;
  let completionTokens: number | undefined;

  while (true) {
    if (signal?.aborted) break;
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // 按 SSE 事件行分割
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const raw of lines) {
      const line = raw.trim();
      if (!line || !line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (data === '[DONE]') continue;
      try {
        const json = JSON.parse(data);
        const delta = json?.choices?.[0]?.delta?.content;
        if (typeof delta === 'string' && delta.length) {
          full += delta;
          onDelta(delta);
        }
        // 部分厂商在最后一个 chunk 返回 usage
        if (json?.usage) {
          promptTokens = json.usage.prompt_tokens;
          completionTokens = json.usage.completion_tokens;
        }
      } catch {
        // 忽略非 JSON 行
      }
    }
  }

  const tokens =
    promptTokens !== undefined && completionTokens !== undefined
      ? {
          prompt: promptTokens,
          completion: completionTokens,
          total: promptTokens + completionTokens,
        }
      : undefined;

  return { content: full, tokens };
}