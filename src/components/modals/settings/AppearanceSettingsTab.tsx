import React from 'react';
import { Moon, Sun, Monitor, Check } from 'lucide-react';
import { hexToRgba } from '../../../utils/color';
import { AI_BRAND_COLORS, AI_PROVIDERS } from '../../../constants/ai';
import { DevFlowColorPicker } from '../../ui/DevFlowColorPicker';
import { MiniSwitch } from '../../ui/MiniSwitch';
import type { ThemeTokens } from '../../../types/ide';

export interface AppearanceSettingsTabProps {
  themeTokens: ThemeTokens;
  isEffectiveDark: boolean;
  accentColor: string;
  setAccentColor: (color: string) => void;
  themeMode: 'dark' | 'light' | 'system';
  setThemeMode: (mode: 'dark' | 'light' | 'system') => void;
  selectedAiProvider: string;
  useAiChatThemeColor: boolean;
  setUseAiChatThemeColor: (value: boolean) => void;
}

export const AppearanceSettingsTab: React.FC<AppearanceSettingsTabProps> = ({
  themeTokens,
  isEffectiveDark,
  accentColor,
  setAccentColor,
  themeMode,
  setThemeMode,
  selectedAiProvider,
  useAiChatThemeColor,
  setUseAiChatThemeColor,
}) => {
  return (
    <>
      <div>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Tema de Exibição</div>
        <div style={{ fontSize: 12, color: themeTokens.textSecondary, marginBottom: 14 }}>
          Alterne entre os modos escuro, claro ou sincronizado com o sistema operacional.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {[
            { id: 'dark', label: 'Dark', desc: 'Modo escuro imersivo', icon: <Moon size={18} /> },
            { id: 'light', label: 'Light', desc: 'Modo claro clean', icon: <Sun size={18} /> },
            { id: 'system', label: 'Sistema', desc: 'Segue o sistema do SO', icon: <Monitor size={18} /> },
          ].map((t) => {
            const isSelected = themeMode === t.id;
            return (
              <div
                key={t.id}
                onClick={() => setThemeMode(t.id as any)}
                style={{
                  padding: '14px 12px',
                  borderRadius: 8,
                  cursor: 'pointer',
                  border: isSelected ? `1.5px solid ${accentColor}` : `1px solid ${themeTokens.border}`,
                  background: isSelected ? (isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)') : 'transparent',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ color: isSelected ? accentColor : 'inherit' }}>{t.icon}</div>
                  <div
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: '50%',
                      border: isSelected ? `4px solid ${accentColor}` : `2px solid ${themeTokens.textSecondary}`,
                      background: isSelected ? accentColor : 'transparent',
                    }}
                  />
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: themeTokens.textPrimary }}>{t.label}</div>
                <div style={{ fontSize: 11, color: themeTokens.textSecondary }}>{t.desc}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Accent Color Selection */}
      <div>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Cor Principal de Destaque (Accent Color)</div>
        <div style={{ fontSize: 12, color: themeTokens.textSecondary, marginBottom: 14 }}>
          A cor escolhida é aplicada aos botões principais, abas ativas, tags, bordas e destaques da IDE.
        </div>

        {/* Presets */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
          {[
            { name: 'Laranja DevFlow', color: '#FF6A00' },
            { name: 'Azul VS Code', color: '#007ACC' },
            { name: 'Verde Esmeralda', color: '#10B981' },
            { name: 'Roxo Ultraviolet', color: '#8B5CF6' },
            { name: 'Vermelho Coral', color: '#EF4444' },
            { name: 'Dourado Solar', color: '#F59E0B' },
            { name: 'Ciano Elétrico', color: '#06B6D4' },
            { name: 'Rosa Magenta', color: '#EC4899' },
          ].map((c) => {
            const isSelected = accentColor.toUpperCase() === c.color.toUpperCase();
            return (
              <div
                key={c.color}
                onClick={() => setAccentColor(c.color)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 7,
                  padding: '6px 12px',
                  borderRadius: 20,
                  cursor: 'pointer',
                  border: isSelected ? `2px solid ${c.color}` : `1px solid ${themeTokens.border}`,
                  background: isSelected ? hexToRgba(c.color, 0.12) : 'transparent',
                  transition: 'all 0.15s ease',
                }}
              >
                <span style={{ width: 14, height: 14, borderRadius: '50%', background: c.color, flexShrink: 0 }} />
                <span style={{ fontSize: 12, fontWeight: isSelected ? 600 : 400, color: themeTokens.textPrimary }}>{c.name}</span>
                {isSelected && <Check size={12} color={c.color} />}
              </div>
            );
          })}
        </div>

        {/* Custom Color Picker */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: themeTokens.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Cor Personalizada
          </span>
          <div style={{ maxWidth: 300 }}>
            <DevFlowColorPicker
              color={accentColor}
              onChange={setAccentColor}
              isDark={isEffectiveDark}
            />
          </div>
        </div>

        {/* Option: Sincronizar cor da div de chat com a IA ativa */}
        <div
          style={{
            marginTop: 18,
            padding: '12px 14px',
            borderRadius: 8,
            background: isEffectiveDark ? 'rgba(255, 255, 255, 0.04)' : '#f8fafc',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: themeTokens.textPrimary }}>
                Cor da IA no Chat
              </span>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  padding: '2px 7px',
                  borderRadius: 4,
                  background: hexToRgba(AI_BRAND_COLORS[selectedAiProvider] || accentColor, 0.18),
                  color: AI_BRAND_COLORS[selectedAiProvider] || accentColor,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: AI_BRAND_COLORS[selectedAiProvider] || accentColor }} />
                {AI_PROVIDERS.find((p) => p.id === selectedAiProvider)?.name} ({AI_BRAND_COLORS[selectedAiProvider] || accentColor})
              </span>
            </div>
            <span style={{ fontSize: 11.5, color: themeTokens.textSecondary }}>
              Aplica dinamicamente a cor da IA selecionada ao degradê do chat: Claude (#FF8B67), Antigravity (#69C2FD), Codex (#8975B9), Gemini (#589EFF).
            </span>
          </div>
          <MiniSwitch
            checked={useAiChatThemeColor}
            onChange={() => setUseAiChatThemeColor(!useAiChatThemeColor)}
            accentColor={AI_BRAND_COLORS[selectedAiProvider] || accentColor}
          />
        </div>
      </div>
    </>
  );
};
