import React, { useState, useRef } from 'react';
import {
  Globe,
  RotateCw,
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  Lock,
  Smartphone,
  Tablet,
  Monitor,
  Search,
  X,
  Maximize2,
  Minimize2,
} from 'lucide-react';

export interface OrchestrationBrowserNodeProps {
  nodeId: string;
  initialUrl?: string;
  width: number;
  height: number;
  isEffectiveDark: boolean;
  accentColor: string;
  onUpdateUrl?: (url: string) => void;
  onDeleteNode?: () => void;
}

export const OrchestrationBrowserNode: React.FC<OrchestrationBrowserNodeProps> = ({
  nodeId,
  initialUrl = 'http://localhost:5173',
  width,
  height,
  isEffectiveDark,
  accentColor,
  onUpdateUrl,
  onDeleteNode,
}) => {
  const [currentUrl, setCurrentUrl] = useState(initialUrl);
  const [inputUrl, setInputUrl] = useState(initialUrl);
  const [iframeKey, setIframeKey] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [viewport, setViewport] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [hasError, setHasError] = useState(false);

  const iframeRef = useRef<HTMLIFrameElement>(null);

  const handleNavigate = (targetUrl: string) => {
    let url = targetUrl.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url) && !url.startsWith('about:')) {
      if (url.startsWith('localhost') || url.startsWith('127.0.0.1')) {
        url = `http://${url}`;
      } else {
        url = `https://${url}`;
      }
    }
    setInputUrl(url);
    setCurrentUrl(url);
    setIsLoading(true);
    setHasError(false);
    setIframeKey((k) => k + 1);
    onUpdateUrl?.(url);
  };

  const handleReload = () => {
    setIsLoading(true);
    setIframeKey((k) => k + 1);
  };

  const handleOpenExternal = () => {
    if (window.electronAPI?.openExternal) {
      window.electronAPI.openExternal(currentUrl);
    } else {
      window.open(currentUrl, '_blank');
    }
  };

  const quickLinks = [
    { label: 'Local:5173', url: 'http://localhost:5173' },
    { label: 'Local:3000', url: 'http://localhost:3000' },
    { label: 'Google', url: 'https://www.google.com' },
    { label: 'GitHub', url: 'https://github.com' },
  ];

  const headerBg = isEffectiveDark ? '#18181b' : '#f1f5f9';
  const barBg = isEffectiveDark ? '#101012' : '#ffffff';
  const textPrimary = isEffectiveDark ? '#f8fafc' : '#0f172a';
  const textSecondary = isEffectiveDark ? '#94a3b8' : '#64748b';
  const borderColor = isEffectiveDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: isEffectiveDark ? '#0c0c0e' : '#ffffff',
        borderRadius: 18,
        overflow: 'hidden',
        userSelect: 'none',
      }}
    >
      {/* Browser Window Header Chrome */}
      <div
        style={{
          padding: '8px 12px',
          background: headerBg,
          borderBottom: `1px solid ${borderColor}`,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          flexShrink: 0,
        }}
        onMouseDown={(e) => {
          // Allow dragging card from header background if not clicking inputs/buttons
          const tag = (e.target as HTMLElement).tagName.toLowerCase();
          if (tag === 'input' || tag === 'button' || tag === 'svg' || tag === 'path') {
            e.stopPropagation();
          }
        }}
      >
        {/* Top Controls Row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          {/* Window control dots (macOS style) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteNode?.();
              }}
              title="Fechar janela"
              style={{
                width: 11,
                height: 11,
                borderRadius: '50%',
                background: '#ef4444',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                opacity: 0.85,
                transition: 'opacity 0.12s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.85')}
            />
            <div
              style={{
                width: 11,
                height: 11,
                borderRadius: '50%',
                background: '#f59e0b',
                opacity: 0.85,
              }}
            />
            <div
              style={{
                width: 11,
                height: 11,
                borderRadius: '50%',
                background: '#10b981',
                opacity: 0.85,
              }}
            />
            <span style={{ fontSize: 11, fontWeight: 600, color: textPrimary, marginLeft: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
              <Globe size={13} color={accentColor} />
              Navegador Web
            </span>
          </div>

          {/* Device Viewport Toggle Buttons */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              background: barBg,
              borderRadius: 6,
              padding: '2px',
              border: `1px solid ${borderColor}`,
            }}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setViewport('desktop');
              }}
              title="Desktop (100%)"
              style={{
                background: viewport === 'desktop' ? accentColor : 'transparent',
                color: viewport === 'desktop' ? '#ffffff' : textSecondary,
                border: 'none',
                borderRadius: 4,
                padding: '3px 6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                transition: 'all 0.12s ease',
              }}
            >
              <Monitor size={12} />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setViewport('tablet');
              }}
              title="Tablet (768px)"
              style={{
                background: viewport === 'tablet' ? accentColor : 'transparent',
                color: viewport === 'tablet' ? '#ffffff' : textSecondary,
                border: 'none',
                borderRadius: 4,
                padding: '3px 6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                transition: 'all 0.12s ease',
              }}
            >
              <Tablet size={12} />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setViewport('mobile');
              }}
              title="Mobile (375px)"
              style={{
                background: viewport === 'mobile' ? accentColor : 'transparent',
                color: viewport === 'mobile' ? '#ffffff' : textSecondary,
                border: 'none',
                borderRadius: 4,
                padding: '3px 6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                transition: 'all 0.12s ease',
              }}
            >
              <Smartphone size={12} />
            </button>
          </div>
        </div>

        {/* Address Bar Row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* Navigation Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                try {
                  iframeRef.current?.contentWindow?.history.back();
                } catch {}
              }}
              title="Voltar"
              style={{
                background: 'transparent',
                border: 'none',
                color: textSecondary,
                padding: 4,
                borderRadius: 4,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = textPrimary)}
              onMouseLeave={(e) => (e.currentTarget.style.color = textSecondary)}
            >
              <ArrowLeft size={13} />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                try {
                  iframeRef.current?.contentWindow?.history.forward();
                } catch {}
              }}
              title="Avançar"
              style={{
                background: 'transparent',
                border: 'none',
                color: textSecondary,
                padding: 4,
                borderRadius: 4,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = textPrimary)}
              onMouseLeave={(e) => (e.currentTarget.style.color = textSecondary)}
            >
              <ArrowRight size={13} />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleReload();
              }}
              title="Recarregar"
              style={{
                background: 'transparent',
                border: 'none',
                color: textSecondary,
                padding: 4,
                borderRadius: 4,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = textPrimary)}
              onMouseLeave={(e) => (e.currentTarget.style.color = textSecondary)}
            >
              <RotateCw
                size={13}
                style={{
                  animation: isLoading ? 'spin 0.8s linear infinite' : 'none',
                }}
              />
            </button>
          </div>

          {/* Interactive URL Input Bar */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              background: barBg,
              border: `1px solid ${borderColor}`,
              borderRadius: 8,
              padding: '3px 8px',
              gap: 6,
            }}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <Lock size={12} color="#10b981" />
            <input
              type="text"
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleNavigate(inputUrl);
                }
              }}
              placeholder="Digite uma URL (ex: http://localhost:5173)..."
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: textPrimary,
                fontSize: 11.5,
                fontFamily: 'inherit',
                width: '100%',
              }}
            />
            {inputUrl !== currentUrl && (
              <button
                type="button"
                onClick={() => handleNavigate(inputUrl)}
                style={{
                  background: accentColor,
                  border: 'none',
                  color: '#ffffff',
                  fontSize: 10,
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: 4,
                  cursor: 'pointer',
                }}
              >
                Ir
              </button>
            )}
          </div>

          {/* Open in external browser */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleOpenExternal();
            }}
            title="Abrir no navegador externo do sistema"
            style={{
              background: barBg,
              border: `1px solid ${borderColor}`,
              color: textSecondary,
              padding: '4px 6px',
              borderRadius: 6,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 11,
              transition: 'color 0.12s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = textPrimary)}
            onMouseLeave={(e) => (e.currentTarget.style.color = textSecondary)}
          >
            <ExternalLink size={12} />
          </button>
        </div>

        {/* Quick bookmarks row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
          <span style={{ fontSize: 9.5, color: textSecondary, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Atalhos:
          </span>
          {quickLinks.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleNavigate(item.url);
              }}
              style={{
                background: currentUrl === item.url ? `${accentColor}22` : 'transparent',
                border: currentUrl === item.url ? `1px solid ${accentColor}66` : `1px solid ${borderColor}`,
                color: currentUrl === item.url ? accentColor : textSecondary,
                fontSize: 10,
                padding: '1px 6px',
                borderRadius: 4,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.12s ease',
              }}
              onMouseEnter={(e) => {
                if (currentUrl !== item.url) {
                  e.currentTarget.style.color = textPrimary;
                  e.currentTarget.style.borderColor = textSecondary;
                }
              }}
              onMouseLeave={(e) => {
                if (currentUrl !== item.url) {
                  e.currentTarget.style.color = textSecondary;
                  e.currentTarget.style.borderColor = borderColor;
                }
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Viewport & Live Iframe Area */}
      <div
        style={{
          flex: 1,
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: isEffectiveDark ? '#09090b' : '#f8fafc',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <div
          style={{
            width: viewport === 'mobile' ? 375 : viewport === 'tablet' ? 768 : '100%',
            height: '100%',
            maxWidth: '100%',
            background: '#ffffff',
            boxShadow:
              viewport !== 'desktop'
                ? isEffectiveDark
                  ? '0 0 24px rgba(0, 0, 0, 0.8)'
                  : '0 0 20px rgba(0, 0, 0, 0.15)'
                : 'none',
            borderLeft: viewport !== 'desktop' ? `1px solid ${borderColor}` : 'none',
            borderRight: viewport !== 'desktop' ? `1px solid ${borderColor}` : 'none',
            display: 'flex',
            position: 'relative',
            overflow: 'hidden',
            transition: 'width 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <iframe
            ref={iframeRef}
            key={iframeKey}
            src={currentUrl}
            title="WebView Browser"
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"
            onLoad={() => {
              setIsLoading(false);
              setHasError(false);
            }}
            onError={() => {
              setIsLoading(false);
              setHasError(true);
            }}
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              background: '#ffffff',
            }}
          />

          {/* Loading indicator bar */}
          {isLoading && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: 2,
                background: `linear-gradient(90deg, ${accentColor}, #3b82f6)`,
                animation: 'pulse 1s ease-in-out infinite',
                zIndex: 10,
              }}
            />
          )}

          {/* Fallback overlay if iframe blocked or errored */}
          {hasError && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: isEffectiveDark ? '#141416' : '#ffffff',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 20,
                textAlign: 'center',
                gap: 12,
                color: textPrimary,
              }}
            >
              <Globe size={32} color={accentColor} />
              <div style={{ fontSize: 13, fontWeight: 600 }}>Não foi possível incorporar este site</div>
              <div style={{ fontSize: 11, color: textSecondary, maxWidth: 320, lineHeight: '16px' }}>
                Alguns sites bloqueiam exibição em iframes por políticas de segurança (X-Frame-Options). Você pode abri-lo externamente:
              </div>
              <button
                type="button"
                onClick={handleOpenExternal}
                style={{
                  background: accentColor,
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 6,
                  padding: '6px 14px',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <ExternalLink size={13} />
                Abrir no Navegador
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
