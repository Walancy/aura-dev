import React from 'react';
import { GripHorizontal, SquareTerminal, X } from 'lucide-react';
import type { TerminalSettingsTabProps } from './settings/TerminalSettingsTab';
import { TERMINAL_FONT_FAMILIES, TERMINAL_THEMES } from '../NativeXTerm';
import { MiniSwitch } from '../ui/MiniSwitch';
import { DevFlowSelect } from '../ui/DevFlowSelect';
import { TERMINAL_SKINS, TerminalSkinBackground, TerminalSkinOverlay, skinGlow, type TerminalSkinId } from '../TerminalSkin';
import { TYPING_EFFECTS, getTypingEffect, setTypingEffect, type TypingEffectId } from '../typingEffects';
import { logSystemActivity } from '../../utils/brainService';

const FONT_SIZES = [10, 11, 12, 13, 14, 16, 18];
const LINE_HEIGHTS = [
  { v: 1, l: '1.0 Compacto' },
  { v: 1.15, l: '1.15 Padrão' },
  { v: 1.3, l: '1.30 Confortável' },
  { v: 1.45, l: '1.45 Amplo' },
];
const CURSORS = [
  { v: 'block', l: 'Bloco' },
  { v: 'bar', l: 'Barra' },
  { v: 'underline', l: 'Sublinhado' },
];
const SCROLLBACKS = [1000, 5000, 10000, 50000];

// Definidos fora do componente: se fossem recriados a cada render, o dropdown aberto era desmontado (e fechava) com qualquer atualização do app
interface UiTokens {
  tk: TerminalSettingsTabProps['themeTokens'];
  isEffectiveDark: boolean;
  accentColor: string;
}

const Row: React.FC<{ tk: UiTokens['tk']; label: string; children: React.ReactNode }> = ({ tk, label, children }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
    <span style={{ fontSize: 11.5, color: tk.textSecondary }}>{label}</span>
    {children}
  </div>
);

const Select = <T extends string | number>(props: { ui: UiTokens; value: T; options: Array<{ v: T; l: string }>; onChange: (v: T) => void; onHover?: (v: T | null) => void }) => (
  <DevFlowSelect
    value={props.value}
    options={props.options.map((o) => ({ value: o.v, label: o.l }))}
    onChange={props.onChange}
    onOptionHover={props.onHover}
    isEffectiveDark={props.ui.isEffectiveDark}
    accentColor={props.ui.accentColor}
    themeTokens={props.ui.tk}
    width={170}
  />
);

/** Versão compacta das opções de Configurações → Terminal: uma linha por opção, com dropdowns */
const CompactTerminalOptions: React.FC<TerminalSettingsTabProps> = (t) => {
  const { themeTokens: tk, accentColor, isEffectiveDark } = t;
  // passar o mouse numa opção do dropdown mostra o resultado no preview, sem aplicar
  const [pv, setPv] = React.useState<{ skin?: TerminalSkinId; theme?: string; font?: string; size?: number; lh?: number; cursor?: 'block' | 'bar' | 'underline' }>({});
  const [typingFx, setTypingFx] = React.useState<TypingEffectId>(getTypingEffect);
  const hover = <K extends keyof typeof pv>(key: K) => (v: (typeof pv)[K] | null) =>
    setPv((p) => {
      const { [key]: _drop, ...rest } = p;
      return v == null ? rest : { ...rest, [key]: v };
    });
  const skin = pv.skin ?? t.terminalSkin ?? 'none';
  const skinDef = pv.skin ? TERMINAL_SKINS.find((x) => x.id === pv.skin) : undefined; // o estilo traz tema e fonte próprios
  const theme = TERMINAL_THEMES[pv.theme ?? skinDef?.theme ?? t.terminalThemePreset ?? 'default'] || TERMINAL_THEMES.default;
  const font = `"${pv.font ?? skinDef?.font ?? t.terminalFontFamily ?? 'JetBrains Mono'}", "JetBrains Mono", Menlo, monospace`;
  const cursorStyle = pv.cursor ?? t.terminalCursorStyle;
  const divider = <div style={{ height: 1, background: isEffectiveDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }} />;
  const ui: UiTokens = { tk, isEffectiveDark, accentColor };
  const log = (acao: string, extra?: Record<string, unknown>) => logSystemActivity('configuracoes_terminal', acao, 'terminal', extra);

  const Toggle = (label: string, checked: boolean, onChange: (v: boolean) => void, key: string) => (
    <Row tk={tk} label={label} key={key}>
      <MiniSwitch
        checked={checked}
        onChange={() => {
          log(`toggle_${key}`, { ativo: !checked });
          onChange(!checked);
        }}
        accentColor={accentColor}
      />
    </Row>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* preview pequeno */}
      <div
        style={{
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 8,
          padding: '8px 10px',
          background: skin !== 'none' ? 'transparent' : theme.background,
          color: theme.foreground,
          fontFamily: font,
          fontSize: pv.size ?? t.terminalFontSize,
          lineHeight: pv.lh ?? (t.terminalLineHeight || 1.15),
          textShadow: skinGlow(skin),
          userSelect: 'none',
        }}
      >
        <TerminalSkinBackground skin={skin} />
        <div style={{ position: 'relative' }}>
          <div>
            <span style={{ color: theme.cyan }}>~/aura-dev</span> <span style={{ color: theme.green }}>git:(main)</span>
          </div>
          <div>
            <span style={{ color: accentColor }}>❯</span> npm run dev
          </div>
          <div>
            <span style={{ color: accentColor }}>❯</span> aura-dev
            <span style={{ color: accentColor }}>{cursorStyle === 'block' ? '█' : cursorStyle === 'bar' ? '│' : '_'}</span>
          </div>
        </div>
        <TerminalSkinOverlay skin={skin} />
      </div>

      <Row tk={tk} label="Estilo visual">
        <Select
          ui={ui}
          value={(t.terminalSkin || 'none') as TerminalSkinId}
          onHover={hover('skin')}
          options={TERMINAL_SKINS.map((s) => ({ v: s.id, l: s.label }))}
          onChange={(id) => {
            const sk = TERMINAL_SKINS.find((x) => x.id === id)!;
            log('alterar_estilo_visual', { estilo: id });
            t.setTerminalSkin?.(id);
            if (sk.theme) t.setTerminalThemePreset?.(sk.theme);
            if (sk.font) t.setTerminalFontFamily?.(sk.font);
            if (sk.size) t.setTerminalFontSize(sk.size);
          }}
        />
      </Row>
      <Row tk={tk} label="Tema de cores">
        <Select
          ui={ui}
          value={t.terminalThemePreset || 'default'}
          onHover={hover('theme')}
          options={Object.values(TERMINAL_THEMES).map((th) => ({ v: th.id, l: th.name }))}
          onChange={(v) => {
            log('alterar_tema', { tema: v });
            t.setTerminalThemePreset?.(v);
          }}
        />
      </Row>
      <Row tk={tk} label="Fonte">
        <Select
          ui={ui}
          value={t.terminalFontFamily || 'JetBrains Mono'}
          onHover={hover('font')}
          options={TERMINAL_FONT_FAMILIES.map((f) => ({ v: f.id, l: f.label }))}
          onChange={(v) => {
            log('alterar_familia_fonte', { fontFamily: v });
            t.setTerminalFontFamily?.(v);
          }}
        />
      </Row>
      <Row tk={tk} label="Tamanho">
        <Select ui={ui} value={t.terminalFontSize} onHover={hover('size')} options={FONT_SIZES.map((n) => ({ v: n, l: `${n}px` }))} onChange={t.setTerminalFontSize} />
      </Row>
      <Row tk={tk} label="Altura da linha">
        <Select ui={ui} value={t.terminalLineHeight || 1.15} onHover={hover('lh')} options={LINE_HEIGHTS.map((x) => ({ v: x.v, l: x.l }))} onChange={(v) => t.setTerminalLineHeight?.(v)} />
      </Row>
      <Row tk={tk} label="Cursor">
        <Select ui={ui} value={t.terminalCursorStyle} onHover={hover('cursor')} options={CURSORS.map((x) => ({ v: x.v as 'block' | 'bar' | 'underline', l: x.l }))} onChange={t.setTerminalCursorStyle} />
      </Row>
      <Row tk={tk} label="Efeito ao digitar">
        <Select
          ui={ui}
          value={typingFx}
          options={TYPING_EFFECTS.map((e) => ({ v: e.id, l: e.label }))}
          onChange={(id) => {
            log('alterar_efeito_digitacao', { efeito: id });
            setTypingEffect(id);
            setTypingFx(id);
          }}
        />
      </Row>
      <Row tk={tk} label="Histórico de rolagem">
        <Select ui={ui} value={t.terminalScrollback} options={SCROLLBACKS.map((n) => ({ v: n, l: `${n / 1000}k linhas` }))} onChange={t.setTerminalScrollback} />
      </Row>

      {divider}

      {Toggle('Cursor piscante', t.terminalCursorBlink, t.setTerminalCursorBlink, 'cursor_blink')}
      {Toggle('Copiar ao selecionar', t.terminalCopyOnSelect, t.setTerminalCopyOnSelect, 'copy_on_select')}
      {t.setTerminalScrollOnUserInput && Toggle('Rolar ao digitar', t.terminalScrollOnUserInput ?? true, t.setTerminalScrollOnUserInput, 'scroll_on_input')}
      {t.setTerminalDrawBoldTextInBrightColors && Toggle('Negrito com cores vivas', t.terminalDrawBoldTextInBrightColors ?? true, t.setTerminalDrawBoldTextInBrightColors, 'bold_bright')}
    </div>
  );
};

/** Popup arrastável "Personalizar CLI": as mesmas opções de Configurações → Terminal, com preview ao vivo */
export const CliCustomizePopup: React.FC<TerminalSettingsTabProps & { onClose: () => void }> = ({ onClose, ...tab }) => {
  const { themeTokens, accentColor } = tab;
  const W = 340;
  const [pos, setPos] = React.useState(() => ({ x: Math.max(20, window.innerWidth - W - 40), y: 65 }));
  const drag = React.useRef<{ mx: number; my: number; x: number; y: number } | null>(null);
  const [dragging, setDragging] = React.useState(false);

  React.useEffect(() => {
    if (!dragging) return;
    const move = (e: MouseEvent) => {
      if (!drag.current) return;
      setPos({
        x: Math.max(8, Math.min(window.innerWidth - W - 8, drag.current.x + e.clientX - drag.current.mx)),
        y: Math.max(8, Math.min(window.innerHeight - 120, drag.current.y + e.clientY - drag.current.my)),
      });
    };
    const up = () => setDragging(false);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
  }, [dragging]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      style={{
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        width: W,
        maxWidth: 'calc(100vw - 32px)',
        maxHeight: 'calc(100vh - 90px)',
        background: themeTokens.bgCard,
        borderRadius: 10,
        border: `1px solid ${themeTokens.border}`,
        boxShadow: '0 24px 64px rgba(0, 0, 0, 0.85)',
        zIndex: 999999,
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        userSelect: dragging ? 'none' : 'auto',
        fontFamily: 'Poppins, -apple-system, sans-serif',
        overflow: 'hidden',
      }}
    >
      <div
        onMouseDown={(e) => {
          if (e.button !== 0) return;
          drag.current = { mx: e.clientX, my: e.clientY, x: pos.x, y: pos.y };
          setDragging(true);
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 12px',
          background: themeTokens.bgCardSecondary,
          cursor: dragging ? 'grabbing' : 'grab',
          userSelect: 'none',
          flexShrink: 0,
        }}
        title="Arraste para reposicionar na tela"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <GripHorizontal size={14} color={themeTokens.textSecondary} style={{ opacity: 0.8 }} />
          <SquareTerminal size={14} color={accentColor} />
          <span style={{ fontSize: 12.5, fontWeight: 600, color: themeTokens.textPrimary }}>Personalizar CLI</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          onMouseDown={(e) => e.stopPropagation()}
          title="Fechar (Esc)"
          style={{ background: 'transparent', border: 'none', color: themeTokens.textSecondary, cursor: 'pointer', padding: 3, display: 'flex', borderRadius: 4 }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = '#ff5f56')}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = themeTokens.textSecondary)}
        >
          <X size={15} />
        </button>
      </div>
      <div style={{ padding: 12, overflowY: 'auto', minHeight: 0 }}>
        <CompactTerminalOptions {...tab} />
      </div>
    </div>
  );
};
