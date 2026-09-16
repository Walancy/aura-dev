import React from 'react';
import { GitBranch, RefreshCw, XCircle, AlertTriangle } from 'lucide-react';

export const StatusBar: React.FC = () => {
  return (
    <footer
      style={{
        height: '24px',
        backgroundColor: '#090a0d',
        borderTop: '1px solid #16181f',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingLeft: '10px',
        fontSize: '0.72rem',
        color: '#71717a',
        userSelect: 'none',
        overflow: 'hidden',
      }}
    >
      {/* Left side */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        {/* Branch */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <GitBranch size={12} color="#a1a1aa" />
          <span style={{ color: '#a1a1aa' }}>ainaobra-painel-web</span>
          <span style={{ color: '#ff6600', fontWeight: 600 }}>main</span>
          <RefreshCw size={11} color="#ff6600" />
        </div>

        {/* Errors 0 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <XCircle size={12} color="#71717a" />
          <span>0</span>
        </div>

        {/* Sprint 2 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <AlertTriangle size={12} color="#71717a" />
          <span>Sprint 2 - </span>
          <span style={{ color: '#ff6600' }}>7 days</span>
        </div>

        {/* Issues */}
        <div>
          <span>Issues: </span>
          <span style={{ color: '#ff6600' }}>12 remaining</span>
        </div>
      </div>

      {/* Right side */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span>Walancy (3 months ago)</span>
        <span>Ln 21, Col 13</span>
        <span>Spaces: 2</span>
        <span>UTF-8</span>
        <span>TypeScript</span>

        {/* Neon Orange Button Ainaobra */}
        <div
          style={{
            backgroundColor: '#ff6600',
            color: '#ffffff',
            fontWeight: 700,
            fontSize: '0.72rem',
            padding: '3px 14px',
            height: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          Ainaobra
        </div>
      </div>
    </footer>
  );
};
