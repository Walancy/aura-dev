import React, { useState } from 'react';
import { Puzzle } from 'lucide-react';
import type { ExtensionEditorTitleAction } from '../utils/extensions';

// Editor-title icon button for an extension-contributed action. Tracks its own image-load
// failure so a broken/missing local icon file falls back to a generic icon instead of a
// blank square.
export const ExtensionTitleActionButton: React.FC<{
  action: ExtensionEditorTitleAction;
  themeTokens: { textSecondary: string };
  isEffectiveDark: boolean;
  onClick: () => void;
}> = ({ action, themeTokens, isEffectiveDark, onClick }) => {
  const [imgFailed, setImgFailed] = useState(false);
  return (
    <div
      onClick={onClick}
      style={{
        width: 26,
        height: 26,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        borderRadius: 4,
        transition: 'background 0.15s ease',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = isEffectiveDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      title={`${action.title} (contribuído por ${action.extensionName})`}
    >
      {action.iconUrl && !imgFailed ? (
        <img
          src={action.iconUrl}
          alt={action.extensionName}
          style={{ width: 14, height: 14, objectFit: 'contain', borderRadius: 2 }}
          onError={() => setImgFailed(true)}
        />
      ) : (
        <Puzzle size={14} color={themeTokens.textSecondary} />
      )}
    </div>
  );
};
