/** Trecho de texto com estilo próprio (intervalo [start, end) sobre o campo `text`). */
export interface TextRun {
  start: number;
  end: number;
  fontWeight?: number | string;
  fontStyle?: 'normal' | 'italic';
  textDecoration?: 'none' | 'underline' | 'line-through';
  fill?: string;
  fontSize?: number;
  href?: string;
}

export type RunStyle = Omit<TextRun, 'start' | 'end'>;

const STYLE_KEYS: Array<keyof RunStyle> = ['fontWeight', 'fontStyle', 'textDecoration', 'fill', 'fontSize', 'href'];

const sameStyle = (a: RunStyle, b: RunStyle) => STYLE_KEYS.every((k) => a[k] === b[k]);
const hasStyle = (r: RunStyle) => STYLE_KEYS.some((k) => r[k] !== undefined);
const styleOf = (r: TextRun): RunStyle => {
  const out: RunStyle = {};
  for (const k of STYLE_KEYS) if (r[k] !== undefined) (out as Record<string, unknown>)[k] = r[k];
  return out;
};

/** Ordena, remove vazios/sem estilo e junta trechos vizinhos com o mesmo estilo. */
export function normalizeRuns(runs: TextRun[] | undefined, length = Infinity): TextRun[] {
  const list = (runs || [])
    .map((r) => ({ ...r, start: Math.max(0, r.start), end: Math.min(length, r.end) }))
    .filter((r) => r.end > r.start && hasStyle(r))
    .sort((a, b) => a.start - b.start);
  const out: TextRun[] = [];
  for (const r of list) {
    const last = out[out.length - 1];
    if (last && last.end === r.start && sameStyle(styleOf(last), styleOf(r))) last.end = r.end;
    else out.push({ ...r });
  }
  return out;
}

/** Estilo efetivo em cada posição do intervalo, com o `patch` por cima (undefined remove a propriedade). */
export function applyRunStyle(runs: TextRun[] | undefined, start: number, end: number, patch: Partial<RunStyle>, length = Infinity): TextRun[] {
  if (end <= start) return normalizeRuns(runs, length);
  const cuts = new Set<number>([start, end]);
  (runs || []).forEach((r) => {
    if (r.start > start && r.start < end) cuts.add(r.start);
    if (r.end > start && r.end < end) cuts.add(r.end);
  });
  const points = [...cuts].sort((a, b) => a - b);
  const inside: TextRun[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const base = (runs || []).find((r) => r.start <= a && r.end >= b);
    const merged: Record<string, unknown> = { ...(base ? styleOf(base) : {}) };
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) delete merged[k];
      else merged[k] = v;
    }
    inside.push({ start: a, end: b, ...(merged as RunStyle) });
  }
  // fora do intervalo: mantém as partes dos trechos existentes que sobram
  const outside: TextRun[] = [];
  (runs || []).forEach((r) => {
    if (r.start < start) outside.push({ ...r, end: Math.min(r.end, start) });
    if (r.end > end) outside.push({ ...r, start: Math.max(r.start, end) });
  });
  return normalizeRuns([...outside, ...inside], length);
}

/** Alterna uma propriedade booleana (negrito, itálico, sublinhado…): se todo o intervalo já tem o valor, remove; senão aplica. */
export function toggleRunStyle(runs: TextRun[] | undefined, start: number, end: number, key: 'fontWeight' | 'fontStyle' | 'textDecoration', on: RunStyle[typeof key], length = Infinity): TextRun[] {
  const covered = isFullyStyled(runs, start, end, key, on);
  return applyRunStyle(runs, start, end, { [key]: covered ? undefined : on } as Partial<RunStyle>, length);
}

export function isFullyStyled(runs: TextRun[] | undefined, start: number, end: number, key: keyof RunStyle, value: unknown): boolean {
  if (end <= start) return false;
  let pos = start;
  for (const r of normalizeRuns(runs)) {
    if (r.end <= pos) continue;
    if (r.start > pos || r[key] !== value) return false;
    pos = r.end;
    if (pos >= end) return true;
  }
  return pos >= end;
}

/** Reposiciona os trechos depois de uma edição do texto (prefixo/sufixo em comum; o miolo trocado perde o estilo). */
export function adjustRuns(runs: TextRun[] | undefined, oldText: string, newText: string): TextRun[] {
  if (!runs?.length || oldText === newText) return normalizeRuns(runs, newText.length);
  let p = 0;
  while (p < oldText.length && p < newText.length && oldText[p] === newText[p]) p++;
  let s = 0;
  while (s < oldText.length - p && s < newText.length - p && oldText[oldText.length - 1 - s] === newText[newText.length - 1 - s]) s++;
  const oldEnd = oldText.length - s; // fim do trecho removido
  const delta = newText.length - oldText.length;
  const out: TextRun[] = [];
  for (const r of runs) {
    const a = r.start < p ? r.start : r.start >= oldEnd ? r.start + delta : p; // início dentro do trecho trocado vai para o começo dele
    const b = r.end <= p ? r.end : r.end >= oldEnd ? r.end + delta : p + (newText.length - p - s);
    // texto digitado no meio de um trecho (inserção) herda o estilo dele
    if (r.start < p && r.end > oldEnd - 0 && oldEnd === p) out.push({ ...r, start: r.start, end: r.end + delta });
    else out.push({ ...r, start: a, end: Math.max(a, b) });
  }
  return normalizeRuns(out, newText.length);
}

export interface Segment {
  text: string;
  style: RunStyle;
}

/** Divide o texto em linhas e cada linha em segmentos de mesmo estilo (para desenhar com tspans). */
export function lineSegments(text: string, runs: TextRun[] | undefined): Segment[][] {
  const norm = normalizeRuns(runs, text.length);
  const lines: Segment[][] = [];
  let offset = 0;
  for (const line of text.split('\n')) {
    const segs: Segment[] = [];
    let pos = offset;
    const lineEnd = offset + line.length;
    const push = (a: number, b: number, style: RunStyle) => {
      if (b > a) segs.push({ text: text.slice(a, b), style });
    };
    for (const r of norm) {
      if (r.end <= pos || r.start >= lineEnd) continue;
      push(pos, Math.max(pos, r.start), {});
      const a = Math.max(pos, r.start);
      const b = Math.min(lineEnd, r.end);
      push(a, b, styleOf(r));
      pos = b;
    }
    push(pos, lineEnd, {});
    lines.push(segs.length ? segs : [{ text: '', style: {} }]);
    offset = lineEnd + 1; // + o \n
  }
  return lines;
}
