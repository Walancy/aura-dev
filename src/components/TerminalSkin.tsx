import React from 'react';

export type TerminalSkinId = 'none' | 'cyberdeck' | 'industrial' | 'amber' | 'reds' | 'bios' | 'scan' | 'blood' | 'minimal' | 'discovery' | 'hud' | 'neon' | 'stat' | 'flow' | 'recon' | 'ember';

interface SkinDef {
  id: TerminalSkinId;
  label: string;
  desc: string;
  /** paleta (TERMINAL_THEMES) e fonte que combinam com o estilo */
  theme?: string;
  font?: string;
  /** brilho leve no texto: cor e raio do blur em px (fontes de pixel pedem raio curto, senão desfocam) */
  glow?: string;
  glowRadius?: number;
  /** divisória entre terminais (multi-terminal): cor e se é tracejada */
  line?: string;
  dash?: boolean;
  /** filtro CSS que tinge o texto em RGB (24 bits) das CLIs, que ignora a paleta do tema (ex.: Antigravity) */
  tint?: string;
}

export const TERMINAL_SKINS: SkinDef[] = [
  { id: 'none', label: 'Nenhum', desc: 'Terminal limpo', theme: 'default', font: 'JetBrains Mono' },
  { id: 'cyberdeck', label: 'Cyberdeck', desc: 'Degradê vinho e azul, HUD coral', theme: 'cyberdeck', font: 'Share Tech Mono', line: 'rgba(255, 99, 90, 0.55)', tint: 'sepia(1) hue-rotate(-34deg) saturate(1.8) brightness(1.05)' },
  { id: 'industrial', label: 'Industrial', desc: 'Preto e laranja, barras e grão', theme: 'industrial', font: 'Space Mono', line: 'rgba(238, 106, 58, 0.7)', tint: 'sepia(1) hue-rotate(5deg) saturate(0.7)' },
  { id: 'amber', label: 'Âmbar CRT', desc: 'Monitor antigo, âmbar com brilho', theme: 'amber', font: 'VT323', glow: 'rgba(255, 180, 58, 0.4)', glowRadius: 2, line: 'rgba(255, 180, 58, 0.55)', dash: true, tint: 'sepia(1) saturate(2.6) brightness(1.05)' },
  { id: 'reds', label: 'Reds', desc: 'Preto, rosa e linhas brancas', theme: 'reds', font: 'Space Mono', line: 'rgba(255, 255, 255, 0.35)', tint: 'grayscale(1) brightness(1.05)' },
  { id: 'bios', label: 'BIOS', desc: 'Fósforo verde, moldura fina', theme: 'bios', font: 'IBM Plex Mono', glow: 'rgba(95, 242, 192, 0.5)', line: 'rgba(95, 242, 192, 0.5)', tint: 'sepia(1) hue-rotate(115deg) saturate(2.2)' },
  { id: 'scan', label: 'Scan', desc: 'Verde pálido, brilho e varredura', theme: 'scan', font: 'Share Tech Mono', glow: 'rgba(205, 238, 221, 0.55)', line: 'rgba(205, 238, 221, 0.5)', dash: true, tint: 'sepia(1) hue-rotate(105deg) saturate(0.55) brightness(1.1)' },
  { id: 'blood', label: 'Anatomia', desc: 'Preto, vermelho e branco', theme: 'blood', font: 'JetBrains Mono', glow: 'rgba(255, 43, 43, 0.4)', line: 'rgba(255, 255, 255, 0.5)', tint: 'sepia(1) hue-rotate(-40deg) saturate(3.2)' },
  { id: 'minimal', label: 'Minimal HUD', desc: 'Futurista minimalista, linhas finas', theme: 'minimal', font: 'IBM Plex Mono', glow: 'rgba(255, 255, 255, 0.28)', line: 'rgba(220, 228, 226, 0.35)', tint: 'grayscale(1)' },
  { id: 'discovery', label: 'Discovery', desc: 'Vermelho e azul profundo', theme: 'discovery', font: 'Share Tech Mono', line: 'rgba(255, 255, 255, 0.3)', tint: 'grayscale(0.55)' },
  { id: 'hud', label: 'Nave', desc: 'Ciano e laranja, HUD de cabine', theme: 'hud', font: 'Share Tech Mono', glow: 'rgba(47, 214, 216, 0.35)', line: 'rgba(47, 214, 216, 0.55)', tint: 'sepia(1) hue-rotate(115deg) saturate(2.4)' },
  { id: 'neon', label: 'Neon Vital', desc: 'Azul noite, verde menta e violeta', theme: 'neon', font: 'Space Mono', glow: 'rgba(30, 255, 166, 0.35)', line: 'rgba(122, 63, 255, 0.7)', tint: 'sepia(1) hue-rotate(95deg) saturate(2.4)' },
  { id: 'stat', label: 'Clã', desc: 'Preto e amarelo, placar de status', theme: 'stat', font: 'Space Mono', line: 'rgba(245, 184, 0, 0.5)', tint: 'sepia(1) saturate(2.2) brightness(1.1)' },
  { id: 'flow', label: 'Fluxo', desc: 'Grafite e carmim, linhas de fluxo', theme: 'flow', font: 'IBM Plex Mono', line: 'rgba(238, 42, 78, 0.65)', tint: 'grayscale(0.7)' },
  { id: 'recon', label: 'Recon', desc: 'Verde fosco, faixas diagonais e alerta vermelho', theme: 'recon', font: 'Share Tech Mono', line: 'rgba(196, 207, 203, 0.4)', tint: 'grayscale(0.8)' },
  { id: 'ember', label: 'Brasa', desc: 'Preto com brasa laranja brilhante', theme: 'ember', font: 'Share Tech Mono', glow: 'rgba(255, 106, 26, 0.45)', line: 'rgba(255, 106, 26, 0.6)', tint: 'sepia(1) hue-rotate(-18deg) saturate(2.6)' },
];

export const skinTint = (skin: TerminalSkinId) => TERMINAL_SKINS.find((s) => s.id === skin)?.tint;

/** variáveis CSS das divisórias entre terminais (vertical e horizontal) do estilo */
export const skinDividerVars = (skin: TerminalSkinId): Record<string, string> => {
  const d = TERMINAL_SKINS.find((s) => s.id === skin);
  if (!d?.line) return {};
  return d.dash
    ? {
        '--skin-line-v': `repeating-linear-gradient(180deg, ${d.line} 0 5px, transparent 5px 8px)`,
        '--skin-line-h': `repeating-linear-gradient(90deg, ${d.line} 0 5px, transparent 5px 8px)`,
      }
    : { '--skin-line-v': d.line, '--skin-line-h': d.line };
};

/** valor de text-shadow do brilho do estilo (undefined se não tem) */
export const skinGlow = (skin: TerminalSkinId) => {
  const d = TERMINAL_SKINS.find((s) => s.id === skin);
  return d?.glow ? `0 0 ${d.glowRadius ?? 5}px ${d.glow}` : undefined;
};

const GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.55 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";

const fill: React.CSSProperties = { position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' };

// ── peças reutilizáveis ──────────────────────────────────────────────────────
const Scan: React.FC<{ rgb: string; a?: number; step?: number }> = ({ rgb, a = 0.05, step = 3 }) => (
  <div style={{ ...fill, background: `repeating-linear-gradient(0deg, rgba(${rgb}, ${a}) 0 1px, transparent 1px ${step}px)` }} />
);
const Vignette: React.FC<{ a: number }> = ({ a }) => (
  <div style={{ ...fill, background: `radial-gradient(ellipse at center, transparent 55%, rgba(0, 0, 0, ${a}) 100%)` }} />
);
const Frame: React.FC<{ color: string; inset?: number; radius?: number }> = ({ color, inset = 5, radius = 0 }) => (
  <div style={{ position: 'absolute', inset, border: `1px solid ${color}`, borderRadius: radius, pointerEvents: 'none' }} />
);
const Brackets: React.FC<{ color: string; size?: number; inset?: number }> = ({ color, size = 16, inset = 4 }) => {
  const l = `1px solid ${color}`;
  const box: React.CSSProperties = { position: 'absolute', width: size, height: size };
  return (
    <>
      <div style={{ ...box, top: inset, left: inset, borderTop: l, borderLeft: l }} />
      <div style={{ ...box, top: inset, right: inset, borderTop: l, borderRight: l }} />
      <div style={{ ...box, bottom: inset, left: inset, borderBottom: l, borderLeft: l }} />
      <div style={{ ...box, bottom: inset, right: inset, borderBottom: l, borderRight: l }} />
    </>
  );
};
const Block: React.FC<{ style: React.CSSProperties; children?: React.ReactNode }> = ({ style, children }) => (
  <div style={{ position: 'absolute', ...style }}>{children}</div>
);

/** Fundo do estilo (atrás do texto). */
/** terminal: moldura completa do terminal; sidebar/header: só bordas; screen: moldura leve da tela toda (cantos e vinheta) */
export type SkinRegion = 'terminal' | 'sidebar' | 'header' | 'screen';

export const TerminalSkinBackground: React.FC<{ skin: TerminalSkinId; region?: SkinRegion }> = ({ skin, region = 'terminal' }) => {
  const bg: Partial<Record<TerminalSkinId, string>> = {
    cyberdeck: 'linear-gradient(180deg, #3b161b 0%, #20121a 42%, #0b121b 100%)',
    industrial: '#0a0a0a',
    amber: 'radial-gradient(ellipse at center, #2a1a07 0%, #140b04 70%, #0a0603 100%)',
    reds: '#09090a',
    bios: 'radial-gradient(ellipse at center, #05170f 0%, #010605 100%)',
    scan: 'radial-gradient(ellipse at 50% 40%, #0d1c17 0%, #040908 80%)',
    hud: 'radial-gradient(ellipse 80% 60% at 50% 45%, rgba(20, 90, 100, 0.28), transparent 70%), #02080a',
    neon: 'radial-gradient(ellipse at 50% 40%, #0b1d3a 0%, #040a18 80%)',
    stat: '#050505',
    flow: 'radial-gradient(ellipse 90% 70% at 20% 0%, #232429 0%, #141518 100%)',
    recon: 'repeating-linear-gradient(135deg, rgba(255, 255, 255, 0.025) 0 10px, transparent 10px 22px), linear-gradient(180deg, #0c1514, #070d0c)',
    ember: 'radial-gradient(ellipse 60% 55% at 50% 50%, rgba(120, 30, 6, 0.35), transparent 75%), #090302',
    blood:
      'radial-gradient(ellipse 70% 60% at 0% 100%, rgba(150, 10, 14, 0.42), transparent 70%), radial-gradient(ellipse 50% 45% at 100% 0%, rgba(110, 8, 12, 0.3), transparent 70%), linear-gradient(180deg, #0a0204 0%, #050102 55%, #000000 100%)',
    minimal: 'radial-gradient(ellipse at 50% 55%, #0a0d0d 0%, #040505 100%)',
    discovery:
      'radial-gradient(ellipse 70% 55% at 100% 0%, rgba(46, 120, 170, 0.5), transparent 70%), radial-gradient(ellipse 60% 50% at 70% 72%, rgba(170, 20, 60, 0.38), transparent 70%), linear-gradient(180deg, #05060d 0%, #07040b 100%)',
  };
  if (!bg[skin]) return null;
  return (
    <div aria-hidden style={{ ...fill, background: bg[skin] }}>
      {skin === 'industrial' && <div style={{ ...fill, backgroundImage: GRAIN, opacity: 0.07, mixBlendMode: 'screen' }} />}
      {skin === 'blood' && (
        <>
          {/* grade anatômica fina e vinheta para dar profundidade */}
          <div style={{ ...fill, backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.035) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
          <Vignette a={0.6} />
        </>
      )}
      {skin === 'ember' && (
        <div style={{ ...fill, backgroundImage: 'radial-gradient(rgba(255, 106, 26, 0.18) 1px, transparent 1.4px)', backgroundSize: '12px 12px' }} />
      )}
      {skin === 'discovery' && region === 'terminal' && (
        <>
          {/* nuvem de partículas carmim, concentrada à direita para não atrapalhar o texto */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: 'radial-gradient(rgba(255, 96, 130, 0.85) 0.7px, transparent 1.1px), radial-gradient(rgba(255, 150, 170, 0.5) 0.6px, transparent 1px)',
              backgroundSize: '6px 6px, 11px 11px',
              backgroundPosition: '0 0, 3px 4px',
              WebkitMaskImage: 'radial-gradient(ellipse 38% 32% at 72% 62%, #000 0%, transparent 75%)',
              maskImage: 'radial-gradient(ellipse 38% 32% at 72% 62%, #000 0%, transparent 75%)',
              opacity: 0.55,
            }}
          />
          {/* chão de pontos em perspectiva */}
          <div style={{ position: 'absolute', left: '-20%', right: '-20%', bottom: 0, height: '42%', perspective: 260, overflow: 'hidden' }}>
            <div
              style={{
                position: 'absolute',
                inset: '-40% 0 0 0',
                transform: 'rotateX(62deg)',
                transformOrigin: 'bottom',
                backgroundImage: 'radial-gradient(rgba(255, 70, 100, 0.65) 1px, transparent 1.5px)',
                backgroundSize: '14px 14px',
                WebkitMaskImage: 'linear-gradient(transparent 0%, #000 70%)',
                maskImage: 'linear-gradient(transparent 0%, #000 70%)',
              }}
            />
          </div>
        </>
      )}
    </div>
  );
};


// ── Barra lateral e cabeçalho: um desenho próprio por região, só nas bordas (nada por cima do conteúdo) ──────────────
const ticks = (dir: 'v' | 'h', rgba: string, step: number): string =>
  `repeating-linear-gradient(${dir === 'v' ? '180deg' : '90deg'}, ${rgba} 0 1px, transparent 1px ${step}px)`;


// ── estilos novos: decoração compacta por região (terminal / sidebar / header) ──────────
const newSkinDecor = (skin: TerminalSkinId, region: 'terminal' | 'sidebar' | 'header'): React.ReactNode => {
  const t = region === 'terminal';
  const h = region === 'header';
  switch (skin) {
    case 'hud': {
      const c = 'rgba(47, 214, 216, 0.75)';
      const o = '#ff6a1a';
      return (
        <div aria-hidden style={fill}>
          <Brackets color={c} size={t ? 20 : 12} inset={4} />
          <Block style={{ top: 3, left: '30%', right: '30%', height: 2, background: c, opacity: 0.6 }} />
          <Block style={{ bottom: 3, left: '12%', width: 40, height: 4, background: `repeating-linear-gradient(135deg, ${o} 0 3px, transparent 3px 6px)` }} />
          <Block style={{ bottom: 3, right: '12%', width: 14, height: 4, background: o }} />
        </div>
      );
    }
    case 'neon': {
      const v = '#5a1fd6';
      const g = '#1effa6';
      return (
        <div aria-hidden style={fill}>
          <Frame color="rgba(122, 63, 255, 0.7)" inset={4} />
          <Block style={{ top: 1, left: 14, width: 34, height: 6, background: g }} />
          <Block style={{ top: 1, left: 52, width: 10, height: 6, background: '#0aa0ff' }} />
          <Block style={{ bottom: 1, right: 14, width: 26, height: 6, background: v }} />
        </div>
      );
    }
    case 'stat': {
      const y = '#f5b800';
      return (
        <div aria-hidden style={fill}>
          <Block style={{ left: 8, top: 8, width: 3, height: t ? 48 : 20, background: '#fff' }} />
          <Block style={{ left: 8, top: 8, width: t ? 64 : 34, height: 3, background: y }} />
          <Block style={{ left: 8, right: 8, bottom: 6, height: 1, background: 'rgba(245, 184, 0, 0.5)' }} />
          <Block style={{ right: 8, bottom: 4, width: 5, height: 5, background: y }} />
        </div>
      );
    }
    case 'flow': {
      const r = '#ee2a4e';
      return (
        <div aria-hidden style={fill}>
          <Block style={{ left: 6, top: 6, width: '40%', height: 2, background: r }} />
          <Block style={{ left: 6, top: 6, width: 2, height: t ? '30%' : 14, background: r }} />
          <Block style={{ left: 2, top: 2, width: 10, height: 10, border: `2px solid ${r}`, background: '#17181b', borderRadius: '50%' }} />
          <Block style={{ right: 6, bottom: 6, width: '30%', height: 2, background: r }} />
          <Block style={{ right: 6, bottom: 6, width: 2, height: t ? '24%' : 12, background: r }} />
          <Block style={{ right: 2, bottom: 2, width: 10, height: 10, border: `2px solid ${r}`, background: '#17181b', borderRadius: '50%' }} />
        </div>
      );
    }
    case 'recon': {
      const r = '#e0383e';
      return (
        <div aria-hidden style={fill}>
          <Frame color="rgba(196, 207, 203, 0.3)" inset={4} />
          <Block style={{ top: 4, left: 4, width: 70, height: 7, background: 'repeating-linear-gradient(135deg, rgba(196, 207, 203, 0.55) 0 3px, transparent 3px 6px)' }} />
          <Block style={{ top: 4, right: 4, width: 36, height: 7, background: r }} />
          {t && <Block style={{ bottom: 8, left: 8, fontSize: 9, color: 'rgba(196, 207, 203, 0.5)', fontFamily: 'monospace' }}>+</Block>}
          {t && <Block style={{ bottom: 8, right: 8, fontSize: 9, color: 'rgba(196, 207, 203, 0.5)', fontFamily: 'monospace' }}>+</Block>}
        </div>
      );
    }
    case 'ember': {
      const o = '#ff6a1a';
      const L = t ? 34 : 16;
      const w = t ? 5 : 3;
      return (
        <div aria-hidden style={{ ...fill, filter: 'drop-shadow(0 0 4px rgba(255, 106, 26, 0.7))' }}>
          <Block style={{ top: 6, left: 6, width: L, height: w, background: o }} />
          <Block style={{ top: 6, left: 6, width: w, height: L, background: o }} />
          <Block style={{ bottom: 6, right: 6, width: L, height: w, background: o }} />
          <Block style={{ bottom: 6, right: 6, width: w, height: L, background: o }} />
        </div>
      );
    }
    default:
      return null;
  }
};

const SidebarDecor: React.FC<{ skin: TerminalSkinId }> = ({ skin }) => {
  const nd = newSkinDecor(skin, 'sidebar');
  if (nd) return <>{nd}</>;
  switch (skin) {
    case 'cyberdeck': {
      const c = 'rgba(255, 99, 90, 0.6)';
      return (
        <div aria-hidden style={fill}>
          <Block style={{ right: 3, top: '12%', bottom: '12%', width: 6, borderRight: `1px solid ${c}`, background: ticks('v', c, 8) }} />
          <Block style={{ left: 8, bottom: 3, width: '38%', height: 2, background: c }} />
          <Block style={{ left: 'calc(38% + 14px)', bottom: 3, width: 10, height: 2, background: c, opacity: 0.5 }} />
        </div>
      );
    }
    case 'industrial': {
      const o = '#ee6a3a';
      return (
        <div aria-hidden style={fill}>
          <Block style={{ left: 0, top: 0, bottom: 0, width: 3, background: `repeating-linear-gradient(180deg, ${o} 0 22px, transparent 22px 26px)` }} />
          <Block style={{ right: 0, bottom: 0, width: 24, height: 9, background: o }} />
        </div>
      );
    }
    case 'amber': {
      const c = 'rgba(255, 180, 58, 0.55)';
      return (
        <div aria-hidden style={fill}>
          <Block style={{ right: 3, top: 8, bottom: 8, width: 0, borderRight: `1px dashed ${c}` }} />
        </div>
      );
    }
    case 'reds': {
      return (
        <div aria-hidden style={fill}>
          <Block style={{ right: 4, top: 6, bottom: 6, width: 1, background: 'rgba(255, 255, 255, 0.35)' }} />
          {['20%', '50%', '80%'].map((t) => (
            <Block key={t} style={{ right: 2, top: t, width: 5, height: 5, background: '#ff8a8a' }} />
          ))}
        </div>
      );
    }
    case 'bios': {
      return (
        <div aria-hidden style={fill}>
          <Block style={{ right: 3, top: 5, bottom: 5, width: 1, background: 'rgba(95, 242, 192, 0.6)' }} />
          <Block style={{ right: 6, top: 5, bottom: 5, width: 1, background: 'rgba(95, 242, 192, 0.25)' }} />
        </div>
      );
    }
    case 'scan': {
      const m = 'rgba(205, 238, 221, 0.6)';
      return (
        <div aria-hidden style={fill}>
          <Block style={{ left: 0, top: 0, bottom: 0, width: 5, background: `repeating-linear-gradient(135deg, ${m} 0 2px, transparent 2px 5px)`, opacity: 0.7 }} />
          <Block style={{ left: 10, right: 8, bottom: 3, height: 1, background: m }} />
        </div>
      );
    }
    case 'blood': {
      return (
        <div aria-hidden style={fill}>
          <Block style={{ left: 3, top: '10%', bottom: '10%', width: 6, background: ticks('v', 'rgba(255, 255, 255, 0.5)', 6) }} />
          <Block style={{ right: 4, top: 4, width: 6, height: 6, background: '#ff2b2b' }} />
        </div>
      );
    }
    case 'minimal': {
      const w = 'rgba(220, 228, 226, 0.4)';
      return (
        <div aria-hidden style={fill}>
          <Block style={{ right: 3, top: 8, bottom: 8, width: 1, background: w }} />
          {['25%', '55%', '82%'].map((t) => (
            <Block key={t} style={{ right: 1, top: t, width: 5, height: 5, border: `1px solid ${w}`, background: '#050606' }} />
          ))}
        </div>
      );
    }
    case 'discovery': {
      return (
        <div aria-hidden style={fill}>
          {[0, 1, 2].map((i) => (
            <Block key={i} style={{ right: 7 + i * 8, bottom: 5, width: 3, height: 3, borderRadius: '50%', background: i === 0 ? '#ff3b5c' : 'rgba(255, 255, 255, 0.4)' }} />
          ))}
        </div>
      );
    }
    default:
      return null;
  }
};

const HeaderDecor: React.FC<{ skin: TerminalSkinId }> = ({ skin }) => {
  const nd = newSkinDecor(skin, 'header');
  if (nd) return <>{nd}</>;
  switch (skin) {
    case 'cyberdeck': {
      const c = 'rgba(255, 99, 90, 0.7)';
      return (
        <div aria-hidden style={fill}>
          <Block style={{ left: 0, right: 0, bottom: 0, height: 1, background: `linear-gradient(90deg, ${c}, rgba(255, 99, 90, 0.05))` }} />
          <Block style={{ right: 10, bottom: 0, width: 34, height: 3, background: c }} />
        </div>
      );
    }
    case 'industrial': {
      const o = '#ee6a3a';
      return (
        <div aria-hidden style={fill}>
          <Block style={{ left: 0, top: 7, bottom: 7, width: 3, background: o }} />
          <Block style={{ right: 0, bottom: 0, width: 44, height: 3, background: o }} />
          <Block style={{ left: 0, right: 44, bottom: 0, height: 1, background: 'rgba(238, 106, 58, 0.3)' }} />
        </div>
      );
    }
    case 'amber': {
      return (
        <div aria-hidden style={fill}>
          <Block style={{ left: 6, right: 6, bottom: 0, height: 0, borderBottom: '1px dashed rgba(255, 180, 58, 0.55)' }} />
          <Block style={{ left: 0, bottom: 0, width: 1, height: 7, background: 'rgba(255, 180, 58, 0.7)' }} />
          <Block style={{ right: 0, bottom: 0, width: 1, height: 7, background: 'rgba(255, 180, 58, 0.7)' }} />
        </div>
      );
    }
    case 'reds': {
      return (
        <div aria-hidden style={fill}>
          <Block style={{ left: 0, right: 0, bottom: 0, height: 1, background: 'rgba(255, 255, 255, 0.35)' }} />
          {[10, 18, 26].map((r, i) => (
            <Block key={r} style={{ right: r, bottom: 3, width: 4, height: 4, background: '#ff8a8a', opacity: 1 - i * 0.3 }} />
          ))}
        </div>
      );
    }
    case 'bios': {
      return (
        <div aria-hidden style={fill}>
          <Block style={{ left: 0, right: 0, bottom: 0, height: 1, background: 'rgba(95, 242, 192, 0.6)' }} />
          <Block style={{ left: 0, right: 0, bottom: 3, height: 1, background: 'rgba(95, 242, 192, 0.22)' }} />
        </div>
      );
    }
    case 'scan': {
      const m = 'rgba(205, 238, 221, 0.6)';
      return (
        <div aria-hidden style={fill}>
          <Block style={{ left: 0, bottom: 0, width: '28%', height: 4, background: `repeating-linear-gradient(135deg, ${m} 0 2px, transparent 2px 5px)` }} />
          <Block style={{ left: '28%', right: 0, bottom: 0, height: 1, background: m }} />
        </div>
      );
    }
    case 'blood': {
      return (
        <div aria-hidden style={fill}>
          <Block style={{ left: 0, right: 0, bottom: 0, height: 4, background: ticks('h', 'rgba(255, 255, 255, 0.5)', 6) }} />
          <Block style={{ left: 0, bottom: 0, width: 14, height: 4, background: '#ff2b2b' }} />
        </div>
      );
    }
    case 'minimal': {
      const w = 'rgba(220, 228, 226, 0.45)';
      return (
        <div aria-hidden style={fill}>
          <Block style={{ left: 0, right: 0, bottom: 0, height: 1, background: `linear-gradient(90deg, transparent, ${w} 20%, ${w} 80%, transparent)` }} />
          {['15%', '85%'].map((l) => (
            <Block key={l} style={{ left: l, bottom: 2, width: 2, height: 2, background: '#fff', boxShadow: '0 0 5px rgba(255, 255, 255, 0.8)' }} />
          ))}
        </div>
      );
    }
    case 'discovery': {
      return (
        <div aria-hidden style={fill}>
          <Block style={{ left: 0, right: 0, bottom: 0, height: 1, background: 'linear-gradient(90deg, rgba(255, 255, 255, 0.55), rgba(255, 255, 255, 0.1) 70%, transparent)' }} />
          <Block style={{ left: 8, bottom: -3, width: 7, height: 7, borderRadius: '50%', border: '1px solid rgba(255, 255, 255, 0.85)', background: '#05060d' }} />
        </div>
      );
    }
    default:
      return null;
  }
};

/** Moldura da tela inteira: só cantos e vinheta, para o efeito envolver tudo sem cobrir informação */
const ScreenDecor: React.FC<{ skin: TerminalSkinId }> = ({ skin }) => {
  const d = TERMINAL_SKINS.find((s) => s.id === skin);
  if (!d?.line) return null;
  return (
    <div aria-hidden style={fill}>
      {(skin === 'amber' || skin === 'scan') && <Scan rgb={skin === 'amber' ? '255, 170, 40' : '205, 238, 221'} a={0.03} step={4} />}
      <Vignette a={skin === 'minimal' || skin === 'reds' ? 0.25 : 0.4} />
      <Brackets color={d.line} size={18} inset={3} />
    </div>
  );
};

/** Moldura do estilo (por cima do texto, sem capturar o mouse). */
export const TerminalSkinOverlay: React.FC<{ skin: TerminalSkinId; region?: SkinRegion }> = ({ skin, region = 'terminal' }) => {
  if (region === 'sidebar') return <SidebarDecor skin={skin} />;
  if (region === 'header') return <HeaderDecor skin={skin} />;
  if (region === 'screen') return <ScreenDecor skin={skin} />;
  const nd = newSkinDecor(skin, 'terminal');
  if (nd) return <>{nd}</>;
  switch (skin) {
    case 'cyberdeck': {
      const c = 'rgba(255, 99, 90, 0.7)';
      return (
        <div aria-hidden style={fill}>
          <Scan rgb="255, 99, 90" a={0.05} />
          <Brackets color={c} />
          <Block style={{ left: 4, top: '18%', bottom: '18%', width: 7, borderLeft: '1px solid rgba(255, 99, 90, 0.35)', background: 'repeating-linear-gradient(180deg, rgba(255, 99, 90, 0.55) 0 1px, transparent 1px 10px)' }} />
          <Block style={{ top: 4, left: 28, right: 28, height: 1, background: 'linear-gradient(90deg, rgba(255, 99, 90, 0.55), rgba(255, 99, 90, 0.05) 70%, transparent)' }} />
          <Block style={{ top: 4, right: 28, width: 46, height: 3, background: c }} />
        </div>
      );
    }
    case 'industrial': {
      const o = '#ee6a3a';
      return (
        <div aria-hidden style={fill}>
          <div style={{ ...fill, backgroundImage: GRAIN, opacity: 0.05, mixBlendMode: 'screen' }} />
          <Block style={{ left: 0, top: 0, bottom: 0, width: 1, background: 'rgba(238, 106, 58, 0.25)' }} />
          <Block style={{ left: 0, top: '8%', width: 4, height: '16%', background: o }} />
          <Block style={{ right: 0, top: 0, width: 30, height: 12, background: o }} />
          <Block style={{ right: 0, top: 12, width: 1, height: '30%', background: 'rgba(238, 106, 58, 0.3)' }} />
          <Block style={{ left: 8, right: 8, bottom: 6, height: 2, background: o }} />
          <Block style={{ left: 8, right: 8, bottom: 1, height: 2, background: 'rgba(238, 106, 58, 0.35)' }} />
        </div>
      );
    }
    case 'amber': {
      return (
        <div aria-hidden style={fill}>
          <Scan rgb="255, 170, 40" a={0.035} step={4} />
          <Vignette a={0.5} />
          <Brackets color="rgba(255, 180, 58, 0.75)" size={18} inset={6} />
          <Block
            style={{ top: 3, left: '50%', transform: 'translateX(-50%)', padding: '0 8px', height: 12, lineHeight: '12px', fontSize: 9, letterSpacing: 1, background: '#ffb43a', color: '#1a0f03', fontFamily: 'monospace' }}
          >
            SYSTEM STATISTICS
          </Block>
        </div>
      );
    }
    case 'reds': {
      return (
        <div aria-hidden style={fill}>
          <Frame color="rgba(255, 255, 255, 0.55)" inset={5} radius={6} />
          <Block style={{ top: 9, left: 12, width: 5, height: 5, background: '#ff8a8a' }} />
          <Block style={{ top: 9, left: 20, width: 5, height: 5, background: '#ff8a8a', opacity: 0.6 }} />
          <Block style={{ top: 9, left: 28, width: 5, height: 5, background: '#ff8a8a', opacity: 0.3 }} />
          <Block style={{ bottom: 5, right: 18, width: 54, height: 3, background: '#ff8a8a' }} />
        </div>
      );
    }
    case 'bios': {
      const g = 'rgba(95, 242, 192, 0.55)';
      return (
        <div aria-hidden style={fill}>
          <Scan rgb="95, 242, 192" a={0.06} />
          <Frame color={g} inset={5} />
          <Block style={{ top: 18, left: 5, right: 5, height: 1, background: g }} />
          <Vignette a={0.45} />
        </div>
      );
    }
    case 'scan': {
      const g = 'rgba(205, 238, 221, 0.6)';
      return (
        <div aria-hidden style={fill}>
          <Scan rgb="205, 238, 221" a={0.1} step={3} />
          <Brackets color={g} size={20} inset={5} />
          <Block style={{ top: 5, left: 30, width: 64, height: 6, background: 'repeating-linear-gradient(135deg, rgba(205, 238, 221, 0.7) 0 2px, transparent 2px 5px)' }} />
          <Block style={{ top: 5, right: 30, width: 90, height: 1, background: g }} />
          <Vignette a={0.55} />
        </div>
      );
    }
    case 'blood': {
      return (
        <div aria-hidden style={fill}>
          <Frame color="rgba(255, 255, 255, 0.7)" inset={5} />
          <Block style={{ top: 9, left: 11, width: 6, height: 6, background: '#ff2b2b' }} />
          <Block style={{ top: 9, left: 21, width: 6, height: 6, background: '#ff2b2b', opacity: 0.5 }} />
          <Block style={{ right: 9, top: '15%', bottom: '15%', width: 8, background: 'repeating-linear-gradient(180deg, rgba(255, 255, 255, 0.55) 0 1px, transparent 1px 6px)' }} />
        </div>
      );
    }
    case 'minimal': {
      const w = 'rgba(220, 228, 226, 0.45)';
      const plus = (style: React.CSSProperties, k: string) => (
        <Block key={k} style={{ ...style, fontSize: 9, lineHeight: '9px', color: w, fontFamily: 'monospace' }}>
          +
        </Block>
      );
      return (
        <div aria-hidden style={fill}>
          <Brackets color={w} size={12} inset={6} />
          {/* fio vertical com setas, como o módulo da referência */}
          <Block style={{ right: '9%', top: '12%', bottom: '12%', width: 1, background: w }} />
          <Block style={{ right: 'calc(9% - 3px)', top: 'calc(12% - 7px)', width: 7, height: 7, borderRight: `1px solid ${w}`, borderBottom: `1px solid ${w}`, transform: 'rotate(45deg)' }} />
          <Block style={{ right: 'calc(9% - 3px)', bottom: 'calc(12% - 7px)', width: 7, height: 7, borderLeft: `1px solid ${w}`, borderTop: `1px solid ${w}`, transform: 'rotate(45deg)' }} />
          {/* pontos e quadradinhos soltos */}
          {[
            { left: '24%', top: 9 },
            { left: '62%', bottom: 10 },
            { right: '20%', top: '30%' },
          ].map((p, i) => (
            <Block key={i} style={{ ...p, width: 2, height: 2, background: 'rgba(255, 255, 255, 0.8)', boxShadow: '0 0 6px rgba(255, 255, 255, 0.8)' }} />
          ))}
          <Block style={{ left: '38%', bottom: 12, width: 5, height: 5, border: `1px solid ${w}` }} />
          {plus({ left: '30%', top: 9 }, 'p1')}
        </div>
      );
    }
    case 'discovery': {
      const w = 'rgba(255, 255, 255, 0.85)';
      const hex = (style: React.CSSProperties, k: string, a = 0.5) => (
        <svg key={k} width="22" height="24" viewBox="0 0 22 24" style={{ position: 'absolute', ...style }}>
          <polygon points="11,1 21,6.5 21,17.5 11,23 1,17.5 1,6.5" fill="rgba(255, 60, 90, 0.08)" stroke={`rgba(255, 255, 255, ${a})`} strokeWidth="1" />
        </svg>
      );
      return (
        <div aria-hidden style={fill}>
          {/* rótulos pequenos, espaçados, no topo */}
          <Block style={{ top: 4, left: 24, fontSize: 8, letterSpacing: 3, color: 'rgba(255, 255, 255, 0.5)', fontFamily: 'monospace' }}>SECTION — 01</Block>
          {[0, 1, 2].map((i) => (
            <Block key={i} style={{ right: 12, top: 10 + i * 9, width: 4, height: 4, borderRadius: '50%', background: i === 0 ? '#fff' : 'transparent', border: '1px solid rgba(255, 255, 255, 0.85)' }} />
          ))}
          {/* hexágonos discretos sobre a nuvem */}
          {hex({ right: '16%', top: '46%' }, 'h1', 0.55)}
          {hex({ right: '27%', top: '58%' }, 'h2', 0.35)}
          {hex({ right: '11%', top: '66%' }, 'h3', 0.3)}
          <Block style={{ left: 24, bottom: 4, fontSize: 8, letterSpacing: 3, color: 'rgba(255, 255, 255, 0.4)', fontFamily: 'monospace' }}>SCROLL FOR MORE</Block>
        </div>
      );
    }
    default:
      return null;
  }
};
