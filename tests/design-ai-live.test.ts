import { test, expect } from 'bun:test';
import { AiJsonStream } from '../src/components/design2/aiJsonStream';
import { fitText, wrapLines } from '../src/components/design2/textFit';
import { ScreenBuilder, parseAiScreenResponse, buildAiScreenPrompt } from '../src/components/design2/aiScreenFromLlm';
import { buildDevice, DEVICE_PRESETS } from '../src/components/design2/devices';
import { referenceHints } from '../src/components/design2/designReferences';
import icons from '../src/components/design2/materialIcons.json';

const cat = icons as Record<string, string>;
const req = { pageId: 'p', startX: 0, startY: 0, isDark: false, accentColor: '#EA1D2C', icons: cat };

test('stream emite tela e itens em pedaços', () => {
  const json = '```json\n{"screens":[{"name":"Home","width":393,"height":852,"background":"#fff","shapes":[{"type":"rect","x":1,"y":2,"width":3,"height":4},{"type":"text","text":"a {b} \\"c\\"","x":0,"y":0}]},{"name":"B","width":393,"height":852,"shapes":[{"type":"ellipse"}]}]}\n```';
  const s = new AiJsonStream();
  const ev: any[] = [];
  for (let i = 0; i < json.length; i += 7) ev.push(...s.push(json.slice(i, i + 7)));
  expect(ev.map((e) => e.kind)).toEqual(['screen', 'item', 'item', 'screen', 'item']);
  expect(ev[0].header.name).toBe('Home');
  expect(ev[2].item.text).toBe('a {b} "c"');
  expect(ev[3].header.width).toBe(393);
});

test('stream de tela única e item ainda incompleto não emite', () => {
  const s = new AiJsonStream();
  expect(s.push('Claro! {"name":"X","width":390,"height":844,"shapes":[{"type":"rect","x":1').map((e) => e.kind)).toEqual(['screen']);
  expect(s.push(',"y":2}').map((e) => e.kind)).toEqual(['item']);
});

test('fitText: uma linha, reduz fonte, quebra e corta', () => {
  const one = fitText({ text: 'Agendar horário', width: 80, fontSize: 16, maxWidth: 300, maxHeight: 40, singleLine: true });
  expect(one.lines).toBe(1);
  const shrunk = fitText({ text: 'Confirmar agendamento', width: 100, fontSize: 18, maxWidth: 100, maxHeight: 24, singleLine: true });
  expect(shrunk.lines).toBe(1);
  expect(shrunk.fontSize).toBeLessThan(18);
  const wrapped = fitText({ text: 'Um texto bem longo que precisa quebrar em várias linhas dentro do card', width: 120, fontSize: 14, maxWidth: 120, maxHeight: 200, singleLine: false });
  expect(wrapped.lines).toBeGreaterThan(1);
  const cut = fitText({ text: 'Um texto bem longo que precisa quebrar em várias linhas dentro do card e não cabe', width: 80, fontSize: 14, maxWidth: 80, maxHeight: 30, singleLine: false });
  expect(cut.text.endsWith('…')).toBe(true);
  expect(wrapLines('a b c', 1000, 14, 400)).toEqual(['a b c']);
});

test('texto fica dentro do card e mobile ganha aparelho', () => {
  const b = new ScreenBuilder(req);
  const frame = b.startScreen({ name: 'Home', width: 393, height: 852 });
  expect(frame.length).toBeGreaterThan(12); // corpo + moldura + tela + botões + ilha + câmera + sensores + status + home
  const screen = frame.find((s) => s.name === 'Tela')!;
  expect(screen.cornerRadius).toBe(55);
  expect(screen.parentId).toBe(frame[0].id);
  expect(frame.some((s) => s.name === 'Câmera frontal')).toBe(true);
  expect(frame.some((s) => s.name === 'Botão lateral')).toBe(true);
  b.addItem({ type: 'rect', x: 16, y: 100, width: 200, height: 80, fill: '#eee' });
  const t = b.addItem({ type: 'text', text: 'Studio de beleza premium Bela Vista', x: 24, y: 110, width: 300, height: 20, fontSize: 18 })!;
  expect(t.parentId).toBe(screen.id);
  expect(t.x + t.width).toBeLessThanOrEqual(screen.x + 16 + 200 + 0.5); // não passa da borda do card
  const desktop = new ScreenBuilder(req).startScreen({ name: 'D', width: 1440, height: 900 });
  expect(desktop).toHaveLength(1);
});

test('imagens pendentes e várias telas lado a lado', () => {
  const raw = JSON.stringify({ screens: [{ name: 'A', width: 393, height: 852, shapes: [{ type: 'image', query: 'portrait', x: 10, y: 100, width: 64, height: 64, cornerRadius: 32 }] }, { name: 'B', width: 393, height: 852, shapes: [{ type: 'rect', width: 10, height: 10 }] }] });
  const r = parseAiScreenResponse(raw, req)!;
  expect(r.pending).toHaveLength(1);
  expect(r.pending[0].query).toBe('portrait');
  expect(r.shapes.filter((s) => s.type === 'frame' && !s.parentId)).toHaveLength(2);
  const img = r.shapes.find((s) => s.type === 'image')!;
  expect(img.cornerRadius).toBe(32);
});

test('referências e prompt', () => {
  expect(referenceHints('crie um app no estilo do iFood')).toContain('EA1D2C');
  expect(referenceHints('algo qualquer')).toBe('');
  const p = buildAiScreenPrompt({ prompt: 'app como o ifood', pageId: 'p', startX: 0, startY: 0, accentColor: '#f90', isDark: false, canReadProject: true });
  expect(p).toContain('LEITURA');
  expect(p).toContain('Padrões conhecidos');
});

test('presets de dispositivos', () => {
  const gen = () => { let n = 0; return () => `i${++n}`; };
  const iphone = DEVICE_PRESETS.find((d) => d.id === 'iphone-15-pro')!;
  const d = buildDevice(iphone, { idGen: gen(), pageId: 'p', x: 0, y: 0, z: 10, isDark: false, icons: cat });
  expect(d.shapes[0].id).toBe(d.rootId);
  expect(d.rootWidth).toBe(393 + 28);
  expect(d.shapes.some((s) => s.name === 'Dynamic Island')).toBe(true);
  expect(d.shapes.some((s) => s.name === 'Sensor Face ID')).toBe(true);
  expect(d.shapes.find((s) => s.id === d.screenId)!.x).toBe(14);
  // cada tipo de aparelho tem seus detalhes
  const names = (id: string) => buildDevice(DEVICE_PRESETS.find((p) => p.id === id)!, { idGen: gen(), pageId: 'p', x: 0, y: 0, z: 10, isDark: false, icons: cat }).shapes.map((s) => s.name);
  expect(names('iphone-se')).toContain('Botão Home');
  expect(names('pixel-8')).toContain('Anel da câmera');
  expect(names('iphone-14')).toContain('Notch');
  expect(names('ipad-pro-11')).toContain('Botão superior');
  expect(names('macbook-pro-14')).toContain('Base');
  const plain = buildDevice(DEVICE_PRESETS.find((p) => p.id === 'desktop')!, { idGen: () => 'x', pageId: 'p', x: 0, y: 0, z: 1, isDark: false });
  expect(plain.shapes).toHaveLength(1);
  expect(plain.rootId).toBe(plain.screenId);
});

test('tema vem do fundo escolhido pela IA, não do app', () => {
  const dark = new ScreenBuilder({ ...req, isDark: false });
  dark.startScreen({ width: 393, height: 852, background: '#0B0B0F' });
  expect(dark.addItem({ type: 'text', text: 'Oi', x: 20, y: 80, width: 100, height: 20 })!.fill).toBe('#FFFFFF');
  const light = new ScreenBuilder({ ...req, isDark: true });
  light.startScreen({ width: 393, height: 852, background: '#FFF7F0' });
  expect(light.addItem({ type: 'text', text: 'Oi', x: 20, y: 80, width: 100, height: 20 })!.fill).toBe('#0F172A');
  expect(light.addItem({ type: 'rect', x: 0, y: 0, width: 50, height: 50 })!.fill).not.toBe('#EA1D2C');
  expect(buildAiScreenPrompt({ prompt: 'x', pageId: 'p', startX: 0, startY: 0, accentColor: '#FF00AA', isDark: true })).not.toContain('#FF00AA');
});

test('imagens de referência e fluxo com N telas no prompt', () => {
  const p = buildAiScreenPrompt({ prompt: 'fluxo de agendamento', pageId: 'p', startX: 0, startY: 0, accentColor: '#f90', isDark: false, referenceImages: ['/tmp/devflow-pasted-images/a.jpg'] });
  expect(p).toContain('IMAGENS DE REFERÊNCIA');
  expect(p).toContain('/tmp/devflow-pasted-images/a.jpg');
  expect(p).toContain('VOCÊ decide a quantidade');
  expect(buildAiScreenPrompt({ prompt: 'x', pageId: 'p', startX: 0, startY: 0, accentColor: '#f90', isDark: false })).not.toContain('IMAGENS DE REFERÊNCIA ANEXADAS');
  // 12 telas cabem
  const raw = JSON.stringify({ screens: Array.from({ length: 12 }, (_, i) => ({ name: `T${i}`, width: 393, height: 852, shapes: [{ type: 'rect', width: 10, height: 10 }] })) });
  const r = parseAiScreenResponse(raw, req)!;
  expect(r.shapes.filter((s) => s.type === 'frame' && !s.parentId)).toHaveLength(12);
});

test('IA com auto layout: frames aninhados, hug e fill', () => {
  const raw = JSON.stringify({
    name: 'Home', width: 393, height: 852, background: '#FFFFFF',
    shapes: [
      { type: 'frame', id: 'raiz', name: 'Conteúdo', layout: 'vertical', gap: 16, padding: [54, 16, 34, 16], x: 0, y: 0, width: 393, height: 852 },
      { type: 'frame', id: 'card', parent: 'raiz', name: 'Card', layout: 'horizontal', gap: 12, padding: 12, align: 'left', width: 'fill', height: 'hug', fill: '#F4F4F5', cornerRadius: 16 },
      { type: 'image', parent: 'card', name: 'Foto', query: 'salon', width: 64, height: 64, cornerRadius: 12 },
      { type: 'frame', id: 'col', parent: 'card', name: 'Textos', layout: 'vertical', gap: 4, width: 'fill', height: 'hug' },
      { type: 'text', parent: 'col', name: 'Título', text: 'Studio Lumina Concept Beauty & Spa Premium', width: 'fill', fontSize: 16, fontWeight: 600 },
      { type: 'text', parent: 'col', name: 'Local', text: 'Jardins', width: 'hug', fontSize: 13 },
      { type: 'frame', id: 'card2', parent: 'raiz', name: 'Card 2', layout: 'horizontal', gap: 8, padding: 12, width: 'fill', height: 'hug', fill: '#EEE' },
      { type: 'text', parent: 'card2', name: 'T2', text: 'Segundo', width: 'hug', fontSize: 14 },
    ],
  });
  const r = parseAiScreenResponse(raw, req)!;
  const by = (n: string) => r.shapes.find((s) => s.name === n)!;
  const screen = r.shapes.find((s) => s.name === 'Tela')!;
  const raiz = by('Conteúdo');
  const card = by('Card');
  const card2 = by('Card 2');
  expect(raiz.hasAutoLayout).toBe(true);
  expect(card.parentId).toBe(raiz.id);
  // largura "fill": ocupa a tela menos o padding do raiz (16 + 16)
  expect(card.width).toBe(393 - 32);
  expect(card.x).toBe(screen.x + 16);
  expect(card.y).toBe(screen.y + 54);
  // altura "hug": cresce com a coluna de textos (título quebra em mais de uma linha)
  const title = by('Título');
  expect(title.text!.includes('\n')).toBe(true);
  expect(card.height).toBeGreaterThanOrEqual(64 + 24); // foto 64 + padding 24
  // segundo card vem abaixo do primeiro com gap 16
  expect(card2.y).toBe(card.y + card.height + 16);
  // texto "fill" cabe dentro da coluna, que cabe dentro do card
  const col = by('Textos');
  expect(title.x + title.width).toBeLessThanOrEqual(col.x + col.width + 0.5);
  expect(col.x + col.width).toBeLessThanOrEqual(card.x + card.width - 12 + 0.5);
  // texto "hug" tem largura do conteúdo
  expect(by('Local').width).toBeLessThan(100);
  expect(by('T2').x).toBe(card2.x + 12);
});
