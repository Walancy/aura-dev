import type { Shape } from './types';

/** Rótulos em português que o usuário pode digitar para buscar por tipo */
const TYPE_ALIASES: Record<string, string[]> = {
  frame: ['frame', 'quadro'],
  group: ['group', 'grupo'],
  rect: ['rect', 'retângulo', 'retangulo'],
  ellipse: ['ellipse', 'elipse', 'círculo', 'circulo'],
  text: ['text', 'texto'],
  image: ['image', 'imagem'],
  icon: ['icon', 'ícone', 'icone'],
  line: ['line', 'linha'],
  pen: ['pen', 'caneta', 'vetor'],
  polygon: ['polygon', 'polígono', 'poligono'],
  star: ['star', 'estrela'],
  section: ['section', 'seção', 'secao'],
};

const fillOf = (s: Shape) => ((s.fills?.find((f: any) => f.visible !== false && f.type === 'solid') as any)?.color || s.fill || '').toLowerCase();

/** Camadas que combinam com a busca: nome, tipo (em pt ou en) ou cor (#hex). Vazio = todas. */
export function filterLayers(shapes: Shape[], query: string): Shape[] {
  const q = query.trim().toLowerCase();
  if (!q) return shapes;
  // status de entrega para desenvolvimento
  if (q === 'pronto' || q === 'ready') return shapes.filter((s) => s.devStatus === 'ready');
  if (q === 'implementado' || q === 'done') return shapes.filter((s) => s.devStatus === 'done');
  return shapes.filter((s) => {
    if ((s.name || '').toLowerCase().includes(q)) return true;
    if (q.startsWith('#')) return fillOf(s).startsWith(q);
    if (s.type === 'text' && (s.text || '').toLowerCase().includes(q)) return true;
    return (TYPE_ALIASES[s.type] || [s.type]).some((a) => a === q || (q.length >= 3 && a.startsWith(q)));
  });
}
