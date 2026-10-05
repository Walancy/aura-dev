export type AiStreamEvent = { kind: 'screen'; header: Record<string, any> } | { kind: 'item'; item: any };

/**
 * Lê o JSON da IA enquanto ele chega: emite o cabeçalho de cada tela quando começa o array "shapes"
 * e cada elemento assim que o objeto fecha. Texto antes do primeiro "{" (prosa, ```json) é ignorado.
 */
export class AiJsonStream {
  private text = '';
  private pos = 0;
  private inStr = false;
  private esc = false;
  private started = false;
  private stack: { ch: '{' | '['; start: number; shapes: boolean }[] = [];
  /** quantos caracteres já foram consumidos (para completar com a resposta final) */
  get consumed() { return this.text.length; }

  push(chunk: string): AiStreamEvent[] {
    this.text += chunk;
    const out: AiStreamEvent[] = [];
    for (; this.pos < this.text.length; this.pos++) {
      const c = this.text[this.pos];
      if (!this.started) {
        if (c !== '{') continue;
        this.started = true;
      }
      if (this.inStr) {
        if (this.esc) this.esc = false;
        else if (c === '\\') this.esc = true;
        else if (c === '"') this.inStr = false;
        continue;
      }
      if (c === '"') { this.inStr = true; continue; }
      if (c === '{' || c === '[') {
        const entry = { ch: c as '{' | '[', start: this.pos, shapes: false };
        if (c === '[') {
          const before = this.text.slice(Math.max(0, this.pos - 24), this.pos);
          const m = /"shapes"\s*:\s*$/.exec(before);
          const owner = this.stack[this.stack.length - 1];
          if (m && owner?.ch === '{') {
            entry.shapes = true;
            const keyIdx = this.pos - (before.length - m.index);
            let header: Record<string, any> = {};
            try { header = JSON.parse(this.text.slice(owner.start, keyIdx).replace(/,\s*$/, '') + '}'); } catch {}
            out.push({ kind: 'screen', header });
          }
        }
        this.stack.push(entry);
        continue;
      }
      if (c === '}' || c === ']') {
        const e = this.stack.pop();
        if (e && c === '}' && this.stack[this.stack.length - 1]?.shapes) {
          try { out.push({ kind: 'item', item: JSON.parse(this.text.slice(e.start, this.pos + 1)) }); } catch {}
        }
      }
    }
    return out;
  }
}
