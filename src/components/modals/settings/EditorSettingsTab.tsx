import React from 'react';
import { hexToRgba } from '../../../utils/color';
import { MiniSwitch } from '../../ui/MiniSwitch';
import type { ThemeTokens } from '../../../types/ide';

export interface EditorSettingsTabProps {
  themeTokens: ThemeTokens;
  isEffectiveDark: boolean;
  accentColor: string;
  editorFontSize: number;
  setEditorFontSize: (value: number) => void;
  editorTabSize: number;
  setEditorTabSize: (value: number) => void;
  editorWordWrap: boolean;
  setEditorWordWrap: (value: boolean) => void;
  editorMinimap: boolean;
  setEditorMinimap: (value: boolean) => void;
  editorLineNumbers: boolean;
  setEditorLineNumbers: (value: boolean) => void;
  editorSmoothScrolling: boolean;
  setEditorSmoothScrolling: (value: boolean) => void;
  editorBracketColorization: boolean;
  setEditorBracketColorization: (value: boolean) => void;
  editorRenderWhitespace: boolean;
  setEditorRenderWhitespace: (value: boolean) => void;
}

export const EditorSettingsTab: React.FC<EditorSettingsTabProps> = ({
  themeTokens,
  isEffectiveDark,
  accentColor,
  editorFontSize,
  setEditorFontSize,
  editorTabSize,
  setEditorTabSize,
  editorWordWrap,
  setEditorWordWrap,
  editorMinimap,
  setEditorMinimap,
  editorLineNumbers,
  setEditorLineNumbers,
  editorSmoothScrolling,
  setEditorSmoothScrolling,
  editorBracketColorization,
  setEditorBracketColorization,
  editorRenderWhitespace,
  setEditorRenderWhitespace,
}) => {
  return (
    <>
      <div>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Tamanho da Fonte (Font Size)</div>
        <div style={{ fontSize: 12, color: themeTokens.textSecondary, marginBottom: 10 }}>
          Ajusta a escala tipográfica do editor de código Monaco.
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {[12, 13, 14, 15, 16, 18].map((size) => (
            <button
              key={size}
              type="button"
              onClick={() => setEditorFontSize(size)}
              style={{
                padding: '6px 14px',
                borderRadius: 6,
                border: editorFontSize === size ? `1.5px solid ${accentColor}` : `1px solid ${themeTokens.border}`,
                background: editorFontSize === size ? hexToRgba(accentColor, 0.15) : 'transparent',
                color: editorFontSize === size ? accentColor : themeTokens.textPrimary,
                fontSize: 12,
                fontWeight: editorFontSize === size ? 600 : 400,
                cursor: 'pointer',
              }}
            >
              {size}px
            </button>
          ))}
        </div>
      </div>

      <div>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Tamanho da Tabulação (Tab Size)</div>
        <div style={{ fontSize: 12, color: themeTokens.textSecondary, marginBottom: 10 }}>
          Número de espaços inseridos ao pressionar a tecla Tab.
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {[2, 4].map((size) => (
            <button
              key={size}
              type="button"
              onClick={() => setEditorTabSize(size)}
              style={{
                padding: '6px 14px',
                borderRadius: 6,
                border: editorTabSize === size ? `1.5px solid ${accentColor}` : `1px solid ${themeTokens.border}`,
                background: editorTabSize === size ? hexToRgba(accentColor, 0.15) : 'transparent',
                color: editorTabSize === size ? accentColor : themeTokens.textPrimary,
                fontSize: 12,
                fontWeight: editorTabSize === size ? 600 : 400,
                cursor: 'pointer',
              }}
            >
              {size} espaços
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {[
          {
            label: 'Quebra Automática de Linha (Word Wrap)',
            desc: 'Quebra linhas longas sem necessidade de rolagem horizontal',
            checked: editorWordWrap,
            onChange: () => setEditorWordWrap(!editorWordWrap),
          },
          {
            label: 'Minimapa de Código (Minimap)',
            desc: 'Exibe a visão geral em miniatura do arquivo no lado direito',
            checked: editorMinimap,
            onChange: () => setEditorMinimap(!editorMinimap),
          },
          {
            label: 'Números de Linha (Line Numbers)',
            desc: 'Exibe a numeração de linhas na margem esquerda do editor',
            checked: editorLineNumbers,
            onChange: () => setEditorLineNumbers(!editorLineNumbers),
          },
          {
            label: 'Rolagem Suave (Smooth Scrolling)',
            desc: 'Anima a rolagem do editor em vez de saltos instantâneos',
            checked: editorSmoothScrolling,
            onChange: () => setEditorSmoothScrolling(!editorSmoothScrolling),
          },
          {
            label: 'Colorização de Pares de Colchetes',
            desc: 'Colore pares correspondentes de (), [] e {} para facilitar a leitura',
            checked: editorBracketColorization,
            onChange: () => setEditorBracketColorization(!editorBracketColorization),
          },
          {
            label: 'Renderizar Espaços em Branco',
            desc: 'Exibe pontos e setas para espaços e tabulações no código',
            checked: editorRenderWhitespace,
            onChange: () => setEditorRenderWhitespace(!editorRenderWhitespace),
          },
        ].map((row) => (
          <div
            key={row.label}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              padding: '9px 10px',
              borderRadius: 8,
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = isEffectiveDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: themeTokens.textPrimary }}>{row.label}</div>
              <div style={{ fontSize: 11.5, color: themeTokens.textSecondary }}>{row.desc}</div>
            </div>
            <MiniSwitch checked={row.checked} onChange={row.onChange} accentColor={accentColor} />
          </div>
        ))}
      </div>
    </>
  );
};
