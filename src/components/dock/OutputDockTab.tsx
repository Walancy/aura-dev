import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Terminal,
  Trash2,
  Copy,
  Check,
  Search,
  ChevronDown,
  ArrowDownCircle,
  Filter,
} from 'lucide-react';
import { logSystemActivity } from '../../utils/brainService';

export interface OutputLogItem {
  id: string;
  timestamp: string;
  module: string;
  action: string;
  projectName: string;
  details?: any;
  level?: 'info' | 'warn' | 'error' | 'success';
}

interface OutputDockTabProps {
  themeTokens: any;
  isEffectiveDark: boolean;
  accentColor: string;
  projectName?: string;
}

export const OutputDockTab: React.FC<OutputDockTabProps> = ({
  themeTokens,
  isEffectiveDark,
  accentColor,
  projectName = 'devflow-desktop',
}) => {
  const [logs, setLogs] = useState<OutputLogItem[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<string>('all');
  const [channelDropdownOpen, setChannelDropdownOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);
  const [levelFilter, setLevelFilter] = useState<'all' | 'info' | 'warn' | 'error' | 'success'>('all');
  const listEndRef = useRef<HTMLDivElement>(null);

  // Channels definition
  const channels = [
    { id: 'all', label: 'Todos os Canais' },
    { id: 'devflow', label: 'DevFlow & Atividades' },
    { id: 'tarefas', label: 'Tarefas & GitHub' },
    { id: 'git', label: 'Git & Versionamento' },
    { id: 'build', label: 'Build & Diagnósticos' },
    { id: 'ide_ai_chat', label: 'Terminal & IA' },
  ];

  // Load stored logs from localStorage on mount and register live listener
  useEffect(() => {
    const loadStoredLogs = () => {
      try {
        const stored = localStorage.getItem('devflow_system_activity_logs');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            const mapped: OutputLogItem[] = parsed.map((item, idx) => {
              const act = (item.action || '').toLowerCase();
              let level: OutputLogItem['level'] = 'info';
              if (act.includes('error') || act.includes('fail')) level = 'error';
              else if (act.includes('warn')) level = 'warn';
              else if (act.includes('success') || act.includes('accept') || act.includes('finalize') || act.includes('complete')) level = 'success';

              return {
                id: `log-${item.timestamp}-${idx}`,
                timestamp: item.timestamp,
                module: item.module || 'system',
                action: item.action || 'activity',
                projectName: item.projectName || 'geral',
                details: item.details,
                level,
              };
            });
            setLogs(mapped);
          }
        }
      } catch (err) {
        console.warn('[OutputDockTab] Erro ao ler logs armazenados:', err);
      }
    };

    loadStoredLogs();

    const handleNewLog = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        const item = customEvent.detail;
        const act = (item.action || '').toLowerCase();
        let level: OutputLogItem['level'] = 'info';
        if (act.includes('error') || act.includes('fail')) level = 'error';
        else if (act.includes('warn')) level = 'warn';
        else if (act.includes('success') || act.includes('accept') || act.includes('finalize') || act.includes('complete')) level = 'success';

        const newLogItem: OutputLogItem = {
          id: `log-${item.timestamp}-${Date.now()}`,
          timestamp: item.timestamp,
          module: item.module || 'system',
          action: item.action || 'activity',
          projectName: item.projectName || 'geral',
          details: item.details,
          level,
        };

        setLogs((prev) => [newLogItem, ...prev.slice(0, 299)]);
      }
    };

    window.addEventListener('devflow-system-activity-logged', handleNewLog);
    return () => {
      window.removeEventListener('devflow-system-activity-logged', handleNewLog);
    };
  }, []);

  // Auto-scroll when new logs arrive if enabled
  useEffect(() => {
    if (autoScroll && listEndRef.current) {
      listEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  // Filter logs by channel, level and search text
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Channel match
      if (selectedChannel !== 'all') {
        if (selectedChannel === 'devflow' && log.module !== 'system' && log.module !== 'brain' && log.module !== 'projects' && log.module !== 'header') {
          return false;
        } else if (selectedChannel === 'tarefas' && log.module !== 'tarefas' && log.module !== 'github') {
          return false;
        } else if (selectedChannel === 'git' && log.module !== 'git') {
          return false;
        } else if (selectedChannel === 'build' && log.module !== 'build' && log.module !== 'diagnostics') {
          return false;
        } else if (selectedChannel === 'ide_ai_chat' && log.module !== 'ide_ai_chat' && log.module !== 'ai_rules') {
          return false;
        }
      }

      // Level match
      if (levelFilter !== 'all' && log.level !== levelFilter) {
        return false;
      }

      // Search match
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const detailsStr = typeof log.details === 'object' ? JSON.stringify(log.details) : String(log.details || '');
        const match =
          log.module.toLowerCase().includes(q) ||
          log.action.toLowerCase().includes(q) ||
          log.projectName.toLowerCase().includes(q) ||
          detailsStr.toLowerCase().includes(q);
        if (!match) return false;
      }

      return true;
    });
  }, [logs, selectedChannel, levelFilter, searchQuery]);

  // Clear output for active view
  const handleClear = () => {
    if (selectedChannel === 'all') {
      setLogs([]);
      try {
        localStorage.removeItem('devflow_system_activity_logs');
      } catch {}
    } else {
      setLogs((prev) =>
        prev.filter((log) => {
          if (selectedChannel === 'tarefas') return log.module !== 'tarefas' && log.module !== 'github';
          if (selectedChannel === 'git') return log.module !== 'git';
          if (selectedChannel === 'build') return log.module !== 'build';
          if (selectedChannel === 'ide_ai_chat') return log.module !== 'ide_ai_chat';
          return false;
        })
      );
    }
    logSystemActivity('output', 'clear_logs', projectName, { channel: selectedChannel });
  };

  // Copy output to clipboard
  const handleCopy = () => {
    const text = filteredLogs
      .map((l) => {
        const time = new Date(l.timestamp).toLocaleTimeString();
        const detailsStr = l.details ? ` | ${JSON.stringify(l.details)}` : '';
        return `[${time}] [${l.module}] ${l.action} (${l.projectName})${detailsStr}`;
      })
      .join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const currentChannelObj = channels.find((c) => c.id === selectedChannel) || channels[0];

  return (
    <div
      style={{
        flex: '1 1 0',
        alignSelf: 'stretch',
        padding: '12px',
        gap: '12px',
        background: themeTokens.bgCard,
        borderRadius: 0,
        border: 'none',
        flexDirection: 'column',
        display: 'flex',
        overflow: 'hidden',
        boxSizing: 'border-box',
        height: '100%',
      }}
    >
      {/* Top Toolbar: Channel Selector + Search + Filters + Actions */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          flexShrink: 0,
          whiteSpace: 'nowrap',
        }}
      >
        {/* Left: Channel Selector Dropdown */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            onClick={() => setChannelDropdownOpen(!channelDropdownOpen)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              height: 26,
              borderRadius: 4,
              border: 'none',
              background: isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
              color: themeTokens.textPrimary,
              fontSize: 11,
              fontFamily: 'Poppins, -apple-system, sans-serif',
              fontWeight: 400,
              cursor: 'pointer',
              transition: 'background 0.15s ease',
            }}
          >
            <Terminal size={12} color={accentColor} />
            <span>{currentChannelObj.label}</span>
            <ChevronDown size={11} color={themeTokens.textSecondary} />
          </div>

          {channelDropdownOpen && (
            <div
              style={{
                position: 'absolute',
                top: 32,
                left: 0,
                background: themeTokens.bgCardSecondary || themeTokens.bgCard,
                borderRadius: 4,
                border: 'none',
                padding: '4px',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
                zIndex: 9999,
                minWidth: 180,
                boxShadow: 'none',
              }}
            >
              {channels.map((ch) => (
                <div
                  key={ch.id}
                  onClick={() => {
                    setSelectedChannel(ch.id);
                    setChannelDropdownOpen(false);
                  }}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 3,
                    border: 'none',
                    background: selectedChannel === ch.id ? (isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)') : 'transparent',
                    color: selectedChannel === ch.id ? accentColor : themeTokens.textPrimary,
                    fontSize: 11,
                    fontFamily: 'Poppins, -apple-system, sans-serif',
                    fontWeight: 400,
                    cursor: 'pointer',
                    transition: 'all 0.12s ease',
                  }}
                >
                  {ch.label}
                </div>
              ))}
            </div>
          )}

          <span
            style={{
              fontSize: 10,
              fontFamily: 'Poppins, -apple-system, sans-serif',
              fontWeight: 400,
              padding: '1px 6px',
              borderRadius: 4,
              background: isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
              color: themeTokens.textSecondary,
            }}
          >
            {filteredLogs.length} {filteredLogs.length === 1 ? 'registro' : 'registros'}
          </span>
        </div>

        {/* Right: Search + Level Filter + AutoScroll + Copy + Clear */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Search Box */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 8px',
              background: isEffectiveDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)',
              borderRadius: 4,
              border: 'none',
              height: 26,
              boxSizing: 'border-box',
            }}
          >
            <Search size={12} color={themeTokens.textSecondary} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filtrar saída..."
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: themeTokens.textPrimary,
                fontSize: 11,
                fontFamily: 'Poppins, -apple-system, sans-serif',
                fontWeight: 400,
                width: 130,
              }}
            />
          </div>

          {/* Level Filter Chips */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {(['all', 'info', 'success', 'warn', 'error'] as const).map((lvl) => {
              const isActive = levelFilter === lvl;
              const labelMap: Record<string, string> = {
                all: 'Todos',
                info: 'Info',
                success: 'Sucesso',
                warn: 'Avisos',
                error: 'Erros',
              };
              return (
                <div
                  key={lvl}
                  onClick={() => setLevelFilter(lvl)}
                  style={{
                    padding: '2px 7px',
                    height: 22,
                    borderRadius: 3,
                    border: 'none',
                    background: isActive
                      ? isEffectiveDark
                        ? 'rgba(255, 255, 255, 0.12)'
                        : 'rgba(0, 0, 0, 0.1)'
                      : 'transparent',
                    color: isActive ? themeTokens.textPrimary : themeTokens.textSecondary,
                    fontSize: 10,
                    fontFamily: 'Poppins, -apple-system, sans-serif',
                    fontWeight: 400,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    transition: 'all 0.12s ease',
                  }}
                >
                  {labelMap[lvl]}
                </div>
              );
            })}
          </div>

          {/* Divider */}
          <div style={{ width: 1, height: 14, background: 'rgba(255, 255, 255, 0.08)' }} />

          {/* Auto Scroll Toggle */}
          <div
            onClick={() => setAutoScroll(!autoScroll)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 6px',
              height: 26,
              borderRadius: 4,
              border: 'none',
              background: autoScroll ? (isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)') : 'transparent',
              color: autoScroll ? accentColor : themeTokens.textSecondary,
              fontSize: 11,
              fontFamily: 'Poppins, -apple-system, sans-serif',
              fontWeight: 400,
              cursor: 'pointer',
              transition: 'all 0.12s ease',
            }}
            title="Rolar automaticamente para novos logs"
          >
            <ArrowDownCircle size={12} />
          </div>

          {/* Copy Button */}
          <div
            onClick={handleCopy}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 6px',
              height: 26,
              borderRadius: 4,
              border: 'none',
              background: 'transparent',
              color: copied ? '#3fb950' : themeTokens.textSecondary,
              fontSize: 11,
              fontFamily: 'Poppins, -apple-system, sans-serif',
              fontWeight: 400,
              cursor: 'pointer',
              transition: 'all 0.12s ease',
            }}
            title="Copiar saída visível"
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
          </div>

          {/* Clear Button */}
          <div
            onClick={handleClear}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 6px',
              height: 26,
              borderRadius: 4,
              border: 'none',
              background: 'transparent',
              color: themeTokens.textSecondary,
              fontSize: 11,
              fontFamily: 'Poppins, -apple-system, sans-serif',
              fontWeight: 400,
              cursor: 'pointer',
              transition: 'all 0.12s ease',
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = '#ef4444')}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = themeTokens.textSecondary)}
            title="Limpar saída deste canal"
          >
            <Trash2 size={12} />
          </div>
        </div>
      </div>

      {/* Log Content Area */}
      <div
        style={{
          flex: '1 1 0',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          overflowY: 'auto',
          minHeight: 0,
          fontFamily: 'JetBrains Mono, Menlo, monospace',
          fontSize: 11.5,
          lineHeight: '18px',
          background: isEffectiveDark ? 'rgba(0, 0, 0, 0.2)' : 'rgba(0, 0, 0, 0.02)',
          padding: '8px 10px',
          borderRadius: 4,
          border: 'none',
        }}
      >
        {filteredLogs.length === 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              gap: '8px',
              color: themeTokens.textSecondary,
              fontFamily: 'Poppins, -apple-system, sans-serif',
              fontWeight: 400,
              fontSize: 12,
              opacity: 0.7,
            }}
          >
            <span>Nenhuma saída registrada neste canal.</span>
          </div>
        ) : (
          filteredLogs.map((log) => {
            const timeStr = log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : '--:--:--';
            let colorLevel = themeTokens.textSecondary;
            if (log.level === 'error') colorLevel = '#ef4444';
            else if (log.level === 'warn') colorLevel = '#f59e0b';
            else if (log.level === 'success') colorLevel = '#3fb950';

            const detailPreview = log.details
              ? typeof log.details === 'object'
                ? JSON.stringify(log.details)
                : String(log.details)
              : '';

            return (
              <div
                key={log.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                <span style={{ color: themeTokens.textSecondary, opacity: 0.5, flexShrink: 0 }}>
                  [{timeStr}]
                </span>
                <span
                  style={{
                    color: accentColor,
                    flexShrink: 0,
                    opacity: 0.9,
                  }}
                >
                  [{log.module}]
                </span>
                <span style={{ color: colorLevel, flexShrink: 0 }}>
                  {log.action}
                </span>
                {log.projectName && (
                  <span style={{ color: themeTokens.textSecondary, opacity: 0.6, flexShrink: 0 }}>
                    ({log.projectName})
                  </span>
                )}
                {detailPreview && (
                  <span style={{ color: themeTokens.textSecondary, opacity: 0.85 }}>
                    {detailPreview}
                  </span>
                )}
              </div>
            );
          })
        )}
        <div ref={listEndRef} />
      </div>
    </div>
  );
};
