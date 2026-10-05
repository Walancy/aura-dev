import { describe, expect, it } from 'bun:test';
import { buildAiScreenPrompt, extractJson, parseAiScreenResponse, wrapText } from '../src/components/design2/aiScreenFromLlm';

const req = { pageId: 'p1', startX: 100, startY: 200, isDark: true, accentColor: '#0D99FF' };

describe('aiScreenFromLlm', () => {
  it('extrai JSON de resposta com cerca de markdown e texto em volta', () => {
    expect(extractJson('Claro!\n```json\n{"a":1}\n```\nPronto')).toEqual({ a: 1 });
    expect(extractJson('texto {"a":2} fim')).toEqual({ a: 2 });
    expect(extractJson('sem json')).toBeNull();
  });

  it('converte para shapes absolutos dentro de um frame novo', () => {
    const raw = JSON.stringify({ name: 'Login', width: 400, height: 300, background: '#101010', shapes: [
      { type: 'rect', name: 'Card', x: 20, y: 30, width: 200, height: 100, fill: '#222222', cornerRadius: 12 },
      { type: 'text', x: 30, y: 40, width: 100, height: 20, text: 'Olá', fontSize: 18, fill: '#ffffff' },
    ] });
    const res = parseAiScreenResponse(raw, req)!;
    expect(res.shapes[0].type).toBe('frame');
    expect(res.shapes[0]).toMatchObject({ x: 100, y: 200, width: 400, height: 300, fill: '#101010', name: 'Login' });
    const card = res.shapes[1];
    expect(card).toMatchObject({ x: 120, y: 230, parentId: res.mainFrameId, cornerRadius: 12 });
    expect(res.shapes[2]).toMatchObject({ type: 'text', text: 'Olá', fontSize: 18 });
  });

  it('ignora tipos inválidos, sanitiza cores e mantém tudo dentro do frame', () => {
    const raw = JSON.stringify({ width: 400, height: 300, shapes: [
      { type: 'script', x: 0, y: 0 },
      { type: 'rect', x: 900, y: -50, width: 5000, height: 20, fill: 'url(javascript:alert(1))' },
    ] });
    const res = parseAiScreenResponse(raw, req)!;
    expect(res.shapes.length).toBe(2);
    const r = res.shapes[1];
    expect(r.width).toBe(400);
    expect(r.x).toBe(100); // x clampado em 0 relativo
    expect(r.y).toBe(200);
    expect(r.fill).toBe('#E4E4E7'); // cor inválida cai num neutro (não na cor do app)
  });

  it('com targetFrame mantém o frame e gera só o conteúdo', () => {
    const frame: any = { id: 'f', type: 'frame', x: 10, y: 20, width: 300, height: 200, zIndex: 5 };
    const res = parseAiScreenResponse(JSON.stringify({ shapes: [{ type: 'ellipse', x: 5, y: 5, width: 20, height: 20 }] }), { ...req, targetFrame: frame })!;
    expect(res.shapes[0]).toBe(frame);
    expect(res.mainFrameId).toBe('f');
    expect(res.shapes[1]).toMatchObject({ x: 15, y: 25, parentId: 'f' });
  });

  it('retorna null quando não há shapes úteis', () => {
    expect(parseAiScreenResponse('{"shapes":[]}', req)).toBeNull();
    expect(parseAiScreenResponse('nada', req)).toBeNull();
  });

  it('o prompt exige JSON puro e cita o pedido', () => {
    const p = buildAiScreenPrompt({ ...req, prompt: 'tela de login' });
    expect(p).toContain('tela de login');
    expect(p).toContain('SOMENTE com JSON');
  });

  it('quebra texto longo por palavras para caber na largura', () => {
    const t = wrapText('Sua obra sob controle, do projeto à entrega final', 220, 20); // ~20 chars por linha
    expect(t.split('\n').length).toBeGreaterThan(1);
    expect(Math.max(...t.split('\n').map((l) => l.length))).toBeLessThanOrEqual(20);
    expect(wrapText('curto', 400, 16)).toBe('curto');
  });
});
