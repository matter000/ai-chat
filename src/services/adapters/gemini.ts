import type { ChatRequestParams, ChatResult } from '@/types';

// Google Gemini 原生 Adapter（streamGenerateContent）
// 注意：响应**不是 SSE**，是一连串 `[ {json},{json},...,{...最后一个含 reason? 标记} ]`
// 这里按流式读取逐个解析 chunk，把每个 text 增量通过 onDelta 回调出去。
// 参考：https://ai.google.dev/api/generate-content

type GeminiPart = { text: string } | { inline_data: { mime_type: string; data: string } };
type GeminiContent = { role: 'user' | 'model'; parts: GeminiPart[] };

function normalizeBaseUrl(url: string) {
  return url.replace(/\/+$/, '');
}

export async function chatGemini(params: ChatRequestParams): Promise<ChatResult> {
  const { provider, model, messages, systemPrompt, params: mp, signal, onDelta } = params;
  // 默认 base URL = https://generativelanguage.googleapis.com/v1beta
  const base = normalizeBaseUrl(provider.baseUrl) || 'https://generativelanguage.googleapis.com/v1beta';
  const url = `${base}/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(provider.apiKey)}`;

  // 构造 Gemini contents
  const contents: GeminiContent[] = messages.map((m) => {
    const role: 'user' | 'model' = m.role === 'assistant' ? 'model' : 'user';
    if (typeof m.content === 'string') {
      return { role, parts: [{ text: m.content }] };
    }
    const parts: GeminiPart[] = [];
    for (const part of m.content) {
      if (part.type === 'text') parts.push({ text: part.text });
      else if (part.type === 'image_url') {
        const m1 = /^data:([^;]+);base64,(.*)$/.exec(part.image_url.url);
        if (m1) {
          parts.push({ inline_data: { mime_type: m1[1], data: m1[2] } });
        }
      }
    }
    return { role, parts };
  });

  const generationConfig: Record<string, unknown> = {};
  if (mp.temperature !== undefined) generationConfig.temperature = mp.temperature;
  if (mp.top_p !== undefined) generationConfig.top_p = mp.top_p;
  if (mp.max_tokens !== undefined) generationConfig.maxOutputTokens = mp.max_tokens;

  const body: Record<string, unknown> = {
    contents,
    generationConfig,
  };
  if (systemPrompt) {
    body.systemInstruction = { role: 'system', parts: [{ text: systemPrompt }] };
  }

  // 用 SSE 模式（alt=sse）让响应像 Anthropic 那样走事件分隔，方便按行解析
  const res = await fetch(url, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
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

    // 用空行分隔 SSE 事件
    const events = buffer.split('\n\n');
    buffer = events.pop() ?? '';

    for (const evt of events) {
      const lines = evt.split('\n');
      let data = '';
      for (const line of lines) {
        if (line.startsWith('data:')) data += line.slice(5).trim();
      }
      if (!data) continue;
      if (data === '[DONE]') continue;
      try {
        const json = JSON.parse(data);
        const parts = json?.candidates?.[0]?.content?.parts;
        if (Array.isArray(parts)) {
          for (const part of parts) {
            if (typeof part.text === 'string' && part.text.length) {
              full += part.text;
              onDelta(part.text);
            }
          }
        }
      } catch {
        /* ignore */
      }
    }
  }

  return { content: full };
}