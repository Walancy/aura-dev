import React from 'react';
import { Trash2 } from 'lucide-react';
import type { UnifiedConvoItem } from '../../types/ide';

export interface ChatHistoryModalProps {
  onClose: () => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  chatHistorySearch: string;
  setChatHistorySearch: (value: string) => void;
  setChatHistorySelectedIndex: (value: number) => void;
  chatHistorySelectedIndex: number;
  onKeyDown: (e: React.KeyboardEvent) => void;
  selectableConvosList: UnifiedConvoItem[];
  currentConvo: UnifiedConvoItem | undefined;
  runningConvos: UnifiedConvoItem[];
  visibleRecentConvos: UnifiedConvoItem[];
  recentConvos: UnifiedConvoItem[];
  chatHistoryShowAllRecent: boolean;
  setChatHistoryShowAllRecent: (value: boolean) => void;
  onSelectSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string, e?: React.MouseEvent) => void;
  formatTimeAgo: (timestamp?: number) => string;
}

// Command-palette style "all conversations" modal (Current / Running / Recent).
export const ChatHistoryModal: React.FC<ChatHistoryModalProps> = ({
  onClose,
  inputRef,
  chatHistorySearch,
  setChatHistorySearch,
  setChatHistorySelectedIndex,
  chatHistorySelectedIndex,
  onKeyDown,
  selectableConvosList,
  currentConvo,
  runningConvos,
  visibleRecentConvos,
  recentConvos,
  chatHistoryShowAllRecent,
  setChatHistoryShowAllRecent,
  onSelectSession,
  onDeleteSession,
  formatTimeAgo,
}) => {
  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.55)',
          zIndex: 999998,
          backdropFilter: 'blur(3px)',
          animation: 'fadeIn 0.12s ease-out',
        }}
      />

      {/* Modal Dialog */}
      <div
        style={{
          position: 'fixed',
          top: '12%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 580,
          maxWidth: 'calc(100vw - 32px)',
          background: '#1c1c1f',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: 10,
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.85)',
          zIndex: 999999,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxSizing: 'border-box',
          animation: 'fadeIn 0.12s ease-out',
          fontFamily: 'Poppins, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}
      >
        {/* Top Search Input Bar */}
        <div style={{ padding: '12px 14px 8px 14px', background: '#1c1c1f' }}>
          <input
            ref={inputRef}
            type="text"
            value={chatHistorySearch}
            onChange={(e) => {
              setChatHistorySearch(e.target.value);
              setChatHistorySelectedIndex(0);
            }}
            onKeyDown={onKeyDown}
            placeholder="Search all convos..."
            autoFocus
            style={{
              width: '100%',
              boxSizing: 'border-box',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1.5px solid #3b82f6',
              borderRadius: 8,
              padding: '8px 12px',
              color: '#ffffff',
              fontSize: 13,
              fontFamily: 'Poppins, sans-serif',
              outline: 'none',
              boxShadow: '0 0 0 1px rgba(59, 130, 246, 0.25)',
            }}
          />
        </div>

        {/* Convos List */}
        <div
          style={{
            maxHeight: 380,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            padding: '4px 6px 10px 6px',
          }}
        >
          {selectableConvosList.length === 0 ? (
            <div style={{ padding: '24px 16px', color: 'rgba(255, 255, 255, 0.4)', fontSize: 12.5, textAlign: 'center' }}>
              {chatHistorySearch.trim() ? `Nenhuma conversa encontrada para "${chatHistorySearch}"` : 'Nenhum histórico de conversa registrado.'}
            </div>
          ) : (
            <>
              {/* 1. CURRENT SECTION */}
              {currentConvo && (
                <div>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: 'rgba(255, 255, 255, 0.45)',
                      padding: '6px 10px 4px 10px',
                      letterSpacing: '0.02em',
                    }}
                  >
                    Current
                  </div>
                  {(() => {
                    const item = currentConvo;
                    const flatIdx = selectableConvosList.findIndex((x) => x.id === item.id);
                    const isSelected = flatIdx === chatHistorySelectedIndex;
                    return (
                      <div
                        key={item.id}
                        onClick={() => onSelectSession(item.id)}
                        onMouseEnter={() => setChatHistorySelectedIndex(flatIdx)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 12px',
                          margin: '2px 4px',
                          borderRadius: 6,
                          cursor: 'pointer',
                          background: isSelected ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.025)',
                          transition: 'background 0.08s ease',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden', minWidth: 0, flex: 1 }}>
                          <span
                            style={{
                              fontSize: 13,
                              fontWeight: 500,
                              color: '#ffffff',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {item.title}
                          </span>
                          {item.projectName && (
                            <span
                              style={{
                                fontSize: 12,
                                color: 'rgba(255, 255, 255, 0.4)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                flexShrink: 0,
                              }}
                            >
                              {item.projectName}
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                          <span style={{ fontSize: 11.5, color: 'rgba(255, 255, 255, 0.4)' }}>
                            {formatTimeAgo(item.updatedAt)}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => onDeleteSession(item.id, e)}
                            title="Excluir conversa"
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: 'rgba(255, 255, 255, 0.4)',
                              cursor: 'pointer',
                              padding: 2,
                              display: 'flex',
                              alignItems: 'center',
                              borderRadius: 3,
                            }}
                            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = '#ef4444')}
                            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = 'rgba(255, 255, 255, 0.4)')}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* 2. RUNNING SECTION */}
              {runningConvos.length > 0 && (
                <div style={{ marginTop: currentConvo ? 8 : 0 }}>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: 'rgba(255, 255, 255, 0.45)',
                      padding: '6px 10px 4px 10px',
                      letterSpacing: '0.02em',
                    }}
                  >
                    Running
                  </div>
                  {runningConvos.map((item) => {
                    const flatIdx = selectableConvosList.findIndex((x) => x.id === item.id);
                    const isSelected = flatIdx === chatHistorySelectedIndex;
                    return (
                      <div
                        key={item.id}
                        onClick={() => onSelectSession(item.id)}
                        onMouseEnter={() => setChatHistorySelectedIndex(flatIdx)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 12px',
                          margin: '2px 4px',
                          borderRadius: 6,
                          cursor: 'pointer',
                          background: isSelected ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                          transition: 'background 0.08s ease',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden', minWidth: 0, flex: 1 }}>
                          <span
                            style={{
                              fontSize: 13,
                              fontWeight: 500,
                              color: '#ffffff',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {item.title}
                          </span>
                          {item.projectName && (
                            <span
                              style={{
                                fontSize: 12,
                                color: 'rgba(255, 255, 255, 0.4)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                flexShrink: 0,
                              }}
                            >
                              {item.projectName}
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                          <span style={{ fontSize: 11.5, color: 'rgba(255, 255, 255, 0.4)' }}>
                            {formatTimeAgo(item.updatedAt)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* 3. RECENT SECTION */}
              {visibleRecentConvos.length > 0 && (
                <div style={{ marginTop: (currentConvo || runningConvos.length > 0) ? 8 : 0 }}>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: 'rgba(255, 255, 255, 0.45)',
                      padding: '6px 10px 4px 10px',
                      letterSpacing: '0.02em',
                    }}
                  >
                    Recent
                  </div>
                  {visibleRecentConvos.map((item) => {
                    const flatIdx = selectableConvosList.findIndex((x) => x.id === item.id);
                    const isSelected = flatIdx === chatHistorySelectedIndex;
                    return (
                      <div
                        key={item.id}
                        onClick={() => onSelectSession(item.id)}
                        onMouseEnter={() => setChatHistorySelectedIndex(flatIdx)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 12px',
                          margin: '2px 4px',
                          borderRadius: 6,
                          cursor: 'pointer',
                          background: isSelected ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                          transition: 'background 0.08s ease',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden', minWidth: 0, flex: 1 }}>
                          <span
                            style={{
                              fontSize: 13,
                              fontWeight: 500,
                              color: '#ffffff',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {item.title}
                          </span>
                          {item.projectName && (
                            <span
                              style={{
                                fontSize: 12,
                                color: 'rgba(255, 255, 255, 0.4)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                flexShrink: 0,
                              }}
                            >
                              {item.projectName}
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                          <span style={{ fontSize: 11.5, color: 'rgba(255, 255, 255, 0.4)' }}>
                            {formatTimeAgo(item.updatedAt)}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => onDeleteSession(item.id, e)}
                            title="Excluir conversa"
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: 'rgba(255, 255, 255, 0.4)',
                              cursor: 'pointer',
                              padding: 2,
                              display: 'flex',
                              alignItems: 'center',
                              borderRadius: 3,
                            }}
                            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = '#ef4444')}
                            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = 'rgba(255, 255, 255, 0.4)')}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {/* Show more button if there are more recent convos */}
                  {!chatHistoryShowAllRecent && !chatHistorySearch.trim() && recentConvos.length > 4 && (
                    <div
                      onClick={() => setChatHistoryShowAllRecent(true)}
                      style={{
                        padding: '8px 14px',
                        fontSize: 12,
                        color: 'rgba(255, 255, 255, 0.45)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        transition: 'color 0.15s ease',
                      }}
                      onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = '#3b82f6')}
                      onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = 'rgba(255, 255, 255, 0.45)')}
                    >
                      <span>Show {recentConvos.length - 4} more...</span>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            padding: '8px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 11,
            color: 'rgba(255, 255, 255, 0.35)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>↑↓ to navigate</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>↵ to select</span>
          </div>
        </div>
      </div>
    </>
  );
};
