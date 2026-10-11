import React, { useEffect, useRef, useState } from 'react';
import { Check, ExternalLink, X } from 'lucide-react';
import GradientWaves from './GradientWaves';
import logoUrl from '../../../icon-devflow.svg';

export interface GithubAuthenticatedUser {
  login: string;
  name: string | null;
  avatarUrl: string;
  htmlUrl: string;
}

export interface GithubLoginScreenProps {
  accentColor: string;
  onAuthenticated: (user: GithubAuthenticatedUser) => void;
  /** usuário que acabou de sair (a sessão continua válida): mostra um card para voltar a ela sem trocar de conta */
  previousUser?: { user: GithubAuthenticatedUser; lastLogin: string | null } | null;
  onResume?: () => void;
}

type LoginState = 'idle' | 'requesting' | 'waiting' | 'error';

const GithubMarkIcon: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg height={size} width={size} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
  </svg>
);

export const GithubLoginScreen: React.FC<GithubLoginScreenProps> = ({ accentColor, onAuthenticated, previousUser, onResume }) => {
  const [state, setState] = useState<LoginState>('idle');
  const [userCode, setUserCode] = useState('');
  const [verificationUri, setVerificationUri] = useState('https://github.com/login/device');
  const [errorMessage, setErrorMessage] = useState('');
  const [copied, setCopied] = useState(false);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      unsubscribeRef.current?.();
      window.electronAPI?.github?.cancelLogin?.();
    };
  }, []);

  const startLogin = async () => {
    setState('requesting');
    setErrorMessage('');
    try {
      const result = await window.electronAPI?.github?.startLogin?.();
      if (!result?.success) {
        setState('error');
        setErrorMessage(result?.error || 'Não foi possível iniciar o login com o GitHub.');
        return;
      }
      setUserCode(result.userCode || '');
      setVerificationUri(result.verificationUri || 'https://github.com/login/device');
      setState('waiting');

      unsubscribeRef.current =
        window.electronAPI?.github?.onLoginResult?.((res) => {
          if (res.success && res.user) {
            onAuthenticated(res.user);
          } else {
            setState('error');
            setErrorMessage(
              res.error === 'expired'
                ? 'O código expirou. Tente novamente.'
                : res.error === 'access_denied'
                ? 'Autorização negada no GitHub.'
                : res.error || 'Falha ao autenticar com o GitHub.'
            );
          }
        }) || null;
    } catch (err: any) {
      setState('error');
      setErrorMessage(err?.message || 'Erro inesperado ao iniciar o login.');
    }
  };

  const handleCopyCode = () => {
    if (!userCode) return;
    navigator.clipboard?.writeText(userCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };

  const handleRetry = () => {
    setState('idle');
    setErrorMessage('');
    setUserCode('');
  };

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
      }}
    >
      {/* Fundo animado: GradientWaves (React Bits) */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
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
      </div>

      <div
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 22,
          WebkitAppRegion: 'no-drag' as any,
        }}
      >
        <img
          src={logoUrl}
          alt="Aura Dev"
          style={{ width: 84, height: 'auto', filter: 'none' }}
        />

        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: '#ffffff',
              fontFamily: 'Poppins, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            }}
          >
            Bem-vindo ao Aura Dev
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 6 }}>
            Entre com sua conta do GitHub para continuar
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 22, minWidth: 300 }}>
        {!previousUser && (state === 'idle' || state === 'requesting') && (
          <button
            onClick={startLogin}
            disabled={state === 'requesting'}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 20px',
              borderRadius: 8,
              border: 'none',
              background: 'rgba(255,255,255,0.07)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
              color: '#ffffff',
              fontSize: 13.5,
              fontWeight: 400,
              cursor: state === 'requesting' ? 'default' : 'pointer',
              opacity: state === 'requesting' ? 0.6 : 1,
              transition: 'background 0.15s ease, opacity 0.15s ease',
              marginTop: 6,
            }}
            onMouseEnter={(e) => {
              if (state !== 'requesting') e.currentTarget.style.background = 'rgba(255,255,255,0.12)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.07)';
            }}
          >
            <GithubMarkIcon size={16} />
            {state === 'requesting' ? 'Conectando...' : 'Continuar com GitHub'}
          </button>
        )}

        {previousUser && onResume && (state === 'idle' || state === 'requesting') && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
            <button
              onClick={onResume}
              title="Voltar para a sessão deste usuário"
              style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '10px 18px 10px 12px', borderRadius: 10, cursor: 'pointer',
                border: 'none', background: 'rgba(255,255,255,0.07)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', color: '#ffffff', textAlign: 'left', width: '100%', boxSizing: 'border-box',
                transition: 'background 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.12)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}
            >
              <img src={previousUser.user.avatarUrl} alt={previousUser.user.login} style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
              <span style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <span style={{ fontSize: 13.5, fontWeight: 400 }}>{previousUser.user.name || previousUser.user.login}</span>
                <span style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.5)' }}>@{previousUser.user.login}</span>
              </span>
            </button>
            <button
              onClick={startLogin}
              disabled={state === 'requesting'}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, alignSelf: 'center', marginTop: 6, padding: '4px 8px',
                background: 'none', border: 'none', color: 'rgba(255,255,255,0.55)', fontSize: 12, fontWeight: 400,
                cursor: state === 'requesting' ? 'default' : 'pointer', transition: 'color 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#ffffff')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.55)')}
            >
              <GithubMarkIcon size={13} />
              {state === 'requesting' ? 'Conectando...' : 'Trocar de conta'}
            </button>
          </div>
        )}
        </div>

        {state === 'waiting' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, marginTop: 4 }}>
            <div
              style={{
                display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.07)', backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)', borderRadius: 10, padding: '10px 12px 10px 22px',
              }}
            >
              <span style={{ fontFamily: '"JetBrains Mono", Menlo, monospace', fontSize: 24, fontWeight: 400, letterSpacing: 5, color: '#ffffff' }}>
                {userCode}
              </span>
              <button
                onClick={() => { handleCopyCode(); window.electronAPI?.shell?.openExternal?.(verificationUri); }}
                title="Copiar código e abrir o link" 
                style={{ display: 'flex', background: 'none', border: 'none', color: copied ? '#22c55e' : 'rgba(255,255,255,0.6)', cursor: 'pointer', padding: 6, borderRadius: 6, transition: 'background 0.15s ease' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                {copied ? <Check size={16} /> : <ExternalLink size={16} />}
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: accentColor, animation: 'devflow-login-pulse 1.2s ease-in-out infinite' }} />
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>Aguardando...</span>
            </div>
            <button
              onClick={handleRetry}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 12, cursor: 'pointer', padding: '6px 10px', borderRadius: 6, transition: 'all 0.15s ease' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#ffffff'; e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; e.currentTarget.style.background = 'transparent'; }}
            >
              <X size={14} />
              Cancelar
            </button>
          </div>
        )}

        {state === 'error' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginTop: 4 }}>
            <div style={{ fontSize: 12.5, color: '#f87171', textAlign: 'center', maxWidth: 300 }}>{errorMessage}</div>
            <button
              onClick={handleRetry}
              style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: 'rgba(255,255,255,0.07)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', color: '#ffffff', fontSize: 12.5, fontWeight: 400, cursor: 'pointer' }}
            >
              Tentar de novo
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes devflow-login-pulse {
          0%, 100% { opacity: 0.35; transform: scale(0.85); }
          50% { opacity: 1; transform: scale(1.15); }
        }
      `}</style>
    </div>
  );
};
