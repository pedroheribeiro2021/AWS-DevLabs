import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

const components: Components = {
  h1: (props) => <h1 className="mt-6 text-xl font-bold text-slate-900 first:mt-0" {...props} />,
  h2: (props) => <h2 className="mt-6 text-lg font-semibold text-slate-800 first:mt-0" {...props} />,
  h3: (props) => <h3 className="mt-4 text-base font-semibold text-slate-800 first:mt-0" {...props} />,
  p: (props) => <p className="mt-3 leading-relaxed text-slate-700 first:mt-0" {...props} />,
  ul: (props) => <ul className="mt-3 list-disc space-y-1 pl-5 text-slate-700" {...props} />,
  ol: (props) => <ol className="mt-3 list-decimal space-y-1 pl-5 text-slate-700" {...props} />,
  li: (props) => <li className="leading-relaxed" {...props} />,
  strong: (props) => <strong className="font-semibold text-slate-900" {...props} />,
  a: (props) => (
    <a className="text-orange-600 hover:underline" target="_blank" rel="noopener noreferrer" {...props} />
  ),
  blockquote: (props) => (
    <blockquote className="mt-3 border-l-4 border-slate-200 pl-4 text-slate-600 italic" {...props} />
  ),
  pre: (props) => (
    <pre className="mt-3 overflow-x-auto rounded-md bg-slate-900 p-3 text-xs text-slate-100" {...props} />
  ),
  hr: (props) => <hr className="mt-6 border-slate-200" {...props} />,
};

interface MarkdownContentProps {
  content: string;
}

export function MarkdownContent({ content }: MarkdownContentProps) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {content}
    </ReactMarkdown>
  );
}
