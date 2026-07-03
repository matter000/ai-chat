// 附件管理：图片 / 文本 / PDF
// 所有原始数据只在浏览器内存存在，发送后立刻 dispose，IndexedDB 不留 base64

import type { AttachmentMeta } from '@/types';

export type AttachmentKind = 'image' | 'text' | 'pdf';

export interface Attachment {
  id: string;
  kind: AttachmentKind;
  file: File;           // 仅内存
  previewUrl?: string;  // 图片才有
  name: string;
  mime: string;
  size: number;
  // 运行时填充（发送前）
  dataUrl?: string;
  textContent?: string; // 文本附件读取后的内容
  meta: AttachmentMeta;
}

const MAX_SINGLE = 8 * 1024 * 1024;     // 单文件 8MB
export const MAX_TOTAL_FILES = 5;         // 单次最多 5 个附件（用户允许超过）
const MAX_TEXT_INLINE = 64 * 1024;       // 文本内联限制 64KB

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];
const TEXT_EXT = /\.(txt|md|markdown|json|ya?ml|toml|csv|tsv|log|env|ini|conf|html?|css|scss|less|js|jsx|ts|tsx|vue|svelte|py|pyi|rb|rs|go|java|kt|swift|c|h|cc|cpp|hpp|cs|php|sh|bash|zsh|sql|yaml|xml|tex|org|mdx|mmd|ino|dart|lua|pl|r|jl|ex|exs|clj|cljs|edn|scala|groovy|tf|dockerfile|gitignore|gitattributes|editorconfig|properties|gradle|cmake|asm|s|asmx)$/i;

function tooBig(name: string, size: number): boolean {
  if (size > MAX_SINGLE) {
    alert(`文件 ${name} 超过 8MB，已跳过`);
    return true;
  }
  return false;
}

export async function pickAttachments(files: FileList | File[]): Promise<Attachment[]> {
  const out: Attachment[] = [];
  for (const f of Array.from(files)) {
    if (out.length >= MAX_TOTAL_FILES) {
      alert(`一次最多上传 ${MAX_TOTAL_FILES} 个文件`);
      break;
    }
    if (tooBig(f.name, f.size)) continue;

    if (IMAGE_TYPES.includes(f.type)) {
      out.push(makeImageAttachment(f));
    } else if (f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')) {
      out.push(makePdfAttachment(f));
    } else if (f.type.startsWith('text/') || TEXT_EXT.test(f.name)) {
      out.push(await makeTextAttachment(f));
    } else {
      alert(`不支持的文件类型：${f.name}（仅支持 图片 / PDF / 常见文本 / 代码）`);
    }
  }
  return out;
}

function makeImageAttachment(f: File): Attachment {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    kind: 'image',
    file: f,
    previewUrl: URL.createObjectURL(f),
    name: f.name,
    mime: f.type,
    size: f.size,
    meta: { id: '', name: f.name, kind: 'image', size: f.size, mime: f.type },
  };
}

function makePdfAttachment(f: File): Attachment {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    kind: 'pdf',
    file: f,
    name: f.name,
    mime: 'application/pdf',
    size: f.size,
    meta: { id: '', name: f.name, kind: 'pdf', size: f.size, mime: 'application/pdf' },
  };
}

async function makeTextAttachment(f: File): Promise<Attachment> {
  const text = await f.text();
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    kind: 'text',
    file: f,
    name: f.name,
    mime: f.type || 'text/plain',
    size: f.size,
    textContent: text.length > MAX_TEXT_INLINE ? text.slice(0, MAX_TEXT_INLINE) : text,
    meta: { id: '', name: f.name, kind: 'text', size: f.size, mime: f.type || 'text/plain' },
  };
}

export function disposeAttachments(arr: Attachment[]) {
  for (const a of arr) {
    if (a.previewUrl) {
      try {
        URL.revokeObjectURL(a.previewUrl);
      } catch { /* ignore */ }
    }
  }
}

export function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

/** 上传前填充 dataUrl（PDF 和图片需要） */
export async function prepareAttachments(arr: Attachment[]): Promise<Attachment[]> {
  return Promise.all(
    arr.map(async (a) => {
      if (a.kind === 'image' || a.kind === 'pdf') {
        return { ...a, dataUrl: await readAsDataUrl(a.file) };
      }
      return a;
    }),
  );
}

export function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}