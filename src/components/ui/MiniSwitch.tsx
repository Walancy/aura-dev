import React from 'react';
import { getContrastTextColor } from '../../utils/color';

// Mini Toggle Switch for Orchestration
export const MiniSwitch: React.FC<{
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  accentColor?: string;
}> = ({ checked, onChange, disabled, accentColor = '#FF6A00' }) => (
  <div
    onClick={(e) => {
      e.stopPropagation();
      if (!disabled) onChange();
    }}
    style={{
      width: 26,
      height: 15,
      borderRadius: 10,
      background: checked ? accentColor : 'rgba(128, 128, 128, 0.25)',
      position: 'relative',
      cursor: disabled ? 'not-allowed' : 'pointer',
      transition: 'background 0.15s ease',
      flexShrink: 0,
      opacity: disabled ? 0.35 : 1,
    }}
    title={checked ? 'Incluído no Orquestrador' : 'Desativado no Orquestrador'}
  >
    <div
      style={{
        width: 11,
        height: 11,
        borderRadius: '50%',
        background: checked ? getContrastTextColor(accentColor) : '#ffffff',
        position: 'absolute',
        top: 2,
        left: checked ? 13 : 2,
        transition: 'left 0.15s ease',
        boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
      }}
    />
  </div>
);
