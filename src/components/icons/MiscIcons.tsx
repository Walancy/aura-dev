import React from 'react';

// Customize Layout Official VS Code / Antigravity Icon
export const CustomizeLayoutIcon: React.FC<{ size?: number; color?: string }> = ({ size = 18, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect width="18" height="18" x="3" y="3" rx="3.5" />
    <rect width="3.5" height="11" x="6" y="6.5" rx="1" fill={color} stroke="none" />
    <rect width="5.5" height="4.5" x="12" y="6.5" rx="1" fill={color} stroke="none" />
    <rect width="5.5" height="4.5" x="12" y="13" rx="1" fill={color} stroke="none" />
  </svg>
);

// Git Diamond Icon (.gitignore & Git status)
export const GitDiamondIcon: React.FC<{ size?: number }> = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
    <rect x="4.5" y="4.5" width="15" height="15" rx="3" transform="rotate(45 12 12)" fill="#F05032" />
    <circle cx="12" cy="7.5" r="1.5" fill="#ffffff" />
    <circle cx="7.5" cy="15" r="1.5" fill="#ffffff" />
    <circle cx="15.5" cy="15" r="1.5" fill="#ffffff" />
    <path d="M12 9v3.5m-2.5 1l-1.5 1m5.5-1l1.5 1" stroke="#ffffff" strokeWidth="1.2" strokeLinecap="round" />
  </svg>
);

// Keyboard Badge Component
export const KbdBadge: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span
    style={{
      padding: '1px 5px',
      background: 'rgba(255, 255, 255, 0.08)',
      borderRadius: 3,
      fontSize: 10.5,
      color: '#bbbbbb',
      border: 'none',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 16,
      height: 18,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontWeight: 500,
      userSelect: 'none',
    }}
  >
    {children}
  </span>
);
