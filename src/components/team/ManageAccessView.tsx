import React, { useState, useMemo } from 'react';
import {
  Users,
  UserCheck,
  Shield,
  Layers,
  Key,
  CheckSquare,
  Square,
  Search,
  ChevronDown,
  Trash2,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  UserPlus,
} from 'lucide-react';
import type { RepoCollaborator } from '../ProjectsSchedulerView';

export interface AccessItem {
  id: string;
  type: 'user' | 'team';
  name: string;
  login: string;
  handle?: string;
  memberCount?: number;
  avatarUrl?: string;
  role: 'admin' | 'write' | 'read' | 'triage' | 'maintain';
  accessType: 'direct' | 'organization';
}

export interface ManageAccessViewProps {
  projectName?: string;
  repoFullName?: string;
  collaborators: RepoCollaborator[];
  isLoading?: boolean;
  theme: any;
  accentColor: string;
  accentContrastText: string;
  isEffectiveDark: boolean;
  onRefreshCollaborators?: () => void;
  onRequestDeleteCollaborator: (item: AccessItem) => void;
  onRequestBulkDelete?: (items: AccessItem[]) => void;
  showToast: (message: string) => void;
}

const DEFAULT_ACCESS_ITEMS: AccessItem[] = [
  {
    id: 'team-agrobravo',
    type: 'team',
    name: 'Agrobravo',
    login: 'agrobravo',
    handle: '@appmoove/agrobravo • 6 members',
    memberCount: 6,
    role: 'write',
    accessType: 'direct',
  },
  {
    id: 'user-gus-fernandes',
    type: 'user',
    name: 'Gustavo Fernandes',
    login: 'Gus-Fernandes',
    avatarUrl: 'https://github.com/Gus-Fernandes.png',
    role: 'admin',
    accessType: 'direct',
  },
  {
    id: 'user-juliaamartinez',
    type: 'user',
    name: 'juliaamartinez',
    login: 'juliaamartinez',
    avatarUrl: 'https://github.com/juliaamartinez.png',
    role: 'admin',
    accessType: 'direct',
  },
  {
    id: 'user-lpbaiser',
    type: 'user',
    name: 'lpbaiser',
    login: 'lpbaiser',
    avatarUrl: 'https://github.com/lpbaiser.png',
    role: 'admin',
    accessType: 'direct',
  },
  {
    id: 'user-luscas18',
    type: 'user',
    name: 'Lucas Dos Santos Vaz',
    login: 'luscas18',
    avatarUrl: 'https://github.com/luscas18.png',
    role: 'admin',
    accessType: 'direct',
  },
  {
    id: 'user-nelsonappmoove',
    type: 'user',
    name: 'Nelson Jr',
    login: 'nelsonappmoove',
    avatarUrl: 'https://github.com/nelsonappmoove.png',
    role: 'admin',
    accessType: 'direct',
  },
  {
    id: 'user-walancy',
    type: 'user',
    name: 'Walancy',
    login: 'Walancy',
    avatarUrl: 'https://github.com/Walancy.png',
    role: 'admin',
    accessType: 'direct',
  },
];

const ROLE_DEFINITIONS: Record<
  string,
  { label: string; description: string }
> = {
  admin: {
    label: 'admin',
    description: 'Pode ler, clonar, dar push e gerenciar colaboradores e configurações.',
  },
  maintain: {
    label: 'maintain',
    description: 'Pode ler, clonar, dar push e gerenciar o repositório sem acesso sensível.',
  },
  write: {
    label: 'write',
    description: 'Pode ler, clonar e dar push em branches deste repositório.',
  },
  triage: {
    label: 'triage',
    description: 'Pode ler, clonar e gerenciar issues e pull requests.',
  },
  read: {
    label: 'read',
    description: 'Pode visualizar e clonar este repositório.',
  },
};

export const ManageAccessView: React.FC<ManageAccessViewProps> = ({
  projectName,
  repoFullName,
  collaborators,
  theme,
  accentColor,
  accentContrastText,
  isEffectiveDark,
  onRequestDeleteCollaborator,
  onRequestBulkDelete,
  showToast,
}) => {
  // Lista de acessos
  const [accessList, setAccessList] = useState<AccessItem[]>(() => {
    const list = [...DEFAULT_ACCESS_ITEMS];
    if (collaborators && collaborators.length > 0) {
      collaborators.forEach((c) => {
        const exists = list.some(
          (item) => item.login.toLowerCase() === c.login.toLowerCase()
        );
        if (!exists) {
          list.push({
            id: `user-${c.login}`,
            type: c.type || 'user',
            name: c.name || c.login,
            login: c.login,
            avatarUrl: c.avatarUrl,
            role: c.role || 'admin',
            accessType: 'direct',
          });
        }
      });
    }
    return list;
  });

  // Sidebar
  const [sidebarTab, setSidebarTab] = useState<'all' | 'direct' | 'organization' | 'team' | 'admin'>('all');

  // Filtros
  const [typeFilter, setTypeFilter] = useState<'all' | 'user' | 'team'>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Dropdowns
  const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState(false);
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);
  const [activeRolePickerId, setActiveRolePickerId] = useState<string | null>(null);

  // Seleção múltipla
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 7;

  // Modais
  const [isAddPeopleOpen, setIsAddPeopleOpen] = useState(false);
  const [isAddTeamsOpen, setIsAddTeamsOpen] = useState(false);
  const [isCreateTeamOpen, setIsCreateTeamOpen] = useState(false);

  // Form states
  const [newPersonUsername, setNewPersonUsername] = useState('');
  const [newPersonRole, setNewPersonRole] = useState<'admin' | 'write' | 'read' | 'triage' | 'maintain'>('write');

  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamHandle, setNewTeamHandle] = useState('');
  const [newTeamRole, setNewTeamRole] = useState<'admin' | 'write' | 'read' | 'triage' | 'maintain'>('write');

  const [createTeamName, setCreateTeamName] = useState('');
  const [createTeamDesc, setCreateTeamDesc] = useState('');

  // Contagens para os badges da sidebar
  const counts = useMemo(() => {
    return {
      all: accessList.length,
      direct: accessList.filter((i) => i.accessType === 'direct').length,
      organization: accessList.filter((i) => i.accessType === 'organization').length,
      team: accessList.filter((i) => i.type === 'team').length,
      admin: accessList.filter((i) => i.role === 'admin').length,
    };
  }, [accessList]);

  // Itens filtrados
  const filteredItems = useMemo(() => {
    return accessList.filter((item) => {
      if (sidebarTab === 'direct' && item.accessType !== 'direct') return false;
      if (sidebarTab === 'organization' && item.accessType !== 'organization') return false;
      if (sidebarTab === 'team' && item.type !== 'team') return false;
      if (sidebarTab === 'admin' && item.role !== 'admin') return false;

      if (typeFilter !== 'all' && item.type !== typeFilter) return false;
      if (roleFilter !== 'all' && item.role !== roleFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = item.name.toLowerCase().includes(q);
        const matchLogin = item.login.toLowerCase().includes(q);
        const matchHandle = item.handle ? item.handle.toLowerCase().includes(q) : false;
        if (!matchName && !matchLogin && !matchHandle) return false;
      }

      return true;
    });
  }, [accessList, sidebarTab, typeFilter, roleFilter, searchQuery]);

  // Paginação
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / itemsPerPage));
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredItems.slice(start, start + itemsPerPage);
  }, [filteredItems, currentPage, itemsPerPage]);

  const isAllSelected =
    paginatedItems.length > 0 &&
    paginatedItems.every((item) => selectedIds.has(item.id));

  const toggleSelectAll = () => {
    const next = new Set(selectedIds);
    if (isAllSelected) {
      paginatedItems.forEach((i) => next.delete(i.id));
    } else {
      paginatedItems.forEach((i) => next.add(i.id));
    }
    setSelectedIds(next);
  };

  const toggleSelectItem = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleChangeRole = (
    id: string,
    newRole: 'admin' | 'write' | 'read' | 'triage' | 'maintain'
  ) => {
    setAccessList((prev) =>
      prev.map((item) => (item.id === id ? { ...item, role: newRole } : item))
    );
    setActiveRolePickerId(null);
    showToast(`Papel atualizado para "${newRole}".`);
  };

  const handleAddPersonSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPersonUsername.trim()) return;
    const clean = newPersonUsername.trim().replace(/^@/, '');
    const newItem: AccessItem = {
      id: `user-${clean.toLowerCase()}-${Date.now()}`,
      type: 'user',
      name: clean,
      login: clean,
      avatarUrl: `https://github.com/${clean}.png`,
      role: newPersonRole,
      accessType: 'direct',
    };
    setAccessList((prev) => [newItem, ...prev]);
    setNewPersonUsername('');
    setIsAddPeopleOpen(false);
    showToast(`Colaborador @${clean} adicionado.`);
  };

  const handleAddTeamSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;
    const org = repoFullName?.split('/')[0] || 'appmoove';
    const slug = newTeamName.toLowerCase().replace(/\s+/g, '-');
    const newItem: AccessItem = {
      id: `team-${slug}-${Date.now()}`,
      type: 'team',
      name: newTeamName.trim(),
      login: slug,
      handle: newTeamHandle.trim() || `@${org}/${slug} • 1 membro`,
      memberCount: 1,
      role: newTeamRole,
      accessType: 'direct',
    };
    setAccessList((prev) => [newItem, ...prev]);
    setNewTeamName('');
    setNewTeamHandle('');
    setIsAddTeamsOpen(false);
    showToast(`Time "${newTeamName}" adicionado.`);
  };

  const handleCreateTeamSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!createTeamName.trim()) return;
    const org = repoFullName?.split('/')[0] || 'appmoove';
    const slug = createTeamName.toLowerCase().replace(/\s+/g, '-');
    const newItem: AccessItem = {
      id: `team-${slug}-${Date.now()}`,
      type: 'team',
      name: createTeamName.trim(),
      login: slug,
      handle: `@${org}/${slug} • 1 membro`,
      memberCount: 1,
      role: 'write',
      accessType: 'direct',
    };
    setAccessList((prev) => [newItem, ...prev]);
    setCreateTeamName('');
    setCreateTeamDesc('');
    setIsCreateTeamOpen(false);
    showToast(`Time "${newItem.name}" criado na organização.`);
  };

  const handleRemoveBulk = () => {
    const toRemove = accessList.filter((i) => selectedIds.has(i.id));
    if (toRemove.length === 0) return;
    if (onRequestBulkDelete) {
      onRequestBulkDelete(toRemove);
    } else if (toRemove[0]) {
      onRequestDeleteCollaborator(toRemove[0]);
    }
  };

  const sidebarTabsConfig = [
    { id: 'all', label: 'Todos os Acessos', icon: Users, count: counts.all },
    { id: 'direct', label: 'Acesso Direto', icon: UserCheck, count: counts.direct },
    { id: 'organization', label: 'Acesso da Organização', icon: Shield, count: counts.organization },
    { id: 'team', label: 'Times', icon: Layers, count: counts.team },
    { id: 'admin', label: 'Administradores', icon: Key, count: counts.admin },
  ] as const;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'stretch',
        gap: 5,
        width: '100%',
        minHeight: 360,
        boxSizing: 'border-box',
        fontFamily: "'Poppins', -apple-system, sans-serif",
      }}
    >
      {/* ----------------------------------------------------------------- */}
      {/* SIDEBAR ESQUERDA (IGUAL À DE ISSUES)                              */}
      {/* ----------------------------------------------------------------- */}
      <div
        style={{
          width: 'clamp(160px, 20%, 220px)',
          minWidth: 160,
          background: theme.viewCanvasBg,
          borderRadius: 8,
          padding: '8px 6px',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          boxSizing: 'border-box',
          flexShrink: 0,
        }}
      >
        {sidebarTabsConfig.map((tab) => {
          const isActive = sidebarTab === tab.id;
          const Icon = tab.icon;

          return (
            <div
              key={tab.id}
              onClick={() => {
                setSidebarTab(tab.id as any);
                setCurrentPage(1);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '7px 10px',
                borderRadius: 6,
                cursor: 'pointer',
                background: isActive
                  ? isEffectiveDark
                    ? '#242424'
                    : '#e2e8f0'
                  : 'transparent',
                color: isActive ? theme.textPrimary : theme.textSecondary,
                fontWeight: isActive ? 500 : 400,
                fontSize: 12.5,
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = isEffectiveDark
                    ? 'rgba(255, 255, 255, 0.05)'
                    : 'rgba(0, 0, 0, 0.04)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'transparent';
                }
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <Icon size={14} color={isActive ? accentColor : theme.textSecondary} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {tab.label}
                </span>
              </div>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  color: isActive ? accentColor : theme.textSecondary,
                  padding: '1px 6px',
                  borderRadius: 10,
                  background: isActive
                    ? isEffectiveDark
                      ? 'rgba(255, 255, 255, 0.1)'
                      : 'rgba(0, 0, 0, 0.06)'
                    : 'transparent',
                  flexShrink: 0,
                }}
              >
                {tab.count}
              </span>
            </div>
          );
        })}
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* ÁREA PRINCIPAL: HEADER E TABELA DEVFLOW                            */}
      {/* ----------------------------------------------------------------- */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          boxSizing: 'border-box',
        }}
      >
        {/* HEADER DO CANVAS COM TÍTULO E BOTÕES NO PADRÃO DEVFLOW */}
        <div
          style={{
            background: theme.viewCanvasBg,
            borderRadius: 8,
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Users size={17} color={accentColor} />
            <div>
              <div style={{ fontSize: 14.5, fontWeight: 600, color: theme.textPrimary }}>
                Manage access
              </div>
              <div style={{ fontSize: 11.5, color: theme.textSecondary }}>
                Colaboradores e permissões de {projectName || repoFullName || 'repositório'}
              </div>
            </div>
          </div>

          {/* GRUPO DE BOTÕES SUPERIORES NO PADRÃO DEVFLOW (SEM BORDAS BRANCAS) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              type="button"
              onClick={() => setIsCreateTeamOpen(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: theme.controlBg,
                border: 'none',
                borderRadius: 8,
                padding: '0 12px',
                height: 30,
                color: theme.textPrimary,
                fontSize: 12,
                fontWeight: 400,
                cursor: 'pointer',
                transition: 'background 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = theme.controlHoverBg)}
              onMouseLeave={(e) => (e.currentTarget.style.background = theme.controlBg)}
            >
              <span>Create team</span>
            </button>

            <button
              type="button"
              onClick={() => setIsAddTeamsOpen(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: theme.controlBg,
                border: 'none',
                borderRadius: 8,
                padding: '0 12px',
                height: 30,
                color: theme.textPrimary,
                fontSize: 12,
                fontWeight: 400,
                cursor: 'pointer',
                transition: 'background 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = theme.controlHoverBg)}
              onMouseLeave={(e) => (e.currentTarget.style.background = theme.controlBg)}
            >
              <Layers size={13} color={theme.textSecondary} />
              <span>Add teams</span>
            </button>

            <button
              type="button"
              onClick={() => setIsAddPeopleOpen(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: accentColor,
                border: 'none',
                borderRadius: 8,
                padding: '0 14px',
                height: 30,
                color: accentContrastText,
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'opacity 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.88')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
            >
              <UserPlus size={13} color={accentContrastText} />
              <span>Add people</span>
            </button>
          </div>
        </div>

        {/* TABELA DE ACESSOS */}
        <div
          style={{
            background: theme.viewCanvasBg,
            borderRadius: 8,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            minHeight: 280,
            position: 'relative',
          }}
        >
          {/* Backdrop para fechar dropdowns */}
          {(isTypeDropdownOpen || isRoleDropdownOpen || activeRolePickerId) && (
            <div
              onClick={() => {
                setIsTypeDropdownOpen(false);
                setIsRoleDropdownOpen(false);
                setActiveRolePickerId(null);
              }}
              style={{ position: 'fixed', inset: 0, zIndex: 30 }}
            />
          )}

          {/* CABEÇALHO DA TABELA (BARRA DE FILTRO E BUSCA) */}
          <div
            style={{
              background: theme.controlBg,
              padding: '8px 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 8,
              userSelect: 'none',
              borderBottom: `1px solid ${theme.tableBorder}`,
            }}
          >
            {/* Esquerda: Checkbox mestre + Select all + Filtros */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                onClick={toggleSelectAll}
                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                title="Selecionar todos os membros visíveis"
              >
                {isAllSelected ? (
                  <CheckSquare size={15} color={accentColor} />
                ) : (
                  <Square size={15} color={theme.textSecondary} />
                )}
                <span style={{ fontSize: 12, fontWeight: 500, color: theme.textPrimary }}>
                  Select all
                </span>
              </div>

              {selectedIds.size > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11, color: accentColor, fontWeight: 600 }}>
                    ({selectedIds.size})
                  </span>
                  <button
                    type="button"
                    onClick={handleRemoveBulk}
                    style={{
                      background: isEffectiveDark ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.1)',
                      border: 'none',
                      color: '#ef4444',
                      fontSize: 11.5,
                      fontWeight: 500,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '3px 8px',
                      borderRadius: 6,
                    }}
                  >
                    <Trash2 size={12} />
                    <span>Remover</span>
                  </button>
                </div>
              )}

              {/* Filtro Type */}
              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => {
                    setIsTypeDropdownOpen((prev) => !prev);
                    setIsRoleDropdownOpen(false);
                  }}
                  style={{
                    background: typeFilter !== 'all' ? theme.controlHoverBg : 'transparent',
                    border: 'none',
                    color: typeFilter !== 'all' ? accentColor : theme.textSecondary,
                    fontSize: 12,
                    fontWeight: 400,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '4px 8px',
                    borderRadius: 6,
                    height: 28,
                    transition: 'background 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (typeFilter === 'all') e.currentTarget.style.background = theme.controlHoverBg;
                  }}
                  onMouseLeave={(e) => {
                    if (typeFilter === 'all') e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <span>
                    {typeFilter === 'all' ? 'Type' : typeFilter === 'user' ? 'Type: People' : 'Type: Teams'}
                  </span>
                  <ChevronDown size={12} />
                </button>

                {isTypeDropdownOpen && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 4px)',
                      left: 0,
                      zIndex: 35,
                      background: theme.dropdownBg,
                      border: `1px solid ${isEffectiveDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                      borderRadius: 8,
                      boxShadow: theme.dropdownShadow,
                      minWidth: 140,
                      padding: 4,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 1,
                    }}
                  >
                    {[
                      { id: 'all', label: 'Todos os tipos' },
                      { id: 'user', label: 'People (Pessoas)' },
                      { id: 'team', label: 'Teams (Times)' },
                    ].map((t) => (
                      <div
                        key={t.id}
                        onClick={() => {
                          setTypeFilter(t.id as any);
                          setIsTypeDropdownOpen(false);
                          setCurrentPage(1);
                        }}
                        style={{
                          padding: '6px 10px',
                          borderRadius: 6,
                          fontSize: 12,
                          color: typeFilter === t.id ? accentColor : theme.textPrimary,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          background: typeFilter === t.id ? theme.dropdownItemHover : 'transparent',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = theme.dropdownItemHover)}
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.background =
                            typeFilter === t.id ? theme.dropdownItemHover : 'transparent')
                        }
                      >
                        <span>{t.label}</span>
                        {typeFilter === t.id && <Check size={12} color={accentColor} />}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Filtro Role */}
              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => {
                    setIsRoleDropdownOpen((prev) => !prev);
                    setIsTypeDropdownOpen(false);
                  }}
                  style={{
                    background: roleFilter !== 'all' ? theme.controlHoverBg : 'transparent',
                    border: 'none',
                    color: roleFilter !== 'all' ? accentColor : theme.textSecondary,
                    fontSize: 12,
                    fontWeight: 400,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '4px 8px',
                    borderRadius: 6,
                    height: 28,
                    transition: 'background 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (roleFilter === 'all') e.currentTarget.style.background = theme.controlHoverBg;
                  }}
                  onMouseLeave={(e) => {
                    if (roleFilter === 'all') e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <span>{roleFilter === 'all' ? 'Role' : `Role: ${roleFilter}`}</span>
                  <ChevronDown size={12} />
                </button>

                {isRoleDropdownOpen && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 4px)',
                      left: 0,
                      zIndex: 35,
                      background: theme.dropdownBg,
                      border: `1px solid ${isEffectiveDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                      borderRadius: 8,
                      boxShadow: theme.dropdownShadow,
                      minWidth: 150,
                      padding: 4,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 1,
                    }}
                  >
                    {[
                      { id: 'all', label: 'Todos os papéis' },
                      { id: 'admin', label: 'admin' },
                      { id: 'maintain', label: 'maintain' },
                      { id: 'write', label: 'write' },
                      { id: 'triage', label: 'triage' },
                      { id: 'read', label: 'read' },
                    ].map((r) => (
                      <div
                        key={r.id}
                        onClick={() => {
                          setRoleFilter(r.id);
                          setIsRoleDropdownOpen(false);
                          setCurrentPage(1);
                        }}
                        style={{
                          padding: '6px 10px',
                          borderRadius: 6,
                          fontSize: 12,
                          color: roleFilter === r.id ? accentColor : theme.textPrimary,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          background: roleFilter === r.id ? theme.dropdownItemHover : 'transparent',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = theme.dropdownItemHover)}
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.background =
                            roleFilter === r.id ? theme.dropdownItemHover : 'transparent')
                        }
                      >
                        <span style={{ textTransform: r.id === 'all' ? 'none' : 'lowercase' }}>{r.label}</span>
                        {roleFilter === r.id && <Check size={12} color={accentColor} />}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Direita: Campo de Busca Padronizado DevFlow (Sem bordas duras) */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: theme.viewCanvasBg,
                borderRadius: 8,
                padding: '0 10px',
                height: 30,
                width: 220,
                maxWidth: '100%',
                border: 'none',
                transition: 'background 0.15s ease',
              }}
            >
              <Search size={13} color={theme.textSecondary} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Find people or a team..."
                style={{
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  color: theme.textPrimary,
                  fontSize: 12,
                  fontFamily: 'inherit',
                  width: '100%',
                }}
              />
            </div>
          </div>

          {/* CORPO DA TABELA: LINHAS DE MEMBROS */}
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            {paginatedItems.length === 0 ? (
              <div
                style={{
                  padding: '48px 24px',
                  textAlign: 'center',
                  color: theme.textSecondary,
                  fontSize: 13,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <Users size={26} color={theme.textMuted} />
                <span>Nenhum membro ou time correspondente encontrado.</span>
              </div>
            ) : (
              paginatedItems.map((item, idx) => {
                const isSelected = selectedIds.has(item.id);
                const isLast = idx === paginatedItems.length - 1;

                return (
                  <div
                    key={item.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '9px 12px',
                      borderBottom: isLast ? 'none' : `1px solid ${theme.tableBorder}`,
                      background: isSelected
                        ? isEffectiveDark
                          ? 'rgba(255, 255, 255, 0.04)'
                          : 'rgba(0, 0, 0, 0.03)'
                        : 'transparent',
                      transition: 'background 0.1s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.background = isEffectiveDark
                          ? 'rgba(255, 255, 255, 0.025)'
                          : 'rgba(0, 0, 0, 0.02)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.background = 'transparent';
                      }
                    }}
                  >
                    {/* Lado Esquerdo: Checkbox + Avatar + Detalhes */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                      <div
                        onClick={() => toggleSelectItem(item.id)}
                        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                      >
                        {isSelected ? (
                          <CheckSquare size={15} color={accentColor} />
                        ) : (
                          <Square size={15} color={theme.textSecondary} />
                        )}
                      </div>

                      {/* Avatar: Time ou Pessoa */}
                      {item.type === 'team' ? (
                        <div
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 6,
                            background: isEffectiveDark
                              ? 'rgba(236, 72, 153, 0.15)'
                              : 'rgba(236, 72, 153, 0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#ec4899',
                            flexShrink: 0,
                          }}
                        >
                          <Layers size={14} />
                        </div>
                      ) : (
                        <div
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: '50%',
                            overflow: 'hidden',
                            background: theme.controlBg,
                            flexShrink: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 11,
                            fontWeight: 600,
                            color: theme.textSecondary,
                          }}
                        >
                          {item.avatarUrl ? (
                            <img
                              src={item.avatarUrl}
                              alt={item.name}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                          ) : (
                            item.name.charAt(0).toUpperCase()
                          )}
                        </div>
                      )}

                      {/* Nome & Handle */}
                      <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <div
                          style={{
                            fontSize: 12.5,
                            fontWeight: 500,
                            color: theme.textPrimary,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            cursor: 'pointer',
                          }}
                          onClick={() => {
                            if (item.type === 'user') {
                              window.electronAPI?.shell?.openExternal?.(`https://github.com/${item.login}`);
                            }
                          }}
                        >
                          <span>{item.name}</span>
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: theme.textSecondary,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {item.handle || item.login}
                        </div>
                      </div>
                    </div>

                    {/* Lado Direito: Role Pill + Delete no Padrão DevFlow */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      {/* Botão de Papel (Role: admin ▾) */}
                      <div style={{ position: 'relative' }}>
                        <button
                          type="button"
                          onClick={() =>
                            setActiveRolePickerId((prev) => (prev === item.id ? null : item.id))
                          }
                          style={{
                            background: theme.controlBg,
                            border: 'none',
                            borderRadius: 6,
                            padding: '0 10px',
                            height: 28,
                            color: theme.textPrimary,
                            fontSize: 11.5,
                            fontWeight: 400,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 5,
                            transition: 'background 0.15s ease',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = theme.controlHoverBg)}
                          onMouseLeave={(e) => (e.currentTarget.style.background = theme.controlBg)}
                        >
                          <span>Role: {item.role}</span>
                          <ChevronDown size={11} color={theme.textSecondary} />
                        </button>

                        {/* Dropdown de Papéis */}
                        {activeRolePickerId === item.id && (
                          <div
                            style={{
                              position: 'absolute',
                              top: 'calc(100% + 4px)',
                              right: 0,
                              zIndex: 35,
                              background: theme.dropdownBg,
                              border: `1px solid ${isEffectiveDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                              borderRadius: 8,
                              boxShadow: theme.dropdownShadow,
                              width: 250,
                              padding: 4,
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 1,
                              backdropFilter: 'blur(16px)',
                            }}
                          >
                            <div
                              style={{
                                padding: '5px 8px 3px',
                                fontSize: 10,
                                fontWeight: 600,
                                color: theme.textMuted,
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                borderBottom: `1px solid ${isEffectiveDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                                marginBottom: 2,
                              }}
                            >
                              Alterar permissão
                            </div>
                            {Object.entries(ROLE_DEFINITIONS).map(([roleKey, roleInfo]) => (
                              <div
                                key={roleKey}
                                onClick={() => handleChangeRole(item.id, roleKey as any)}
                                style={{
                                  padding: '6px 8px',
                                  borderRadius: 6,
                                  cursor: 'pointer',
                                  background: item.role === roleKey ? theme.dropdownItemHover : 'transparent',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: 2,
                                  transition: 'background 0.12s ease',
                                }}
                                onMouseEnter={(e) =>
                                  (e.currentTarget.style.background = theme.dropdownItemHover)
                                }
                                onMouseLeave={(e) =>
                                  (e.currentTarget.style.background =
                                    item.role === roleKey ? theme.dropdownItemHover : 'transparent')
                                }
                              >
                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                  }}
                                >
                                  <span
                                    style={{
                                      fontSize: 12,
                                      fontWeight: 600,
                                      color: item.role === roleKey ? accentColor : theme.textPrimary,
                                    }}
                                  >
                                    {roleInfo.label}
                                  </span>
                                  {item.role === roleKey && <Check size={12} color={accentColor} />}
                                </div>
                                <span
                                  style={{
                                    fontSize: 10.5,
                                    color: theme.textSecondary,
                                    lineHeight: 1.3,
                                  }}
                                >
                                  {roleInfo.description}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Botão de Excluir / Revogar Acesso */}
                      <button
                        type="button"
                        title="Remover acesso"
                        onClick={() => onRequestDeleteCollaborator(item)}
                        style={{
                          background: theme.controlBg,
                          border: 'none',
                          borderRadius: 6,
                          width: 28,
                          height: 28,
                          padding: 0,
                          cursor: 'pointer',
                          color: isEffectiveDark ? '#f87171' : '#ef4444',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'background 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = isEffectiveDark
                            ? 'rgba(239, 68, 68, 0.18)'
                            : 'rgba(239, 68, 68, 0.1)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = theme.controlBg;
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* RODAPÉ DA TABELA: PAGINAÇÃO NO PADRÃO DEVFLOW */}
          <div
            style={{
              background: theme.controlBg,
              padding: '8px 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderTop: `1px solid ${theme.tableBorder}`,
              userSelect: 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginLeft: 'auto' }}>
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: currentPage <= 1 ? theme.textMuted : accentColor,
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 3,
                  padding: '3px 6px',
                  borderRadius: 4,
                }}
              >
                <ChevronLeft size={13} />
                <span>Previous</span>
              </button>

              <span style={{ fontSize: 11.5, color: theme.textPrimary, fontWeight: 500 }}>
                {currentPage} / {totalPages}
              </span>

              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: currentPage >= totalPages ? theme.textMuted : accentColor,
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 3,
                  padding: '3px 6px',
                  borderRadius: 4,
                }}
              >
                <span>Next</span>
                <ChevronRight size={13} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL: ADD PEOPLE */}
      {isAddPeopleOpen && (
        <div
          onClick={() => setIsAddPeopleOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100002,
            background: theme.modalOverlay,
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 420,
              background: theme.modalBg,
              borderRadius: 10,
              border: 'none',
              boxShadow: theme.modalShadow,
              padding: 20,
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <UserPlus size={16} color={accentColor} />
                <span style={{ fontSize: 14, fontWeight: 600, color: theme.textPrimary }}>
                  Adicionar Pessoa ao Repositório
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsAddPeopleOpen(false)}
                style={{ background: 'transparent', border: 'none', color: theme.textSecondary, cursor: 'pointer' }}
              >
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleAddPersonSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 11.5, color: theme.textSecondary, marginBottom: 4, display: 'block' }}>
                  Usuário ou e-mail do GitHub
                </label>
                <input
                  type="text"
                  required
                  value={newPersonUsername}
                  onChange={(e) => setNewPersonUsername(e.target.value)}
                  placeholder="ex: Gus-Fernandes, juliaamartinez"
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    background: theme.modalInputBg || theme.controlBg,
                    border: 'none',
                    borderRadius: 6,
                    padding: '8px 10px',
                    fontSize: 12.5,
                    color: theme.textPrimary,
                    outline: 'none',
                  }}
                  autoFocus
                />
              </div>

              <div>
                <label style={{ fontSize: 11.5, color: theme.textSecondary, marginBottom: 4, display: 'block' }}>
                  Papel / Permissão
                </label>
                <select
                  value={newPersonRole}
                  onChange={(e) => setNewPersonRole(e.target.value as any)}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    background: theme.modalInputBg || theme.controlBg,
                    border: 'none',
                    borderRadius: 6,
                    padding: '8px 10px',
                    fontSize: 12.5,
                    color: theme.textPrimary,
                    outline: 'none',
                  }}
                >
                  <option value="write">write (Pode ler, clonar e dar push)</option>
                  <option value="admin">admin (Acesso total)</option>
                  <option value="maintain">maintain (Gerenciar repo)</option>
                  <option value="triage">triage (Gerenciar issues/PRs)</option>
                  <option value="read">read (Somente leitura)</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
                <button
                  type="button"
                  onClick={() => setIsAddPeopleOpen(false)}
                  style={{
                    background: theme.controlBg,
                    border: 'none',
                    borderRadius: 6,
                    padding: '6px 14px',
                    fontSize: 12,
                    color: theme.textSecondary,
                    cursor: 'pointer',
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{
                    background: accentColor,
                    border: 'none',
                    borderRadius: 6,
                    padding: '6px 16px',
                    fontSize: 12,
                    fontWeight: 500,
                    color: accentContrastText,
                    cursor: 'pointer',
                  }}
                >
                  Adicionar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD TEAMS */}
      {isAddTeamsOpen && (
        <div
          onClick={() => setIsAddTeamsOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100002,
            background: theme.modalOverlay,
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 420,
              background: theme.modalBg,
              borderRadius: 10,
              border: 'none',
              boxShadow: theme.modalShadow,
              padding: 20,
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Users size={16} color={accentColor} />
                <span style={{ fontSize: 14, fontWeight: 600, color: theme.textPrimary }}>
                  Adicionar Time ao Repositório
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsAddTeamsOpen(false)}
                style={{ background: 'transparent', border: 'none', color: theme.textSecondary, cursor: 'pointer' }}
              >
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleAddTeamSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 11.5, color: theme.textSecondary, marginBottom: 4, display: 'block' }}>
                  Nome do Time
                </label>
                <input
                  type="text"
                  required
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  placeholder="ex: Agrobravo, Frontend, Mobile"
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    background: theme.modalInputBg || theme.controlBg,
                    border: 'none',
                    borderRadius: 6,
                    padding: '8px 10px',
                    fontSize: 12.5,
                    color: theme.textPrimary,
                    outline: 'none',
                  }}
                  autoFocus
                />
              </div>

              <div>
                <label style={{ fontSize: 11.5, color: theme.textSecondary, marginBottom: 4, display: 'block' }}>
                  Identificador / Membros (opcional)
                </label>
                <input
                  type="text"
                  value={newTeamHandle}
                  onChange={(e) => setNewTeamHandle(e.target.value)}
                  placeholder="ex: @appmoove/agrobravo • 6 members"
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    background: theme.modalInputBg || theme.controlBg,
                    border: 'none',
                    borderRadius: 6,
                    padding: '8px 10px',
                    fontSize: 12.5,
                    color: theme.textPrimary,
                    outline: 'none',
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: 11.5, color: theme.textSecondary, marginBottom: 4, display: 'block' }}>
                  Papel / Permissão
                </label>
                <select
                  value={newTeamRole}
                  onChange={(e) => setNewTeamRole(e.target.value as any)}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    background: theme.modalInputBg || theme.controlBg,
                    border: 'none',
                    borderRadius: 6,
                    padding: '8px 10px',
                    fontSize: 12.5,
                    color: theme.textPrimary,
                    outline: 'none',
                  }}
                >
                  <option value="write">write (Pode ler, clonar e dar push)</option>
                  <option value="admin">admin (Acesso total)</option>
                  <option value="maintain">maintain (Gerenciar repo)</option>
                  <option value="triage">triage (Gerenciar issues/PRs)</option>
                  <option value="read">read (Somente leitura)</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
                <button
                  type="button"
                  onClick={() => setIsAddTeamsOpen(false)}
                  style={{
                    background: theme.controlBg,
                    border: 'none',
                    borderRadius: 6,
                    padding: '6px 14px',
                    fontSize: 12,
                    color: theme.textSecondary,
                    cursor: 'pointer',
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{
                    background: accentColor,
                    border: 'none',
                    borderRadius: 6,
                    padding: '6px 16px',
                    fontSize: 12,
                    fontWeight: 500,
                    color: accentContrastText,
                    cursor: 'pointer',
                  }}
                >
                  Adicionar Time
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREATE TEAM */}
      {isCreateTeamOpen && (
        <div
          onClick={() => setIsCreateTeamOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100002,
            background: theme.modalOverlay,
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 420,
              background: theme.modalBg,
              borderRadius: 10,
              border: 'none',
              boxShadow: theme.modalShadow,
              padding: 20,
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Layers size={16} color={accentColor} />
                <span style={{ fontSize: 14, fontWeight: 600, color: theme.textPrimary }}>
                  Criar Novo Time na Organização
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateTeamOpen(false)}
                style={{ background: 'transparent', border: 'none', color: theme.textSecondary, cursor: 'pointer' }}
              >
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleCreateTeamSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 11.5, color: theme.textSecondary, marginBottom: 4, display: 'block' }}>
                  Nome do Time
                </label>
                <input
                  type="text"
                  required
                  value={createTeamName}
                  onChange={(e) => setCreateTeamName(e.target.value)}
                  placeholder="ex: Design System, Core Team"
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    background: theme.modalInputBg || theme.controlBg,
                    border: 'none',
                    borderRadius: 6,
                    padding: '8px 10px',
                    fontSize: 12.5,
                    color: theme.textPrimary,
                    outline: 'none',
                  }}
                  autoFocus
                />
              </div>

              <div>
                <label style={{ fontSize: 11.5, color: theme.textSecondary, marginBottom: 4, display: 'block' }}>
                  Descrição (opcional)
                </label>
                <textarea
                  rows={3}
                  value={createTeamDesc}
                  onChange={(e) => setCreateTeamDesc(e.target.value)}
                  placeholder="Finalidade e escopo deste time..."
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    background: theme.modalInputBg || theme.controlBg,
                    border: 'none',
                    borderRadius: 6,
                    padding: '8px 10px',
                    fontSize: 12,
                    color: theme.textPrimary,
                    outline: 'none',
                    resize: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
                <button
                  type="button"
                  onClick={() => setIsCreateTeamOpen(false)}
                  style={{
                    background: theme.controlBg,
                    border: 'none',
                    borderRadius: 6,
                    padding: '6px 14px',
                    fontSize: 12,
                    color: theme.textSecondary,
                    cursor: 'pointer',
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{
                    background: accentColor,
                    border: 'none',
                    borderRadius: 6,
                    padding: '6px 16px',
                    fontSize: 12,
                    fontWeight: 500,
                    color: accentContrastText,
                    cursor: 'pointer',
                  }}
                >
                  Criar Time
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
