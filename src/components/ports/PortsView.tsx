import React, { useState, useEffect } from 'react';
import { Radio, RefreshCw, ExternalLink, Activity, Terminal } from 'lucide-react';
import { OpenPort } from '../../types';
import { api } from '../../services/api';

export const PortsView: React.FC = () => {
  const [ports, setPorts] = useState<OpenPort[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchPorts = async () => {
    setIsLoading(true);
    try {
      const res = await api.getPorts();
      setPorts(res.ports);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPorts();
    const timer = setInterval(fetchPorts, 4000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div
      style={{
        flex: 1,
        height: 'calc(100vh - 66px)',
        overflowY: 'auto',
        padding: '24px 32px',
        backgroundColor: 'var(--bg-main)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px',
        }}
      >
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#fff', letterSpacing: '-0.02em' }}>
            Portas Locais & Serviços Ativos (Ports)
          </h1>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Monitoramento em tempo real de servidores em execução na máquina do usuário
          </p>
        </div>
        <button onClick={fetchPorts} className="btn-secondary" disabled={isLoading}>
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          <span>Atualizar Portas</span>
        </button>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
          <thead>
            <tr
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderBottom: '1px solid var(--border-color)',
                color: 'var(--text-secondary)',
                fontSize: '0.74rem',
                textTransform: 'uppercase',
              }}
            >
              <th style={{ padding: '12px 16px' }}>Porta</th>
              <th style={{ padding: '12px 16px' }}>Serviço / Processo</th>
              <th style={{ padding: '12px 16px' }}>PID</th>
              <th style={{ padding: '12px 16px' }}>Status</th>
              <th style={{ padding: '12px 16px' }}>URL Local</th>
              <th style={{ padding: '12px 16px', textAlign: 'right' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {ports.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Nenhuma porta monitorada no momento.
                </td>
              </tr>
            ) : (
              ports.map((p) => (
                <tr
                  key={p.port}
                  style={{
                    borderBottom: '1px solid var(--border-color)',
                    transition: 'background-color 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <td style={{ padding: '12px 16px' }}>
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 700,
                        color: 'var(--accent-orange)',
                        fontSize: '0.9rem',
                      }}
                    >
                      :{p.port}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontWeight: 600, color: '#fff' }}>
                      {p.serviceName || p.command}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      Comando: {p.command}
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                    {p.pid}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span className="badge badge-green">
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981' }} />
                      Online
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <a
                      href={p.url}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        color: 'var(--accent-cyan)',
                        textDecoration: 'none',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <span>{p.url}</span>
                      <ExternalLink size={12} />
                    </a>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <a
                      href={p.url}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-secondary"
                      style={{ padding: '4px 10px', fontSize: '0.72rem', textDecoration: 'none' }}
                    >
                      <span>Abrir no Navegador</span>
                    </a>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
