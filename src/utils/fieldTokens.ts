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
      fieldBorderColor: 'transparent',
      fieldBorder: 'none',
      fieldBorderFocusColor: 'transparent',
      fieldBorderFocus: 'none',
      dropdownMenuBg: '#1b1b1d',
      dropdownBorder: 'none',
      dropdownItemHoverBg: 'rgba(255, 255, 255, 0.06)',
    };
  }

  return {
    fieldBg: '#f6f6f7',
    fieldBgHover: '#efefef',
    fieldBgSolid: '#f6f6f7',
    fieldBorderColor: 'transparent',
    fieldBorder: 'none',
    fieldBorderFocusColor: 'transparent',
    fieldBorderFocus: 'none',
    dropdownMenuBg: '#f8f8f9',
    dropdownBorder: 'none',
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
    border: 'none',
    borderRadius: 6,
    boxShadow: 'none',
    fontWeight: 400,
    outline: 'none',
    transition: 'background 0.15s ease, color 0.15s ease',
    boxSizing: 'border-box',
  };
}
