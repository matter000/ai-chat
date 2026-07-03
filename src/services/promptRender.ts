/**
 * 展开 Prompt 模板里的变量：
 *   {{input}}                - 用户已有输入（已输入的文字）
 *   {{input}} / {{input|default}} 也可带默认值
 *   {{date}} {{time}}        - 当前日期时间
 *   {{lang}} / {{lang|中文}}   - 语言
 *   {{selection}}             - 暂未实现（占位）
 */
export function renderPrompt(template: string, input = ''): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

  return template
    .replace(/\{\{\s*input(?:\s*\|\s*([^}]*))?\s*\}\}/g, (_, def) => input || (def ? def.trim() : ''))
    .replace(/\{\{\s*date\s*\}\}/g, dateStr)
    .replace(/\{\{\s*time\s*\}\}/g, timeStr)
    .replace(/\{\{\s*lang(?:\s*\|\s*([^}]*))?\s*\}\}/g, (_, def) => (def ? def.trim() : '中文'))
    .replace(/\{\{\s*selection(?:\s*\|\s*([^}]*))?\s*\}\}/g, (_, def) => def ? def.trim() : '');
}