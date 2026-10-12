import React from 'react';
import claudeLogo from '../../assets/logos/claude-color.svg';
import antigravityLogo from '../../assets/logos/google-antigravity-icon.svg';
import codexLogo from '../../assets/logos/codex-color.svg';
import geminiLogo from '../../assets/logos/gemini-icon-seeklogo.svg';
import ollamaLogo from '../../assets/logos/ollama-icon.svg';
import auraDevLogo from '../../assets/logos/app-logo.svg';

// Aura Dev Official App SVG Icon
export const AuraDevIcon: React.FC<{ size?: number; style?: React.CSSProperties }> = ({ size = 16, style }) => (
  <img
    src={auraDevLogo}
    alt="Aura Dev"
    draggable={false}
    onDragStart={(e) => e.preventDefault()}
    style={{
      width: size,
      height: size,
      objectFit: 'contain',
      borderRadius: Math.max(2, Math.round(size * 0.18)),
      flex: 'none',
      display: 'inline-block',
      userSelect: 'none',
      pointerEvents: 'none',
      ...style,
    }}
  />
);

// Claude Color Official SVG Icon
export const ClaudeIcon: React.FC<{ size?: number; style?: React.CSSProperties }> = ({ size = 16, style }) => (
  <img
    src={claudeLogo}
    alt="Claude"
    draggable={false}
    onDragStart={(e) => e.preventDefault()}
    style={{
      width: size,
      height: size,
      objectFit: 'contain',
      flex: 'none',
      display: 'inline-block',
      userSelect: 'none',
      pointerEvents: 'none',
      ...style,
    }}
  />
);

// Google Antigravity Official SVG Icon
export const AntigravityIcon: React.FC<{ size?: number; style?: React.CSSProperties }> = ({ size = 16, style }) => (
  <img
    src={antigravityLogo}
    alt="Google Antigravity"
    draggable={false}
    onDragStart={(e) => e.preventDefault()}
    style={{
      width: size,
      height: size,
      objectFit: 'contain',
      borderRadius: 2,
      flex: 'none',
      display: 'inline-block',
      userSelect: 'none',
      pointerEvents: 'none',
      ...style,
    }}
  />
);

// Google Gemini Official SVG Icon
export const GeminiIcon: React.FC<{ size?: number; style?: React.CSSProperties }> = ({ size = 16, style }) => (
  <img
    src={geminiLogo}
    alt="Google Gemini"
    draggable={false}
    onDragStart={(e) => e.preventDefault()}
    style={{
      width: size,
      height: size,
      objectFit: 'contain',
      flex: 'none',
      display: 'inline-block',
      userSelect: 'none',
      pointerEvents: 'none',
      ...style,
    }}
  />
);

// Ollama Official SVG Icon
export const OllamaIcon: React.FC<{ size?: number; style?: React.CSSProperties }> = ({ size = 16, style }) => (
  <img
    src={ollamaLogo}
    alt="Ollama"
    draggable={false}
    onDragStart={(e) => e.preventDefault()}
    style={{
      width: size,
      height: size,
      objectFit: 'contain',
      flex: 'none',
      display: 'inline-block',
      userSelect: 'none',
      pointerEvents: 'none',
      ...style,
    }}
  />
);

// OpenAI Codex Official SVG Icon
export const CodexIcon: React.FC<{ size?: number; style?: React.CSSProperties }> = ({ size = 16, style }) => (
  <img
    src={codexLogo}
    alt="OpenAI Codex"
    draggable={false}
    onDragStart={(e) => e.preventDefault()}
    style={{
      width: size,
      height: size,
      objectFit: 'contain',
      flex: 'none',
      display: 'inline-block',
      userSelect: 'none',
      pointerEvents: 'none',
      ...style,
    }}
  />
);

// Helper to render AI icon by provider ID
export const renderAiIcon = (
  providerId: string,
  size = 16,
  style?: React.CSSProperties,
  showUpdateBadge?: boolean
) => {
  let icon: React.ReactNode;
  switch (providerId) {
    case 'claude':
      icon = <ClaudeIcon size={size} style={style} />;
      break;
    case 'antigravity':
    case 'agy':
      icon = <AntigravityIcon size={size} style={style} />;
      break;
    case 'codex':
      icon = <CodexIcon size={size} style={style} />;
      break;
    case 'gemini':
      icon = <GeminiIcon size={size} style={style} />;
      break;
    case 'ollama':
      icon = <OllamaIcon size={size} style={style} />;
      break;
    case 'aura':
    case 'auradev':
    case 'aura-dev':
    case 'maestro':
      icon = <AuraDevIcon size={size} style={style} />;
      break;
    default:
      icon = <ClaudeIcon size={size} style={style} />;
      break;
  }

  if (showUpdateBadge) {
    const badgeSize = Math.max(7, Math.round(size * 0.45));
    const iconSize = Math.max(5, Math.round(size * 0.32));
    return (
      <div
        style={{
          position: 'relative',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {icon}
        <span
          style={{
            position: 'absolute',
            bottom: -2,
            right: -2,
            width: badgeSize,
            height: badgeSize,
            borderRadius: '50%',
            background: '#0284c7',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: 'none',
            boxShadow: 'none',
            pointerEvents: 'none',
            lineHeight: 1,
          }}
          title="Atualização disponível"
        >
          <svg
            width={iconSize}
            height={iconSize}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="12" y1="19" x2="12" y2="5" />
            <polyline points="5 12 12 5 19 12" />
          </svg>
        </span>
      </div>
    );
  }

  return icon;
};

