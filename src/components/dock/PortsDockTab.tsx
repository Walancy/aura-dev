import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Radio,
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
  Search,
  Plus,
  SquareTerminal,
  Activity,
  AlertCircle,
  XCircle,
} from 'lucide-react';
import { ConfirmDeleteModal } from '../modals/ConfirmDeleteModal';
import { logSystemActivity } from '../../utils/brainService';

export interface OpenPortItem {
  port: number;
  protocol: string;
  command: string;
  pid: string;
  user: string;
  url: string;
  status: 'online' | 'unreachable';
  serviceName?: string;
  isCustom?: boolean;
}

interface PortsDockTabProps {
  themeTokens: any;
  isEffectiveDark: boolean;
  accentColor: string;
  repoName?: string;
  onPortCountChange?: (count: number) => void;
}

export const PortsDockTab: React.FC<PortsDockTabProps> = ({
  themeTokens,
  isEffectiveDark,
  accentColor,
  repoName = 'devflow-desktop',
  onPortCountChange,
}) => {
  const [ports, setPorts] = useState<OpenPortItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedPort, setCopiedPort] = useState<number | null>(null);
  const [portToKill, setPortToKill] = useState<OpenPortItem | null>(null);
  const [isKilling, setIsKilling] = useState<boolean>(false);
  const [newPortInput, setNewPortInput] = useState<string>('');
  const [newPortServiceName, setNewPortServiceName] = useState<string>('');
  const [showAddForm, setShowAddForm] = useState<boolean>(false);

  // Scan listening ports using Electron API with fallback to shell lsof
  const scanPorts = useCallback(async () => {
    setIsLoading(true);
    let detectedPorts: OpenPortItem[] = [];

    try {
      if (window.electronAPI?.ports?.scan) {
        const res = await window.electronAPI.ports.scan();
        if (res && Array.isArray(res.ports)) {
          detectedPorts = res.ports;
        }
      } else if (window.electronAPI?.shell?.exec) {
        const cmdRes = await window.electronAPI.shell.exec(
          'lsof -iTCP -sTCP:LISTEN -n -P 2>/dev/null',
          process.cwd()
        );
        if (cmdRes.exitCode === 0 && cmdRes.stdout) {
          const lines = cmdRes.stdout.trim().split('\n');
          const portMap = new Map<number, OpenPortItem>();

          for (let i = 1; i < lines.length; i++) {
            const parts = lines[i].trim().split(/\s+/);
            if (parts.length < 9) continue;

            const command = parts[0];
            const pid = parts[1];
            const user = parts[2];
            const name = parts[8];

            const match = name.match(/:(\d+)$/);
            if (match) {
              const port = parseInt(match[1], 10);
              if (!portMap.has(port)) {
                let service = command;
                if (port === 3000 || port === 3001 || port === 3010) service = 'Backend API (NestJS/Node)';
                else if (port === 3333) service = 'API Server (Adonis/Fastify)';
                else if (port === 5000) service = 'AirPlay / Python Server';
                else if (port === 5173) service = 'Vite Frontend';
                else if (port === 5174) service = 'Vite Admin';
                else if (port === 5175 || port === 5180 || port === 5185) service = 'Vite Dev Server';
                else if (port === 5432 || port === 5433) service = 'PostgreSQL';
                else if (port === 6379) service = 'Redis Server';
                else if (port === 7000) service = 'Control Center (AirPlay)';
                else if (port === 8000 || port === 8080) service = 'Web Application Server';
                else if (command.toLowerCase().includes('docke')) service = `${command} (Docker)`;
                else if (command === 'node') service = 'Node.js Service';

                portMap.set(port, {
                  port,
                  protocol: 'HTTP/TCP',
                  command,
                  pid,
                  user,
                  url: `http://localhost:${port}`,
                  status: 'online',
                  serviceName: service,
                });
              }
            }
          }
          detectedPorts = Array.from(portMap.values()).sort((a, b) => a.port - b.port);
        }
      }
    } catch (err) {
      console.warn('[PortsDockTab] Falha ao escanear portas:', err);
    } finally {
      setIsLoading(false);
      setPorts(detectedPorts);
      if (onPortCountChange) {
        onPortCountChange(detectedPorts.length);
      }
      logSystemActivity('ports', 'scan', repoName, { count: detectedPorts.length });
    }
  }, [repoName, onPortCountChange]);

  useEffect(() => {
    scanPorts();
  }, [scanPorts]);

  // Copy URL with visual confirmation
  const handleCopyUrl = (url: string, port: number) => {
    navigator.clipboard.writeText(url);
    setCopiedPort(port);
    setTimeout(() => setCopiedPort(null), 1800);
  };

  // Open in browser
  const handleOpenUrl = (url: string) => {
    if (window.electronAPI?.shell?.openExternal) {
      window.electronAPI.shell.openExternal(url);
    } else {
      window.open(url, '_blank', 'noreferrer');
    }
    logSystemActivity('ports', 'open_url', repoName, { url });
  };

  // Terminate process (kill PID)
  const handleConfirmKill = async () => {
    if (!portToKill) return;
    setIsKilling(true);

    try {
      if (window.electronAPI?.ports?.kill) {
        await window.electronAPI.ports.kill(portToKill.pid);
      } else if (window.electronAPI?.shell?.exec) {
        await window.electronAPI.shell.exec(`kill -9 ${portToKill.pid}`, process.cwd());
      }
      logSystemActivity('ports', 'kill_process', repoName, {
        port: portToKill.port,
        pid: portToKill.pid,
        command: portToKill.command,
      });
      setPortToKill(null);
      await scanPorts();
    } catch (err: any) {
      console.warn('[PortsDockTab] Erro ao encerrar processo:', err);
    } finally {
      setIsKilling(false);
    }
  };

  // Add custom tracked port
  const handleAddCustomPort = (e: React.FormEvent) => {
    e.preventDefault();
    const portNum = parseInt(newPortInput.trim(), 10);
    if (isNaN(portNum) || portNum <= 0 || portNum > 65535) return;

    const customItem: OpenPortItem = {
      port: portNum,
      protocol: 'HTTP/TCP',
      command: 'personalizado',
      pid: '-',
      user: 'local',
      url: `http://localhost:${portNum}`,
      status: 'online',
      serviceName: newPortServiceName.trim() || `Serviço :${portNum}`,
      isCustom: true,
    };

    setPorts((prev) => {
      const exists = prev.some((p) => p.port === portNum);
      if (exists) return prev;
      return [...prev, customItem].sort((a, b) => a.port - b.port);
    });

    setNewPortInput('');
    setNewPortServiceName('');
    setShowAddForm(false);
    logSystemActivity('ports', 'add_custom_port', repoName, { port: portNum });
  };

  const filteredPorts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return ports;
    return ports.filter(
      (p) =>
        p.port.toString().includes(q) ||
        p.serviceName?.toLowerCase().includes(q) ||
        p.command.toLowerCase().includes(q) ||
        p.pid.toLowerCase().includes(q) ||
        p.url.toLowerCase().includes(q)
    );
  }, [ports, searchQuery]);

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
      {/* Toolbar: Title/Status + Search + Add Port + Refresh */}
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
        {/* Left: Indicator & Count */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Radio size={14} color="#3fb950" />
          <span
            style={{
              color: themeTokens.textPrimary,
              fontSize: 12,
              fontFamily: 'Poppins, -apple-system, sans-serif',
              fontWeight: 400,
            }}
          >
            Portas Encaminhadas e Serviços Ativos
          </span>
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
            {ports.length} {ports.length === 1 ? 'porta' : 'portas'}
          </span>
        </div>

        {/* Right: Search, Add Port Button, Refresh Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Search Input */}
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
              placeholder="Filtrar portas ou serviços..."
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: themeTokens.textPrimary,
                fontSize: 11,
                fontFamily: 'Poppins, -apple-system, sans-serif',
                fontWeight: 400,
                width: 170,
              }}
            />
          </div>

          {/* Add Port Toggle */}
          <div
            onClick={() => setShowAddForm(!showAddForm)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 8px',
              height: 26,
              borderRadius: 4,
              border: 'none',
              background: showAddForm
                ? isEffectiveDark
                  ? 'rgba(255, 255, 255, 0.12)'
                  : 'rgba(0, 0, 0, 0.1)'
                : isEffectiveDark
                ? 'rgba(255, 255, 255, 0.04)'
                : 'rgba(0, 0, 0, 0.04)',
              color: themeTokens.textPrimary,
              fontSize: 11,
              fontFamily: 'Poppins, -apple-system, sans-serif',
              fontWeight: 400,
              cursor: 'pointer',
              transition: 'background 0.15s ease',
              whiteSpace: 'nowrap',
            }}
            title="Encaminhar ou monitorar nova porta"
          >
            <Plus size={12} />
            <span>Encaminhar Porta</span>
          </div>

          {/* Refresh Button */}
          <div
            onClick={scanPorts}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 8px',
              height: 26,
              borderRadius: 4,
              border: 'none',
              background: isEffectiveDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)',
              color: themeTokens.textSecondary,
              fontSize: 11,
              fontFamily: 'Poppins, -apple-system, sans-serif',
              fontWeight: 400,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = themeTokens.textPrimary)}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = themeTokens.textSecondary)}
            title="Atualizar lista de portas ativas"
          >
            <RefreshCw
              size={12}
              style={{
                animation: isLoading ? 'spin 1s linear infinite' : 'none',
              }}
            />
            <span>Atualizar</span>
          </div>
        </div>
      </div>

      {/* Add Port Form (Inline expandable) */}
      {showAddForm && (
        <form
          onSubmit={handleAddCustomPort}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px',
            background: isEffectiveDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.03)',
            borderRadius: 4,
            border: 'none',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 11, color: themeTokens.textSecondary, fontFamily: 'Poppins, -apple-system, sans-serif', fontWeight: 400 }}>
            Porta:
          </span>
          <input
            type="number"
            min="1"
            max="65535"
            placeholder="Ex: 8080"
            value={newPortInput}
            onChange={(e) => setNewPortInput(e.target.value)}
            style={{
              width: 90,
              padding: '4px 8px',
              background: isEffectiveDark ? 'rgba(0, 0, 0, 0.3)' : 'rgba(255, 255, 255, 0.7)',
              border: 'none',
              borderRadius: 4,
              color: themeTokens.textPrimary,
              fontSize: 11,
              fontFamily: 'JetBrains Mono, Menlo, monospace',
              fontWeight: 400,
              outline: 'none',
            }}
            autoFocus
          />
          <span style={{ fontSize: 11, color: themeTokens.textSecondary, fontFamily: 'Poppins, -apple-system, sans-serif', fontWeight: 400 }}>
            Nome do Serviço:
          </span>
          <input
            type="text"
            placeholder="Ex: API Gateway / Swagger"
            value={newPortServiceName}
            onChange={(e) => setNewPortServiceName(e.target.value)}
            style={{
              flex: 1,
              padding: '4px 8px',
              background: isEffectiveDark ? 'rgba(0, 0, 0, 0.3)' : 'rgba(255, 255, 255, 0.7)',
              border: 'none',
              borderRadius: 4,
              color: themeTokens.textPrimary,
              fontSize: 11,
              fontFamily: 'Poppins, -apple-system, sans-serif',
              fontWeight: 400,
              outline: 'none',
            }}
          />
          <button
            type="submit"
            style={{
              padding: '4px 12px',
              borderRadius: 4,
              border: 'none',
              background: accentColor,
              color: '#ffffff',
              fontSize: 11,
              fontFamily: 'Poppins, -apple-system, sans-serif',
              fontWeight: 400,
              cursor: 'pointer',
              transition: 'opacity 0.15s ease',
            }}
          >
            Adicionar
          </button>
          <button
            type="button"
            onClick={() => setShowAddForm(false)}
            style={{
              padding: '4px 10px',
              borderRadius: 4,
              border: 'none',
              background: 'transparent',
              color: themeTokens.textSecondary,
              fontSize: 11,
              fontFamily: 'Poppins, -apple-system, sans-serif',
              fontWeight: 400,
              cursor: 'pointer',
            }}
          >
            Cancelar
          </button>
        </form>
      )}

      {/* Ports List */}
      <div
        style={{
          flex: '1 1 0',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          overflowY: 'auto',
          minHeight: 0,
        }}
      >
        {filteredPorts.length === 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '32px 16px',
              gap: '8px',
              color: themeTokens.textSecondary,
              fontFamily: 'Poppins, -apple-system, sans-serif',
              fontWeight: 400,
              fontSize: 12,
            }}
          >
            <SquareTerminal size={24} color={themeTokens.textSecondary} style={{ opacity: 0.6 }} />
            <span>
              {searchQuery
                ? 'Nenhuma porta encontrada para a busca.'
                : 'Nenhum serviço ou porta escutando no momento.'}
            </span>
            <div
              onClick={scanPorts}
              style={{
                marginTop: 4,
                color: accentColor,
                cursor: 'pointer',
                fontSize: 11,
              }}
            >
              Escanear novamente
            </div>
          </div>
        ) : (
          filteredPorts.map((p) => {
            const isCopied = copiedPort === p.port;
            return (
              <div
                key={`${p.port}-${p.pid}`}
                style={{
                  padding: '8px 12px',
                  background: isEffectiveDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.03)',
                  borderRadius: 4,
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  whiteSpace: 'nowrap',
                  transition: 'background 0.15s ease',
                }}
              >
                {/* Left: Port, Service, PID and Command */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                  <div
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      background: p.status === 'online' ? '#3fb950' : '#ef4444',
                      flexShrink: 0,
                    }}
                    title={p.status === 'online' ? 'Serviço Ativo' : 'Inacessível'}
                  />
                  <span
                    style={{
                      color: themeTokens.textPrimary,
                      fontWeight: 500,
                      fontSize: 12.5,
                      fontFamily: 'JetBrains Mono, Menlo, monospace',
                    }}
                  >
                    :{p.port}
                  </span>
                  <span
                    style={{
                      color: themeTokens.textPrimary,
                      fontSize: 12,
                      fontFamily: 'Poppins, -apple-system, sans-serif',
                      fontWeight: 400,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {p.serviceName || p.command}
                  </span>
                  {p.pid && p.pid !== '-' && (
                    <span
                      style={{
                        color: themeTokens.textSecondary,
                        fontSize: 10.5,
                        fontFamily: 'JetBrains Mono, Menlo, monospace',
                        fontWeight: 400,
                        background: isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
                        padding: '1px 5px',
                        borderRadius: 3,
                      }}
                      title={`Process ID: ${p.pid}`}
                    >
                      PID {p.pid}
                    </span>
                  )}
                  {p.user && (
                    <span
                      style={{
                        color: themeTokens.textSecondary,
                        fontSize: 10.5,
                        fontFamily: 'Poppins, -apple-system, sans-serif',
                        fontWeight: 400,
                        opacity: 0.7,
                      }}
                    >
                      ({p.user})
                    </span>
                  )}
                </div>

                {/* Right: URL Link, Copy Button and Kill Button */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                  {/* URL */}
                  <span
                    onClick={() => handleOpenUrl(p.url)}
                    style={{
                      color: accentColor,
                      fontSize: 11.5,
                      fontFamily: 'JetBrains Mono, Menlo, monospace',
                      fontWeight: 400,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      transition: 'opacity 0.15s ease',
                    }}
                    title="Abrir no navegador padrão"
                  >
                    {p.url}
                    <ExternalLink size={11} />
                  </span>

                  {/* Copy URL */}
                  <div
                    onClick={() => handleCopyUrl(p.url, p.port)}
                    style={{
                      padding: '3px 6px',
                      borderRadius: 3,
                      border: 'none',
                      background: 'transparent',
                      color: isCopied ? '#3fb950' : themeTokens.textSecondary,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 3,
                      fontSize: 10.5,
                      fontFamily: 'Poppins, -apple-system, sans-serif',
                      fontWeight: 400,
                      transition: 'all 0.15s ease',
                    }}
                    title="Copiar URL local"
                  >
                    {isCopied ? <Check size={11} /> : <Copy size={11} />}
                    <span>{isCopied ? 'Copiado' : 'Copiar'}</span>
                  </div>

                  {/* Kill Process (if PID available) */}
                  {p.pid && p.pid !== '-' && (
                    <div
                      onClick={() => setPortToKill(p)}
                      style={{
                        padding: '3px 6px',
                        borderRadius: 3,
                        border: 'none',
                        background: 'transparent',
                        color: themeTokens.textSecondary,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 3,
                        fontSize: 10.5,
                        fontFamily: 'Poppins, -apple-system, sans-serif',
                        fontWeight: 400,
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.color = '#ef4444';
                        (e.currentTarget as HTMLElement).style.background = 'rgba(239, 68, 68, 0.1)';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.color = themeTokens.textSecondary;
                        (e.currentTarget as HTMLElement).style.background = 'transparent';
                      }}
                      title="Encerrar processo em execução"
                    >
                      <XCircle size={11} />
                      <span>Encerrar</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Styled Confirmation Modal for Killing Process */}
      {portToKill && (
        <ConfirmDeleteModal
          isOpen={Boolean(portToKill)}
          title="Encerrar Processo"
          message={`Tem certeza que deseja encerrar o processo "${portToKill.serviceName || portToKill.command}" (PID ${portToKill.pid}) na porta :${portToKill.port}?`}
          itemDescription="Esta ação forçará o encerramento imediato do processo e liberará a porta no sistema."
          confirmLabel="Encerrar Processo"
          cancelLabel="Cancelar"
          isDeleting={isKilling}
          iconType="warning"
          themeTokens={themeTokens}
          accentColor="#ef4444"
          onConfirm={handleConfirmKill}
          onClose={() => setPortToKill(null)}
        />
      )}
    </div>
  );
};
