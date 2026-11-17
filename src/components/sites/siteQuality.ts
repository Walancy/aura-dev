// Checagem estática do index.html gerado pela IA. Modelos mais fracos costumam entregar arquivo cortado, com poucas seções,
// sem animação ou com "..." no lugar do conteúdo: o que for detectado aqui vira uma passada de correção dirigida.
export function inspectSiteHtml(html: string): string[] {
  const issues: string[] = [];
  const text = html || '';
  if (!/<\/html>\s*$/i.test(text.trim())) issues.push('o arquivo parece cortado: não termina em </html>');
  if (text.length < 14000) issues.push(`o site é pequeno demais (${Math.round(text.length / 1000)} mil caracteres): faltam conteúdo, seções e acabamento`);
  const sections = (text.match(/<section[\s>]/gi) || []).length;
  if (sections < 4) issues.push(`só ${sections} seção(ões) <section>: um site completo precisa de pelo menos 4, com layouts diferentes`);
  const animated = /@keyframes|gsap|IntersectionObserver|requestAnimationFrame|animation-timeline|view-timeline|ScrollTrigger/i.test(text);
  if (!animated) issues.push('não há nenhuma animação (keyframes, GSAP, IntersectionObserver ou scroll): revelação de títulos, hover e movimento no hero são obrigatórios');
  if (!/data-(curtain|pin|hscroll|stack|scene|bg|scale-in)|ScrollTrigger|animation-timeline|view-timeline|position:\s*sticky/i.test(text)) issues.push('nenhuma transição entre seções ligada ao scroll (cortina, cena fixa, scroll horizontal, pilha, troca de cor): adicione pelo menos 3 com o motor AURA FX');
  if (/cursor\s*:\s*none/i.test(text) === false && /(class|id)=["'][^"']*(cursor|pointer-dot|ring)[^"']*["']/i.test(text) && !/fx-cursor/.test(text)) issues.push('há cursor customizado, mas o cursor nativo continua visível (falta cursor:none): o usuário vê dois cursores');
  if (!/@media[^{]*(max|min)-width/i.test(text)) issues.push('sem media queries: o site não está responsivo (tablet 768 e celular 390)');
  if (!/fonts\.googleapis\.com|fonts\.bunny\.net|api\.fontshare\.com|@font-face/i.test(text)) issues.push('nenhuma fonte foi importada: o site cai na fonte padrão do navegador');
  if (/lorem ipsum/i.test(text) || /<!--\s*(\.{3}|…|more|mais|resto|restante|continue|repita|repeat|etc)/i.test(text)) issues.push('há texto de preenchimento (lorem ipsum) ou comentário no lugar de conteúdo ("...", "mais seções"): escreva o conteúdo de verdade');
  if (!/<meta[^>]+viewport/i.test(text)) issues.push('falta <meta name="viewport">');
  // sistema de design: variáveis no :root e componentes por classe, em vez de valores soltos repetidos
  const root = /:root\s*\{([^}]*)\}/i.exec(text)?.[1] || '';
  const vars = (root.match(/--[\w-]+\s*:/g) || []).length;
  if (vars < 6) issues.push(`faltam tokens de design: defina cores, espaçamentos e tamanhos de fonte como variáveis CSS no :root (${vars} encontradas; use --bg, --fg, --accent, --space-*, --fs-*) e reutilize-as em todo o CSS`);
  else {
    const css = (text.match(/<style[\s\S]*?<\/style>/gi) || []).join('\n').replace(/:root\s*\{[^}]*\}/gi, '');
    const loose = new Set((css.match(/#[0-9a-f]{6}\b|#[0-9a-f]{3}\b/gi) || []).map((c) => c.toLowerCase())).size;
    if (loose > 14) issues.push(`${loose} cores diferentes escritas direto no CSS fora do :root: troque por variáveis do sistema de design`);
  }
  const inline = (text.match(/\sstyle="/gi) || []).length;
  if (inline > 24) issues.push(`${inline} atributos style="" inline: mova para classes reutilizáveis (.btn, .card, .eyebrow, .section-title...)`);
  const imgNoAlt = (text.match(/<img\b(?![^>]*\balt=)[^>]*>/gi) || []).length;
  if (imgNoAlt) issues.push(`${imgNoAlt} <img> sem alt`);
  if ((text.match(/<h1[\s>]/gi) || []).length !== 1) issues.push('deve haver exatamente um <h1> (hierarquia de títulos h1 > h2 > h3)');
  if (!/<!--\s*PLANO/i.test(text)) issues.push('falta o comentário <!-- PLANO ... --> no topo do <head> com conceito, paleta, fontes, escala e a lista de seções (veja as regras)');
  return issues;
}
