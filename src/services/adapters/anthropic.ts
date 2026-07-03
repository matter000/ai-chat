import type { ChatRequestParams, ChatResult } from '@/types';

// Anthropic 原生 Adapter（Messages API + SSE）
// 参考：https://docs.anthropic.com/claude/reference/messages-streaming

type ACMessage = { role: 'user' | 'assistant'; content: string | ACBlock[] };
type ACBlock = { type: 'text'; text: string } | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } };

function normalizeBaseUrl(url: string) {
  return url.replace(/\/+$/, '');
}

export async function chatAnthropic(params: ChatRequestParams): Promise<ChatResult> {
  const { provider, model, messages, systemPrompt, params: mp, signal, onDelta } = params;
  const url = `${normalizeBaseUrl(provider.baseUrl)}/v1/messages`;

  // 构造 Anthropic messages
  const acMessages: ACMessage[] = messages.map((m) => {
    if (typeof m.content === 'string') {
      return { role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content };
    }
    // 多模态
    const blocks: ACBlock[] = [];
    for (const part of m.content) {
      if (part.type === 'text') blocks.push({ type: 'text', text: part.text });
      else if (part.type === 'image_url') {
        // part.image_url.url = "data:image/png;base64,XXX"
        const url = part.image_url.url;
        const m1 = /^data:([^;]+);base64,(.*)$/.exec(url);
        if (!m1) continue;
        blocks.push({
          type: 'image',
          source: { type: 'base64', media_type: m1[1], data: m1[2] },
        });
      }
    }
    return {
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: blocks,
    };
  });

  const body: Record<string, unknown> = {
    model,
    messages: acMessages,
    max_tokens: mp.max_tokens ?? 4096,
    stream: true,
  };
  if (systemPrompt) body.system = systemPrompt;
  if (mp.temperature !== undefined) body.temperature = mp.temperature;
  if (mp.top_p !== undefined) body.top_p = mp.top_p;

  const res = await fetch(url, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': provider.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok || !res.body) {
    let detail = '';
    try { detail = await res.text(); } catch { /* ignore */ }
    throw new Error(`请求失败 ${res.status}: ${detail || res.statusText}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let full = '';

  while (true) {
    if (signal?.aborted) break;
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE 多行事件：以空行分隔
    const events = buffer.split('\n\n');
    buffer = events.pop() ?? '';

    for (const evt of events) {
      // event: 消息块 + 多行 data
      const lines = evt.split('\n');
      let data = '';
      for (const line of lines) {
        if (line.startsWith('data:')) data += line.slice(5).trim();
      }
      if (!data) continue;
      try {
        const json = JSON.parse(data);
        // 只关心 content_block_delta 增量
        if (json.type === 'content_block_delta') {
          const text = json.delta?.text;
          if (typeof text === 'string' && text.length) {
            full += text;
            onDelta(text);
          }
        }
      } catch {
        /* ignore */
      }
    }
  }

  return { content: full };
}