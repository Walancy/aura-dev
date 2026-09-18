import React, { useState, useEffect, useRef } from 'react';
import { Pipette } from 'lucide-react';
import { hexToRgb, hexToRgba, hexToHsv, hsvToRgb, rgbToHex } from '../../utils/color';

export const DevFlowColorPicker: React.FC<{
  color: string;
  onChange: (hex: string) => void;
  isDark?: boolean;
}> = ({ color, onChange, isDark = true }) => {
  const [hue, setHue] = useState<number>(() => hexToHsv(color)[0]);
  const [sat, setSat] = useState<number>(() => hexToHsv(color)[1]);
  const [val, setVal] = useState<number>(() => hexToHsv(color)[2]);
  const [hexInput, setHexInput] = useState<string>(color.toUpperCase());

  const satValRef = useRef<HTMLDivElement | null>(null);
  const hueRef = useRef<HTMLDivElement | null>(null);

  const hueRefVal = useRef(hue);
  hueRefVal.current = hue;
  const satRefVal = useRef(sat);
  satRefVal.current = sat;
  const valRefVal = useRef(val);
  valRefVal.current = val;

  // Keep internal state synced when external color prop changes (e.g. clicking presets)
  useEffect(() => {
    const [h, s, v] = hexToHsv(color);
    if (s > 0.02 && v > 0.02) {
      setHue(h);
    }
    setSat(s);
    setVal(v);
    setHexInput(color.toUpperCase());
  }, [color]);

  const [r, g, b] = hexToRgb(color);

  // Saturation / Value Area Drag
  const handleSatValMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    const rect = satValRef.current?.getBoundingClientRect();
    if (!rect) return;

    const updateFromPoint = (clientX: number, clientY: number) => {
      const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
      const newS = x;
      const newV = 1 - y;
      setSat(newS);
      setVal(newV);
      const [newR, newG, newB] = hsvToRgb(hueRefVal.current, newS, newV);
      const newHex = rgbToHex(newR, newG, newB);
      setHexInput(newHex);
      onChange(newHex);
    };

    updateFromPoint(e.clientX, e.clientY);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      updateFromPoint(moveEvent.clientX, moveEvent.clientY);
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Hue Slider Drag
  const handleHueMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    const rect = hueRef.current?.getBoundingClientRect();
    if (!rect) return;

    const updateFromPoint = (clientX: number) => {
      const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const newH = Math.round(x * 360) % 360;
      setHue(newH);
      const [newR, newG, newB] = hsvToRgb(newH, satRefVal.current, valRefVal.current);
      const newHex = rgbToHex(newR, newG, newB);
      setHexInput(newHex);
      onChange(newHex);
    };

    updateFromPoint(e.clientX);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      updateFromPoint(moveEvent.clientX);
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Eyedropper API (Native Chromium / Electron support)
  const handleEyeDropper = async () => {
    if (typeof window !== 'undefined' && 'EyeDropper' in window) {
      try {
        const eyeDropper = new (window as any).EyeDropper();
        const result = await eyeDropper.open();
        if (result?.sRGBHex) {
          onChange(result.sRGBHex.toUpperCase());
        }
      } catch {
        // User cancelled picker
      }
    }
  };

  const handleHexInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let valStr = e.target.value.trim().toUpperCase();
    setHexInput(valStr);
    if (!valStr.startsWith('#')) {
      valStr = '#' + valStr;
    }
    if (/^#[0-9A-F]{6}$/i.test(valStr)) {
      onChange(valStr);
    }
  };

  const handleHexInputBlur = () => {
    let valStr = hexInput.trim().toUpperCase();
    if (!valStr.startsWith('#')) {
      valStr = '#' + valStr;
    }
    if (/^#[0-9A-F]{6}$/i.test(valStr)) {
      onChange(valStr);
      setHexInput(valStr);
    } else {
      setHexInput(color.toUpperCase());
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 9,
        background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.03)',
        padding: 9,
        borderRadius: 8,
        border: 'none',
        userSelect: 'none',
      }}
    >
      {/* 2D Saturation & Brightness Board */}
      <div
        ref={satValRef}
        onMouseDown={handleSatValMouseDown}
        style={{
          position: 'relative',
          width: '100%',
          height: 105,
          borderRadius: 6,
          backgroundColor: `hsl(${hue}, 100%, 50%)`,
          backgroundImage: `
            linear-gradient(to right, #ffffff, rgba(255, 255, 255, 0)),
            linear-gradient(to top, #000000, rgba(0, 0, 0, 0))
          `,
          cursor: 'crosshair',
          overflow: 'hidden',
          border: 'none',
          boxShadow: 'inset 0 0 0 1px rgba(0, 0, 0, 0.1)',
        }}
      >
        {/* Sat/Val Handle */}
        <div
          style={{
            position: 'absolute',
            left: `${sat * 100}%`,
            top: `${(1 - val) * 100}%`,
            width: 13,
            height: 13,
            borderRadius: '50%',
            border: '2px solid #ffffff',
            boxShadow: '0 0 4px rgba(0, 0, 0, 0.7)',
            backgroundColor: color,
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
          }}
        />
      </div>

      {/* Rainbow Hue Slider */}
      <div
        ref={hueRef}
        onMouseDown={handleHueMouseDown}
        style={{
          position: 'relative',
          width: '100%',
          height: 11,
          borderRadius: 6,
          background: 'linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)',
          cursor: 'pointer',
          border: 'none',
        }}
      >
        {/* Hue Handle */}
        <div
          style={{
            position: 'absolute',
            left: `${(hue / 360) * 100}%`,
            top: '50%',
            width: 13,
            height: 13,
            borderRadius: '50%',
            border: '2px solid #ffffff',
            boxShadow: '0 1px 4px rgba(0, 0, 0, 0.5)',
            backgroundColor: `hsl(${hue}, 100%, 50%)`,
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
          }}
        />
      </div>

      {/* Controls: Eyedropper, Swatch, Hex, RGB readout */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
        {/* Eyedropper tool & Swatch */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          {typeof window !== 'undefined' && 'EyeDropper' in window && (
            <button
              type="button"
              onClick={handleEyeDropper}
              title="Conta-gotas (Capturar cor da tela)"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 24,
                height: 24,
                borderRadius: 5,
                background: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
                color: isDark ? '#e0e0e0' : '#333333',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = hexToRgba(color, 0.25);
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)';
              }}
            >
              <Pipette size={13} />
            </button>
          )}
          <div
            title={`Cor atual: ${color}`}
            style={{
              width: 24,
              height: 24,
              borderRadius: 5,
              backgroundColor: color,
              border: 'none',
              boxShadow: `0 0 6px ${hexToRgba(color, 0.5)}`,
              flexShrink: 0,
            }}
          />
        </div>

        {/* HEX Input */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            background: isDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(0, 0, 0, 0.07)',
            borderRadius: 5,
            padding: '2px 6px',
            border: 'none',
            flex: 1,
            maxWidth: 82,
          }}
        >
          <input
            type="text"
            value={hexInput}
            onChange={handleHexInputChange}
            onBlur={handleHexInputBlur}
            placeholder="#HEX"
            maxLength={7}
            style={{
              width: '100%',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: isDark ? '#f0f0f0' : '#111111',
              fontSize: 10.5,
              fontWeight: 600,
              fontFamily: 'monospace',
              textAlign: 'center',
              textTransform: 'uppercase',
            }}
          />
        </div>

        {/* RGB Badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          {[
            { label: 'R', val: r },
            { label: 'G', val: g },
            { label: 'B', val: b },
          ].map((item) => (
            <div
              key={item.label}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: 26,
                padding: '2px 3px',
                borderRadius: 4,
                background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                border: 'none',
              }}
            >
              <span style={{ fontSize: 7.5, fontWeight: 700, color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)', lineHeight: 1 }}>
                {item.label}
              </span>
              <span style={{ fontSize: 9.5, fontWeight: 600, fontFamily: 'monospace', color: isDark ? '#e0e0e0' : '#333333', lineHeight: 1.1 }}>
                {item.val}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
