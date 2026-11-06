import type React from 'react';

export interface FieldVisualTokens {
  fieldBg: string;
  fieldBgHover: string;
  fieldBgSolid: string;
  fieldBorderColor: string;
  fieldBorder: string;
  fieldBorderFocusColor: string;
  fieldBorderFocus: string;
  dropdownMenuBg: string;
  dropdownBorder: string;
  dropdownItemHoverBg: string;
}

export function getFieldTokens(isEffectiveDark: boolean): FieldVisualTokens {
  if (isEffectiveDark) {
    return {
      fieldBg: 'rgba(255, 255, 255, 0.05)',
      fieldBgHover: 'rgba(255, 255, 255, 0.075)',
      fieldBgSolid: '#1e1e20',
      fieldBorderColor: 'rgba(255, 255, 255, 0.06)',
      fieldBorder: '1px solid rgba(255, 255, 255, 0.06)',
      fieldBorderFocusColor: 'rgba(255, 255, 255, 0.12)',
      fieldBorderFocus: '1px solid rgba(255, 255, 255, 0.12)',
      dropdownMenuBg: '#1b1b1d',
      dropdownBorder: '1px solid rgba(255, 255, 255, 0.06)',
      dropdownItemHoverBg: 'rgba(255, 255, 255, 0.06)',
    };
  }

  return {
    fieldBg: '#f6f6f7',
    fieldBgHover: '#efefef',
    fieldBgSolid: '#f6f6f7',
    fieldBorderColor: 'rgba(0, 0, 0, 0.06)',
    fieldBorder: '1px solid rgba(0, 0, 0, 0.06)',
    fieldBorderFocusColor: 'rgba(0, 0, 0, 0.12)',
    fieldBorderFocus: '1px solid rgba(0, 0, 0, 0.12)',
    dropdownMenuBg: '#f8f8f9',
    dropdownBorder: '1px solid rgba(0, 0, 0, 0.06)',
    dropdownItemHoverBg: 'rgba(0, 0, 0, 0.045)',
  };
}

export function getFieldBaseStyle(
  isEffectiveDark: boolean,
  height: number | string = 28
): React.CSSProperties {
  const ft = getFieldTokens(isEffectiveDark);
  return {
    height,
    background: ft.fieldBg,
    border: ft.fieldBorder,
    borderRadius: 6,
    boxShadow: 'none',
    fontWeight: 400,
    outline: 'none',
    transition: 'background 0.15s ease, border-color 0.15s ease, color 0.15s ease',
    boxSizing: 'border-box',
  };
}
