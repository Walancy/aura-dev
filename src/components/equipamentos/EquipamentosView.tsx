import React from 'react';
import { Cpu, Server, HardDrive, Wifi, Activity, CheckCircle2 } from 'lucide-react';

export const EquipamentosView: React.FC = () => {
  const machines = [
    {
      id: 'macbook-pro',
      name: 'MacBook Pro (Host de Desenvolvimento)',
      os: 'macOS Sequoia (Apple Silicon M-Series)',
      status: 'online',
      cpu: '14% uso',
      ram: '18.4 GB / 32 GB',
      storage: '340 GB livres',
      role: 'Estação de trabalho principal, Docker, PTY Gateway',
    },
    {
      id: 'srv-db-dev',
      name: 'Servidor PostgreSQL Remoto (Dev)',
      os: 'Ubuntu 24.04 LTS (143.198.185.8)',
      status: 'online',
      cpu: '8% uso',
      ram: '3.2 GB / 8 GB',
      storage: '82 GB livres',
      role: 'Instância de banco de dados do Ainaobra Monorepo',
    },
    {
      id: 'srv-redis-cache',
      name: 'Serviço de Fila e Cache (Redis)',
      os: 'Local Container / Service',
      status: 'online',
      cpu: '2% uso',
      ram: '256 MB',
      storage: 'N/A',
      role: 'Locks distribuídos, sessões de autenticação JWT',
    },
  ];

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
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#fff', letterSpacing: '-0.02em' }}>
          Equipamentos & Recursos de Infraestrutura
        </h1>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
          Monitoramento de servidores, nós de execução de agentes e bancos de dados vinculados
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
        {machines.map((m) => (
          <div key={m.id} className="card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Server size={18} color="var(--accent-orange)" />
                <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#fff' }}>{m.name}</h3>
              </div>
              <span className="badge badge-green">
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981' }} />
                Online
              </span>
            </div>

            <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginBottom: '14px' }}>
              {m.role}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.74rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                <span>Sistema Operacional:</span>
                <span style={{ color: '#fff' }}>{m.os}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                <span>CPU:</span>
                <span style={{ color: 'var(--accent-cyan)' }}>{m.cpu}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                <span>Memória RAM:</span>
                <span style={{ color: '#fff' }}>{m.ram}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                <span>Armazenamento:</span>
                <span style={{ color: '#fff' }}>{m.storage}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
