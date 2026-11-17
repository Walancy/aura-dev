import React, { useState } from 'react';
import { Check, ChevronRight } from 'lucide-react';
import { InfoTip } from './InfoTip';

export interface GroupableModel {
  id: string;
  label: string;
  tag?: string;
  description?: string;
}

interface Version {
  id: string;
  versionLabel: string;
  rawLabel: string;
  originalItem: GroupableModel;
}
interface Group {
  baseName: string;
  badge?: string;
  versions: Version[];
}

const VERSION_ORDER: Record<string, number> = { XHigh: 0, High: 1, Medium: 2, Low: 3, Thinking: 4, Orchestrator: 5 };
const LEVEL_HELP: Record<string, string> = {
  Low: 'Low: respostas mais rápidas e econômicas, com pouco raciocínio.',
  Medium: 'Medium: equilíbrio entre velocidade e qualidade.',
  High: 'High: raciocínio mais profundo, mais lento e com maior consumo.',
  XHigh: 'XHigh: esforço máximo de raciocínio, para tarefas difíceis.',
  Thinking: 'Thinking: raciocina passo a passo antes de responder.',
  Orchestrator: 'Orchestrator: variante que organiza a tarefa em várias etapas.',
};

/** Junta os níveis de um mesmo modelo (Low/Medium/High/XHigh/Thinking) e anexa o "Orchestrator (Linha)" ao modelo da linha. */
export function groupModelVersions(modelList: GroupableModel[]): Group[] {
  const groups: Group[] = [];
  const orchestrators: GroupableModel[] = [];
  for (const m of modelList) {
    if (/^orchestrator\s*\(.+\)$/i.test(m.label)) {
      orchestrators.push(m);
      continue;
    }
    const lower = m.label.toLowerCase();
    let versionLabel = 'Padrão';
    let baseName = m.label;
    if (/xhigh/i.test(m.id) || lower.includes('(xhigh)')) {
      versionLabel = 'XHigh';
      baseName = m.label.replace(/\s*\(xhigh\)/i, '').trim();
    } else if (m.id.endsWith('-high') || lower.includes('(high)')) {
      versionLabel = 'High';
      baseName = m.label.replace(/\s*\(high\)/i, '').trim();
    } else if (m.id.endsWith('-medium') || lower.includes('(medium)')) {
      versionLabel = 'Medium';
      baseName = m.label.replace(/\s*\(medium\)/i, '').trim();
    } else if (m.id.endsWith('-low') || lower.includes('(low)')) {
      versionLabel = 'Low';
      baseName = m.label.replace(/\s*\(low\)/i, '').trim();
    } else if (m.id.includes('thinking') || lower.includes('(thinking)')) {
      versionLabel = 'Thinking';
      baseName = m.label.replace(/\s*\(thinking\)/i, '').trim();
    }
    let g = groups.find((x) => x.baseName.toLowerCase() === baseName.toLowerCase());
    if (!g) groups.push((g = { baseName, badge: baseName.toLowerCase().includes('flash') ? 'Fast' : undefined, versions: [] }));
    g.versions.push({ id: m.id, versionLabel, rawLabel: m.label, originalItem: m });
  }
  for (const m of orchestrators) {
    const line = m.label.match(/\(([^)]+)\)/)?.[1].trim().toLowerCase() || '';
    const host = groups.find((g) => g.baseName.toLowerCase().endsWith(` ${line}`));
    const version: Version = { id: m.id, versionLabel: 'Orchestrator', rawLabel: m.label, originalItem: m };
    if (host) host.versions.push(version);
    else groups.push({ baseName: m.label, versions: [{ ...version, versionLabel: 'Padrão' }] });
  }
  for (const g of groups) g.versions.sort((a, b) => (VERSION_ORDER[a.versionLabel] ?? 99) - (VERSION_ORDER[b.versionLabel] ?? 99));
  return groups;
}

interface Props {
  providerName: string;
  models: GroupableModel[];
  isCurrent: (m: GroupableModel) => boolean;
  onSelect: (m: GroupableModel) => void;
  accentColor: string;
  isDark: boolean;
  textPrimary: string;
  textSecondary: string;
  border: string;
  menuBg: string;
  menuBorder: string;
  hexToRgba: (hex: string, a: number) => string;
}

/** Lista de modelos agrupada por nível (igual ao seletor do header): cada modelo abre um popup à esquerda com seus níveis. */
export const GroupedModelMenu: React.FC<Props> = ({ providerName, models, isCurrent, onSelect, accentColor, isDark, textPrimary, textSecondary, border, menuBg, menuBorder, hexToRgba }) => {
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [openTop, setOpenTop] = useState(0);
  const groups = groupModelVersions(models);
  const active = groups.find((g) => g.baseName === openGroup);
  const hoverBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';
  const panel: React.CSSProperties = { background: menuBg, borderRadius: 10, border: menuBorder, boxShadow: 'none', padding: 6, display: 'flex', flexDirection: 'column', gap: 2, userSelect: 'none' };

  return (
    <div style={{ position: 'relative' }} onMouseLeave={() => setOpenGroup(null)} onClick={(e) => e.stopPropagation()}>
      {active && active.versions.length > 0 && (
        <div className="df-dropdown-menu" style={{ ...panel, position: 'absolute', right: 'calc(100% + 4px)', top: Math.min(openTop, 220), zIndex: 1000002, minWidth: 110 }}>
          <div style={{ position: 'absolute', top: -10, bottom: -10, right: -14, width: 20 }} />
          {active.versions.map((v) => {
            const cur = isCurrent(v.originalItem);
            return (
              <div
                key={v.id}
                className="df-row-interactive"
                onClick={() => onSelect(v.originalItem)}
                style={{ padding: '6px 12px', borderRadius: 6, cursor: 'pointer', background: cur ? hexToRgba(accentColor, 0.16) : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, transition: 'background 0.12s ease', whiteSpace: 'nowrap' }}
                onMouseEnter={(e) => { if (!cur) e.currentTarget.style.background = hoverBg; }}
                onMouseLeave={(e) => { if (!cur) e.currentTarget.style.background = 'transparent'; }}
              >
                <span style={{ fontSize: 12, fontFamily: 'Poppins, sans-serif', fontWeight: cur ? 600 : 400, color: cur ? accentColor : textPrimary }}>{v.versionLabel}</span>
                {cur && <Check size={12} color={accentColor} style={{ flexShrink: 0 }} />}
              </div>
            );
          })}
        </div>
      )}
      <div className="no-scrollbar" style={{ ...panel, minWidth: 265, maxWidth: 320, maxHeight: 'min(420px, calc(100vh - 60px))', overflowY: 'auto' }}>
        <div style={{ padding: '3px 8px 5px', fontSize: 10, fontWeight: 600, color: textSecondary, textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: `1px solid ${border}`, marginBottom: 3 }}>Modelos {providerName}</div>
        {groups.map((g) => {
          const activeV = g.versions.find((v) => isCurrent(v.originalItem));
          const groupCurrent = !!activeV;
          const shown = activeV?.versionLabel || g.versions.find((v) => v.versionLabel === 'Medium')?.versionLabel || g.versions[0]?.versionLabel;
          const open = openGroup === g.baseName;
          const help = [(g.versions[0]?.originalItem.description || ''), g.badge ? 'Fast: otimizado para baixa latência.' : '', ...g.versions.map((v) => LEVEL_HELP[v.versionLabel])].filter(Boolean).join('\n') || g.baseName;
          return (
            <div
              key={g.baseName}
              onMouseEnter={(e) => {
                setOpenGroup(g.baseName);
                const r = e.currentTarget.getBoundingClientRect();
                const p = e.currentTarget.parentElement?.getBoundingClientRect();
                if (p) setOpenTop(Math.max(0, r.top - p.top));
              }}
              onClick={() => (g.versions.length === 1 ? onSelect(g.versions[0].originalItem) : setOpenGroup(g.baseName))}
              style={{ padding: '7px 10px', borderRadius: 6, cursor: 'pointer', background: groupCurrent ? hexToRgba(accentColor, 0.16) : open ? (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)') : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, transition: 'background 0.12s ease', whiteSpace: 'nowrap' }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <InfoTip isDark={isDark} text={help} />
                <span style={{ fontSize: 12, fontFamily: 'Poppins, sans-serif', fontWeight: groupCurrent ? 600 : 400, color: groupCurrent ? accentColor : textPrimary }}>{g.baseName}</span>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                {g.versions.length > 1 && <span style={{ fontSize: 11, fontFamily: 'Poppins, sans-serif', color: groupCurrent ? accentColor : textSecondary, opacity: groupCurrent ? 0.9 : 0.7 }}>{shown}</span>}
                {g.versions.length > 1 ? <ChevronRight size={13} color={open ? textPrimary : textSecondary} style={{ opacity: 0.7, transform: open ? 'translateX(2px)' : 'none', transition: 'transform 0.15s ease' }} /> : groupCurrent && <Check size={12} color={accentColor} />}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
