import React from 'react';
import { hexToRgba } from '../../../utils/color';
import { MiniSwitch } from '../../ui/MiniSwitch';
import { DevFlowSelect } from '../../ui/DevFlowSelect';
import type { ThemeTokens } from '../../../types/ide';
import { logSystemActivity } from '../../../utils/brainService';

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

  // Additional customizable options
  editorFontFamily?: string;
  setEditorFontFamily?: (value: string) => void;
  editorLineHeight?: number;
  setEditorLineHeight?: (value: number) => void;
  editorCursorStyle?: 'line' | 'block' | 'underline' | 'line-thin' | 'block-outline';
  setEditorCursorStyle?: (value: 'line' | 'block' | 'underline' | 'line-thin' | 'block-outline') => void;
  editorCursorBlinking?: 'blink' | 'smooth' | 'phase' | 'expand' | 'solid';
  setEditorCursorBlinking?: (value: 'blink' | 'smooth' | 'phase' | 'expand' | 'solid') => void;
  editorGuides?: boolean;
  setEditorGuides?: (value: boolean) => void;
  editorAutoClosingBrackets?: boolean;
  setEditorAutoClosingBrackets?: (value: boolean) => void;
  editorHighlightActiveLine?: 'all' | 'line' | 'none';
  setEditorHighlightActiveLine?: (value: 'all' | 'line' | 'none') => void;
  editorFormatOnSave?: boolean;
  setEditorFormatOnSave?: (value: boolean) => void;
  editorCodeFolding?: boolean;
  setEditorCodeFolding?: (value: boolean) => void;
}

const FONT_FAMILY_OPTIONS = [
  { value: 'JetBrains Mono', label: 'JetBrains Mono (Padrão)', description: 'Monospace' },
  { value: 'Fira Code', label: 'Fira Code', description: 'Ligatures' },
  { value: 'Cascadia Code', label: 'Cascadia Code', description: 'Microsoft' },
  { value: 'Source Code Pro', label: 'Source Code Pro', description: 'Adobe' },
  { value: 'Menlo', label: 'Menlo', description: 'macOS' },
  { value: 'Consolas', label: 'Consolas', description: 'Windows' },
];

const FONT_SIZE_OPTIONS = [
  { value: 11, label: '11px - Muito Pequeno' },
  { value: 12, label: '12px - Pequeno' },
  { value: 13, label: '13px - Padrão Aura Dev' },
  { value: 14, label: '14px - Médio' },
  { value: 15, label: '15px - Confortável' },
  { value: 16, label: '16px - Grande' },
  { value: 18, label: '18px - Muito Grande' },
  { value: 20, label: '20px - Destaque' },
];

const LINE_HEIGHT_OPTIONS = [
  { value: 1.2, label: '1.2 - Compacto' },
  { value: 1.4, label: '1.4 - Padrão' },
  { value: 1.5, label: '1.5 - Confortável (Recomendado)' },
  { value: 1.6, label: '1.6 - Espaçoso' },
  { value: 1.8, label: '1.8 - Amplo' },
];

const TAB_SIZE_OPTIONS = [
  { value: 2, label: '2 espaços (JavaScript / TypeScript / HTML)' },
  { value: 4, label: '4 espaços (Python / Rust / C++)' },
  { value: 8, label: '8 espaços (Padrão Clássico)' },
];

const CURSOR_STYLE_OPTIONS = [
  { value: 'line', label: 'Linha vertical (Padrão)' },
  { value: 'block', label: 'Bloco sólido' },
  { value: 'underline', label: 'Sublinhado' },
  { value: 'line-thin', label: 'Linha fina' },
  { value: 'block-outline', label: 'Contorno de bloco' },
];

const CURSOR_BLINKING_OPTIONS = [
  { value: 'smooth', label: 'Fade suave (Padrão Aura Dev)' },
  { value: 'blink', label: 'Piscar clássico' },
  { value: 'phase', label: 'Fase gradual' },
  { value: 'expand', label: 'Expansão' },
  { value: 'solid', label: 'Fixo (sem piscar)' },
];

const LINE_NUMBERS_OPTIONS = [
  { value: 'on', label: 'Ativado (Numeração contínua)' },
  { value: 'relative', label: 'Relativo (Estilo Vim)' },
  { value: 'interval', label: 'A cada 10 linhas' },
  { value: 'off', label: 'Oculto (Sem numeração)' },
];

const RENDER_WHITESPACE_OPTIONS = [
  { value: 'none', label: 'Nenhum marcador' },
  { value: 'boundary', label: 'Apenas entre palavras' },
  { value: 'selection', label: 'Apenas em texto selecionado' },
  { value: 'all', label: 'Todos os espaços e tabulações' },
];

const WORD_WRAP_OPTIONS = [
  { value: 'off', label: 'Desativada (Rolagem horizontal)' },
  { value: 'on', label: 'Ativada (Quebrar na janela)' },
  { value: 'wordWrapColumn', label: 'Quebrar na coluna 80' },
  { value: 'bounded', label: 'Delimitada na janela e coluna' },
];

const HIGHLIGHT_LINE_OPTIONS = [
  { value: 'all', label: 'Linha inteira e margem' },
  { value: 'line', label: 'Apenas texto da linha' },
  { value: 'none', label: 'Sem destaque' },
];

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
  editorFontFamily = 'JetBrains Mono',
  setEditorFontFamily,
  editorLineHeight = 1.5,
  setEditorLineHeight,
  editorCursorStyle = 'line',
  setEditorCursorStyle,
  editorCursorBlinking = 'smooth',
  setEditorCursorBlinking,
  editorGuides = true,
  setEditorGuides,
  editorAutoClosingBrackets = true,
  setEditorAutoClosingBrackets,
  editorHighlightActiveLine = 'all',
  setEditorHighlightActiveLine,
  editorFormatOnSave = true,
  setEditorFormatOnSave,
  editorCodeFolding = true,
  setEditorCodeFolding,
}) => {
  const cardStyle: React.CSSProperties = {
    padding: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    borderRadius: 8,
    background: isEffectiveDark ? 'rgba(255, 255, 255, 0.035)' : 'rgba(0, 0, 0, 0.025)',
    border: 'none',
    boxShadow: 'none',
    boxSizing: 'border-box',
  };

  const titleStyle: React.CSSProperties = {
    fontSize: 10.5,
    fontWeight: 500,
    color: themeTokens.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  };

  const fieldRowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    minHeight: 28,
  };

  const fieldLabelStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    flex: 1,
    minWidth: 0,
  };

  // Convert boolean line numbers to string dropdown value
  const currentLineNumbersValue = editorLineNumbers ? 'on' : 'off';
  const currentWhitespaceValue = editorRenderWhitespace ? 'all' : 'none';
  const currentWordWrapValue = editorWordWrap ? 'on' : 'off';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      {/* 1. Tipografia do Editor */}
      <div style={cardStyle}>
        <div style={titleStyle}>Tipografia do Editor</div>

        {/* Família da Fonte */}
        <div style={fieldRowStyle}>
          <div style={fieldLabelStyle}>
            <span style={{ fontSize: 12, fontWeight: 400, color: themeTokens.textPrimary }}>
              Família da Fonte
            </span>
            <span style={{ fontSize: 11, color: themeTokens.textSecondary }}>
              Tipografia de código utilizada no editor Monaco.
            </span>
          </div>
          <div style={{ width: 200, flexShrink: 0 }}>
            <DevFlowSelect
              value={editorFontFamily}
              onChange={(val) => {
                logSystemActivity('configuracoes_editor', 'alterar_familia_fonte', String(val), {
                  fontFamily: val,
                });
                setEditorFontFamily?.(String(val));
              }}
              options={FONT_FAMILY_OPTIONS}
              isEffectiveDark={isEffectiveDark}
              accentColor={accentColor}
              themeTokens={themeTokens}
            />
          </div>
        </div>

        {/* Tamanho da Fonte */}
        <div style={fieldRowStyle}>
          <div style={fieldLabelStyle}>
            <span style={{ fontSize: 12, fontWeight: 400, color: themeTokens.textPrimary }}>
              Tamanho da Fonte
            </span>
            <span style={{ fontSize: 11, color: themeTokens.textSecondary }}>
              Escala de renderização dos caracteres no editor.
            </span>
          </div>
          <div style={{ width: 200, flexShrink: 0 }}>
            <DevFlowSelect
              value={editorFontSize}
              onChange={(val) => {
                logSystemActivity('configuracoes_editor', 'alterar_tamanho_fonte', `${val}px`, {
                  fontSize: val,
                });
                setEditorFontSize(Number(val));
              }}
              options={FONT_SIZE_OPTIONS}
              isEffectiveDark={isEffectiveDark}
              accentColor={accentColor}
              themeTokens={themeTokens}
            />
          </div>
        </div>

        {/* Altura da Linha */}
        <div style={fieldRowStyle}>
          <div style={fieldLabelStyle}>
            <span style={{ fontSize: 12, fontWeight: 400, color: themeTokens.textPrimary }}>
              Espaçamento de Linha (Line Height)
            </span>
            <span style={{ fontSize: 11, color: themeTokens.textSecondary }}>
              Multiplicador vertical da linha para maior legibilidade.
            </span>
          </div>
          <div style={{ width: 200, flexShrink: 0 }}>
            <DevFlowSelect
              value={editorLineHeight}
              onChange={(val) => {
                logSystemActivity('configuracoes_editor', 'alterar_altura_linha', `${val}`, {
                  lineHeight: val,
                });
                setEditorLineHeight?.(Number(val));
              }}
              options={LINE_HEIGHT_OPTIONS}
              isEffectiveDark={isEffectiveDark}
              accentColor={accentColor}
              themeTokens={themeTokens}
            />
          </div>
        </div>
      </div>

      {/* 2. Indentação & Formatação */}
      <div style={cardStyle}>
        <div style={titleStyle}>Indentação & Formatação</div>

        {/* Tamanho da Tabulação */}
        <div style={fieldRowStyle}>
          <div style={fieldLabelStyle}>
            <span style={{ fontSize: 12, fontWeight: 400, color: themeTokens.textPrimary }}>
              Tamanho da Tabulação
            </span>
            <span style={{ fontSize: 11, color: themeTokens.textSecondary }}>
              Quantidade de espaços inseridos por nível de indentação.
            </span>
          </div>
          <div style={{ width: 200, flexShrink: 0 }}>
            <DevFlowSelect
              value={editorTabSize}
              onChange={(val) => {
                logSystemActivity('configuracoes_editor', 'alterar_tamanho_tab', `${val} espaços`, {
                  tabSize: val,
                });
                setEditorTabSize(Number(val));
              }}
              options={TAB_SIZE_OPTIONS}
              isEffectiveDark={isEffectiveDark}
              accentColor={accentColor}
              themeTokens={themeTokens}
            />
          </div>
        </div>

        {/* Formatar ao Salvar */}
        <div style={fieldRowStyle}>
          <div style={fieldLabelStyle}>
            <span style={{ fontSize: 12, fontWeight: 400, color: themeTokens.textPrimary }}>
              Formatar ao Salvar
            </span>
            <span style={{ fontSize: 11, color: themeTokens.textSecondary }}>
              Aplica formatação automática de código ao salvar o arquivo.
            </span>
          </div>
          <MiniSwitch
            checked={editorFormatOnSave}
            onChange={() => {
              const next = !editorFormatOnSave;
              logSystemActivity('configuracoes_editor', 'toggle_format_on_save', 'editor', {
                ativo: next,
              });
              setEditorFormatOnSave?.(next);
            }}
            accentColor={accentColor}
          />
        </div>

        {/* Fechamento Automático de Parênteses e Chaves */}
        <div style={fieldRowStyle}>
          <div style={fieldLabelStyle}>
            <span style={{ fontSize: 12, fontWeight: 400, color: themeTokens.textPrimary }}>
              Fechamento Automático de Colchetes
            </span>
            <span style={{ fontSize: 11, color: themeTokens.textSecondary }}>
              Fecha automaticamente aspas, colchetes, parênteses e chaves.
            </span>
          </div>
          <MiniSwitch
            checked={editorAutoClosingBrackets}
            onChange={() => {
              const next = !editorAutoClosingBrackets;
              logSystemActivity('configuracoes_editor', 'toggle_auto_closing_brackets', 'editor', {
                ativo: next,
              });
              setEditorAutoClosingBrackets?.(next);
            }}
            accentColor={accentColor}
          />
        </div>
      </div>

      {/* 3. Cursor & Linhas */}
      <div style={cardStyle}>
        <div style={titleStyle}>Cursor & Visualização de Linhas</div>

        {/* Estilo do Cursor */}
        <div style={fieldRowStyle}>
          <div style={fieldLabelStyle}>
            <span style={{ fontSize: 12, fontWeight: 400, color: themeTokens.textPrimary }}>
              Estilo do Cursor
            </span>
            <span style={{ fontSize: 11, color: themeTokens.textSecondary }}>
              Formato geométrico do cursor de edição.
            </span>
          </div>
          <div style={{ width: 200, flexShrink: 0 }}>
            <DevFlowSelect
              value={editorCursorStyle}
              onChange={(val) => {
                logSystemActivity('configuracoes_editor', 'alterar_estilo_cursor', String(val), {
                  cursorStyle: val,
                });
                setEditorCursorStyle?.(val as any);
              }}
              options={CURSOR_STYLE_OPTIONS}
              isEffectiveDark={isEffectiveDark}
              accentColor={accentColor}
              themeTokens={themeTokens}
            />
          </div>
        </div>

        {/* Animação do Cursor */}
        <div style={fieldRowStyle}>
          <div style={fieldLabelStyle}>
            <span style={{ fontSize: 12, fontWeight: 400, color: themeTokens.textPrimary }}>
              Animação do Cursor
            </span>
            <span style={{ fontSize: 11, color: themeTokens.textSecondary }}>
              Modo de transição e piscar do cursor ativo.
            </span>
          </div>
          <div style={{ width: 200, flexShrink: 0 }}>
            <DevFlowSelect
              value={editorCursorBlinking}
              onChange={(val) => {
                logSystemActivity('configuracoes_editor', 'alterar_animacao_cursor', String(val), {
                  cursorBlinking: val,
                });
                setEditorCursorBlinking?.(val as any);
              }}
              options={CURSOR_BLINKING_OPTIONS}
              isEffectiveDark={isEffectiveDark}
              accentColor={accentColor}
              themeTokens={themeTokens}
            />
          </div>
        </div>

        {/* Numeração de Linhas */}
        <div style={fieldRowStyle}>
          <div style={fieldLabelStyle}>
            <span style={{ fontSize: 12, fontWeight: 400, color: themeTokens.textPrimary }}>
              Números de Linha
            </span>
            <span style={{ fontSize: 11, color: themeTokens.textSecondary }}>
              Modo de exibição das linhas na margem esquerda.
            </span>
          </div>
          <div style={{ width: 200, flexShrink: 0 }}>
            <DevFlowSelect
              value={currentLineNumbersValue}
              onChange={(val) => {
                const isEnabled = val !== 'off';
                logSystemActivity('configuracoes_editor', 'alterar_numeros_linha', String(val), {
                  mode: val,
                });
                setEditorLineNumbers(isEnabled);
              }}
              options={LINE_NUMBERS_OPTIONS}
              isEffectiveDark={isEffectiveDark}
              accentColor={accentColor}
              themeTokens={themeTokens}
            />
          </div>
        </div>

        {/* Quebra de Linha */}
        <div style={fieldRowStyle}>
          <div style={fieldLabelStyle}>
            <span style={{ fontSize: 12, fontWeight: 400, color: themeTokens.textPrimary }}>
              Quebra Automática de Linha
            </span>
            <span style={{ fontSize: 11, color: themeTokens.textSecondary }}>
              Comportamento para linhas que ultrapassam a viewport.
            </span>
          </div>
          <div style={{ width: 200, flexShrink: 0 }}>
            <DevFlowSelect
              value={currentWordWrapValue}
              onChange={(val) => {
                const isEnabled = val === 'on';
                logSystemActivity('configuracoes_editor', 'alterar_quebra_linha', String(val), {
                  wordWrap: val,
                });
                setEditorWordWrap(isEnabled);
              }}
              options={WORD_WRAP_OPTIONS}
              isEffectiveDark={isEffectiveDark}
              accentColor={accentColor}
              themeTokens={themeTokens}
            />
          </div>
        </div>

        {/* Renderizar Espaços em Branco */}
        <div style={fieldRowStyle}>
          <div style={fieldLabelStyle}>
            <span style={{ fontSize: 12, fontWeight: 400, color: themeTokens.textPrimary }}>
              Renderizar Espaços em Branco
            </span>
            <span style={{ fontSize: 11, color: themeTokens.textSecondary }}>
              Exibe marcadores gráficos para caracteres invisíveis.
            </span>
          </div>
          <div style={{ width: 200, flexShrink: 0 }}>
            <DevFlowSelect
              value={currentWhitespaceValue}
              onChange={(val) => {
                const isEnabled = val === 'all' || val === 'boundary';
                logSystemActivity('configuracoes_editor', 'alterar_render_whitespace', String(val), {
                  renderWhitespace: val,
                });
                setEditorRenderWhitespace(isEnabled);
              }}
              options={RENDER_WHITESPACE_OPTIONS}
              isEffectiveDark={isEffectiveDark}
              accentColor={accentColor}
              themeTokens={themeTokens}
            />
          </div>
        </div>

        {/* Destaque da Linha Ativa */}
        <div style={fieldRowStyle}>
          <div style={fieldLabelStyle}>
            <span style={{ fontSize: 12, fontWeight: 400, color: themeTokens.textPrimary }}>
              Destaque da Linha Ativa
            </span>
            <span style={{ fontSize: 11, color: themeTokens.textSecondary }}>
              Realce sutil sob a linha onde o cursor está posicionado.
            </span>
          </div>
          <div style={{ width: 200, flexShrink: 0 }}>
            <DevFlowSelect
              value={editorHighlightActiveLine}
              onChange={(val) => {
                logSystemActivity('configuracoes_editor', 'alterar_destaque_linha', String(val), {
                  highlight: val,
                });
                setEditorHighlightActiveLine?.(val as any);
              }}
              options={HIGHLIGHT_LINE_OPTIONS}
              isEffectiveDark={isEffectiveDark}
              accentColor={accentColor}
              themeTokens={themeTokens}
            />
          </div>
        </div>
      </div>

      {/* 4. Recursos do Editor */}
      <div style={cardStyle}>
        <div style={titleStyle}>Recursos do Editor</div>

        {[
          {
            label: 'Minimapa de Código',
            desc: 'Visão geral em miniatura do arquivo no lado direito.',
            checked: editorMinimap,
            onChange: () => {
              const next = !editorMinimap;
              logSystemActivity('configuracoes_editor', 'toggle_minimap', 'editor', { ativo: next });
              setEditorMinimap(next);
            },
          },
          {
            label: 'Rolagem Suave',
            desc: 'Anima a rolagem do editor em vez de saltos instantâneos.',
            checked: editorSmoothScrolling,
            onChange: () => {
              const next = !editorSmoothScrolling;
              logSystemActivity('configuracoes_editor', 'toggle_smooth_scrolling', 'editor', { ativo: next });
              setEditorSmoothScrolling(next);
            },
          },
          {
            label: 'Colorização de Pares de Colchetes',
            desc: 'Destaque visual em pares correspondentes de parênteses e chaves.',
            checked: editorBracketColorization,
            onChange: () => {
              const next = !editorBracketColorization;
              logSystemActivity('configuracoes_editor', 'toggle_bracket_colorization', 'editor', { ativo: next });
              setEditorBracketColorization(next);
            },
          },
          {
            label: 'Guias de Indentação',
            desc: 'Linhas verticais que delimitam visualmente blocos de código.',
            checked: editorGuides,
            onChange: () => {
              const next = !editorGuides;
              logSystemActivity('configuracoes_editor', 'toggle_indent_guides', 'editor', { ativo: next });
              setEditorGuides?.(next);
            },
          },
          {
            label: 'Dobradura de Código (Code Folding)',
            desc: 'Permite recolher funções, classes e blocos na margem.',
            checked: editorCodeFolding,
            onChange: () => {
              const next = !editorCodeFolding;
              logSystemActivity('configuracoes_editor', 'toggle_code_folding', 'editor', { ativo: next });
              setEditorCodeFolding?.(next);
            },
          },
        ].map((row) => (
          <div key={row.label} style={fieldRowStyle}>
            <div style={fieldLabelStyle}>
              <span style={{ fontSize: 12, fontWeight: 400, color: themeTokens.textPrimary }}>
                {row.label}
              </span>
              <span style={{ fontSize: 11, color: themeTokens.textSecondary }}>{row.desc}</span>
            </div>
            <MiniSwitch checked={row.checked} onChange={row.onChange} accentColor={accentColor} />
          </div>
        ))}
      </div>
    </div>
  );
};
