import React, { Component, ErrorInfo, ReactNode } from 'react';

interface RootErrorBoundaryProps {
  children: ReactNode;
}

interface RootErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  copied: boolean;
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
  }

  handleReload = () => {
    window.location.reload();
  };

  handleResetOrchestration = () => {
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
    const { error, errorInfo } = this.state;
    const text = `DevFlow Crash Report:\n${error?.toString() || 'Erro desconhecido'}\n\nStack:\n${error?.stack || 'Sem stack'}\n\nComponent Stack:\n${errorInfo?.componentStack || 'Sem component stack'}`;
    navigator.clipboard?.writeText(text);
    this.setState({ copied: true });
    setTimeout(() => this.setState({ copied: false }), 2000);
  };

  render() {
    if (this.state.hasError) {
      const { error, errorInfo, copied } = this.state;
      return (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 999999,
            backgroundColor: '#09090b',
            backgroundImage:
              'radial-gradient(circle at 50% 25%, rgba(249, 115, 22, 0.08) 0%, transparent 60%)',
            color: '#f4f4f5',
            fontFamily:
              "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 32,
            overflowY: 'auto',
          }}
        >
          <div
            style={{
              maxWidth: 580,
              width: '100%',
              backgroundColor: '#18181b',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: 16,
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 30px rgba(249, 115, 22, 0.1)',
              padding: '32px 28px',
              display: 'flex',
              flexDirection: 'column',
              gap: 20,
            }}
          >
            {/* Header Icon + Title */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ef4444',
                  fontSize: 22,
                  flexShrink: 0,
                }}
              >
                ⚠️
              </div>
              <div>
                <h1
                  style={{
                    margin: 0,
                    fontSize: 18,
                    fontWeight: 600,
                    letterSpacing: '-0.02em',
                    color: '#ffffff',
                  }}
                >
                  Instabilidade na Interface
                </h1>
                <p
                  style={{
                    margin: '3px 0 0',
                    fontSize: 13,
                    color: '#a1a1aa',
                    lineHeight: 1.4,
                  }}
                >
                  O aplicativo encontrou uma exceção não tratada na renderização.
                </p>
              </div>
            </div>

            {/* Error Message Box */}
            <div
              style={{
                backgroundColor: 'rgba(0, 0, 0, 0.4)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                borderRadius: 8,
                padding: '12px 14px',
                fontSize: 12,
                fontFamily: "'JetBrains Mono', monospace",
                color: '#fca5a5',
                overflowX: 'auto',
                lineHeight: 1.5,
                maxHeight: 120,
              }}
            >
              {error?.message || 'Erro desconhecido'}
            </div>

            {/* Stack trace detail */}
            {error?.stack && (
              <details style={{ fontSize: 11, color: '#71717a' }}>
                <summary
                  style={{
                    cursor: 'pointer',
                    userSelect: 'none',
                    outline: 'none',
                    color: '#a1a1aa',
                  }}
                >
                  Ver rastreamento detalhado (stack trace)
                </summary>
                <pre
                  style={{
                    marginTop: 8,
                    padding: 10,
                    background: '#09090b',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: 6,
                    maxHeight: 180,
                    overflowY: 'auto',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 10.5,
                    color: '#a1a1aa',
                  }}
                >
                  {error.stack}
                  {errorInfo?.componentStack ? `\n\nComponent Stack:\n${errorInfo.componentStack}` : ''}
                </pre>
              </details>
            )}

            {/* Actions */}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 10,
                paddingTop: 8,
                borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              <button
                type="button"
                onClick={this.handleReload}
                style={{
                  flex: '1 1 auto',
                  minWidth: 140,
                  height: 38,
                  padding: '0 16px',
                  borderRadius: 8,
                  background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  boxShadow: '0 4px 14px rgba(249, 115, 22, 0.35)',
                  transition: 'opacity 0.15s ease',
                }}
              >
                🔄 Recarregar Aplicação
              </button>

              <button
                type="button"
                onClick={this.handleResetOrchestration}
                title="Restaura os nós para o modelo padrão se dados corrompidos estiverem impedindo o carregamento"
                style={{
                  height: 38,
                  padding: '0 14px',
                  borderRadius: 8,
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.14)',
                  color: '#e4e4e7',
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                Limpar Cache de Nós
              </button>

              <button
                type="button"
                onClick={this.handleCopyError}
                style={{
                  height: 38,
                  padding: '0 12px',
                  borderRadius: 8,
                  background: 'transparent',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: '#a1a1aa',
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                {copied ? '✓ Copiado' : 'Copiar Erro'}
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
