import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Terminal,
  Search,
  FileCode2,
  Check,
  RotateCcw,
  Copy,
  Clock,
} from 'lucide-react';
import { FileIcon } from '../../FileIcon';
import type { ExecutionStepItem, ChangedFileItem } from '../../../types/ide';

export interface TerminalExecutionRecord {
  command: string;
  cwd?: string;
  duration?: string;
  stdout?: string;
  stderr?: string;
  exitCode?: number;
}

interface AiChatTimelineProps {
  steps?: ExecutionStepItem[];
  workedDuration?: string;
  thoughtSnippet?: string;
  isWorking?: boolean;
  /** o que a IA está fazendo agora (ex.: "Editando App.tsx..."); sem isso mostra "Pensando…" */
  liveAction?: string;
  terminalCommands?: TerminalExecutionRecord[];
  changedFiles?: ChangedFileItem[];
  onOpenFileAction?: (path: string, name: string, lineRange?: string) => void;
  onReviewDiffAction?: (files: ChangedFileItem[], index: number) => void;
  onAcceptAllDiffs?: () => void;
  onRejectAllDiffs?: () => void;
  accentColor: string;
  themeTokens: any;
  isEffectiveDark: boolean;
}

export const AiChatTimeline: React.FC<AiChatTimelineProps> = ({
  steps: rawSteps,
  workedDuration,
  thoughtSnippet,
  isWorking = false,
  liveAction,
  terminalCommands: rawTerminalCommands,
  changedFiles: rawChangedFiles,
  onOpenFileAction,
  onReviewDiffAction,
  onAcceptAllDiffs,
  onRejectAllDiffs,
  accentColor,
  themeTokens,
  isEffectiveDark,
}) => {
  const steps = Array.isArray(rawSteps) ? rawSteps : [];
  const terminalCommands = Array.isArray(rawTerminalCommands) ? rawTerminalCommands : [];
  const changedFiles = Array.isArray(rawChangedFiles) ? rawChangedFiles : [];

  const [isAccordionOpen, setIsAccordionOpen] = useState(true);
  const [expandedCommandIdx, setExpandedCommandIdx] = useState<number | null>(null);
  const [expandedStepKeys, setExpandedStepKeys] = useState<Record<string, boolean>>({});
  const [copiedCmdIdx, setCopiedCmdIdx] = useState<number | null>(null);

  const toggleStepKey = (key: string) => {
    setExpandedStepKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const copyCommandText = (cmd: string, idx: number) => {
    navigator.clipboard.writeText(cmd);
    setCopiedCmdIdx(idx);
    setTimeout(() => setCopiedCmdIdx(null), 2000);
  };

  const totalAdditions = changedFiles.reduce((acc, f) => acc + (f.additions || 0), 0);
  const totalDeletions = changedFiles.reduce((acc, f) => acc + (f.deletions || 0), 0);

  const divider = isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';
  const surface = isEffectiveDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)';

  if (!steps.length && !workedDuration && !thoughtSnippet && !isWorking && !changedFiles.length) {
    return null;
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        padding: 8,
        borderRadius: 8,
        background: surface,
        border: 'none',
        boxShadow: 'none',
        width: '100%',
        boxSizing: 'border-box',
        transition: 'all 0.15s ease',
      }}
    >
      {/* Top Header: Worked for X or Thinking... */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button
          type="button"
          onClick={() => setIsAccordionOpen((prev) => !prev)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'transparent',
            border: 'none',
            color: themeTokens.textPrimary,
            fontSize: 12,
            fontWeight: 500,
            cursor: 'pointer',
            padding: 0,
            textAlign: 'left',
            minWidth: 0,
            flex: 1,
            transition: 'color 0.15s ease',
          }}
        >
          {isAccordionOpen ? <ChevronDown size={13} style={{ flexShrink: 0 }} /> : <ChevronRight size={13} style={{ flexShrink: 0 }} />}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
            {isWorking ? (liveAction || 'Pensando…') : workedDuration ? `Trabalhou por ${workedDuration}` : 'Concluído'}
          </span>
          {isWorking && (
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: accentColor,
                display: 'inline-block',
                flexShrink: 0,
                animation: 'pulse 1.2s infinite ease-in-out',
              }}
            />
          )}
        </button>

        {changedFiles.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
            <span style={{ color: '#22c55e', fontWeight: 500 }}>+{totalAdditions}</span>
            <span style={{ color: '#ef4444', fontWeight: 500 }}>-{totalDeletions}</span>
          </div>
        )}
      </div>

      {isAccordionOpen && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 4 }}>
          {/* Chain of Thought text if available */}
          {thoughtSnippet && (
            <div
              style={{
                fontSize: 11.5,
                color: themeTokens.textSecondary,
                lineHeight: '16px',
                padding: '4px 6px',
                borderRadius: 4,
                background: isEffectiveDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.02)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                <Clock size={11} color={themeTokens.textSecondary} />
                <span style={{ fontSize: 10.5, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                  Chain of Thought
                </span>
              </div>
              <span>{thoughtSnippet}</span>
            </div>
          )}

          {/* Ran Terminal Commands Section */}
          {terminalCommands.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontSize: 11, fontWeight: 500, color: themeTokens.textSecondary, display: 'flex', alignItems: 'center', gap: 5 }}>
                <Terminal size={11} color={accentColor} />
                <span>Comandos Executados ({terminalCommands.length})</span>
              </div>
              {terminalCommands.map((tc, idx) => {
                const isExp = expandedCommandIdx === idx;
                return (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      borderRadius: 4,
                      background: isEffectiveDark ? 'rgba(0, 0, 0, 0.25)' : 'rgba(255, 255, 255, 0.5)',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      onClick={() => setExpandedCommandIdx(isExp ? null : idx)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '4px 8px',
                        cursor: 'pointer',
                        gap: 6,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: 1 }}>
                        {isExp ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                        <span style={{ fontFamily: 'monospace', fontSize: 11, color: themeTokens.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          $ {tc.command}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {tc.duration && (
                          <span style={{ fontSize: 10, color: themeTokens.textSecondary }}>{tc.duration}</span>
                        )}
                        <span
                          style={{
                            fontSize: 9.5,
                            padding: '1px 4px',
                            borderRadius: 3,
                            background: tc.exitCode === 0 ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                            color: tc.exitCode === 0 ? '#22c55e' : '#ef4444',
                            fontFamily: 'monospace',
                          }}
                        >
                          exit {tc.exitCode ?? 0}
                        </span>
                      </div>
                    </div>

                    {isExp && (
                      <div
                        style={{
                          padding: '6px 8px',
                          borderTop: `1px solid ${divider}`,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 6,
                          fontSize: 11,
                          fontFamily: 'monospace',
                        }}
                      >
                        {tc.cwd && (
                          <div style={{ color: themeTokens.textSecondary }}>
                            cwd: {tc.cwd}
                          </div>
                        )}
                        {tc.stdout && (
                          <div
                            style={{
                              background: isEffectiveDark ? '#111' : '#f4f4f4',
                              padding: '6px 8px',
                              borderRadius: 4,
                              maxHeight: 120,
                              overflowY: 'auto',
                              whiteSpace: 'pre-wrap',
                              color: themeTokens.textPrimary,
                            }}
                          >
                            {tc.stdout}
                          </div>
                        )}
                        {tc.stderr && (
                          <div
                            style={{
                              background: 'rgba(239, 68, 68, 0.08)',
                              padding: '6px 8px',
                              borderRadius: 4,
                              maxHeight: 80,
                              overflowY: 'auto',
                              whiteSpace: 'pre-wrap',
                              color: '#ef4444',
                            }}
                          >
                            {tc.stderr}
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => copyCommandText(tc.command, idx)}
                          style={{
                            alignSelf: 'flex-start',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            background: 'transparent',
                            border: 'none',
                            color: copiedCmdIdx === idx ? '#22c55e' : themeTokens.textSecondary,
                            fontSize: 10.5,
                            cursor: 'pointer',
                            padding: '2px 4px',
                          }}
                        >
                          {copiedCmdIdx === idx ? <Check size={10} /> : <Copy size={10} />}
                          <span>{copiedCmdIdx === idx ? 'Copiado' : 'Copiar comando'}</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Execution Steps (Explored, Analyzed, Edited) */}
          {steps.map((st, sIdx) => {
            const stepKey = `step-${sIdx}-${st.label}`;
            const isStepExp = expandedStepKeys[stepKey] ?? false;

            if (st.type === 'edit') {
              return (
                <div
                  key={stepKey}
                  onClick={() => {
                    if (st.path || st.file) {
                      onOpenFileAction?.(st.path || st.file!, st.file || 'Arquivo');
                    }
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '3px 6px',
                    borderRadius: 4,
                    cursor: st.path || st.file ? 'pointer' : 'default',
                    gap: 6,
                    fontSize: 12,
                    transition: 'background 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (st.path || st.file) {
                      e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: 1 }}>
                    <span style={{ color: themeTokens.textSecondary, fontSize: 11 }}>Edited</span>
                    <FileIcon fileName={st.file || 'file'} size={12} />
                    <span style={{ fontWeight: 500, color: themeTokens.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {st.file || st.label}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    {st.additions !== undefined && (
                      <span style={{ color: '#22c55e', fontSize: 11, fontWeight: 500 }}>
                        +{st.additions}
                      </span>
                    )}
                    {st.deletions !== undefined && (
                      <span style={{ color: '#ef4444', fontSize: 11, fontWeight: 500 }}>
                        -{st.deletions}
                      </span>
                    )}
                  </div>
                </div>
              );
            }

            if (st.type === 'explore' || st.type === 'search') {
              const hasKids = Boolean(st.children && Array.isArray(st.children) && st.children.length > 0);
              return (
                <div key={stepKey} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div
                    onClick={() => hasKids && toggleStepKey(stepKey)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '3px 6px',
                      borderRadius: 4,
                      cursor: hasKids ? 'pointer' : 'default',
                      fontSize: 12,
                      color: themeTokens.textSecondary,
                    }}
                  >
                    {hasKids && (isStepExp ? <ChevronDown size={11} /> : <ChevronRight size={11} />)}
                    {st.type === 'search' ? <Search size={11} /> : <FileCode2 size={11} />}
                    <span style={{ color: themeTokens.textPrimary, fontWeight: 400 }}>{st.label}</span>
                  </div>

                  {hasKids && isStepExp && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingLeft: 18 }}>
                      {(st.children || []).map((ch, cIdx) => (
                        <div
                          key={cIdx}
                          onClick={() => {
                            if (ch.path || ch.file) {
                              onOpenFileAction?.(ch.path || ch.file!, ch.file || 'Arquivo', ch.lineRange);
                            }
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '2px 4px',
                            borderRadius: 3,
                            cursor: ch.path || ch.file ? 'pointer' : 'default',
                            fontSize: 11.5,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5, overflow: 'hidden' }}>
                            <span style={{ color: themeTokens.textSecondary }}>{ch.type === 'analyze' ? 'Analisou' : ch.label}</span>
                            {ch.file && <FileIcon fileName={ch.file} size={11} />}
                            <span style={{ color: themeTokens.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {ch.file || ''}
                            </span>
                          </div>
                          {ch.lineRange && (
                            <span style={{ fontSize: 10.5, color: accentColor, fontFamily: 'monospace' }}>
                              {ch.lineRange}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <div key={stepKey} style={{ fontSize: 11.5, color: themeTokens.textSecondary, padding: '2px 6px' }}>
                {st.label}
              </div>
            );
          })}

          {/* Review and Diff Approval Bar */}
          {changedFiles.length > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 8px',
                borderRadius: 6,
                background: isEffectiveDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)',
                marginTop: 4,
                gap: 6,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5 }}>
                <span style={{ fontWeight: 500, color: themeTokens.textPrimary }}>
                  {changedFiles.length} {changedFiles.length === 1 ? 'arquivo alterado' : 'arquivos alterados'}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {onReviewDiffAction && (
                  <button
                    type="button"
                    onClick={() => onReviewDiffAction(changedFiles, 0)}
                    style={{
                      height: 24,
                      padding: '0 8px',
                      borderRadius: 4,
                      border: 'none',
                      background: isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
                      color: themeTokens.textPrimary,
                      fontSize: 11,
                      fontWeight: 500,
                      cursor: 'pointer',
                      transition: 'background 0.15s ease',
                    }}
                  >
                    Revisar
                  </button>
                )}
                {onRejectAllDiffs && (
                  <button
                    type="button"
                    onClick={onRejectAllDiffs}
                    title="Descartar todas as alterações feitas pelo agente no workspace"
                    style={{
                      height: 24,
                      padding: '0 8px',
                      borderRadius: 4,
                      border: 'none',
                      background: 'transparent',
                      color: '#ef4444',
                      fontSize: 11,
                      fontWeight: 400,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      transition: 'opacity 0.15s ease',
                    }}
                  >
                    <RotateCcw size={11} />
                    <span>Reject all</span>
                  </button>
                )}
                {onAcceptAllDiffs && (
                  <button
                    type="button"
                    onClick={onAcceptAllDiffs}
                    title="Confirmar todas as alterações e limpar marcadores pendentes"
                    style={{
                      height: 24,
                      padding: '0 8px',
                      borderRadius: 4,
                      border: 'none',
                      background: '#16a34a',
                      color: '#ffffff',
                      fontSize: 11,
                      fontWeight: 500,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      transition: 'opacity 0.15s ease',
                    }}
                  >
                    <Check size={11} />
                    <span>Accept all</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
