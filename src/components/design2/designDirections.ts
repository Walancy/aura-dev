export interface Direction {
  id: string;
  name: string;
  brief: string;
}

/** Direções de arte concretas: cada geração sorteia uma, para que pedidos iguais não saiam com a mesma cara. */
export const DIRECTIONS: Direction[] = [
  { id: 'editorial', name: 'Editorial minimalista', brief: 'fundo off-white quente (#F6F3EE), tipografia GRANDE e de alto contraste (títulos 40–56px, peso 700–800, entrelinha justa), uma única cor de acento, linhas finas de 1px no lugar de caixas, muito respiro e alinhamento à esquerda; quase sem cards nem sombras.' },
  { id: 'mesh', name: 'Gradiente de malha vibrante', brief: 'fundo com manchas de cor desfocadas (ellipses com degradê radial + blur 80–120 em roxo, rosa e laranja ou azul e ciano) e conteúdo em cartões de VIDRO ("glass":true); títulos brancos grandes, botão pílula em cor sólida contrastante.' },
  { id: 'neobrutal', name: 'Neo-brutalismo', brief: 'cores chapadas e saturadas (amarelo #FFD93D, azul #4D96FF, rosa #FF6B9D) sobre creme, bordas pretas de 2px, sombras sólidas deslocadas (x 4, y 4, blur 0, preto), cantos pouco arredondados (6–8), tipografia pesada em caixa alta nos rótulos; sensação de colagem divertida.' },
  { id: 'dark-glow', name: 'Escuro premium com brilho', brief: 'fundo quase preto (#0A0A0F) com UM halo de luz colorido (ellipse radial + blur) atrás do conteúdo, tipografia fina e elegante, detalhes em ciano ou âmbar, bordas translúcidas de 1px (#FFFFFF1A), botão primário em degradê sutil; texto sempre claro e legível.' },
  { id: 'bento', name: 'Bento / cards modulares', brief: 'grade de cards de tamanhos DIFERENTES (um grande, dois pequenos, um largo) em cores pastel distintas (lavanda, menta, pêssego, céu), cantos 24–28, ícone grande por card e rótulos curtos; hierarquia pela escala dos cards.' },
  { id: 'organic', name: 'Orgânico com formas', brief: 'formas grandes e sobrepostas (ellipses, cantos 999) ocupando o fundo em paleta terrosa/verde-sálvia ou coral/creme, cantos muito arredondados nos componentes, tipografia amigável; o conteúdo respira sobre as formas.' },
  { id: 'hero-sheet', name: 'Hero ilustrado + painel inferior', brief: 'metade superior (45%) é uma área visual forte (foto "image" com degradê escurecendo a base, ou composição abstrata de formas) e o conteúdo vive num painel inferior de cantos 32 sobreposto a ela, com campos amplos e botão de largura total.' },
  { id: 'tech-mono', name: 'Tecnológico / terminal', brief: 'grafite (#111418), fonte monoespaçada nos números e rótulos, acento verde-neon (#39FF88) ou azul elétrico, grade de pontos sutil no fundo, bordas 1px, cantos 4–6, métricas e códigos como destaque visual.' },
  { id: 'fintech', name: 'Fintech confiável', brief: 'azul profundo (#0B2A5B) + branco + um acento (turquesa ou verde), cards limpos com sombra suave, ícones lineares em chips 40px, números grandes em destaque, microtextos de segurança; transmite confiança sem ser genérico.' },
  { id: 'pastel-play', name: 'Pastel lúdico', brief: 'fundo pastel (pêssego, lilás ou menta), componentes em pílula grandes, ilustração feita de formas simples (círculos, meia-luas, estrelas) em cores alegres, tipografia arredondada e microcopy simpática; botões gordinhos com sombra colorida.' },
  { id: 'luxury', name: 'Luxo sóbrio', brief: 'preto profundo + dourado envelhecido (#C8A96A) ou marfim, títulos em fonte serifada (Playfair Display / Cormorant) com espaçamento largo, rótulos em caixa alta com tracking, linhas douradas finas, composição centrada e simétrica, muito espaço vazio.' },
  { id: 'swiss', name: 'Grade suíça / tipográfico', brief: 'composição guiada pela tipografia: um título gigantesco (64–96px) cortando a tela, texto pequeno alinhado a uma grade rígida, contraste forte de escala, paleta de duas cores (preto + vermelho ou azul cobalto), sem ornamentos nem sombras.' },
];

/** Conceitos de composição para telas de login/cadastro: fogem do modelo "logo + dois campos + botão + social". */
const LOGIN_IDEAS = [
  'título gigante à esquerda e campos de LINHA SUBLINHADA (sem caixas), botão como seta circular grande no canto',
  'cartão de vidro flutuando sobre um fundo de manchas de cor, com o título dentro do cartão e campos de vidro',
  'passos: tela só com o campo de e-mail enorme e um botão "Continuar"; login social como ícones redondos pequenos embaixo',
  'saudação grande + passwordless em destaque (código por e-mail/biometria como ação principal; senha vira link secundário)',
  'metade superior visual (foto ou formas) e painel inferior arredondado com o formulário; logo pequeno sobre a imagem',
  'layout centrado e simétrico, com uma ilustração feita de formas atrás do título e campos em pílula',
];

const isLogin = (p: string) => /\b(login|log in|sign ?in|entrar|acesso|autentica|conectar|cadastro|sign ?up)\b/i.test(p);

/** Sorteia (ou usa `seed` 0..1, nos testes) um item de uma lista. */
export const pick = <T,>(list: T[], seed = Math.random()): T => list[Math.min(list.length - 1, Math.floor(seed * list.length))];

/**
 * Bloco de DIREÇÃO CRIATIVA do prompt: uma direção de arte sorteada + (em login/cadastro) um conceito de composição.
 * O pedido do usuário e as referências anexadas sempre vencem.
 */
export function directionBlock(prompt: string, seed = Math.random(), seed2 = Math.random()): string {
  const d = pick(DIRECTIONS, seed);
  const idea = isLogin(prompt) ? `\n- COMPOSIÇÃO sugerida para esta tela: ${pick(LOGIN_IDEAS, seed2)}.` : '';
  return `DIREÇÃO CRIATIVA DESTA GERAÇÃO (sorteada para que cada tela tenha identidade própria; se o PEDIDO já define tema, cores ou estilo, o pedido vence e você só aproveita a composição):
- Direção de arte: ${d.name} — ${d.brief}${idea}
- EVITE o modelo genérico (quadrado de logo no topo + "Bem-vindo de volta" + dois campos brancos + botão roxo + Google/Apple). Invente uma composição própria, com ponto focal claro, escala tipográfica ousada e UM detalhe memorável (forma, degradê, ilustração, número gigante, textura).
- Texto SEMPRE legível: contraste mínimo 4.5:1 com o fundo real (título claro em fundo escuro, escuro em fundo claro); nunca título da mesma família de cor do fundo.
`;
}

/** Bloco de INSPIRAÇÃO (biblioteca local): imagens salvas que dão clima, sem serem copiadas. */
export function inspirationBlock(paths?: string[]): string {
  if (!paths?.length) return '';
  return `INSPIRAÇÃO DA BIBLIOTECA DO USUÁRIO (NÃO copie; extraia o clima, o ritmo, o uso de cor, a tipografia e o tipo de composição e crie algo ORIGINAL para o pedido). Abra cada imagem uma única vez no início e responda direto com o JSON:\n${paths.map((p) => `- ${p}`).join('\n')}\n`;
}
