import { useEffect, useState } from 'react';

/** Mantém o elemento montado durante a animação de saída: `shown` anima, `mounted` decide se renderiza. */
export function usePresence(open: boolean, ms = 220) {
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(open);
  useEffect(() => {
    if (open) {
      setMounted(true);
      const r = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
      return () => cancelAnimationFrame(r);
    }
    setShown(false);
    const t = setTimeout(() => setMounted(false), ms);
    return () => clearTimeout(t);
  }, [open, ms]);
  return { mounted, shown };
}
