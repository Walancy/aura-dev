import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Bot, X } from 'lucide-react';
import { AiSection } from '../settings/sections/AiSection';
import { getProjectSettings, saveProjectSettings, subscribeProjectSettings, type ProjectSettings } from '../settings/projectSettingsStore';
import { ghSettings } from '../settings/settingsUi';
import { getFieldTokens } from '../../utils/fieldTokens';

interface ProjectAiModalProps {
  isOpen: boolean;
  onClose: () => void;
  repoFullName?: string;
  isEffectiveDark: boolean;
  accentColor: string;
  accentContrastText: string;
  onToast: (msg: string) => void;
}

// Configuração da IA do projeto ativo (mesma seção das Configurações do projeto), aberta pelo menu da engrenagem
export const ProjectAiModal: React.FC<ProjectAiModalProps> = ({ isOpen, onClose, repoFullName = '', isEffectiveDark, accentColor, accentContrastText, onToast }) => {
  const [owner, repo] = repoFullName.split('/');
  const [settings, setSettings] = useState<ProjectSettings>(() => getProjectSettings(repoFullName));
  const [repoInfo, setRepoInfo] = useState<any | null>(null);

  const ft = getFieldTokens(isEffectiveDark);
  const theme = useMemo(
    () => ({
      controlBg: ft.fieldBg,
      controlHoverBg: ft.fieldBgHover,
      textPrimary: isEffectiveDark ? '#ffffff' : '#111111',
      textSecondary: isEffectiveDark ? '#888888' : '#777777',
      textMuted: isEffectiveDark ? '#555555' : '#999999',
    }),
    [isEffectiveDark, ft],
  );

  useEffect(() => {
    if (!isOpen || !repoFullName) return;
    setSettings(getProjectSettings(repoFullName));
    const unsubscribe = subscribeProjectSettings((r) => {
      if (r.toLowerCase() === repoFullName.toLowerCase()) setSettings(getProjectSettings(repoFullName));
    });
    return () => {
      unsubscribe();
    };
  }, [isOpen, repoFullName]);

  const reloadRepo = useCallback(async () => {
    if (!owner || !repo) return;
    try {
      setRepoInfo(await ghSettings('getRepo', { owner, repo }));
    } catch {
      setRepoInfo(null);
    }
  }, [owner, repo]);

  useEffect(() => {
    if (!isOpen) return;
    setRepoInfo(null);
    reloadRepo();
  }, [isOpen, reloadRepo]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const update = useCallback(
    (fn: (prev: ProjectSettings) => ProjectSettings) => {
      if (!repoFullName) return;
      const next = fn(getProjectSettings(repoFullName));
      saveProjectSettings(repoFullName, next);
      setSettings(next);
    },
    [repoFullName],
  );

  if (!isOpen) return null;

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 99999, background: isEffectiveDark ? 'rgba(0, 0, 0, 0.75)' : 'rgba(0, 0, 0, 0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{ width: '100%', maxWidth: 760, height: 'min(800px, calc(100vh - 32px))', background: isEffectiveDark ? '#161618' : '#ffffff', borderRadius: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 16, flexShrink: 0 }}>
          <Bot size={15} color={accentColor} />
          <span style={{ flex: 1, fontSize: 13, color: theme.textPrimary }}>
            IA do projeto {repoFullName && <span style={{ color: theme.textMuted, fontSize: 11.5 }}>{repoFullName}</span>}
          </span>
          <button
            type="button"
            onClick={onClose}
            title="Fechar"
            style={{ width: 28, height: 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: 'none', borderRadius: 6, background: 'transparent', color: theme.textSecondary, cursor: 'pointer', transition: 'background 0.15s ease' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = theme.controlHoverBg)}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <X size={14} />
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 16px' }}>
          {owner && repo ? (
            <AiSection
              ctx={{ theme, accentColor, accentContrastText, isEffectiveDark }}
              repoFullName={repoFullName}
              owner={owner}
              repo={repo}
              repoInfo={repoInfo}
              isAdmin={Boolean(repoInfo?.permissions?.admin)}
              reloadRepo={reloadRepo}
              settings={settings}
              update={update}
              showToast={onToast}
              confirm={() => {}}
            />
          ) : (
            <div style={{ padding: 24, fontSize: 12.5, color: theme.textSecondary }}>Selecione um projeto vinculado a um repositório do GitHub para configurar a IA dele.</div>
          )}
        </div>
      </div>
    </div>
  );
};
