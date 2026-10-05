import React, { useEffect, useRef, useState, useCallback } from 'react';
import { X, RefreshCw, AlertCircle, Play } from 'lucide-react';

export interface OrchestrationSimulatorPanelProps {
  isOpen: boolean;
  onClose: () => void;
  sources: Array<{ id: string; name: string }>;
  onRefresh: () => void;
  accentColor: string;
  isEffectiveDark: boolean;
  bgCard: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
}

// Captura ao vivo (best-effort) da janela do Simulador iOS/Xcode via Electron desktopCapturer.
// Mostra o vídeo real do simulador dentro do canvas; não repassa clique/teclado (somente visualização).
export const OrchestrationSimulatorPanel: React.FC<OrchestrationSimulatorPanelProps> = ({
  isOpen,
  onClose,
  sources,
  onRefresh,
  accentColor,
  isEffectiveDark,
  bgCard,
  border,
  textPrimary,
  textSecondary,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Stop active media stream completely
  const stopStream = useCallback(() => {
    if (streamRef.current) {
      try {
        streamRef.current.getTracks().forEach((track) => {
          track.stop();
        });
      } catch {}
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // Stop tracks when closed or unmounted
  useEffect(() => {
    if (!isOpen) {
      stopStream();
      setSelectedId(null);
      setError(null);
    }
  }, [isOpen, stopStream]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Connect to selected window stream
  const connectToSource = useCallback((sourceId: string) => {
    stopStream();
    setError(null);
    setSelectedId(sourceId);

    (navigator.mediaDevices.getUserMedia as any)({
      audio: false,
      video: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: sourceId,
        },
      },
    })
      .then((stream: MediaStream) => {
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      })
      .catch((err: Error) => {
        const msg = err.message || '';
        if (/denied|permission|not allowed/i.test(msg)) {
          setError(
            'Permissão negada. Conceda acesso à Gravação de Tela nas Preferências do Sistema do macOS > Privacidade e Segurança > Gravação de Tela.'
          );
        } else {
          setError(`Falha na captura: ${msg || 'Janela indisponível'}`);
        }
      });
  }, [stopStream]);

  useEffect(() => {
    if (selectedId) {
      connectToSource(selectedId);
    }
    return () => {
      stopStream();
    };
  }, [selectedId, connectToSource, stopStream]);

  if (!isOpen) return null;

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      style={{
        position: 'fixed',
        top: '12%',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 440,
        maxHeight: '75vh',
        background: bgCard,
        border: `1px solid ${border}`,
        borderRadius: 12,
        boxShadow: isEffectiveDark ? '0 24px 64px rgba(0, 0, 0, 0.75)' : '0 24px 64px rgba(0, 0, 0, 0.18)',
        zIndex: 975,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '10px 14px',
          borderBottom: `1px solid ${border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ fontSize: 12.5, fontWeight: 600, color: textPrimary }}>
          Capturar Janela do Simulador iOS
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={onRefresh}
            aria-label="Atualizar lista de janelas"
            title="Atualizar lista"
            style={{ background: 'transparent', border: 'none', color: textSecondary, cursor: 'pointer', padding: 4, display: 'flex' }}
          >
            <RefreshCw size={13} />
          </button>
          <button
            onClick={onClose}
            aria-label="Fechar captura"
            style={{ background: 'transparent', border: 'none', color: textSecondary, cursor: 'pointer', padding: 4, display: 'flex' }}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 6, borderBottom: `1px solid ${border}` }}>
        <div style={{ fontSize: 10.5, color: textSecondary, lineHeight: 1.4 }}>
          Abra o <strong>Simulator</strong> no macOS (Xcode) e selecione a janela abaixo. Visualização direta no canvas (somente vídeo).
        </div>
        {sources.length === 0 ? (
          <div style={{ fontSize: 11, color: textSecondary, padding: '6px 0' }}>
            Nenhuma janela de simulador encontrada. Abra o Simulador iOS e clique em atualizar.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 110, overflowY: 'auto' }}>
            {sources.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelectedId(s.id)}
                style={{
                  padding: '6px 10px',
                  borderRadius: 6,
                  border: selectedId === s.id ? `1px solid ${accentColor}` : `1px solid ${border}`,
                  background: selectedId === s.id ? `${accentColor}18` : 'transparent',
                  color: selectedId === s.id ? accentColor : textPrimary,
                  fontSize: 11.5,
                  fontWeight: selectedId === s.id ? 600 : 400,
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Play size={10} color={selectedId === s.id ? accentColor : textSecondary} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div
        style={{
          flex: 1,
          background: '#09090b',
          minHeight: 280,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        {error ? (
          <div style={{ padding: 18, textAlign: 'center', maxWidth: 360, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <AlertCircle size={22} color="#ef4444" />
            <div style={{ fontSize: 11.5, color: '#ef4444', lineHeight: 1.4 }}>{error}</div>
            <button
              onClick={() => {
                if (selectedId) connectToSource(selectedId);
                else onRefresh();
              }}
              style={{
                marginTop: 6,
                padding: '5px 12px',
                borderRadius: 6,
                border: 'none',
                background: accentColor,
                color: '#ffffff',
                fontSize: 11,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Tentar novamente
            </button>
          </div>
        ) : selectedId ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{ width: '100%', height: '100%', maxHeight: 380, objectFit: 'contain' }}
          />
        ) : (
          <div style={{ fontSize: 11, color: textSecondary }}>Selecione um simulador na lista acima</div>
        )}
      </div>
    </div>
  );
};
