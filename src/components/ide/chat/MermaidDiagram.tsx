import React, { useEffect, useState } from 'react';

let seq = 0;

export const MermaidDiagram: React.FC<{ code: string; isEffectiveDark: boolean }> = ({ code, isEffectiveDark }) => {
  const [svg, setSvg] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    import('mermaid')
      .then(async ({ default: mermaid }) => {
        mermaid.initialize({ startOnLoad: false, theme: isEffectiveDark ? 'dark' : 'default', securityLevel: 'strict' });
        const { svg } = await mermaid.render(`mermaid-${++seq}`, code);
        if (!cancelled) setSvg(svg);
      })
      .catch((e) => !cancelled && setError(String(e?.message || e)));
    return () => {
      cancelled = true;
    };
  }, [code, isEffectiveDark]);

  if (error) return <pre style={{ margin: 0, fontSize: 12, color: '#ef4444', whiteSpace: 'pre-wrap' }}>{`Mermaid inválido: ${error}\n\n${code}`}</pre>;
  return <div style={{ overflowX: 'auto', padding: 8 }} dangerouslySetInnerHTML={{ __html: svg }} />;
};
