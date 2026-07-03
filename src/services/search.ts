// 全局搜索服务：跨所有会话的消息正文搜索
import { db } from '@/db';
import type { Conversation, Message } from '@/types';

export interface SearchHit {
  conversation: Conversation;
  message: Message;
  /** 高亮片段：包含命中前后约 40 个字符 */
  snippet: string;
}

const SNIPPET_RADIUS = 40;
const MAX_RESULTS = 50;

/**
 * 在所有会话的消息正文里搜索。
 * - 不区分大小写
 * - 多关键词按空格分隔后 AND 匹配
 * - 返回按 updatedAt 倒序的会话分组（每组按 createdAt 倒序）
 */
export async function globalSearch(query: string): Promise<SearchHit[]> {
  const q = query.trim();
  if (!q) return [];

  const keywords = q.split(/\s+/).filter(Boolean);
  if (keywords.length === 0) return [];

  const messages = await db.messages.toArray();
  const conversations = await db.conversations.toArray();
  const byId = new Map(conversations.map((c) => [c.id, c]));

  // 1) 预过滤
  const lower = (s: string) => s.toLowerCase();
  const hits: { msg: Message; conv: Conversation; score: number }[] = [];
  for (const m of messages) {
    if (!m.content) continue;
    const text = lower(m.content);
    if (!keywords.every((k) => text.includes(lower(k)))) continue;
    // 计算一个简单 score：出现的总次数 + 越靠前权重越高
    let score = 0;
    let firstIdx = -1;
    for (const k of keywords) {
      const idx = text.indexOf(lower(k));
      if (idx >= 0) {
        score += (text.match(new RegExp(lower(k).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
        if (firstIdx < 0 || idx < firstIdx) firstIdx = idx;
      }
    }
    if (firstIdx >= 0) score += Math.max(0, 100 - firstIdx); // 命中靠前的分高
    const conv = byId.get(m.conversationId);
    if (!conv) continue;
    hits.push({ msg: m, conv, score });
    if (hits.length >= MAX_RESULTS * 4) break;
  }

  // 2) 排序：会话 updatedAt 倒序；组内消息 createdAt 倒序；score 次之
  hits.sort((a, b) => {
    const cUpd = b.conv.updatedAt - a.conv.updatedAt;
    if (cUpd !== 0) return cUpd;
    const mUpd = b.msg.createdAt - a.msg.createdAt;
    if (mUpd !== 0) return mUpd;
    return b.score - a.score;
  });

  // 3) 截断 + 构造 snippet
  const out: SearchHit[] = [];
  for (const h of hits) {
    out.push({ conversation: h.conv, message: h.msg, snippet: makeSnippet(h.msg.content, q) });
    if (out.length >= MAX_RESULTS) break;
  }
  return out;
}

function makeSnippet(content: string, query: string): string {
  const kw = query.split(/\s+/)[0] || query;
  const lower = content.toLowerCase();
  const idx = lower.indexOf(kw.toLowerCase());
  if (idx < 0) return content.slice(0, SNIPPET_RADIUS * 2) + (content.length > SNIPPET_RADIUS * 2 ? '…' : '');
  const start = Math.max(0, idx - SNIPPET_RADIUS);
  const end = Math.min(content.length, idx + kw.length + SNIPPET_RADIUS);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < content.length ? '…' : '';
  return prefix + content.slice(start, end) + suffix;
}

/** 给定 keyword 列表对 snippet 做高亮（<mark>） */
export function highlightSnippet(snippet: string, query: string): string {
  const kws = query.split(/\s+/).filter(Boolean);
  if (kws.length === 0) return snippet;
  const escaped = kws.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  try {
    return snippet.replace(new RegExp(`(${escaped})`, 'gi'), '<mark>$1</mark>');
  } catch {
    return snippet;
  }
}