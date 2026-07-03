import type { Conversation, Message } from '@/types';
import { conversationRepo, messageRepo } from '@/db';

export async function exportConversationAsMarkdown(conversationId: string): Promise<string> {
  const conv = await conversationRepo.get(conversationId);
  if (!conv) throw new Error('未找到会话');

  const messages = await messageRepo.listByConversation(conversationId);
  if (!messages.length) throw new Error('会话无消息');

  const dateStr = conv.createdAt
    ? new Date(conv.createdAt).toLocaleString('zh-CN')
    : '未知时间';
  const lines: string[] = [];

  lines.push(`# ${conv.title || '新会话'}`);
  lines.push('');
  lines.push(`> 导出时间：${new Date().toLocaleString('zh-CN')}`);
  lines.push(`> 创建时间：${dateStr}`);
  if (conv.model) lines.push(`> 模型：${conv.model}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  for (const m of messages) {
    const role = m.role === 'user' ? '### 👤 你' : '### 🤖 AI';
    lines.push(role);
    lines.push('');
    if (m.hasAttachments && m.attachments?.length) {
      lines.push(
        `> 📎 附件：${m.attachments.map((a) => `\`${a.name}\` (${a.kind})`).join('、')}`,
      );
      lines.push('');
    }
    lines.push(m.content);
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  return lines.join('\n');
}

export function downloadMarkdown(content: string, filename: string) {
  const url = URL.createObjectURL(
    new Blob([content], { type: 'text/markdown;charset=utf-8' }),
  );
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
  } finally {
    URL.revokeObjectURL(url);
  }
}