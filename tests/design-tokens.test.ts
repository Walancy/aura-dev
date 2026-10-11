import { test, expect } from 'bun:test';
import { DEFAULT_TOKENS, normalizeTokens, parseTokens, snapRadiusToTokens, snapSpaceToTokens, snapTypeToTokens, tokensFromShapes, tokensPromptBlock } from '../src/components/design2/designTokens';

const mk = (o: any) => ({ rotation: 0, fill: '#000', stroke: 'none', strokeWidth: 0, opacity: 1, zIndex: 1, visible: true, pageId: 'p', ...o });

test('normalizeTokens descarta lixo e completa o que falta', () => {
  const t = normalizeTokens({ colors: [{ name: 'primary', value: '#ff6a00' }, { name: 'x', value: 'azul' }], spacing: [8, 16, 'a', 8], type: [{ name: 'body', size: 14, weight: 400 }] })!;
  expect(t.colors).toEqual([{ name: 'primary', dark: '#FF6A00', light: '#FF6A00' }]);
  expect(t.mode).toBe('dark');
  expect(t.spacing).toEqual([8, 16]);
  expect(t.radii.length).toBeGreaterThan(0);
  expect(normalizeTokens({})).toBeNull();
  expect(normalizeTokens(null)).toBeNull();
});

test('parseTokens lê JSON com cerca de markdown', () => {
  const t = parseTokens('```json\n' + JSON.stringify(DEFAULT_TOKENS) + '\n```')!;
  expect(t.fontFamily).toBe('Poppins');
  expect(t.colors.length).toBe(DEFAULT_TOKENS.colors.length);
});

test('o bloco do prompt lista cores, fonte, escala, espaços e raios', () => {
  const b = tokensPromptBlock(DEFAULT_TOKENS);
  expect(b).toContain('primary #F59333');
  expect(b).toContain('ESCURO');
  expect(tokensPromptBlock({ ...DEFAULT_TOKENS, mode: 'light' })).toContain('primary #EA7A12');
  expect(b).toContain('Poppins');
  expect(b).toContain('body 14px/400');
  expect(b).toContain('4, 8, 12, 16, 24, 32, 48');
  expect(b).toContain('md 12');
  expect(tokensPromptBlock(null)).toBe('');
});

test('snap para o token mais próximo', () => {
  expect(snapSpaceToTokens(14, DEFAULT_TOKENS)).toBe(12);
  expect(snapSpaceToTokens(22, DEFAULT_TOKENS)).toBe(24);
  expect(snapSpaceToTokens(14)).toBe(14);
  expect(snapRadiusToTokens(15, DEFAULT_TOKENS)).toBe(12);
  expect(snapTypeToTokens(15, DEFAULT_TOKENS)).toEqual({ size: 14, weight: 400 });
  expect(snapTypeToTokens(15)).toEqual({ size: 15 });
});

test('tokensFromShapes deduz cores, fonte e escala do design', () => {
  const all = [
    mk({ id: 'a', type: 'frame', fill: '#111111', cornerRadius: 16, hasAutoLayout: true, layoutGap: 12, paddingHorizontal: 16 }),
    mk({ id: 'b', type: 'frame', fill: '#111111', cornerRadius: 16 }),
    mk({ id: 'c', type: 'text', fill: '#FFFFFF', fontFamily: 'Inter', fontSize: 14, fontWeight: 400 }),
    mk({ id: 'd', type: 'text', fill: '#FFFFFF', fontFamily: 'Inter', fontSize: 24, fontWeight: 700 }),
  ] as any[];
  const t = tokensFromShapes(all)!;
  expect(t.colors[0].dark).toBe('#111111');
  expect(t.fontFamily).toBe('Inter');
  expect(t.type.map((x) => x.size)).toEqual([24, 14]);
  expect(t.radii[0].value).toBe(16);
  expect(t.spacing).toEqual([12, 16]);
});

test('a IA criando com tokens: cores, fonte, escala, espaços e raios são ajustados aos tokens', async () => {
  const { parseAiScreenResponse } = await import('../src/components/design2/aiScreenFromLlm');
  const tokens = { ...DEFAULT_TOKENS, fontFamily: 'Inter' };
  const raw = JSON.stringify({ name: 'T', width: 393, height: 852, background: '#0F0F10', shapes: [
    { type: 'frame', id: 'c', layout: 'vertical', gap: 14, padding: 18, width: 300, height: 120, fill: '#1B1B1D', cornerRadius: 14, x: 20, y: 80 },
    { type: 'text', parent: 'c', text: 'Olá', fontSize: 15, fill: '#FEFEFE' },
  ] });
  const r = parseAiScreenResponse(raw, { prompt: 'x', pageId: 'p', startX: 0, startY: 0, accentColor: '#f90', isDark: true, tokens } as any)!;
  const card = r.shapes.find((s: any) => s.name === 'Frame' || s.layoutGap !== undefined && s.cornerRadius)!;
  expect(card.fill).toBe('#1A1A1C'); // surface
  expect(card.cornerRadius).toBe(12);
  expect(DEFAULT_TOKENS.spacing).toContain(card.layoutGap);
  const txt = r.shapes.find((s: any) => s.type === 'text' && s.text === 'Olá')!;
  expect(txt.fontFamily).toBe('Inter');
  expect(txt.fontSize).toBe(14);
  expect(txt.fill).toBe('#FFFFFF');
});

test('cores com modo escuro e claro; legado "value" vira os dois', () => {
  const t = normalizeTokens({ mode: 'light', colors: [{ name: 'a', dark: '#000000', light: '#ffffff' }, { name: 'b', value: '#123456' }] })!;
  expect(t.mode).toBe('light');
  expect(t.colors[0]).toEqual({ name: 'a', dark: '#000000', light: '#FFFFFF' });
  expect(t.colors[1]).toEqual({ name: 'b', dark: '#123456', light: '#123456' });
});

test('modesInPrompt e applyModeScope respeitam o modo citado no pedido', async () => {
  const { applyModeScope, modesInPrompt, buildTokensGenPrompt } = await import('../src/components/design2/designTokens');
  expect(modesInPrompt('troque o fundo do modo claro para branco')).toEqual({ dark: false, light: true });
  expect(modesInPrompt('deixe o darkmode mais escuro e o lightmode mais claro')).toEqual({ dark: true, light: true });
  const cur = { ...DEFAULT_TOKENS, mode: 'dark' as const };
  // a IA mexeu nos dois modos de "primary", mas o pedido era só do claro
  const next = { ...cur, colors: cur.colors.map((c) => (c.name === 'primary' ? { ...c, dark: '#0000FF', light: '#1111FF' } : c)) };
  const r = applyModeScope('mude a primary do modo claro para azul', cur, next);
  expect(r.colors.find((c) => c.name === 'primary')).toEqual({ name: 'primary', dark: DEFAULT_TOKENS.colors[2].dark, light: '#1111FF' });
  expect(r.mode).toBe('dark');
  // sem modo citado, vale o que a IA devolveu nos dois
  expect(applyModeScope('troque a primary para azul', cur, next).colors.find((c) => c.name === 'primary')!.dark).toBe('#0000FF');
  // "use o modo claro" troca o modo ativo
  expect(applyModeScope('use o modo claro', cur, next).mode).toBe('light');
  const p = buildTokensGenPrompt({ prompt: 'crie o modo claro', current: cur });
  expect(p).toContain('"dark"');
  expect(p).toContain('MODO CLARO');
  expect(p).toContain('TOKENS ATUAIS');
});

test('randomizePalette troca só as funções conhecidas, nos dois modos, com cores válidas', async () => {
  const { randomizePalette } = await import('../src/components/design2/designTokens');
  let n = 0.1;
  const rnd = () => ((n = (n * 9301 + 0.49297) % 1), n);
  const base = { ...DEFAULT_TOKENS, colors: [...DEFAULT_TOKENS.colors, { name: 'success', dark: '#10B981', light: '#059669' }] };
  const r = randomizePalette(base, rnd);
  for (const c of r.colors) expect(/^#[0-9A-F]{6}$/.test(c.dark) && /^#[0-9A-F]{6}$/.test(c.light)).toBe(true);
  expect(r.colors.find((c) => c.name === 'success')).toEqual({ name: 'success', dark: '#10B981', light: '#059669' });
  const bg = r.colors.find((c) => c.name === 'background')!;
  expect(bg.dark).not.toBe(DEFAULT_TOKENS.colors[0].dark);
  // fundo escuro é escuro e fundo claro é claro
  const lum = (h: string) => (parseInt(h.slice(1, 3), 16) + parseInt(h.slice(3, 5), 16) + parseInt(h.slice(5, 7), 16)) / 3;
  expect(lum(bg.dark)).toBeLessThan(60);
  expect(lum(bg.light)).toBeGreaterThan(200);
  expect(r.fontFamily).toBe(base.fontFamily);
});

test('applyTokensSection troca só a seção pedida', async () => {
  const { applyTokensSection } = await import('../src/components/design2/designTokens');
  const r = applyTokensSection('radii', DEFAULT_TOKENS, '{"radii":[{"name":"sm","value":4},{"name":"full","value":999}]}')!;
  expect(r.radii).toEqual([{ name: 'sm', value: 4 }, { name: 'full', value: 999 }]);
  expect(r.type).toEqual(DEFAULT_TOKENS.type);
  expect(r.colors).toEqual(DEFAULT_TOKENS.colors);
  const t = applyTokensSection('type', DEFAULT_TOKENS, '{"fontFamily":"Inter","type":[{"name":"body","size":15,"weight":400}]}')!;
  expect(t.fontFamily).toBe('Inter');
  expect(t.type[0].size).toBe(15);
  expect(applyTokensSection('spacing', DEFAULT_TOKENS, 'lixo')).toBeNull();
  expect(applyTokensSection('spacing', DEFAULT_TOKENS, '{"radii":[]}')).toBeNull();
});

test('projectAssets: escolhe logos e ícones do projeto, ignora node_modules e imagens soltas', async () => {
  const { pickProjectAssets, assetsPromptBlock } = await import('../src/components/design2/projectAssets');
  const f = (name: string, path: string) => ({ name, path, isDirectory: false });
  const d = (name: string, children: any[]) => ({ name, path: name, isDirectory: true, children });
  const tree = [
    f('logo.svg', '/p/logo.svg'),
    d('public', [f('hero-photo.png', '/p/public/hero-photo.png'), f('favicon.ico', '/p/public/favicon.ico'), d('icons', [f('home.svg', '/p/public/icons/home.svg')])]),
    d('node_modules', [f('logo.svg', '/p/node_modules/x/logo.svg')]),
  ] as any[];
  const list = pickProjectAssets(tree);
  expect(list.map((a) => a.name)).toEqual(['logo.svg', 'favicon.ico', 'home.svg']);
  expect(list[0].kind).toBe('logo');
  expect(list[2].kind).toBe('icon');
  const block = assetsPromptBlock(list.map((a, i) => ({ ...a, id: `a${i + 1}` })));
  expect(block).toContain('a1 = logo.svg (logo)');
  expect(assetsPromptBlock([])).toBe('');
});

test('imagem com asset do projeto: sem foto, sem fundo cinza, ajustada ao slot', async () => {
  const { parseAiScreenResponse, buildAiScreenPrompt, isDesktopRequest } = await import('../src/components/design2/aiScreenFromLlm');
  const raw = JSON.stringify({ name: 'T', width: 1440, height: 900, background: '#fff', shapes: [{ type: 'image', asset: 'a1', x: 24, y: 20, width: 120, height: 32 }, { type: 'image', query: 'cat', x: 24, y: 80, width: 80, height: 80 }] });
  const req = { prompt: 'dashboard desktop', pageId: 'p', startX: 0, startY: 0, accentColor: '#f90', isDark: false, projectAssets: [{ id: 'a1', name: 'logo.svg', path: '/proj/logo.svg', kind: 'logo' }] } as any;
  const r = parseAiScreenResponse(raw, req)!;
  const imgs = r.shapes.filter((s: any) => s.type === 'image');
  expect(r.pending.find((p: any) => p.assetPath === '/proj/logo.svg')).toBeTruthy();
  expect(r.pending.filter((p: any) => !p.assetPath).length).toBe(1);
  const logo = imgs.find((s: any) => s.fill === 'transparent')!;
  expect(logo.imageFit).toBe('fit');
  expect(buildAiScreenPrompt(req)).toContain('a1 = logo.svg (logo)');
  expect(buildAiScreenPrompt(req)).toContain('DESKTOP / WEB');
  expect(isDesktopRequest('tela de login mobile')).toBe(false);
  expect(isDesktopRequest('dashboard web de vendas')).toBe(true);
  expect(buildAiScreenPrompt({ ...req, prompt: 'tela de login para app' })).not.toContain('DESKTOP / WEB');
});

test('pedido que é um erro/log colado ganha instrução para deduzir a tela envolvida', async () => {
  const { buildAiScreenPrompt, looksLikeErrorLog } = await import('../src/components/design2/aiScreenFromLlm');
  const err = '## Error Type\nConsole Error\n## Error Message\nEncountered two children with the same key, `closed`.\nNext.js version: 16.0.10 (Turbopack)';
  expect(looksLikeErrorLog(err)).toBe(true);
  expect(looksLikeErrorLog('crie uma tela de login moderna')).toBe(false);
  const p = buildAiScreenPrompt({ prompt: err, pageId: 'p', startX: 0, startY: 0, accentColor: '#f90', isDark: true } as any);
  expect(p).toContain('ERRO/LOG colado');
});

test('gráficos: linha suave, barras com trilho e rosca viram shapes; o frame é refeito no tamanho final', async () => {
  const { buildChartShapes, linePath, normalizeChartSpec } = await import('../src/components/design2/charts');
  const { parseAiScreenResponse } = await import('../src/components/design2/aiScreenFromLlm');
  expect(linePath([{ x: 0, y: 10 }, { x: 10, y: 0 }, { x: 20, y: 10 }], true)).toContain(' C ');
  expect(linePath([{ x: 0, y: 10 }, { x: 10, y: 0 }], true)).not.toContain(' C ');
  expect(normalizeChartSpec({ kind: 'line', data: [1] })).toBeNull();
  const ctx = { pageId: 'p', parentId: 'f', z: 5, isDark: true };
  const line = buildChartShapes(normalizeChartSpec({ kind: 'area', data: [10, 40, 20, 60, 50, 90], color: '#22C55E', highlight: { index: 3, label: '+$2,956' }, grid: true })!, { x: 0, y: 0, w: 300, h: 160 }, ctx);
  expect(line.filter((s) => s.type === 'path').length).toBe(2); // área + linha
  expect(line.some((s) => s.type === 'ellipse')).toBe(true); // marcador
  expect(line.some((s: any) => s.text === '+$2,956')).toBe(true);
  expect(line.filter((s) => s.name === 'Grade').length).toBe(5);
  const bars = buildChartShapes(normalizeChartSpec({ kind: 'bar', data: [56, 63, 13, 87], labels: ['Mon', 'Tue', 'Wed', 'Thu'], track: '#FFFFFF10', valueLabels: ['56%', '63%', '13%', '87%'] })!, { x: 0, y: 0, w: 200, h: 140 }, ctx);
  expect(bars.filter((s) => s.name === 'Barra').length).toBe(4);
  expect(bars.filter((s) => s.name === 'Trilho').length).toBe(4);
  expect(bars.filter((s: any) => s.text === '87%').length).toBe(1);
  const donut = buildChartShapes(normalizeChartSpec({ kind: 'donut', data: [30, 50, 20] })!, { x: 0, y: 0, w: 120, h: 120 }, ctx);
  expect(donut.filter((s) => s.name === 'Fatia').length).toBe(3);
  // integração: item "chart" vira frame com filhos, depois do auto layout
  const raw = JSON.stringify({ name: 'T', width: 400, height: 600, background: '#000', shapes: [
    { type: 'frame', id: 'raiz', layout: 'vertical', gap: 8, padding: 16, x: 0, y: 0, width: 400, height: 600, fill: 'transparent' },
    { type: 'chart', parent: 'raiz', kind: 'line', width: 'fill', height: 120, data: [3, 5, 4, 8, 6, 9], color: '#22C55E' },
    { type: 'frame', id: 'av', parent: 'raiz', layout: 'horizontal', gap: -10, width: 'hug', height: 'hug' },
    { type: 'ellipse', parent: 'av', width: 24, height: 24, fill: '#f00' },
    { type: 'ellipse', parent: 'av', width: 24, height: 24, fill: '#0f0' },
  ] });
  const r = parseAiScreenResponse(raw, { prompt: 'x', pageId: 'p', startX: 0, startY: 0, accentColor: '#f90', isDark: true } as any)!;
  const chartFrame = r.shapes.find((s: any) => s.name === 'Gráfico')!;
  expect(chartFrame.width).toBe(368);
  const kids = r.shapes.filter((s) => s.parentId === chartFrame.id);
  expect(kids.some((s) => s.type === 'path')).toBe(true);
  expect(Math.max(...kids.map((k) => k.x + k.width))).toBeLessThanOrEqual(chartFrame.x + chartFrame.width + 1);
  const stack = r.shapes.filter((s: any) => s.parentId === 'av' || (s.type === 'ellipse' && s.width === 24));
  expect(stack[1].x - stack[0].x).toBe(12); // 24 - 12 (o gap -10 vai para a grade de 4px)
});

test('overlay/anchor: badge sobre botão fica fora do auto layout, preso ao canto, e não aumenta o botão', async () => {
  const { parseAiScreenResponse } = await import('../src/components/design2/aiScreenFromLlm');
  const raw = JSON.stringify({ name: 'T', width: 400, height: 300, background: '#fff', shapes: [
    { type: 'frame', id: 'raiz', layout: 'horizontal', gap: 16, padding: 16, x: 0, y: 0, width: 400, height: 300, fill: 'transparent' },
    { type: 'frame', id: 'btn', parent: 'raiz', layout: 'horizontal', align: 'center', padding: 10, width: 'hug', height: 'hug', cornerRadius: 999, fill: '#eee' },
    { type: 'ellipse', parent: 'btn', width: 24, height: 24, fill: '#000' },
    { type: 'frame', id: 'badge', parent: 'btn', overlay: true, anchor: 'top-right', dx: 6, dy: 6, layout: 'horizontal', align: 'center', padding: [2, 6, 2, 6], cornerRadius: 999, fill: '#7C3AED', width: 'hug', height: 18 },
    { type: 'text', parent: 'badge', text: '3', fontSize: 11, fill: '#fff' },
    { type: 'ellipse', parent: 'raiz', width: 40, height: 40, fill: '#0f0' },
  ] });
  const r = parseAiScreenResponse(raw, { prompt: 'x', pageId: 'p', startX: 0, startY: 0, accentColor: '#f90', isDark: false } as any)!;
  const btn = r.shapes.find((s: any) => s.fill === '#eee')!;
  expect(btn.width).toBe(48); // 24 + 2*12 (padding 10 vai para a grade de 4px): o badge não entra na conta
  const badge = r.shapes.find((s: any) => s.layoutAbsolute)!;
  expect(badge.parentId).toBe(btn.id);
  expect(Math.round(badge.x + badge.width - (btn.x + btn.width))).toBe(6); // sai 6px para a direita do canto
  expect(Math.round(btn.y - badge.y)).toBe(6); // e 6px acima
  const txt = r.shapes.find((s: any) => s.text === '3')!;
  expect(txt.x).toBeGreaterThanOrEqual(badge.x);
  expect(txt.x + txt.width).toBeLessThanOrEqual(badge.x + badge.width + 1);
  const green = r.shapes.find((s: any) => s.fill === '#0f0')!;
  expect(green.x).toBe(btn.x + btn.width + 16); // o irmão vem logo depois do botão, sem espaço do badge
});

test('telas geradas recortam o conteúdo (sombra/blur não vazam), mobile e desktop', async () => {
  const { parseAiScreenResponse } = await import('../src/components/design2/aiScreenFromLlm');
  for (const [w, h] of [[393, 852], [1440, 900]]) {
    const raw = JSON.stringify({ name: 'T', width: w, height: h, background: '#fff', shapes: [{ type: 'rect', x: 10, y: 10, width: 100, height: 60, fill: '#ccc', effects: [{ type: 'shadow', x: 0, y: 8, blur: 40, color: '#00000066' }] }] });
    const r = parseAiScreenResponse(raw, { prompt: 'x', pageId: 'p', startX: 0, startY: 0, accentColor: '#f90', isDark: false } as any)!;
    const screen = r.shapes.find((s: any) => s.width === w && s.height === h)!;
    expect(screen.clipContent).toBe(true);
  }
});
