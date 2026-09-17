import React, { useState } from 'react';
import {
  FolderKanban,
  GitBranch,
  FolderOpen,
  Code,
  Terminal,
  Plus,
  Clock,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';
import { Project } from '../../types';

interface ProjectsViewProps {
  projects: Project[];
  activeProject: Project | null;
  onSelectProject: (id: string) => void;
  onOpenInIde: (id: string) => void;
  onAddProject: (name: string, path: string, description: string) => void;
}

export const ProjectsView: React.FC<ProjectsViewProps> = ({
  projects,
  activeProject,
  onSelectProject,
  onOpenInIde,
  onAddProject,
}) => {
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [projPath, setProjPath] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !projPath) return;
    onAddProject(name, projPath, description);
    setShowModal(false);
    setName('');
    setProjPath('');
    setDescription('');
  };

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
      {/* Header */}
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
            Gerenciamento de Projetos
          </h1>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Workspaces locais, repositórios Git e ambiente de execução de agentes de IA
          </p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary">
          <Plus size={15} />
          <span>Novo Projeto Local</span>
        </button>
      </div>

      {/* Projects Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
          gap: '16px',
        }}
      >
        {projects.map((proj) => {
          const isActive = proj.id === activeProject?.id;
          return (
            <div
              key={proj.id}
              className="card"
              style={{
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                borderColor: isActive ? 'var(--accent-orange)' : 'var(--border-color)',
                boxShadow: isActive ? '0 0 16px rgba(255, 102, 0, 0.15)' : 'none',
              }}
            >
              <div>
                {/* Title & Badge */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FolderKanban size={18} color="var(--accent-orange)" />
                    <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#fff' }}>{proj.name}</h3>
                  </div>
                  {isActive && <span className="badge badge-orange">Ativo no Editor</span>}
                </div>

                {/* Description */}
                <p
                  style={{
                    fontSize: '0.78rem',
                    color: 'var(--text-secondary)',
                    margin: '10px 0 14px 0',
                    lineHeight: 1.4,
                  }}
                >
                  {proj.description || 'Nenhuma descrição fornecida.'}
                </p>

                {/* Meta Details */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.74rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)' }}>
                    <FolderOpen size={13} />
                    <span className="font-mono truncate" style={{ maxWidth: '270px' }}>
                      {proj.path}
                    </span>
                  </div>

                  {proj.gitBranch && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent-cyan)' }}>
                      <GitBranch size={13} />
                      <span>Branch: <strong>{proj.gitBranch}</strong></span>
                      {proj.gitStatus && (
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.7rem' }}>
                          ({proj.gitStatus})
                        </span>
                      )}
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)' }}>
                    <Clock size={13} />
                    <span>Último acesso: {new Date(proj.lastActive).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div
                style={{
                  display: 'flex',
                  gap: '8px',
                  marginTop: '20px',
                  paddingTop: '12px',
                  borderTop: 'none',
                }}
              >
                <button
                  onClick={() => onOpenInIde(proj.id)}
                  className="btn-primary"
                  style={{ flex: 1, justifyContent: 'center' }}
                >
                  <Code size={14} />
                  <span>Abrir na IDE</span>
                </button>
                <button
                  onClick={() => {
                    onSelectProject(proj.id);
                    onOpenInIde(proj.id);
                  }}
                  className="btn-secondary"
                  title="Abrir terminal"
                >
                  <Terminal size={14} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal: Add Project */}
      {showModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
          }}
        >
          <div
            className="card"
            style={{
              width: '450px',
              padding: '24px',
              backgroundColor: 'var(--bg-surface)',
              border: 'none',
              boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
            }}
          >
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#fff', marginBottom: '16px' }}>
              Adicionar Projeto Local
            </h3>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Nome do Projeto
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Meu App Web"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    fontSize: '0.82rem',
                    backgroundColor: 'var(--bg-main)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Caminho Absoluto no Disco
                </label>
                <input
                  type="text"
                  required
                  placeholder="/Users/walancy/Documents/codes/..."
                  value={projPath}
                  onChange={(e) => setProjPath(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    fontSize: '0.82rem',
                    backgroundColor: 'var(--bg-main)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Descrição / Notas
                </label>
                <textarea
                  rows={2}
                  placeholder="Breve descrição dos serviços e propósito..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    fontSize: '0.82rem',
                    backgroundColor: 'var(--bg-main)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    resize: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">
                  Cancelar
                </button>
                <button type="submit" className="btn-primary">
                  Salvar Projeto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
