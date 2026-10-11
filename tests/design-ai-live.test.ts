import { test, expect } from 'bun:test';
import { AiJsonStream } from '../src/components/design2/aiJsonStream';
import { fitText, wrapLines } from '../src/components/design2/textFit';
import { ScreenBuilder, parseAiScreenResponse, buildAiScreenPrompt, isVaguePrompt } from '../src/components/design2/aiScreenFromLlm';
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
  expect(card.y).toBe(screen.y + 56); // 54 vira 56 na grade de 4px
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

test('pin: navbar fica colada na base da tela, mesmo com o conteúdo "hug" e crescendo', () => {
  const tab = (i: number) => [
    { type: 'frame', id: `a${i}`, parent: 'nav', name: `Aba ${i}`, layout: 'vertical', gap: 4, align: 'top-center', width: 'fill', height: 'hug' },
    { type: 'icon', parent: `a${i}`, name: 'Home', size: 24, fill: '#7C3AED' },
    { type: 'text', parent: `a${i}`, text: `Aba ${i}`, width: 'hug', fontSize: 11 },
  ];
  const raw = JSON.stringify({ name: 'Início', width: 393, height: 852, background: '#FFFFFF', shapes: [
    { type: 'frame', id: 'raiz', name: 'Conteúdo', layout: 'vertical', gap: 12, padding: [60, 16, 16, 16], x: 0, y: 0, width: 393, height: 852 },
    { type: 'text', parent: 'raiz', text: 'Título', width: 'fill', fontSize: 24 },
    { type: 'frame', id: 'card', parent: 'raiz', name: 'Card', layout: 'vertical', padding: 12, width: 'fill', height: 'hug', fill: '#EEE' },
    { type: 'text', parent: 'card', text: 'conteúdo curto', width: 'fill', fontSize: 14 },
    // a barra é declarada DENTRO do layout vertical, mas com pin ela sai do fluxo
    { type: 'frame', id: 'nav', parent: 'raiz', name: 'Navbar', pin: 'bottom', layout: 'horizontal', padding: [10, 8, 34, 8], width: 'fill', height: 'hug', fill: '#FFFFFF' },
    ...tab(1), ...tab(2), ...tab(3),
  ] });
  const r = parseAiScreenResponse(raw, req)!;
  const by = (n: string) => r.shapes.find((s) => s.name === n)!;
  const screen = r.shapes.find((s) => s.name === 'Tela')!;
  const nav = by('Navbar');
  expect(nav.parentId).toBe(screen.id); // saiu do fluxo do layout
  expect(nav.y + nav.height).toBe(screen.y + screen.height); // colada na base
  expect(nav.width).toBe(393);
  // abas dividem a largura e ficam dentro da barra
  const tabs = [by('Aba 1'), by('Aba 2'), by('Aba 3')];
  expect(tabs.every((t) => t.parentId === nav.id)).toBe(true);
  expect(tabs[0].width).toBeCloseTo((393 - 16) / 3, 0);
  for (const t of tabs) {
    expect(t.y).toBeGreaterThanOrEqual(nav.y + 10 - 0.5);
    expect(t.y + t.height).toBeLessThanOrEqual(nav.y + nav.height - 34 + 0.5);
  }
  // o conteúdo continua no topo, sem ser empurrado pela barra
  expect(by('Card').y).toBeLessThan(nav.y);
  expect(by('Card').y).toBeLessThan(screen.y + 200);
  // ícone e rótulo da aba dentro da aba
  expect(r.shapes.find((s) => s.parentId === by('Aba 1').id && s.type === 'text')!.y).toBeGreaterThan(by('Aba 1').y);
});

test('rede de segurança: navbar sem "pin" dentro do layout principal também fica na base', () => {
  const raw = JSON.stringify({ name: 'Início', width: 393, height: 852, background: '#FFFFFF', shapes: [
    { type: 'frame', id: 'raiz', name: 'Conteúdo', layout: 'vertical', gap: 12, padding: [60, 16, 16, 16], x: 0, y: 0, width: 393, height: 852 },
    { type: 'frame', id: 'card', parent: 'raiz', name: 'Card', layout: 'vertical', padding: 12, width: 'fill', height: 'hug', fill: '#EEE' },
    { type: 'text', parent: 'card', text: 'curto', width: 'fill', fontSize: 14 },
    { type: 'frame', id: 'nav', parent: 'raiz', name: 'Barra de Navegação', layout: 'horizontal', padding: [10, 8, 34, 8], width: 'fill', height: 'hug', fill: '#FFF' },
    { type: 'text', parent: 'nav', text: 'Início', width: 'fill', fontSize: 11 },
  ] });
  const r = parseAiScreenResponse(raw, req)!;
  const screen = r.shapes.find((s) => s.name === 'Tela')!;
  const nav = r.shapes.find((s) => s.name === 'Barra de Navegação')!;
  expect(nav.y + nav.height).toBe(screen.y + screen.height);
  // uma barra lateral/outro frame horizontal comum NÃO é fixado
  const other = JSON.stringify({ name: 'X', width: 393, height: 852, shapes: [
    { type: 'frame', id: 'raiz', name: 'Conteúdo', layout: 'vertical', width: 393, height: 852, x: 0, y: 0 },
    { type: 'frame', id: 'linha', parent: 'raiz', name: 'Linha de chips', layout: 'horizontal', width: 'fill', height: 'hug' },
    { type: 'text', parent: 'linha', text: 'a', width: 'hug', fontSize: 12 },
  ] });
  const r2 = parseAiScreenResponse(other, req)!;
  const s2 = r2.shapes.find((s) => s.name === 'Tela')!;
  const linha = r2.shapes.find((s) => s.name === 'Linha de chips')!;
  expect(linha.y).toBe(s2.y); // topo, no fluxo
});

test('robustez: frame sem layout com filhos sem x/y vira fluxo vertical (sem empilhar no canto)', () => {
  const raw = JSON.stringify({ name: 'Fluxo', width: 393, height: 852, background: '#0B1220', shapes: [
    { type: 'frame', id: 'raiz', name: 'Conteúdo', layout: 'vertical', gap: 16, padding: [60, 16, 16, 16], width: 393, height: 852, x: 0, y: 0 },
    // o card ESQUECEU o layout e os filhos não têm x/y
    { type: 'frame', id: 'card', parent: 'raiz', name: 'Card Saldo', width: 'fill', height: 'hug', padding: 16, fill: '#1B2335', cornerRadius: 16 },
    { type: 'text', parent: 'card', name: 'Rótulo', text: 'Saldo Operacional Disponível', width: 'fill', fontSize: 14 },
    { type: 'text', parent: 'card', name: 'Valor', text: 'R$ 148.520,00', width: 'fill', fontSize: 36, fontWeight: 700 },
    { type: 'frame', id: 'badge', parent: 'card', name: 'Badge', layout: 'horizontal', padding: [6, 14, 6, 14], width: 'hug', height: 'hug', fill: '#1F4D3A', cornerRadius: 20 },
    { type: 'text', parent: 'badge', name: 'Badge texto', text: '+14,2% mês', width: 'hug', fontSize: 13 },
    // pai com id errado: não pode ir para o canto da tela
    { type: 'text', parent: 'cartao-inexistente', name: 'Órfão', text: 'Texto solto', width: 'hug', fontSize: 12 },
  ] });
  const r = parseAiScreenResponse(raw, req)!;
  const by = (n: string) => r.shapes.find((s) => s.name === n)!;
  const card = by('Card Saldo');
  expect(card.hasAutoLayout).toBe(true);
  expect(card.layoutFlow).toBe('vertical');
  const label = by('Rótulo');
  const valor = by('Valor');
  const badge = by('Badge');
  // empilhados em ordem, sem sobreposição
  expect(label.y + label.height).toBeLessThanOrEqual(valor.y + 0.5);
  expect(valor.y + valor.height).toBeLessThanOrEqual(badge.y + 0.5);
  // valor monetário em uma linha só
  expect(valor.text).toBe('R$ 148.520,00');
  expect(valor.height).toBe(45); // 36 * 1.25
  // badge "hug": largura do conteúdo, não da tela
  expect(badge.width).toBeLessThan(150);
  // o card envolve todo o conteúdo (hug)
  expect(card.y + card.height).toBeGreaterThanOrEqual(badge.y + badge.height);
  // o órfão não foi parar no canto superior esquerdo da tela
  const screen = r.shapes.find((s) => s.name === 'Tela')!;
  const orf = by('Órfão');
  expect(orf.x === screen.x && orf.y === screen.y).toBe(false);
});

test('robustez: botões de ícone "fill" ao lado do título viram hug; padding de frame sem layout é mantido', () => {
  const F = (id: string, parent: string, name: string, o: any) => ({ type: 'frame', id, parent, name, ...o });
  const raw = JSON.stringify({ name: 'H', width: 393, height: 852, background: '#0B1220', shapes: [
    F('raiz', 'root', 'Conteúdo', { layout: 'vertical', gap: 16, padding: [60, 16, 16, 16], width: 393, height: 852, x: 0, y: 0 }),
    F('hdr', 'raiz', 'Cabeçalho', { layout: 'horizontal', gap: 8, padding: 8, width: 'fill', height: 'hug', fill: '#1E293B' }),
    { type: 'text', parent: 'hdr', name: 'Título', text: 'Geral', width: 'fill', fontSize: 16 },
    F('b1', 'hdr', 'Busca', { layout: 'horizontal', align: 'center', padding: 8, width: 'fill', height: 'hug', fill: '#273449' }),
    { type: 'icon', parent: 'b1', name: 'Search', size: 22, fill: '#CBD5E1' },
    F('b2', 'hdr', 'Filtro', { layout: 'horizontal', align: 'center', padding: 8, width: 'fill', height: 'hug', fill: '#273449' }),
    { type: 'icon', parent: 'b2', name: 'FilterList', size: 22, fill: '#CBD5E1' },
    F('card', 'raiz', 'Card', { width: 'fill', height: 'hug', padding: 20, fill: '#1B2335' }),
    { type: 'text', parent: 'card', name: 'Rótulo', text: 'Saldo', width: 'fill', fontSize: 14 },
  ] });
  const r = parseAiScreenResponse(raw, req)!;
  const by = (n: string) => r.shapes.find((s) => s.name === n)!;
  // ícones: 22 vira 20 (escala 16/20/24) + padding 8*2 = 36 de largura (não ocupam a linha)
  expect(by('Busca').width).toBe(36);
  expect(by('Filtro').width).toBe(36);
  // o título ocupa o resto da linha
  const hdr = by('Cabeçalho');
  expect(by('Título').width).toBeGreaterThan(200);
  expect(by('Título').width).toBe(hdr.width - 16 - 36 - 36 - 16);
  // padding 20 do card sem "layout" foi mantido quando virou fluxo
  const card = by('Card');
  expect(by('Rótulo').x).toBe(card.x + 20);
  expect(by('Rótulo').y).toBe(card.y + 20);
});

test('robustez: seções soltas (sem parent e sem x/y) entram no layout principal, não empilham no canto', () => {
  const F = (id: string | undefined, name: string, o: any) => ({ type: 'frame', ...(id ? { id } : {}), name, ...o });
  // o frame "Conteúdo" existe, mas as seções vêm sem "parent"
  const raw = JSON.stringify({ name: 'Início', width: 393, height: 852, background: '#FFFFFF', shapes: [
    F('raiz', 'Conteúdo', { layout: 'vertical', gap: 16, padding: [54, 16, 84, 16], x: 0, y: 0, width: 393, height: 852 }),
    F('hdr', 'Barra Funcional', { layout: 'horizontal', gap: 12, width: 'fill', height: 'hug' }),
    { type: 'text', parent: 'hdr', text: 'Olá, Mariana', width: 'fill', fontSize: 18 },
    F('saldo', 'Card Saldo', { layout: 'vertical', gap: 16, padding: 16, width: 'fill', height: 'hug', fill: '#0F172A' }),
    { type: 'text', parent: 'saldo', text: 'R$ 48.250,80', width: 'hug', fontSize: 32, fill: '#FFFFFF' },
    F('lista', 'Lista de Transações', { layout: 'vertical', gap: 8, width: 'fill', height: 'hug' }),
    F('t1', 'Transação 1', { parent: 'lista', layout: 'horizontal', gap: 12, padding: 12, width: 'fill', height: 'hug', fill: '#F8FAFC' }),
    { type: 'text', parent: 't1', text: 'Supermercado Central', width: 'fill', fontSize: 14 },
    F('nav', 'Barra de Navegação', { layout: 'horizontal', padding: [10, 8, 34, 8], width: 'fill', height: 'hug', fill: '#FFFFFF' }),
    { type: 'text', parent: 'nav', text: 'Início', width: 'fill', fontSize: 11 },
  ] });
  const r = parseAiScreenResponse(raw, req)!;
  const by = (n: string) => r.shapes.find((s) => s.name === n)!;
  const raiz = by('Conteúdo');
  const hdr = by('Barra Funcional');
  const saldo = by('Card Saldo');
  const lista = by('Lista de Transações');
  for (const f of [hdr, saldo, lista]) expect(f.parentId).toBe(raiz.id);
  // um embaixo do outro, com o gap de 16, sem sobreposição
  expect(saldo.y).toBe(hdr.y + hdr.height + 16);
  expect(lista.y).toBe(saldo.y + saldo.height + 16);
  expect(hdr.y).toBe(raiz.y + 56); // padding do topo (barra de status), na grade de 4px
  expect(by('Transação 1').y).toBe(lista.y);
  // navbar continua colada na base
  const screen = r.shapes.find((s) => s.name === 'Tela')!;
  const nav = by('Barra de Navegação');
  expect(nav.y + nav.height).toBe(screen.y + screen.height);
});

test('robustez: sem frame de conteúdo algum, as seções ganham um layout principal implícito', () => {
  const F = (id: string, name: string, o: any) => ({ type: 'frame', id, name, ...o });
  const raw = JSON.stringify({ name: 'Início', width: 393, height: 852, background: '#FFFFFF', shapes: [
    F('a', 'Seção A', { layout: 'vertical', padding: 16, width: 'fill', height: 'hug', fill: '#EEE' }),
    { type: 'text', parent: 'a', text: 'Primeira', width: 'fill', fontSize: 16 },
    F('b', 'Seção B', { layout: 'vertical', padding: 16, width: 'fill', height: 'hug', fill: '#DDD' }),
    { type: 'text', parent: 'b', text: 'Segunda', width: 'fill', fontSize: 16 },
  ] });
  const r = parseAiScreenResponse(raw, req)!;
  const by = (n: string) => r.shapes.find((s) => s.name === n)!;
  const a = by('Seção A');
  const b = by('Seção B');
  const screen = r.shapes.find((s) => s.name === 'Tela')!;
  expect(a.y).toBe(screen.y + 56); // abaixo da barra de status
  expect(b.y).toBe(a.y + a.height + 12);
  expect(a.width).toBe(393);
});

test('velocidade: prompt pede JSON compacto e teto de elementos; "name" omitido vira nome automático', () => {
  const p = buildAiScreenPrompt({ prompt: 'x', pageId: 'p', startX: 0, startY: 0, accentColor: '#f90', isDark: false });
  expect(p).toContain('JSON MINIFICADO');
  expect(p).toContain('MÁXIMO 80 elementos');
  const raw = JSON.stringify({ name: 'T', width: 393, height: 852, background: '#fff', shapes: [
    { type: 'frame', id: 'raiz', layout: 'vertical', x: 0, y: 0, width: 393, height: 852 },
    { type: 'text', parent: 'raiz', text: 'Olá, Mariana, bem-vinda de volta ao app', width: 'fill', fontSize: 16 },
    { type: 'image', parent: 'raiz', query: 'beauty salon interior', width: 100, height: 100 },
    { type: 'rect', parent: 'raiz', width: 50, height: 10 },
  ] });
  const r = parseAiScreenResponse(raw, req)!;
  const names = r.shapes.filter((s) => s.parentId && ['text', 'image', 'rect'].includes(s.type)).map((s) => s.name);
  expect(names).toContain('Olá, Mariana, bem-vinda de v'); // 28 caracteres do texto
  expect(names).toContain('beauty salon interior');
  expect(names).toContain('Retângulo');
});

test('imagens de referência: etapa de análise e especificação obrigatória na geração', async () => {
  const { buildReferenceAnalysisPrompt } = await import('../src/components/design2/referenceAnalysis');
  const a = buildReferenceAnalysisPrompt(['/tmp/a.jpg', '/tmp/b.jpg']);
  expect(a).toContain('/tmp/a.jpg');
  expect(a).toContain('BLOCOS (de cima para baixo');
  expect(a).toContain('navegação inferior');
  const spec = 'FORMATO: iPhone\nBLOCOS:\n1. cabeçalho com saudação e avatar\n2. busca em pílula\n3. carrossel de cards com foto';
  const p = buildAiScreenPrompt({ prompt: 'crie a tela inicial do app seguindo o exemplo', pageId: 'p', startX: 0, startY: 0, accentColor: '#f90', isDark: false, canReadProject: true, referenceSpec: spec, referenceImages: [] });
  expect(p).toContain('REFERÊNCIA VISUAL OBRIGATÓRIA');
  expect(p).toContain('carrossel de cards com foto');
  expect(p).toContain('FIDELIDADE MÁXIMA À REFERÊNCIA');
  expect(p).not.toContain('abra CADA imagem'); // com a especificação a IA não precisa abrir arquivos
  // sem especificação (análise falhou) volta ao modo de caminhos de arquivo
  const fallback = buildAiScreenPrompt({ prompt: 'x', pageId: 'p', startX: 0, startY: 0, accentColor: '#f90', isDark: false, referenceImages: ['/tmp/a.jpg'] });
  expect(fallback).toContain('/tmp/a.jpg');
  expect(fallback).toContain('FIDELIDADE MÁXIMA À REFERÊNCIA');
});

test('"siga o exemplo" não conta como assunto: o conteúdo vem do projeto', () => {
  expect(isVaguePrompt('crie a tela inicial do app seguindo o exemplo')).toBe(true);
  expect(isVaguePrompt('Gere exatamente a tela igual a imagem anexada')).toBe(true);
});

test('degradê (#RRGGBBAA) e navbar flutuante com inset', () => {
  const raw = JSON.stringify({ name: 'T', width: 393, height: 852, background: '#FFFFFF', shapes: [
    { type: 'frame', id: 'raiz', layout: 'vertical', x: 0, y: 0, width: 393, height: 852 },
    { type: 'rect', parent: 'raiz', name: 'Véu', width: 300, height: 120, gradient: { from: '#00000000', to: '#000000CC', angle: 180 } },
    { type: 'frame', id: 'nav', pin: 'bottom', inset: 24, x: 24, name: 'Navbar', layout: 'horizontal', padding: 12, width: 345, height: 'hug', fill: '#111111', cornerRadius: 999 },
    { type: 'text', parent: 'nav', text: 'Início', width: 'hug', fontSize: 12 },
  ] });
  const r = parseAiScreenResponse(raw, req)!;
  const veu = r.shapes.find((s) => s.name === 'Véu')!;
  const g = veu.fills![0];
  expect(g.type).toBe('linear');
  expect(g.gradientAngle).toBe(180);
  expect(g.gradientStops![0].opacity).toBe(0); // começa transparente
  expect(g.gradientStops![1].opacity).toBeCloseTo(0.8, 1); // CC = 80%
  expect(g.gradientStops![0].color).toBe('#000000'); // sem cinza no meio
  const screen = r.shapes.find((s) => s.name === 'Tela')!;
  const nav = r.shapes.find((s) => s.name === 'Navbar')!;
  expect(nav.y + nav.height).toBe(screen.y + screen.height - 24); // flutua 24px acima da borda
  expect(nav.x).toBe(screen.x + 24);
  expect(nav.width).toBe(345);
});

test('contexto do projeto desligado: prompt usa só o pedido e ignora projeto/memória', () => {
  const base = { prompt: 'crie a tela inicial do app', pageId: 'p', startX: 0, startY: 0, accentColor: '#f90', isDark: false, projectContext: 'README: sistema de leilão de gado', canReadProject: true } as const;
  const on = buildAiScreenPrompt({ ...base });
  expect(on).toContain('leilão de gado');
  expect(on).toContain('o assunto é o PROJETO');
  expect(on).toContain('6 arquivos');
  const off = buildAiScreenPrompt({ ...base, useProjectContext: false });
  expect(off).not.toContain('leilão de gado'); // o resumo do projeto não entra
  expect(off).not.toContain('CONTEXTO DO PROJETO');
  expect(off).not.toContain('6 arquivos'); // não pede para ler arquivos
  expect(off).not.toContain('o assunto é o PROJETO');
  expect(off).toContain('use SOMENTE o que está no pedido');
  expect(off).toContain('IGNORE qualquer projeto');
  expect(off).toContain('NÃO edite arquivos nem leia outros arquivos');
});

test('robustez (print real): título + botão/tag na mesma linha não se cobrem', () => {
  const F = (id: string, parent: string, name: string, o: any) => ({ type: 'frame', id, parent, name, ...o });
  const raw = JSON.stringify({ name: 'Cartões', width: 393, height: 852, background: '#F4F5F7', shapes: [
    F('raiz', 'root', 'Conteúdo', { layout: 'vertical', gap: 20, padding: [54, 20, 100, 20], x: 0, y: 0, width: 393, height: 852 }),
    // linha: título "fill" + botão SEM width (antes virava largura fixa = linha toda e cobria o título)
    F('topo', 'raiz', 'Topo Cartões', { layout: 'horizontal', gap: 16, align: 'center', width: 'fill', height: 'hug' }),
    { type: 'text', parent: 'topo', name: 'Título', text: 'Meus Cartões', width: 'fill', fontSize: 18, fontWeight: 600 },
    F('novo', 'topo', 'Novo Cartão', { layout: 'horizontal', gap: 6, align: 'center', padding: [8, 12, 8, 12], height: 'hug', fill: '#FFFFFF', cornerRadius: 20 }),
    { type: 'icon', parent: 'novo', name: 'Add', size: 16, fill: '#111111' },
    { type: 'text', parent: 'novo', text: 'Novo', fontSize: 13 }, // sem width: hug
    // cartão: título "fill" + tag com largura numérica copiada da linha inteira (228 = largura do pai)
    F('cartao', 'raiz', 'Cartão', { layout: 'vertical', gap: 16, padding: 16, width: 260, height: 'hug', fill: '#C6F25A', cornerRadius: 20 }),
    F('linha2', 'cartao', 'Topo', { layout: 'horizontal', gap: 8, align: 'center', width: 'fill', height: 'hug' }),
    { type: 'text', parent: 'linha2', name: 'EB Agro', text: 'EB Agro', width: 'fill', fontSize: 14, fontWeight: 700 },
    F('tag', 'linha2', 'Tag', { layout: 'horizontal', align: 'center', padding: [4, 8, 4, 8], width: 228, height: 'hug', fill: '#111111', cornerRadius: 999 }),
    { type: 'text', parent: 'tag', text: 'Platinum', width: 'hug', fontSize: 11, fill: '#C6F25A' },
  ] });
  const r = parseAiScreenResponse(raw, req)!;
  const by = (n: string) => r.shapes.find((s) => s.name === n)!;
  // linha 1: o botão tem a largura do conteúdo e o título ocupa o resto (sem colapsar)
  const titulo = by('Título');
  const novo = by('Novo Cartão');
  expect(novo.width).toBeLessThan(120);
  expect(titulo.width).toBeGreaterThan(100);
  expect(titulo.x + titulo.width).toBeLessThanOrEqual(novo.x + 0.5); // o texto termina antes do botão
  expect(by('Novo').widthMode).toBe('hug');
  // linha 2: tag "grande demais" vira hug e o texto "EB Agro" aparece inteiro
  const eb = by('EB Agro');
  const tag = by('Tag');
  expect(tag.width).toBeLessThan(110);
  expect(eb.width).toBeGreaterThan(40);
  expect(eb.x + eb.width).toBeLessThanOrEqual(tag.x + 0.5);
});
