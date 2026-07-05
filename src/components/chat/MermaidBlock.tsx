import { useEffect, useState } from 'react';
import DOMPurify from 'dompurify';
import { clsx } from 'clsx';

// 懒加载 mermaid：仅在实际渲染图表时才下载 (~2MB)
let mermaidModule: typeof import('mermaid') | null = null;

async function getMermaid() {
  if (!mermaidModule) {
    mermaidModule = await import('mermaid');
    mermaidModule.default.initialize({
      startOnLoad: false,
      theme: 'default',
      securityLevel: 'sandbox',
      fontFamily: 'inherit',
    });
  }
  return mermaidModule.default;
}

interface Props {
  chart: string;
}

export function MermaidBlock({ chart }: Props) {
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const m = await getMermaid();
        if (cancelled) return;
        const id = `mermaid-${Math.random().toString(36).slice(2, 9)}`;
        const { svg: result } = await m.render(id, chart);
        if (!cancelled) {
          setSvg(result);
          setError(null);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || '图表渲染失败');
          setSvg(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [chart]);

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-500/30 dark:bg-red-500/10 p-3 my-2">
        <div className="text-[11px] font-medium text-red-600 dark:text-red-400 mb-1">
          ⚠️ Mermaid 渲染失败
        </div>
        <pre className="text-[11px] text-red-500 dark:text-red-300 whitespace-pre-wrap">
          {error}
        </pre>
      </div>
    );
  }

  if (!svg) {
    return (
      <div className="rounded-lg border border-surface-border dark:border-dark-border bg-ink-50 dark:bg-dark-subtle p-4 my-2 text-center text-xs text-ink-400">
        图表渲染中…
      </div>
    );
  }

  return (
    <div
      className={clsx(
        'rounded-lg border border-surface-border dark:border-dark-border bg-white dark:bg-dark-subtle p-4 my-2 overflow-x-auto',
      )}
      dangerouslySetInnerHTML={{
        __html: DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true, svgFilters: true } }),
      }}
    />
  );
}
