import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeHighlight from 'rehype-highlight';
import rehypeKatex from 'rehype-katex';
import { Copy, Check } from 'lucide-react';
import { useState } from 'react';
import { clsx } from 'clsx';
import { MermaidBlock } from './MermaidBlock';

interface Props {
  content: string;
  streaming?: boolean;
}

function CodeBlock({ className, children }: { className?: string; children?: React.ReactNode }) {
  const [copied, setCopied] = useState(false);
  const text = String(children ?? '').replace(/\n$/, '');
  const lang = /language-(\w+)/.exec(className || '')?.[1];

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  return (
    <pre>
      <div className="absolute top-2 left-3 right-12 flex items-center justify-between pointer-events-none">
        {lang && (
          <span className="text-[10px] uppercase tracking-wider text-ink-400 dark:text-dark-muted font-mono">
            {lang}
          </span>
        )}
      </div>
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 rounded p-1.5 bg-white/80 dark:bg-dark-subtle/80 text-ink-500 dark:text-dark-muted hover:text-ink-900 dark:hover:text-dark-ink opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm border border-surface-border dark:border-dark-border"
        aria-label="复制代码"
      >
        {copied ? <Check size={12} /> : <Copy size={12} />}
      </button>
      <code className={className}>{children}</code>
    </pre>
  );
}

export function MarkdownView({ content, streaming }: Props) {
  return (
    <div className={clsx('md group', streaming && 'streaming-cursor')}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeHighlight, rehypeKatex]}
        components={{
          pre: ({ children }) => <>{children}</>,
          code({ className, children, ...rest }) {
            const hasLanguage = className && /language-/.test(className);
            const lang = /language-(\w+)/.exec(className || '')?.[1];
            const isInline = !hasLanguage;
            if (isInline) {
              return (
                <code className={className} {...rest}>
                  {children}
                </code>
              );
            }
            // Mermaid 图表
            if (lang === 'mermaid') {
              const chartSrc = String(children || '').replace(/\n$/, '');
              return <MermaidBlock chart={chartSrc} />;
            }
            return <CodeBlock className={className}>{children}</CodeBlock>;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}