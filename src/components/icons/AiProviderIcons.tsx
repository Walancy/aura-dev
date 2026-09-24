import React from 'react';
import claudeLogo from '../../assets/logos/claude-color.svg';
import antigravityLogo from '../../assets/logos/google-antigravity-icon.svg';
import codexLogo from '../../assets/logos/codex-color.svg';
import geminiLogo from '../../assets/logos/gemini-icon-seeklogo.svg';
import ollamaLogo from '../../assets/logos/ollama-icon.svg';

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
export const renderAiIcon = (providerId: string, size = 16, style?: React.CSSProperties) => {
  switch (providerId) {
    case 'claude':
      return <ClaudeIcon size={size} style={style} />;
    case 'antigravity':
      return <AntigravityIcon size={size} style={style} />;
    case 'codex':
      return <CodexIcon size={size} style={style} />;
    case 'gemini':
      return <GeminiIcon size={size} style={style} />;
    case 'ollama':
      return <OllamaIcon size={size} style={style} />;
    default:
      return <ClaudeIcon size={size} style={style} />;
  }
};
