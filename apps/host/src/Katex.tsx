import katex from 'katex';
import 'katex/dist/katex.min.css';

/** Renderiza uma fórmula LaTeX (modo display) com KaTeX. */
export function Katex({ tex }: { tex: string }) {
  const html = katex.renderToString(tex, { displayMode: true, throwOnError: false, errorColor: '#dc2626' });
  return <div className="text-3xl text-slate-800" dangerouslySetInnerHTML={{ __html: html }} />;
}
