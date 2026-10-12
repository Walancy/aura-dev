import React, { Component, ErrorInfo, ReactNode } from 'react';
import { RefreshCw, Trash2, Copy, Check } from 'lucide-react';
import GradientWaves from './auth/GradientWaves';
import logoUrl from '../../icon-devflow.svg';
import { logSystemActivity } from '../utils/brainService';

interface RootErrorBoundaryProps {
  children: ReactNode;
}

interface RootErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  copied: boolean;
}

/**
 * Envoltório seguro para o GradientWaves caso o WebGL falhe
 * durante uma pane crítica, garantindo que a tela de erro sempre renderize.
 */
class SafeGradientWaves extends Component<{}, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(err: any) {
    console.warn('[RootErrorBoundary] GradientWaves falhou ao renderizar WebGL:', err);
  }

  render() {
    if (this.state.hasError) return null;
    return (
      <GradientWaves
        horizonColor="#5227FF"
        waveColor="#FF9FFC"
        crestColor="#FFFFFF"
        speed={0.2}
        amplitude={3.15}
        waveScale={0.55}
        waveRatio={0.6}
        swell={40}
        turbulence={7.5}
        tilt={1.3}
        zoom={1.15}
        height={4.2}
        fogDepth={16}
        detail="medium"
        brightness={1.1}
        opacity={0.99}
        mouseInteraction
        parallaxStrength={0.14}
        grain
        grainIntensity={0.05}
      />
    );
  }
}

export class RootErrorBoundary extends Component<
  RootErrorBoundaryProps,
  RootErrorBoundaryState
> {
  constructor(props: RootErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      copied: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<RootErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[RootErrorBoundary] Erro crítico não tratado:', error, errorInfo);
    this.setState({ errorInfo });
    try {
      logSystemActivity(
        'root_error_boundary',
        'crash_capturado',
        error.message || 'Exceção não tratada na renderização',
        {
          stack: error.stack,
          componentStack: errorInfo.componentStack,
        }
      );
    } catch {
      // Ignora falhas no logger para não impedir a exibição da tela de erro
    }
  }

  handleReload = () => {
    try {
      logSystemActivity('root_error_boundary', 'recarregar_aplicacao', 'interface');
    } catch {
      // silent
    }
    window.location.reload();
  };

  handleResetOrchestration = () => {
    try {
      logSystemActivity('root_error_boundary', 'limpar_cache_nos', 'interface');
    } catch {
      // silent
    }
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (
          key &&
          (key.startsWith('devflow_orchestration_') ||
            key.startsWith('devflow_orch_') ||
            key.includes('nodes') ||
            key.includes('edges'))
        ) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
    } catch (e) {
      console.error('Falha ao limpar localStorage de orquestração:', e);
    }
    window.location.reload();
  };

  handleCopyError = () => {
    try {
      logSystemActivity('root_error_boundary', 'copiar_relatorio_erro', 'interface');
    } catch {
      // silent
    }
    const { error, errorInfo } = this.state;
    const text = `Aura Dev Crash Report:\n${error?.toString() || 'Erro desconhecido'}\n\nStack:\n${error?.stack || 'Sem stack'}\n\nComponent Stack:\n${errorInfo?.componentStack || 'Sem component stack'}`;
    navigator.clipboard?.writeText(text);
    this.setState({ copied: true });
    setTimeout(() => this.setState({ copied: false }), 2000);
  };

  render() {
    if (this.state.hasError) {
      const { error, errorInfo, copied } = this.state;
      const accentColor =
        (typeof window !== 'undefined' && localStorage.getItem('ide_accent_color')) || '#FF6A00';

      return (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: '#0a0a0b',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2147483647,
            WebkitAppRegion: 'drag' as any,
            userSelect: 'none',
            padding: 24,
            overflowY: 'auto',
            fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
            boxSizing: 'border-box',
          }}
        >
          {/* Fundo animado: GradientWaves (mesmo padrão visual da tela de login) */}
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            <SafeGradientWaves />
          </div>

          {/* Conteúdo Central */}
          <div
            style={{
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 20,
              WebkitAppRegion: 'no-drag' as any,
              maxWidth: 580,
              width: 'min(580px, calc(100vw - 32px))',
              boxSizing: 'border-box',
              animation: 'devflow-error-fade-in 0.2s ease-out',
            }}
          >
            {/* Logo da Aplicação */}
            <img
              src={logoUrl}
              alt="DevFlow"
              style={{ width: 64, height: 'auto', filter: 'none' }}
            />

            {/* Cabeçalho */}
            <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 400,
                  color: '#ffffff',
                  letterSpacing: '-0.01em',
                }}
              >
                Instabilidade na Interface
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: 'rgba(255, 255, 255, 0.55)',
                  fontWeight: 400,
                }}
              >
                O aplicativo encontrou uma exceção não tratada na renderização.
              </div>
            </div>

            {/* Card Principal de Erro */}
            <div
              style={{
                width: '100%',
                background: 'rgba(255, 255, 255, 0.05)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                borderRadius: 14,
                border: 'none',
                boxShadow: 'none',
                padding: 20,
                display: 'flex',
                flexDirection: 'column',
                gap: 20,
                boxSizing: 'border-box',
              }}
            >
              {/* Mensagem do Erro */}
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.04)',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  borderRadius: 8,
                  border: 'none',
                  boxShadow: 'none',
                  padding: 12,
                  fontSize: 12,
                  fontFamily: "'JetBrains Mono', Menlo, monospace",
                  fontWeight: 400,
                  color: '#f87171',
                  overflowX: 'auto',
                  lineHeight: 1.5,
                  maxHeight: 120,
                  boxSizing: 'border-box',
                }}
              >
                {error?.message || 'Erro desconhecido'}
              </div>

              {/* Rastreamento Detalhado (Stack trace) */}
              {error?.stack && (
                <details
                  style={{
                    fontSize: 11.5,
                    color: 'rgba(255, 255, 255, 0.6)',
                    fontWeight: 400,
                  }}
                >
                  <summary
                    style={{
                      cursor: 'pointer',
                      userSelect: 'none',
                      outline: 'none',
                      color: 'rgba(255, 255, 255, 0.65)',
                      fontSize: 11.5,
                      fontWeight: 400,
                      transition: 'color 0.15s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = '#ffffff')}
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.color = 'rgba(255, 255, 255, 0.65)')
                    }
                  >
                    Ver rastreamento detalhado (stack trace)
                  </summary>
                  <pre
                    style={{
                      marginTop: 10,
                      padding: 12,
                      background: 'rgba(0, 0, 0, 0.35)',
                      borderRadius: 6,
                      border: 'none',
                      boxShadow: 'none',
                      maxHeight: 180,
                      overflowY: 'auto',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all',
                      fontFamily: "'JetBrains Mono', Menlo, monospace",
                      fontSize: 10.5,
                      fontWeight: 400,
                      color: 'rgba(255, 255, 255, 0.65)',
                      lineHeight: 1.5,
                      boxSizing: 'border-box',
                    }}
                  >
                    {error.stack}
                    {errorInfo?.componentStack
                      ? `\n\nComponent Stack:\n${errorInfo.componentStack}`
                      : ''}
                  </pre>
                </details>
              )}

              {/* Divisor de baixa opacidade */}
              <div style={{ height: 1, background: 'rgba(255, 255, 255, 0.06)' }} />

              {/* Botões de Ação com altura uniforme 28px */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  flexWrap: 'wrap',
                }}
              >
                <button
                  type="button"
                  onClick={this.handleReload}
                  style={{
                    flex: '1 1 auto',
                    height: 28,
                    padding: '0 14px',
                    borderRadius: 6,
                    background: accentColor,
                    border: 'none',
                    boxShadow: 'none',
                    color: '#ffffff',
                    fontSize: 11.5,
                    fontWeight: 400,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    transition: 'opacity 0.15s ease',
                    boxSizing: 'border-box',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.88')}
                  onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
                >
                  <RefreshCw size={12} />
                  <span>Recarregar Aplicação</span>
                </button>

                <button
                  type="button"
                  onClick={this.handleResetOrchestration}
                  title="Restaura os nós para o modelo padrão se dados corrompidos estiverem impedindo o carregamento"
                  style={{
                    height: 28,
                    padding: '0 12px',
                    borderRadius: 6,
                    background: 'rgba(255, 255, 255, 0.07)',
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)',
                    border: 'none',
                    boxShadow: 'none',
                    color: '#ffffff',
                    fontSize: 11.5,
                    fontWeight: 400,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    transition: 'background 0.15s ease',
                    boxSizing: 'border-box',
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)')
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.07)')
                  }
                >
                  <Trash2 size={12} />
                  <span>Limpar Cache de Nós</span>
                </button>

                <button
                  type="button"
                  onClick={this.handleCopyError}
                  style={{
                    height: 28,
                    padding: '0 12px',
                    borderRadius: 6,
                    background: 'rgba(255, 255, 255, 0.07)',
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)',
                    border: 'none',
                    boxShadow: 'none',
                    color: copied ? '#22c55e' : 'rgba(255, 255, 255, 0.8)',
                    fontSize: 11.5,
                    fontWeight: 400,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    transition: 'background 0.15s ease, color 0.15s ease',
                    boxSizing: 'border-box',
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)')
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.07)')
                  }
                >
                  {copied ? <Check size={12} color="#22c55e" /> : <Copy size={12} />}
                  <span>{copied ? 'Copiado' : 'Copiar Erro'}</span>
                </button>
              </div>
            </div>
          </div>

          <style>{`
            @keyframes devflow-error-fade-in {
              from { opacity: 0; transform: scale(0.98); }
              to { opacity: 1; transform: scale(1); }
            }
          `}</style>
        </div>
      );
    }

    return this.props.children;
  }
}
