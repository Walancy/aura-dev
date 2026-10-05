import React from 'react';
import FloatingPopup from './FloatingPopup';
import { DEVICE_PRESETS, type DevicePreset } from './devices';

interface Props {
  tokens: Record<string, any>;
  accentColor: string;
  onClose: () => void;
  onPick: (preset: DevicePreset) => void;
}

const GROUPS: Array<[DevicePreset['group'], string]> = [['mobile', 'Celular'], ['tablet', 'Tablet'], ['desktop', 'Desktop']];

export default function FramesPopup({ tokens, accentColor, onClose, onPick }: Props) {
  return (
    <FloatingPopup title="Frames" tokens={tokens} onClose={onClose} width={300} height={440}>
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {GROUPS.map(([group, label]) => (
          <div key={group}>
            <div style={{ fontSize: 10, color: tokens.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{label}</div>
            {DEVICE_PRESETS.filter((p) => p.group === group).map((p) => (
              <div
                key={p.id}
                onClick={() => onPick(p)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 8px', borderRadius: 8, cursor: 'pointer', fontSize: 12 }}
                onMouseEnter={(e) => (e.currentTarget.style.background = tokens.hoverBg)}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                {/* miniatura proporcional */}
                <div style={{ width: 22, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ width: p.width >= p.height ? 22 : Math.max(8, (22 * p.width) / p.height), height: p.width >= p.height ? Math.max(8, (22 * p.height) / p.width) : 22, border: `1.5px solid ${accentColor}`, borderRadius: p.group === 'mobile' ? 4 : 2 }} />
                </div>
                <span style={{ flex: 1 }}>{p.name}</span>
                <span style={{ color: tokens.textMuted, fontSize: 10 }}>{p.width}×{p.height}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </FloatingPopup>
  );
}
