// 把拖拽 / 剪贴板的 raw 文件做"智能采集"：
// - dataTransfer.items（拖拽 + 部分 paste 支持 .getAsFile）
// - dataTransfer.files
// - 支持 directory entry 递归（webkitGetAsEntry）

interface WebkitFileSystemEntry {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
  fullPath?: string;
}

interface WebkitFileSystemFileEntry extends WebkitFileSystemEntry {
  isFile: true;
  file: (cb: (f: File) => void, err?: (e: any) => void) => void;
}

interface WebkitFileSystemDirectoryEntry extends WebkitFileSystemEntry {
  isDirectory: true;
  createReader: () => {
    readEntries: (
      cb: (entries: WebkitFileSystemEntry[]) => void,
      err?: (e: any) => void,
    ) => void;
  };
}

export interface IntakeProgress {
  /** 当前已枚举到的"可接收"文件数 */
  count: number;
  /** 已扫描到的目录数（用于 UI 提示） */
  dirs: number;
  /** 是否仍在枚举 */
  loading: boolean;
}

// 与 image.ts 中的 MAX_INTAKE_FILES 配合：intake 多接一些但 picker 再截到 5，
// 这样大型目录（>5）也能完整看到计数；picker 自身负责发出"已达上限"提示。
export const MAX_INTAKE_FILES = 200;
const MAX_DEPTH = 5;
const MAX_FILE_BYTES = 32 * 1024 * 1024;
const ACCEPT_DIR = /\.(txt|md|markdown|json|ya?ml|toml|csv|tsv|log|env|ini|conf|html?|css|scss|less|js|jsx|ts|tsx|vue|svelte|py|pyi|rb|rs|go|java|kt|swift|c|h|cc|cpp|hpp|cs|php|sh|bash|zsh|sql|yaml|xml|tex|org|mdx|mmd|ino|dart|lua|pl|r|jl|ex|exs|clj|cljs|edn|scala|groovy|tf|dockerfile|gitignore|gitattributes|editorconfig|properties|gradle|cmake|asm|s|asmx|pdf|png|jpe?g|webp|gif)$/i;

type OnProgress = (p: IntakeProgress) => void;

/** 遍历一个 entry（文件 / 目录），最多到 MAX_DEPTH。收集所有可接收的 File。 */
async function walkEntry(
  entry: WebkitFileSystemEntry,
  out: File[],
  depth: number,
  state: IntakeProgress,
  report: OnProgress,
): Promise<void> {
  if (out.length >= MAX_INTAKE_FILES) return;
  if (entry.isFile) {
    const e = entry as WebkitFileSystemFileEntry;
    await new Promise<void>((resolve) => {
      e.file(
        (f) => {
          // 超过单文件大小的直接跳
          if (f.size > MAX_FILE_BYTES) {
            resolve();
            return;
          }
          if (out.length < MAX_INTAKE_FILES) {
            out.push(f);
            state.count = out.length;
            report({ ...state });
          }
          resolve();
        },
        () => resolve(),
      );
    });
    return;
  }
  if (entry.isDirectory) {
    if (depth >= MAX_DEPTH) return;
    state.dirs += 1;
    report({ ...state });
    const d = entry as WebkitFileSystemDirectoryEntry;
    const reader = d.createReader();
    // readEntries 是分批的，必须循环到空
    while (out.length < MAX_INTAKE_FILES) {
      const entries: WebkitFileSystemEntry[] = await new Promise((resolve, reject) =>
        reader.readEntries(resolve, reject),
      );
      if (!entries.length) break;
      // 注意：浏览器对 readEntries 单次只返回约 100 条，要循环到空
      for (const sub of entries) {
        if (out.length >= MAX_INTAKE_FILES) break;
        await walkEntry(sub, out, depth + 1, state, report);
      }
      if (entries.length < 100) break; // 本批已被耗尽
    }
  }
}

/** 从 DataTransfer 里枚举出所有 File（递归目录）。 */
export async function intakeFromDataTransfer(
  dt: DataTransfer,
  onProgress?: OnProgress,
): Promise<File[]> {
  const out: File[] = [];
  const state: IntakeProgress = { count: 0, dirs: 0, loading: true };
  if (onProgress) onProgress({ ...state });

  const items = dt.items;
  if (items && items.length) {
    const tasks: Promise<void>[] = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.kind !== 'file') continue;
      // 浏览器支持的 entry API（仅 webkit/Chromium/Safari）
      const anyItem = it as unknown as { webkitGetAsEntry?: () => WebkitFileSystemEntry };
      const entry = anyItem.webkitGetAsEntry?.();
      if (entry) {
        tasks.push(walkEntry(entry, out, 0, state, onProgress ?? (() => {})));
      } else {
        // 退化：直接取文件
        const f = it.getAsFile();
        if (f && f.size <= MAX_FILE_BYTES && out.length < MAX_INTAKE_FILES) {
          out.push(f);
          state.count = out.length;
          if (onProgress) onProgress({ ...state });
        }
      }
    }
    await Promise.all(tasks);
  } else if (dt.files) {
    // 更老的接口
    for (let i = 0; i < dt.files.length; i++) {
      const f = dt.files[i];
      if (f && f.size <= MAX_FILE_BYTES && out.length < MAX_INTAKE_FILES) {
        out.push(f);
      }
    }
    state.count = out.length;
    if (onProgress) onProgress({ ...state });
  }

  state.loading = false;
  if (onProgress) onProgress({ ...state });
  return out;
}
