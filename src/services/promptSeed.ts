import type { PromptTemplate } from '@/types';
import type Dexie from 'dexie';

const NOW = 1700000000000; // 固定时间戳，方便首次注入幂等

const BUILTINS: PromptTemplate[] = [
  {
    id: 'builtin-translate',
    command: 'translate',
    title: '翻译助手',
    description: '翻译一段文本为指定语言（默认中↔英）',
    category: '翻译',
    content:
      '请把下面的文本翻译为 {{lang|中文}}，保留原意、风格与专有名词，必要时给出脚注说明：\n\n{{input}}',
    builtin: true,
    enabled: true,
    createdAt: NOW,
  },
  {
    id: 'builtin-explain',
    command: 'explain',
    title: '通俗解释',
    description: '用简单语言解释一个概念',
    category: '通用',
    content:
      '请用通俗易懂的方式解释下面的内容，目标读者是一个非专业但好奇的人：\n\n{{input}}',
    builtin: true,
    enabled: true,
    createdAt: NOW + 1,
  },
  {
    id: 'builtin-summarize',
    command: 'summarize',
    title: '总结要点',
    description: '提炼一段文字的要点',
    category: '写作',
    content:
      '请把下面的文字提炼成 5 条以内的要点，使用编号列表保留关键信息：\n\n{{input}}',
    builtin: true,
    enabled: true,
    createdAt: NOW + 2,
  },
  {
    id: 'builtin-code-review',
    command: 'code-review',
    title: '代码评审',
    description: '评审一段代码，给出改进建议',
    category: '编程',
    content:
      '请对下面这段代码进行严格评审，关注正确性、可读性、性能、安全性，输出 3-5 条具体建议：\n\n```\n{{input}}\n```',
    builtin: true,
    enabled: true,
    createdAt: NOW + 3,
  },
  {
    id: 'builtin-explain-code',
    command: 'explain-code',
    title: '解释代码',
    description: '逐段解释一段代码',
    category: '编程',
    content:
      '请按顺序逐段解释下面代码做了什么，重点解释关键算法 / 不易理解的部分：\n\n```\n{{input}}\n```',
    builtin: true,
    enabled: true,
    createdAt: NOW + 4,
  },
  {
    id: 'builtin-debug',
    command: 'debug',
    title: '调试助手',
    description: '帮排查代码 Bug',
    category: '编程',
    content:
      '我遇到了下面的 Bug，请帮我分析可能的原因并给出修复方案。请先复述我对问题的描述，再列出最可能的 3 个根因：\n\n{{input}}',
    builtin: true,
    enabled: true,
    createdAt: NOW + 5,
  },
  {
    id: 'builtin-unit-test',
    command: 'unit-test',
    title: '生成单测',
    description: '为函数生成单元测试',
    category: '编程',
    content:
      '请为下面这段代码生成单元测试，覆盖正常路径、边界、异常情况，使用常见测试框架（pytest / vitest / jest 任选合适的）：\n\n```\n{{input}}\n```',
    builtin: true,
    enabled: true,
    createdAt: NOW + 6,
  },
  {
    id: 'builtin-commit',
    command: 'commit',
    title: '生成 Commit',
    description: '根据 diff 生成 commit message',
    category: '编程',
    content:
      '下面的代码改动（diff / 摘要）请生成一个符合 Conventional Commits 规范的 git commit message，中文即可：\n\n{{input}}',
    builtin: true,
    enabled: true,
    createdAt: NOW + 7,
  },
  {
    id: 'builtin-polish',
    command: 'polish',
    title: '润色文字',
    description: '改写润色一段文字',
    category: '写作',
    content:
      '请润色下面的文字，使表达更流畅、简洁、专业，但保留原意与个人语气：\n\n{{input}}',
    builtin: true,
    enabled: true,
    createdAt: NOW + 8,
  },
  {
    id: 'builtin-tutor',
    command: 'tutor',
    title: '严谨导师',
    description: '让 AI 扮演严谨的研究导师',
    category: '角色',
    content:
      '请你扮演一位严谨但不刻板的研究导师，循循善诱、引用证据、先承认不确定性再回答：\n\n{{input}}',
    builtin: true,
    enabled: true,
    createdAt: NOW + 9,
  },
];

/**
 * 首次启动时把内置模板写入数据库（仅当 id 不存在时）。
 * 用 db.version 升级时也可以跑一次。
 */
export async function seedBuiltinPrompts(db: Dexie) {
  const table = (db as any).promptTemplates;
  if (!table) return;
  for (const t of BUILTINS) {
    const existing = await table.get(t.id);
    if (!existing) await table.put(t);
  }
}