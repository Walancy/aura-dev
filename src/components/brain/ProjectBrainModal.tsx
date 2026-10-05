import React, { useState, useEffect } from 'react';
import {
  Brain,
  X,
  RefreshCw,
  Save,
  Plus,
  Trash2,
  ExternalLink,
  Cpu,
  Layers,
  Sparkles,
  ChevronRight,
  PanelLeft,
} from 'lucide-react';
import type { BrainNode, BrainNodeType, ProjectBrainContext } from '../../types/brain';
import { BrainGraphCanvas } from './BrainGraphCanvas';
import {
  loadProjectBrain,
  saveProjectBrain,
  scanProjectCodebase,
  generateBrainAiContext,
} from '../../utils/brainService';
import { ConfirmDeleteModal } from '../modals/ConfirmDeleteModal';

interface ProjectBrainModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspacePath: string;
  projectName?: string;
  accentColor: string;
  themeTokens: any;
  isEffectiveDark: boolean;
  onOpenFile?: (path: string) => void;
  onToast?: (message: string) => void;
}

export const ProjectBrainModal: React.FC<ProjectBrainModalProps> = ({
  isOpen,
  onClose,
  workspacePath,
  projectName,
  accentColor,
  themeTokens,
  isEffectiveDark,
  onOpenFile,
  onToast,
}) => {
  const [brain, setBrain] = useState<ProjectBrainContext | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'inspector' | 'new-node'>('overview');
  const [selectedNode, setSelectedNode] = useState<BrainNode | null>(null);
  const [showAiPreview, setShowAiPreview] = useState(false);

  // Form para novo nó
  const [newNodeLabel, setNewNodeLabel] = useState('');
  const [newNodePath, setNewNodePath] = useState('');
  const [newNodeType, setNewNodeType] = useState<BrainNodeType>('custom');
  const [newNodeDesc, setNewNodeDesc] = useState('');
  const [newNodeTags, setNewNodeTags] = useState('');

  // Form para nova tecnologia
  const [newTechInput, setNewTechInput] = useState('');

  // Exclusão de nó com ConfirmDeleteModal (conforme AGENTS.md)
  const [nodeToDelete, setNodeToDelete] = useState<BrainNode | null>(null);
  const [isDeletingNode, setIsDeletingNode] = useState(false);

  // Carrega ou inicializa o Brain quando o modal é aberto ou o workspace muda
  useEffect(() => {
    if (!isOpen || !workspacePath) return;

    let isMounted = true;
    loadProjectBrain(workspacePath, projectName)
      .then((loaded) => {
        if (isMounted) {
          setBrain(loaded);
        }
      })
      .catch((err) => {
        console.warn('[ProjectBrainModal] Erro ao carregar Brain:', err);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, workspacePath, projectName]);

  // Handler de reescaneamento completo do projeto
  const handleRescan = async () => {
    if (!workspacePath || isScanning) return;
    setIsScanning(true);
    try {
      const scanned = await scanProjectCodebase(workspacePath, projectName);
      setBrain(scanned);
      await saveProjectBrain(scanned);
      onToast?.('Brain e grafo do projeto reescaneados com sucesso');
    } catch (err) {
      console.warn('[ProjectBrainModal] Erro ao reescanear:', err);
      onToast?.('Erro ao reescanear projeto');
    } finally {
      setIsScanning(false);
    }
  };

  // Salvar alterações manuais no Brain
  const handleSave = async () => {
    if (!brain || isSaving) return;
    setIsSaving(true);
    try {
      await saveProjectBrain(brain);
      onToast?.('Contexto do Brain salvo com sucesso');
    } catch (err) {
      console.warn('[ProjectBrainModal] Erro ao salvar:', err);
      onToast?.('Erro ao salvar contexto do Brain');
    } finally {
      setIsSaving(false);
    }
  };

  // Alternar fixação de nó (Pin)
  const handleTogglePinNode = (nodeId: string) => {
    if (!brain) return;
    const updatedNodes = brain.nodes.map((n) =>
      n.id === nodeId ? { ...n, pinned: !n.pinned } : n
    );
    const updated: ProjectBrainContext = { ...brain, nodes: updatedNodes };
    setBrain(updated);
    saveProjectBrain(updated);
  };

  // Adicionar nova tecnologia à stack
  const handleAddTech = () => {
    const trimmed = newTechInput.trim();
    if (!trimmed || !brain) return;
    if (!brain.techStack.includes(trimmed)) {
      const updated = {
        ...brain,
        techStack: [...brain.techStack, trimmed],
      };
      setBrain(updated);
      saveProjectBrain(updated);
    }
    setNewTechInput('');
  };

  // Remover tecnologia da stack
  const handleRemoveTech = (tech: string) => {
    if (!brain) return;
    const updated = {
      ...brain,
      techStack: brain.techStack.filter((t) => t !== tech),
    };
    setBrain(updated);
    saveProjectBrain(updated);
  };

  // Criação de nó customizado
  const handleCreateNode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!brain || !newNodeLabel.trim()) return;

    const id = `custom-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const parsedTags = newNodeTags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const newNode: BrainNode = {
      id,
      label: newNodeLabel.trim(),
      path: newNodePath.trim() || workspacePath,
      type: newNodeType,
      description: newNodeDesc.trim() || 'Nó de contexto customizado',
      tags: parsedTags.length > 0 ? parsedTags : ['custom'],
      size: 14,
      connectionsCount: 1,
      x: (Math.random() - 0.5) * 200,
      y: (Math.random() - 0.5) * 200,
      vx: 0,
      vy: 0,
      isCustom: true,
    };

    const newEdge = {
      id: `edge-root-${id}`,
      source: 'root-project',
      target: id,
      relation: 'contextualiza',
    };

    const updated: ProjectBrainContext = {
      ...brain,
      nodes: [...brain.nodes, newNode],
      edges: [...brain.edges, newEdge],
    };

    setBrain(updated);
    saveProjectBrain(updated);
    setSelectedNode(newNode);
    setActiveTab('inspector');
    setNewNodeLabel('');
    setNewNodePath('');
    setNewNodeDesc('');
    setNewNodeTags('');
    onToast?.('Nó de contexto adicionado ao grafo');
  };

  // Confirmar exclusão do nó via modal (conforme AGENTS.md)
  const confirmDeleteNode = async () => {
    if (!brain || !nodeToDelete) return;
    setIsDeletingNode(true);
    try {
      const updatedNodes = brain.nodes.filter((n) => n.id !== nodeToDelete.id);
      const updatedEdges = brain.edges.filter(
        (e) => e.source !== nodeToDelete.id && e.target !== nodeToDelete.id
      );
      const updated: ProjectBrainContext = {
        ...brain,
        nodes: updatedNodes,
        edges: updatedEdges,
      };
      setBrain(updated);
      await saveProjectBrain(updated);
      if (selectedNode?.id === nodeToDelete.id) {
        setSelectedNode(null);
        setActiveTab('overview');
      }
      setNodeToDelete(null);
      onToast?.('Nó removido do Brain');
    } finally {
      setIsDeletingNode(false);
    }
  };

  if (!isOpen) return null;

  // Design Tokens do sistema DevFlow
  const colors = {
    overlay: isEffectiveDark ? 'rgba(0, 0, 0, 0.75)' : 'rgba(0, 0, 0, 0.45)',
    bg: isEffectiveDark ? '#141414' : '#ffffff',
    headerBg: isEffectiveDark ? '#181818' : '#f8fafc',
    sidebarBg: isEffectiveDark ? '#141414' : '#ffffff',
    panelBg: isEffectiveDark ? '#1a1a1a' : '#f8fafc',
    hoverBg: isEffectiveDark ? '#222222' : '#f1f5f9',
    inputBg: isEffectiveDark ? '#1e1e1e' : '#f1f5f9',
    textPrimary: isEffectiveDark ? '#f4f4f5' : '#0f172a',
    textSecondary: isEffectiveDark ? '#a1a1aa' : '#64748b',
    textMuted: isEffectiveDark ? '#71717a' : '#94a3b8',
    divider: isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)',
  };

  const horizontalDivider = {
    borderBottom: `1px solid ${colors.divider}`,
  };

  const verticalDivider = {
    borderRight: `1px solid ${colors.divider}`,
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: 10,
    background: colors.inputBg,
    border: 'none',
    boxShadow: 'none',
    outline: 'none',
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: 400,
    borderRadius: 6,
    boxSizing: 'border-box',
    fontFamily: "'Poppins', -apple-system, sans-serif",
  };

  const codeInputStyle: React.CSSProperties = {
    ...inputStyle,
    fontFamily: "'JetBrains Mono', Menlo, monospace",
    fontSize: 11,
    lineHeight: 1.5,
  };

  const aiContextPreviewText = brain ? generateBrainAiContext(brain) : '';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: colors.overlay,
        backdropFilter: 'blur(8px)',
        WebkitAppRegion: 'no-drag' as any,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: '95vw',
          height: '92vh',
          maxWidth: 1680,
          background: colors.bg,
          borderRadius: 12,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          border: 'none',
          boxShadow: 'none',
          color: colors.textPrimary,
          fontFamily: "'Poppins', -apple-system, sans-serif",
          transition: 'transform 0.15s ease',
        }}
      >
        {/* Header Bar */}
        <div
          style={{
            height: 52,
            padding: 16,
            gap: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: colors.headerBg,
            ...horizontalDivider,
            flexShrink: 0,
            boxSizing: 'border-box',
          }}
        >
          {/* Informações do Projeto e Ícone */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={() => setIsSidebarOpen((prev) => !prev)}
              title={isSidebarOpen ? 'Ocultar Painel Lateral' : 'Expandir Painel Lateral'}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 28,
                height: 28,
                borderRadius: 6,
                background: isSidebarOpen ? 'transparent' : `${accentColor}18`,
                border: 'none',
                boxShadow: 'none',
                color: isSidebarOpen ? colors.textSecondary : accentColor,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <PanelLeft size={15} />
            </button>

            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: 6,
                background: `${accentColor}18`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: accentColor,
              }}
            >
              <Brain size={16} strokeWidth={1.8} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 400,
                  color: colors.textPrimary,
                }}
              >
                DevFlow Brain
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 400,
                  padding: '3px 8px',
                  borderRadius: 4,
                  background: `${accentColor}18`,
                  color: accentColor,
                }}
              >
                Contexto Ativo do SO: {brain?.projectName || projectName || 'Projeto'}
              </span>
              <span
                style={{
                  fontSize: 11,
                  color: colors.textMuted,
                  fontWeight: 400,
                  fontFamily: "'JetBrains Mono', Menlo, monospace",
                  maxWidth: 320,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {workspacePath}
              </span>
            </div>
          </div>

          {/* Botões de Ação do Cabeçalho */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={handleRescan}
              disabled={isScanning}
              title="Reescanear codebase, dependências e estrutura"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: 8,
                borderRadius: 6,
                background: colors.panelBg,
                border: 'none',
                boxShadow: 'none',
                color: colors.textPrimary,
                fontSize: 12,
                fontWeight: 400,
                cursor: isScanning ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
                transition: 'background 0.15s ease',
              }}
              onMouseEnter={(e) => {
                if (!isScanning) e.currentTarget.style.background = colors.hoverBg;
              }}
              onMouseLeave={(e) => {
                if (!isScanning) e.currentTarget.style.background = colors.panelBg;
              }}
            >
              <RefreshCw
                size={13}
                style={{
                  animation: isScanning ? 'spin 1s linear infinite' : 'none',
                }}
              />
              <span>{isScanning ? 'Escaneando...' : 'Escanear Projeto'}</span>
            </button>

            <button
              onClick={handleSave}
              disabled={isSaving}
              title="Salvar alterações no Brain"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: 8,
                borderRadius: 6,
                background: accentColor,
                border: 'none',
                boxShadow: 'none',
                color: '#ffffff',
                fontSize: 12,
                fontWeight: 400,
                cursor: isSaving ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
                transition: 'opacity 0.15s ease',
              }}
            >
              <Save size={13} />
              <span>{isSaving ? 'Salvando...' : 'Salvar Contexto'}</span>
            </button>

            <button
              onClick={onClose}
              title="Fechar Brain (Esc)"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 28,
                height: 28,
                borderRadius: 6,
                background: 'transparent',
                border: 'none',
                boxShadow: 'none',
                color: colors.textSecondary,
                cursor: 'pointer',
                transition: 'color 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = colors.textPrimary;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = colors.textSecondary;
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Modal Main Body */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Left Sidebar (Colapsável para visualização expansiva do grafo) */}
          {isSidebarOpen && (
            <div
              style={{
                width: 380,
                minWidth: 320,
                display: 'flex',
                flexDirection: 'column',
                background: colors.sidebarBg,
                ...verticalDivider,
                boxSizing: 'border-box',
              }}
            >
              {/* Sidebar Navigation Tabs */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: 10,
                  gap: 10,
                  ...horizontalDivider,
                  flexShrink: 0,
                }}
              >
                <button
                  onClick={() => setActiveTab('overview')}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    padding: 8,
                    borderRadius: 6,
                    border: 'none',
                    boxShadow: 'none',
                    background: activeTab === 'overview' ? colors.hoverBg : 'transparent',
                    color: activeTab === 'overview' ? accentColor : colors.textSecondary,
                    fontSize: 12,
                    fontWeight: 400,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Cpu size={14} />
                  <span>Visão & IA</span>
                </button>

                <button
                  onClick={() => setActiveTab('inspector')}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    padding: 8,
                    borderRadius: 6,
                    border: 'none',
                    boxShadow: 'none',
                    background: activeTab === 'inspector' ? colors.hoverBg : 'transparent',
                    color: activeTab === 'inspector' ? accentColor : colors.textSecondary,
                    fontSize: 12,
                    fontWeight: 400,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Layers size={14} />
                  <span>Inspetor</span>
                </button>

                <button
                  onClick={() => setActiveTab('new-node')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 30,
                    height: 30,
                    borderRadius: 6,
                    border: 'none',
                    boxShadow: 'none',
                    background: activeTab === 'new-node' ? `${accentColor}20` : colors.panelBg,
                    color: activeTab === 'new-node' ? accentColor : colors.textSecondary,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  title="Adicionar nó ao grafo"
                >
                  <Plus size={14} />
                </button>
              </div>

              {/* Sidebar Scrollable Body */}
              <div
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: 16,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 16,
                }}
              >
                {/* TAB 1: VISÃO GERAL & DIRETRIZES DA IA */}
                {activeTab === 'overview' && brain && (
                  <>
                    {/* Stack Tecnológica */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 12, fontWeight: 400, color: colors.textSecondary }}>
                          Stack Tecnológica Detectada
                        </span>
                        <span style={{ fontSize: 11, color: accentColor, fontWeight: 400 }}>
                          {brain.techStack.length} techs
                        </span>
                      </div>

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {brain.techStack.map((tech) => (
                          <div
                            key={tech}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: 6,
                              borderRadius: 4,
                              background: colors.panelBg,
                              fontSize: 11,
                              fontWeight: 400,
                              color: colors.textPrimary,
                            }}
                          >
                            <span>{tech}</span>
                            <button
                              onClick={() => handleRemoveTech(tech)}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                boxShadow: 'none',
                                color: colors.textMuted,
                                cursor: 'pointer',
                                padding: 0,
                                display: 'flex',
                                alignItems: 'center',
                              }}
                            >
                              <X size={10} />
                            </button>
                          </div>
                        ))}
                      </div>

                      <div style={{ display: 'flex', gap: 6 }}>
                        <input
                          type="text"
                          placeholder="Adicionar tecnologia..."
                          value={newTechInput}
                          onChange={(e) => setNewTechInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleAddTech();
                          }}
                          style={inputStyle}
                        />
                        <button
                          onClick={handleAddTech}
                          style={{
                            padding: 10,
                            borderRadius: 6,
                            background: colors.panelBg,
                            border: 'none',
                            boxShadow: 'none',
                            color: colors.textPrimary,
                            cursor: 'pointer',
                            fontWeight: 400,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Plus size={13} />
                        </button>
                      </div>
                    </div>

                    <div style={horizontalDivider} />

                    {/* Resumo do Projeto */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 400, color: colors.textSecondary }}>
                        Resumo do Projeto
                      </span>
                      <textarea
                        rows={3}
                        value={brain.summary}
                        onChange={(e) => setBrain({ ...brain, summary: e.target.value })}
                        style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.45 }}
                        placeholder="Descreva o propósito deste projeto..."
                      />
                    </div>

                    <div style={horizontalDivider} />

                    {/* Visão Arquitetural */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 400, color: colors.textSecondary }}>
                        Visão Arquitetural
                      </span>
                      <textarea
                        rows={3}
                        value={brain.architectureOverview}
                        onChange={(e) =>
                          setBrain({ ...brain, architectureOverview: e.target.value })
                        }
                        style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.45 }}
                        placeholder="Explique os módulos e camadas da aplicação..."
                      />
                    </div>

                    <div style={horizontalDivider} />

                    {/* Diretrizes de IA */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 12, fontWeight: 400, color: colors.textSecondary }}>
                          Diretrizes de IA (Injetadas em Claude, AGY, Gemini)
                        </span>
                        <Sparkles size={13} color={accentColor} />
                      </div>
                      <textarea
                        rows={5}
                        value={brain.aiDirectives}
                        onChange={(e) => setBrain({ ...brain, aiDirectives: e.target.value })}
                        style={codeInputStyle}
                        placeholder="Regras obrigatórias de arquitetura e código para os agentes de IA..."
                      />
                    </div>

                    <div style={horizontalDivider} />

                    {/* Visualização do Prompt das IAs */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <button
                        onClick={() => setShowAiPreview((prev) => !prev)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          background: 'transparent',
                          border: 'none',
                          boxShadow: 'none',
                          color: accentColor,
                          fontSize: 11,
                          fontWeight: 400,
                          cursor: 'pointer',
                          padding: 0,
                          fontFamily: 'inherit',
                        }}
                      >
                        <span>Visualizar Bloco Injetado nos Agentes de IA</span>
                        <ChevronRight
                          size={13}
                          style={{
                            transform: showAiPreview ? 'rotate(90deg)' : 'none',
                            transition: 'transform 0.15s ease',
                          }}
                        />
                      </button>

                      {showAiPreview && (
                        <pre
                          style={{
                            margin: 0,
                            padding: 12,
                            gap: 12,
                            background: colors.inputBg,
                            borderRadius: 6,
                            fontSize: 10.5,
                            fontFamily: "'JetBrains Mono', Menlo, monospace",
                            color: colors.textSecondary,
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            lineHeight: 1.45,
                            fontWeight: 400,
                            border: 'none',
                            boxShadow: 'none',
                          }}
                        >
                          {aiContextPreviewText}
                        </pre>
                      )}
                    </div>
                  </>
                )}

                {/* TAB 2: INSPETOR DO NÓ */}
                {activeTab === 'inspector' && (
                  <>
                    {selectedNode ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span
                            style={{
                              fontSize: 10,
                              padding: '3px 8px',
                              borderRadius: 4,
                              background: `${accentColor}18`,
                              color: accentColor,
                              fontWeight: 400,
                            }}
                          >
                            {selectedNode.type.toUpperCase()}
                          </span>
                          {selectedNode.id !== 'root-project' && (
                            <button
                              onClick={() => setNodeToDelete(selectedNode)}
                              title="Remover nó do Brain"
                              style={{
                                background: 'transparent',
                                border: 'none',
                                boxShadow: 'none',
                                color: '#ef4444',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                padding: 4,
                              }}
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <span style={{ fontSize: 14, fontWeight: 400 }}>{selectedNode.label}</span>
                          <span
                            style={{
                              fontSize: 11,
                              color: colors.textSecondary,
                              wordBreak: 'break-all',
                              fontWeight: 400,
                              fontFamily: "'JetBrains Mono', Menlo, monospace",
                            }}
                          >
                            {selectedNode.path}
                          </span>
                        </div>

                        <div style={horizontalDivider} />

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <span style={{ fontSize: 11, color: colors.textSecondary, fontWeight: 400 }}>
                            Descrição
                          </span>
                          <textarea
                            rows={3}
                            value={selectedNode.description}
                            onChange={(e) => {
                              if (!brain) return;
                              const updatedDesc = e.target.value;
                              setSelectedNode({ ...selectedNode, description: updatedDesc });
                              const updatedNodes = brain.nodes.map((n) =>
                                n.id === selectedNode.id ? { ...n, description: updatedDesc } : n
                              );
                              setBrain({ ...brain, nodes: updatedNodes });
                            }}
                            style={{ ...inputStyle, resize: 'vertical' }}
                          />
                        </div>

                        {onOpenFile && selectedNode.path && (
                          <button
                            onClick={() => {
                              onOpenFile(selectedNode.path);
                              onClose();
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 6,
                              padding: 10,
                              borderRadius: 6,
                              background: colors.panelBg,
                              border: 'none',
                              boxShadow: 'none',
                              color: colors.textPrimary,
                              fontSize: 12,
                              fontWeight: 400,
                              cursor: 'pointer',
                              fontFamily: 'inherit',
                              transition: 'background 0.15s ease',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = colors.hoverBg;
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = colors.panelBg;
                            }}
                          >
                            <ExternalLink size={13} />
                            <span>Abrir Arquivo no Editor</span>
                          </button>
                        )}

                        {selectedNode.tags && selectedNode.tags.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {selectedNode.tags.map((t) => (
                              <span
                                key={t}
                                style={{
                                  fontSize: 10.5,
                                  padding: '3px 8px',
                                  borderRadius: 4,
                                  background: colors.panelBg,
                                  color: colors.textSecondary,
                                  fontWeight: 400,
                                }}
                              >
                                #{t}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div
                        style={{
                          padding: 24,
                          textAlign: 'center',
                          color: colors.textMuted,
                          fontSize: 12,
                          fontWeight: 400,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: 12,
                        }}
                      >
                        <Layers size={22} strokeWidth={1.5} color={accentColor} />
                        <span>Clique em qualquer nó no grafo Obsidian ao lado para inspecionar seus detalhes.</span>
                      </div>
                    )}
                  </>
                )}

                {/* TAB 3: NOVO NÓ */}
                {activeTab === 'new-node' && (
                  <form
                    onSubmit={handleCreateNode}
                    style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 400 }}>
                      Adicionar Nó de Conhecimento
                    </span>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <label style={{ fontSize: 11, color: colors.textSecondary, fontWeight: 400 }}>
                        Título do Nó / Arquivo
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Ex: AuthContext.tsx ou Modelo de Dados"
                        value={newNodeLabel}
                        onChange={(e) => setNewNodeLabel(e.target.value)}
                        style={inputStyle}
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <label style={{ fontSize: 11, color: colors.textSecondary, fontWeight: 400 }}>
                        Tipo de Nó
                      </label>
                      <select
                        value={newNodeType}
                        onChange={(e) => setNewNodeType(e.target.value as BrainNodeType)}
                        style={inputStyle}
                      >
                        <option value="module">Módulo</option>
                        <option value="component">Componente</option>
                        <option value="service">Serviço</option>
                        <option value="config">Configuração</option>
                        <option value="doc">Documento</option>
                        <option value="domain">Domínio</option>
                        <option value="custom">Personalizado</option>
                      </select>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <label style={{ fontSize: 11, color: colors.textSecondary, fontWeight: 400 }}>
                        Caminho do Arquivo (opcional)
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: src/contexts/AuthContext.tsx"
                        value={newNodePath}
                        onChange={(e) => setNewNodePath(e.target.value)}
                        style={inputStyle}
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <label style={{ fontSize: 11, color: colors.textSecondary, fontWeight: 400 }}>
                        Descrição / Papel Arquitetural
                      </label>
                      <textarea
                        rows={3}
                        placeholder="Explique o que este nó representa para o projeto e para as IAs..."
                        value={newNodeDesc}
                        onChange={(e) => setNewNodeDesc(e.target.value)}
                        style={{ ...inputStyle, resize: 'vertical' }}
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <label style={{ fontSize: 11, color: colors.textSecondary, fontWeight: 400 }}>
                        Tags (separadas por vírgula)
                      </label>
                      <input
                        type="text"
                        placeholder="auth, token, security"
                        value={newNodeTags}
                        onChange={(e) => setNewNodeTags(e.target.value)}
                        style={inputStyle}
                      />
                    </div>

                    <button
                      type="submit"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        padding: 10,
                        borderRadius: 6,
                        background: accentColor,
                        border: 'none',
                        boxShadow: 'none',
                        color: '#ffffff',
                        fontSize: 12,
                        fontWeight: 400,
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        marginTop: 4,
                      }}
                    >
                      <Plus size={14} />
                      <span>Adicionar Nó ao Grafo</span>
                    </button>
                  </form>
                )}
              </div>
            </div>
          )}

          {/* Right Main Area: Obsidian Graph (Layout Flex Vertical Limpo - Sem Divs Ocultando Botões) */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Contêiner do Grafo em Canvas */}
            <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
              {brain && (
                <BrainGraphCanvas
                  nodes={brain.nodes}
                  edges={brain.edges}
                  selectedNodeId={selectedNode?.id || null}
                  onSelectNode={(node) => {
                    setSelectedNode(node);
                    if (node) setActiveTab('inspector');
                  }}
                  onOpenNodeFile={onOpenFile}
                  onTogglePinNode={handleTogglePinNode}
                  accentColor={accentColor}
                  isEffectiveDark={isEffectiveDark}
                  projectName={brain.projectName || projectName}
                />
              )}
            </div>

            {/* Bottom Status Bar (Posicionada em fluxo flexbox abaixo do canvas, 100% desobstruída) */}
            <div
              style={{
                height: 32,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 16px',
                gap: 16,
                background: colors.headerBg,
                borderTop: `1px solid ${colors.divider}`,
                borderBottom: 'none',
                borderLeft: 'none',
                borderRight: 'none',
                fontSize: 11,
                color: colors.textSecondary,
                fontWeight: 400,
                flexShrink: 0,
                boxSizing: 'border-box',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span>{brain?.nodes.length || 0} nós mapeados</span>
                <span>{brain?.edges.length || 0} conexões</span>
                {brain?.lastIndexedAt && (
                  <span>
                    Última indexação: {new Date(brain.lastIndexedAt).toLocaleTimeString()}
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: accentColor }}>
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: accentColor,
                    display: 'inline-block',
                  }}
                />
                <span>Contexto pronto para Claude, AGY, Gemini e Codex</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Obrigatório de Confirmação para Exclusão (AGENTS.md) */}
      <ConfirmDeleteModal
        isOpen={!!nodeToDelete}
        title="Excluir Nó de Contexto"
        message="Tem certeza que deseja remover este nó do grafo de conhecimento do projeto? Esta ação não pode ser desfeita."
        itemDescription={nodeToDelete ? `${nodeToDelete.label} (${nodeToDelete.path})` : ''}
        confirmLabel="Excluir Nó"
        cancelLabel="Cancelar"
        isDeleting={isDeletingNode}
        accentColor={accentColor}
        themeTokens={themeTokens}
        onConfirm={confirmDeleteNode}
        onClose={() => setNodeToDelete(null)}
      />
    </div>
  );
};
