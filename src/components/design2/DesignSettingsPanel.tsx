import React, { useState } from 'react';
import { getUnsplashKey, setUnsplashKey } from './stockImage';

export interface ViewPrefs { grid: boolean; rulers: boolean; snap: boolean; guides: boolean; rulerRelative: boolean; pixelSnap: boolean; pixelGrid: boolean }
export type ViewPrefKey = keyof ViewPrefs;

interface Props {
  tokens: Record<string, any>;
  accentColor: string;
  viewPrefs: ViewPrefs;
  onToggleView: (key: ViewPrefKey) => void;
  fastMode: boolean;
  onToggleFast: (v: boolean) => void;
  useProjectContext: boolean;
  onToggleContext: (v: boolean) => void;
  onUnsplashSaved: (hasKey: boolean) => void;
  onClearGuides: () => void;
}

/** Configurações do design: exibição do canvas e opções da IA (mesmo padrão visual do inspetor). */
export default function DesignSettingsPanel({ tokens: th, accentColor, viewPrefs, onToggleView, fastMode, onToggleFast, useProjectContext, onToggleContext, onUnsplashSaved, onClearGuides }: Props) {
  const section = (title: string, children: React.ReactNode) => (
    <div style={{ padding: '12px 14px', borderBottom: `1px solid ${th.border}`, display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: th.textPrimary, marginBottom: 4 }}>{title}</span>
      {children}
    </div>
  );
  const row = (label: string, hint: string, on: boolean, toggle: () => void) => (
    <div onClick={toggle} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', cursor: 'pointer' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11.5, color: th.textPrimary }}>{label}</div>
        <div style={{ fontSize: 10, color: th.textMuted, lineHeight: 1.4 }}>{hint}</div>
      </div>
      <span style={{ position: 'relative', width: 28, height: 16, borderRadius: 8, background: on ? accentColor : 'rgba(128,128,128,0.35)', flexShrink: 0, transition: 'background 0.15s ease' }}>
        <span style={{ position: 'absolute', top: 2, left: on ? 14 : 2, width: 12, height: 12, borderRadius: 6, background: '#fff', transition: 'left 0.15s ease' }} />
      </span>
    </div>
  );
  const [unsplashKey, setKey] = useState(getUnsplashKey());
  const saveKey = () => {
    if (unsplashKey.trim() === getUnsplashKey().trim()) return;
    setUnsplashKey(unsplashKey);
    onUnsplashSaved(!!unsplashKey.trim());
  };
  const btn = (label: string, onClick: () => void) => (
    <button type="button" onClick={onClick} style={{ background: 'transparent', border: `1px solid ${th.border}`, borderRadius: 6, color: th.textPrimary, fontSize: 11, height: 28, padding: '0 10px', cursor: 'pointer', fontFamily: "'Poppins', sans-serif", textAlign: 'left' }}>{label}</button>
  );
  return (
    <div style={{ height: '100%', overflowY: 'auto', background: th.bgCard, color: th.textPrimary, fontFamily: "'Poppins', sans-serif" }}>
      <div style={{ padding: '12px 14px', borderBottom: `1px solid ${th.border}`, fontSize: 12, fontWeight: 600 }}>Configurações do design</div>
      {section('Canvas', (
        <>
          {row('Grade', 'Grade de fundo do canvas · Ctrl+\'', viewPrefs.grid, () => onToggleView('grid'))}
          {row('Réguas', 'Réguas nas bordas do canvas · Shift+R', viewPrefs.rulers, () => onToggleView('rulers'))}
          {row('Réguas relativas', 'Origem da régua no frame selecionado', viewPrefs.rulerRelative, () => onToggleView('rulerRelative'))}
          {row('Guias', 'Guias arrastadas das réguas · Ctrl+;', viewPrefs.guides, () => onToggleView('guides'))}
          {row('Encaixe (snap)', 'Alinha ao mover e redimensionar', viewPrefs.snap, () => onToggleView('snap'))}
          {row('Encaixe em pixels', 'Posição e tamanho sempre inteiros', viewPrefs.pixelSnap, () => onToggleView('pixelSnap'))}
          {row('Grade de pixels', 'Mostra os pixels a partir de 800% de zoom', viewPrefs.pixelGrid, () => onToggleView('pixelGrid'))}
          <button type="button" onClick={onClearGuides} style={{ alignSelf: 'flex-start', marginTop: 6, background: 'transparent', border: `1px solid ${th.border}`, borderRadius: 6, color: th.textSecondary, fontSize: 11, height: 26, padding: '0 10px', cursor: 'pointer', fontFamily: "'Poppins', sans-serif" }}>Limpar guias da página</button>
        </>
      ))}
      {section('IA', (
        <>
          {row('Modo rápido', 'Gera com a variante (Low) do modelo: bem mais rápido, layout equivalente', fastMode, () => onToggleFast(!fastMode))}
          {row('Contexto do projeto', 'A IA lê README, docs e arquivos do projeto para decidir assunto e visual', useProjectContext, () => onToggleContext(!useProjectContext))}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
            <span style={{ fontSize: 11.5, color: th.textPrimary }}>Chave do Unsplash (fotos)</span>
            <input
              type="password"
              value={unsplashKey}
              onChange={(e) => setKey(e.target.value)}
              onBlur={saveKey}
              onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
              placeholder="Access Key (unsplash.com/developers)"
              style={{ background: th.bgApp, border: `1px solid ${th.border}`, borderRadius: 6, color: th.textPrimary, fontSize: 11.5, height: 30, padding: '0 10px', outline: 'none', fontFamily: "'Poppins', sans-serif", boxSizing: 'border-box', width: '100%' }}
            />
            <span style={{ fontSize: 10, color: th.textMuted, lineHeight: 1.4 }}>Usada pela IA nas fotos de avatares, banners e cards. Sem chave, usa fotos aleatórias do picsum.photos.</span>
          </div>
        </>
      ))}
    </div>
  );
}
