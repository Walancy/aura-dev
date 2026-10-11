export interface OpacityKeyState {
  digits: string;
  ts: number;
}

/**
 * Atalho de opacidade do Figma: 1…9 = 10…90%, 0 = 100%; dois dígitos seguidos (até 500 ms) = valor exato (5 e 5 = 55%, 0 e 0 = 0%).
 */
export function opacityFromKey(prev: OpacityKeyState | null, key: string, now: number): { state: OpacityKeyState; opacity: number } | null {
  if (!/^[0-9]$/.test(key)) return null;
  if (prev && prev.digits.length === 1 && now - prev.ts <= 500) {
    const digits = prev.digits + key;
    return { state: { digits, ts: now }, opacity: parseInt(digits, 10) / 100 };
  }
  return { state: { digits: key, ts: now }, opacity: key === '0' ? 1 : parseInt(key, 10) / 10 };
}
