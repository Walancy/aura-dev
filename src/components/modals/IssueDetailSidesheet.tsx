import React, { useState, useEffect, useMemo, useRef, useCallback, Component, ErrorInfo } from 'react';
import {
  X,
  Check,
  CheckCircle2,
  CircleDot,
  CircleSlash,
  PlusCircle,
  ArrowUpRight,
  ExternalLink,
  Copy,
  Sparkles,
  Pencil,
  Trash2,
  Plus,
  ListChecks,
  MessageSquare,
  Tag,
  Users,
  Milestone,
  GitBranch,
  GitPullRequest,
  ChevronDown,
  Bold,
  Italic,
  Code,
  Quote,
  List,
  Heading,
  Loader2,
  Lock,
  Globe,
  Send,
  AlertTriangle,
  Pin,
  MoreHorizontal,
  Bookmark,
  Settings,
  Columns3,
  Target,
  Bell,
  BellOff,
  ArrowRight,
  Heart,
  ChevronUp,
  Smile,
  Link2,
  FileCode2,
  ListFilter,
  User,
  ChevronRight,
  ListOrdered,
  AtSign,
  Reply,
  Paperclip,
  Undo,
  Search,
  ArrowLeft,
} from 'lucide-react';
import type { ProjectIssue, RepoCollaborator, SprintOption } from '../ProjectsSchedulerView';
import { renderMarkdownPreview } from '../../utils/markdown';
import { hexToRgba } from '../../utils/color';

export interface IssueDetailSidesheetProps {
  isOpen: boolean;
  isVisible?: boolean;
  issue: ProjectIssue | null;
  allProjectIssues?: ProjectIssue[];
  repoFullName?: string;
  isRepoPrivate?: boolean;
  collaborators?: RepoCollaborator[];
  availableSprints?: SprintOption[];
  theme: any;
  isEffectiveDark: boolean;
  accentColor: string;
  accentContrastText: string;
  currentUser?: { login: string; avatarUrl: string } | null;
  onClose: () => void;
  onUpdateIssue?: (
    updatedFields: Partial<ProjectIssue> & {
      rawLabels?: string[];
      state?: 'open' | 'closed';
      milestoneNumber?: number | null;
      assignees?: Array<{ name: string; avatarBg: string; initial: string; avatarUrl?: string }>;
    },
    issueToUpdate?: ProjectIssue
  ) => Promise<void> | void;
  onDeleteIssue?: (issue: ProjectIssue) => void;
  onCreateBranchForIssue?: (issue: ProjectIssue) => void;
  onAskAiAboutIssue?: (issue: ProjectIssue) => void;
  showToast?: (msg: string) => void;
}

interface IssueComment {
  id: number;
  user?: { login?: string; avatar_url?: string };
  created_at?: string;
  body?: string;
}

// Error Boundary específico para o Sidesheet para prevenir crash ou tela preta
class SidesheetErrorBoundary extends Component<
  { children: React.ReactNode; onClose: () => void; isEffectiveDark: boolean },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[IssueDetailSidesheet] Erro capturado pelo boundary:', error, errorInfo);
  }

  componentDidUpdate(prevProps: any) {
    if (prevProps.children !== this.props.children && this.state.hasError) {
      this.setState({ hasError: false, error: null });
    }
  }

  handleCloseAndReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onClose();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          onClick={this.handleCloseAndReset}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 99999,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: this.props.isEffectiveDark ? '#161616' : '#ffffff',
              borderRadius: 12,
              border: 'none',
              padding: '24px 22px',
              maxWidth: 480,
              width: '100%',
              boxShadow: '0 20px 48px rgba(0,0,0,0.6)',
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: 'rgba(239, 68, 68, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ef4444',
                }}
              >
                <AlertTriangle size={18} />
              </div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#ef4444' }}>
                Erro ao exibir detalhes da issue
              </h3>
            </div>
            <p style={{ margin: 0, fontSize: 12.5, color: this.props.isEffectiveDark ? '#a1a1aa' : '#52525b', lineHeight: 1.5 }}>
              Ocorreu uma falha ao renderizar os dados desta tarefa. Seus dados permanecem seguros.
            </p>
            <div
              style={{
                padding: '8px 12px',
                borderRadius: 6,
                background: this.props.isEffectiveDark ? '#0f0f0f' : '#f4f4f5',
                fontSize: 11,
                fontFamily: 'monospace',
                color: '#ef4444',
                overflowX: 'auto',
                maxHeight: 120,
                border: 'none',
              }}
            >
              {this.state.error?.message || 'Erro inesperado ao renderizar componente.'}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
              <button
                type="button"
                onClick={this.handleCloseAndReset}
                style={{
                  padding: '7px 16px',
                  background: '#ef4444',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Fechar Painel
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const IssueDetailSidesheetInner: React.FC<IssueDetailSidesheetProps> = ({
  isOpen,
  isVisible = true,
  issue: initialIssue,
  allProjectIssues = [],
  repoFullName,
  isRepoPrivate,
  collaborators = [],
  availableSprints = [],
  theme,
  isEffectiveDark,
  accentColor,
  accentContrastText,
  currentUser,
  onClose,
  onUpdateIssue: externalUpdateIssue,
  onDeleteIssue,
  onCreateBranchForIssue,
  onAskAiAboutIssue,
  showToast = (msg: string) => console.log(msg),
}) => {
  const [currentIssue, setCurrentIssue] = useState<ProjectIssue | null>(initialIssue);
  const [historyStack, setHistoryStack] = useState<ProjectIssue[]>([]);

  useEffect(() => {
    setCurrentIssue(initialIssue);
    setHistoryStack([]);
  }, [initialIssue?.id, initialIssue?.githubNumber]);

  const issue = currentIssue || initialIssue;

  const onUpdateIssue = useCallback(
    async (
      updatedFields: Partial<ProjectIssue> & {
        rawLabels?: string[];
        state?: 'open' | 'closed';
        milestoneNumber?: number | null;
        assignees?: Array<{ name: string; avatarBg: string; initial: string; avatarUrl?: string }>;
      }
    ) => {
      setCurrentIssue((prev) => (prev ? { ...prev, ...updatedFields } : null));
      return externalUpdateIssue?.(updatedFields, issue);
    },
    [externalUpdateIssue, issue]
  );

  // Design system tokens derivados do tema e accentColor
  // Cor de fundo para cards neutra DevFlow (#181818 / #161616 no dark / #f8fafc no light)
  const sysCardBg = isEffectiveDark
    ? (theme?.bgCardSecondary || theme?.cardBg || '#161616')
    : (theme?.bgCardSecondary || (theme?.cardBg && theme.cardBg !== '#ffffff' ? theme.cardBg : '#f8fafc'));
  const sysCardHeaderBg = isEffectiveDark
    ? 'rgba(255, 255, 255, 0.02)'
    : 'rgba(0, 0, 0, 0.02)';
  const sysBorder = (theme?.border && theme.border !== 'transparent')
    ? theme.border
    : (isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : '#e2e8f0');
  const sysBorderHover = (theme?.borderHover && theme.borderHover !== 'transparent')
    ? theme.borderHover
    : (isEffectiveDark ? 'rgba(255, 255, 255, 0.14)' : '#cbd5e1');
  const sysTextPrimary = theme?.textPrimary || (isEffectiveDark ? '#ffffff' : '#0f172a');
  const sysTextSecondary = theme?.textSecondary || (isEffectiveDark ? '#888888' : '#64748b');
  const sysTextMuted = theme?.textMuted || (isEffectiveDark ? '#555555' : '#94a3b8');
  const sysPopupBg = theme?.modalBg || (isEffectiveDark ? '#1a1a1a' : '#ffffff');
  const sysPopupBorder = theme?.modalBorder || (isEffectiveDark ? 'rgba(255, 255, 255, 0.1)' : '#e2e8f0');
  const sysPopupShadow = theme?.modalShadow || (isEffectiveDark ? '0 16px 36px rgba(0, 0, 0, 0.65)' : '0 16px 36px rgba(0, 0, 0, 0.12)');
  const sysHoverBg = isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)';
  const sysInputBg = isEffectiveDark ? '#121212' : '#f8fafc';

  // Local closing state for smooth exit animation
  const [isLocalClosing, setIsLocalClosing] = useState(false);

  const handleClose = useCallback(() => {
    if (isLocalClosing) return;
    setIsLocalClosing(true);
    setTimeout(() => {
      onClose();
    }, 280);
  }, [isLocalClosing, onClose]);

  // Title editing state
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');

  // Description editing state
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editedDescription, setEditedDescription] = useState('');
  const [descTab, setDescTab] = useState<'write' | 'preview'>('write');
  const [isDescMenuOpen, setIsDescMenuOpen] = useState(false);
  const descMenuRef = useRef<HTMLDivElement | null>(null);
  const [isEditHistoryOpen, setIsEditHistoryOpen] = useState(false);
  const editHistoryRef = useRef<HTMLDivElement | null>(null);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const reactionPickerRef = useRef<HTMLDivElement | null>(null);
  const [reactions, setReactions] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!isDescMenuOpen && !showReactionPicker && !isEditHistoryOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (descMenuRef.current && !descMenuRef.current.contains(e.target as Node)) {
        setIsDescMenuOpen(false);
      }
      if (reactionPickerRef.current && !reactionPickerRef.current.contains(e.target as Node)) {
        setShowReactionPicker(false);
      }
      if (editHistoryRef.current && !editHistoryRef.current.contains(e.target as Node)) {
        setIsEditHistoryOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isDescMenuOpen, showReactionPicker, isEditHistoryOpen]);

  // Sub-issue states
  const [newSubIssueTitle, setNewSubIssueTitle] = useState('');
  const [isAddingSubIssue, setIsAddingSubIssue] = useState(false);
  const [isSubIssuesCollapsed, setIsSubIssuesCollapsed] = useState(false);
  const [subIssuesFilter, setSubIssuesFilter] = useState<'all' | 'open'>('all');
  const [isSubIssuesFilterOpen, setIsSubIssuesFilterOpen] = useState(false);
  const subIssuesFilterRef = useRef<HTMLDivElement | null>(null);
  const [activeSubIssueMenuIdx, setActiveSubIssueMenuIdx] = useState<number | null>(null);
  const subIssueMenuRef = useRef<HTMLDivElement | null>(null);
  const commentFileInputRef = useRef<HTMLInputElement | null>(null);
  const contentScrollRef = useRef<HTMLDivElement | null>(null);

  // Split button dropdown popup states
  const [isSubIssueSplitOpen, setIsSubIssueSplitOpen] = useState(false);
  const subIssueSplitRef = useRef<HTMLDivElement | null>(null);
  const [isCloseSplitOpen, setIsCloseSplitOpen] = useState(false);
  const closeSplitRef = useRef<HTMLDivElement | null>(null);
  const [closeReason, setCloseReason] = useState<'completed' | 'not_planned' | 'duplicate'>('completed');
  const [closeSubView, setCloseSubView] = useState<'main' | 'duplicate'>('main');
  const [duplicateSearchQuery, setDuplicateSearchQuery] = useState('');
  const [repoIssues, setRepoIssues] = useState<Array<any>>([]);
  const [isLoadingRepoIssues, setIsLoadingRepoIssues] = useState(false);
  const [selectedDuplicateIssue, setSelectedDuplicateIssue] = useState<any | null>(null);

  useEffect(() => {
    if (!isSubIssuesFilterOpen && activeSubIssueMenuIdx === null && !isSubIssueSplitOpen && !isCloseSplitOpen) return;
    const handleSubIssueOutsideClick = (e: MouseEvent) => {
      if (subIssuesFilterRef.current && !subIssuesFilterRef.current.contains(e.target as Node)) {
        setIsSubIssuesFilterOpen(false);
      }
      if (subIssueMenuRef.current && !subIssueMenuRef.current.contains(e.target as Node)) {
        setActiveSubIssueMenuIdx(null);
      }
      if (subIssueSplitRef.current && !subIssueSplitRef.current.contains(e.target as Node)) {
        setIsSubIssueSplitOpen(false);
      }
      if (closeSplitRef.current && !closeSplitRef.current.contains(e.target as Node)) {
        setIsCloseSplitOpen(false);
        setCloseSubView('main');
      }
    };
    document.addEventListener('mousedown', handleSubIssueOutsideClick);
    return () => document.removeEventListener('mousedown', handleSubIssueOutsideClick);
  }, [isSubIssuesFilterOpen, activeSubIssueMenuIdx, isSubIssueSplitOpen, isCloseSplitOpen]);

  // Comments state
  const [comments, setComments] = useState<IssueComment[]>([]);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [newCommentText, setNewCommentText] = useState('');
  const [commentTab, setCommentTab] = useState<'write' | 'preview'>('write');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  // Sidebar popups & dropdowns
  const [activeSidebarPopup, setActiveSidebarPopup] = useState<
    'assignees' | 'labels' | 'type' | 'priority' | 'projects' | 'milestone' | 'relationships' | 'development' | null
  >(null);
  const [assigneeSearch, setAssigneeSearch] = useState('');
  const [labelSearch, setLabelSearch] = useState('');
  const [typeSearch, setTypeSearch] = useState('');
  const [prioritySearch, setPrioritySearch] = useState('');
  const [projectSearch, setProjectSearch] = useState('');
  const [milestoneSearch, setMilestoneSearch] = useState('');
  const [prSearch, setPrSearch] = useState('');

  const [isAssigneeDropdownOpen, setIsAssigneeDropdownOpen] = useState(false);
  const [isLabelDropdownOpen, setIsLabelDropdownOpen] = useState(false);
  const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<string>('No type');
  const [isPriorityDropdownOpen, setIsPriorityDropdownOpen] = useState(false);
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  const [isSprintDropdownOpen, setIsSprintDropdownOpen] = useState(false);
  const [isProjectCardExpanded, setIsProjectCardExpanded] = useState(true);
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [isSizeDropdownOpen, setIsSizeDropdownOpen] = useState(false);
  const [estimateValue, setEstimateValue] = useState<string>('');
  const [isSubscribed, setIsSubscribed] = useState(true);
  const [isConversationLocked, setIsConversationLocked] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);

  // Status saving state
  const [isSavingStatus, setIsSavingStatus] = useState(false);

  // Reset local state when issue changes
  useEffect(() => {
    if (issue) {
      setEditedTitle(issue.title || '');
      setEditedDescription(issue.description || '');
      setIsEditingTitle(false);
      setIsEditingDescription(false);
      setIsEditHistoryOpen(false);
      setNewCommentText('');
      setDescTab('write');
      setCommentTab('write');
      setIsLocalClosing(false);
      setIsMoreMenuOpen(false);
      setIsTypeDropdownOpen(false);
      setIsSizeDropdownOpen(false);
      setActiveSidebarPopup(null);
      setAssigneeSearch('');
      setLabelSearch('');
      setTypeSearch('');
      setPrioritySearch('');
      setProjectSearch('');
      setMilestoneSearch('');
      setPrSearch('');
      setComments([]);
      loadComments(issue);
    }
  }, [issue?.id]);

  // Close more menu on outside click
  useEffect(() => {
    if (!isMoreMenuOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-more-menu-container]')) {
        setIsMoreMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isMoreMenuOpen]);

  // Close sidebar popup on outside click
  useEffect(() => {
    if (!activeSidebarPopup) return;
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-sidebar-popup]') && !target.closest('[data-sidebar-trigger]')) {
        setActiveSidebarPopup(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [activeSidebarPopup]);

  // Keyboard shortcut: Escape closes sidesheet with animation
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (activeSidebarPopup) {
          setActiveSidebarPopup(null);
          return;
        }
        if (isMoreMenuOpen) {
          setIsMoreMenuOpen(false);
          return;
        }
        if (
          isAssigneeDropdownOpen ||
          isLabelDropdownOpen ||
          isTypeDropdownOpen ||
          isPriorityDropdownOpen ||
          isStatusDropdownOpen ||
          isSprintDropdownOpen ||
          isSizeDropdownOpen
        ) {
          setIsAssigneeDropdownOpen(false);
          setIsLabelDropdownOpen(false);
          setIsTypeDropdownOpen(false);
          setIsPriorityDropdownOpen(false);
          setIsStatusDropdownOpen(false);
          setIsSprintDropdownOpen(false);
          setIsSizeDropdownOpen(false);
          return;
        }
        if (isEditingTitle) {
          setIsEditingTitle(false);
          return;
        }
        if (isEditingDescription) {
          setIsEditingDescription(false);
          return;
        }
        if (isEditHistoryOpen) {
          setIsEditHistoryOpen(false);
          return;
        }
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isOpen,
    activeSidebarPopup,
    isMoreMenuOpen,
    isAssigneeDropdownOpen,
    isLabelDropdownOpen,
    isTypeDropdownOpen,
    isPriorityDropdownOpen,
    isStatusDropdownOpen,
    isSprintDropdownOpen,
    isSizeDropdownOpen,
    isEditingTitle,
    isEditingDescription,
    handleClose,
  ]);

  // Participants calculation from issue author, assignees, and commenters
  const participants = useMemo(() => {
    const map = new Map<string, { login: string; avatarUrl?: string; initial?: string }>();
    if (issue?.author) {
      map.set(issue.author, {
        login: issue.author,
        initial: issue.author.charAt(0).toUpperCase(),
      });
    }
    (issue?.assignees || []).forEach((a) => {
      if (a?.name) {
        map.set(a.name, {
          login: a.name,
          avatarUrl: a.avatarUrl,
          initial: a.initial || a.name.charAt(0).toUpperCase(),
        });
      }
    });
    comments.forEach((c) => {
      if (c?.user?.login) {
        map.set(c.user.login, {
          login: c.user.login,
          avatarUrl: c.user.avatar_url,
          initial: c.user.login.charAt(0).toUpperCase(),
        });
      }
    });
    return Array.from(map.values());
  }, [issue?.author, issue?.assignees, comments]);

  const loadComments = async (iss: ProjectIssue) => {
    if (!iss.githubNumber || !repoFullName) return;
    const parts = repoFullName.split('/');
    if (parts.length !== 2) return;
    const [owner, repo] = parts;
    setIsLoadingComments(true);
    try {
      const res = await window.electronAPI?.github?.fetchIssueComments?.(owner, repo, iss.githubNumber);
      if (res?.success && Array.isArray(res.comments)) {
        setComments(res.comments);
      }
    } catch {
      // Fallback
    } finally {
      setIsLoadingComments(false);
    }
  };

  const issueNumber = issue?.githubNumber != null ? String(issue.githubNumber) : String(issue?.id || '').replace('#', '');
  const isClosed = issue ? (issue.rawState === 'closed' || issue.status === 'Concluído') : false;

  // Sub-issues parser
  const subIssuesList = useMemo(() => {
    const items: Array<{
      index: number;
      lineIndex: number;
      text: string;
      completed: boolean;
      issueNumber?: number;
      linkedIssue?: ProjectIssue;
    }> = [];
    const seenNumbers = new Set<number>();
    const seenTitles = new Set<string>();

    if (issue?.description) {
      try {
        const lines = String(issue.description).split('\n');
        lines.forEach((line, idx) => {
          const match = line.match(/^(\s*[-*]\s*\[([ xX])\]\s+)(.+)$/);
          if (match) {
            const rawText = match[3].trim();
            const numMatch = rawText.match(/#(\d+)\b/);
            const childNum = numMatch ? parseInt(numMatch[1], 10) : undefined;
            if (childNum) seenNumbers.add(childNum);
            seenTitles.add(rawText.toLowerCase());

            let linked: ProjectIssue | undefined = undefined;
            if (childNum) {
              linked = (allProjectIssues || []).find((i) => i.githubNumber === childNum);
            }
            if (!linked) {
              const clean = rawText.replace(/#\d+\b/, '').trim();
              linked = (allProjectIssues || []).find(
                (i) => i.title.toLowerCase().trim() === clean.toLowerCase().trim()
              );
            }

            items.push({
              index: items.length,
              lineIndex: idx,
              completed: linked
                ? linked.status === 'Concluído' || linked.rawState === 'closed'
                : match[2].toLowerCase() === 'x',
              text: rawText,
              issueNumber: childNum || linked?.githubNumber,
              linkedIssue: linked,
            });
          }
        });
      } catch {
        // Fallback
      }
    }

    // Também inclui issues cujo parentIssueNumber aponta para esta issue
    if (issue?.githubNumber) {
      (allProjectIssues || []).forEach((other) => {
        if (
          other.parentIssueNumber === issue.githubNumber &&
          other.githubNumber &&
          !seenNumbers.has(other.githubNumber) &&
          !seenTitles.has(other.title.toLowerCase())
        ) {
          seenNumbers.add(other.githubNumber);
          items.push({
            index: items.length,
            lineIndex: -1,
            completed: other.status === 'Concluído' || other.rawState === 'closed',
            text: `#${other.githubNumber} ${other.title}`,
            issueNumber: other.githubNumber,
            linkedIssue: other,
          });
        }
      });
    }

    return items;
  }, [issue?.description, issue?.githubNumber, allProjectIssues]);

  const handleSelectSubIssue = (item: {
    text: string;
    completed: boolean;
    lineIndex?: number;
    issueNumber?: number;
    linkedIssue?: ProjectIssue;
  }) => {
    let target: ProjectIssue | undefined = item.linkedIssue;
    if (!target && item.issueNumber) {
      target = (allProjectIssues || []).find((i) => i.githubNumber === item.issueNumber);
    }
    if (!target) {
      const clean = item.text.replace(/#\d+\b/, '').trim() || item.text;
      target = (allProjectIssues || []).find(
        (i) => i.title.toLowerCase().trim() === clean.toLowerCase().trim()
      );
    }

    if (!target) {
      const issueNumMatch = item.text.match(/#(\d+)\b/);
      const childNum = item.issueNumber || (issueNumMatch ? parseInt(issueNumMatch[1], 10) : undefined);
      const cleanTitle = item.text.replace(/#\d+\b/, '').trim() || item.text;

      target = {
        id: childNum ? `#${childNum}` : `${issue.id}-sub-${item.lineIndex ?? Date.now()}`,
        projectId: issue.projectId,
        githubNumber: childNum,
        title: cleanTitle,
        description: `Parte de #${issue.githubNumber || issue.id.replace('#', '')} (${issue.title})`,
        dateStr: issue.dateStr,
        createdAtIso: issue.createdAtIso,
        durationDays: issue.durationDays,
        tag: issue.tag,
        tagColor: issue.tagColor,
        priority: issue.priority,
        priorityColor: issue.priorityColor,
        status: item.completed ? 'Concluído' : 'A Fazer',
        assignees: [],
        progress: item.completed ? 100 : 0,
        rawState: item.completed ? 'closed' : 'open',
        parentIssueNumber: issue.githubNumber,
      };
    } else {
      target = {
        ...target,
        parentIssueNumber: target.parentIssueNumber || issue.githubNumber,
      };
    }

    setHistoryStack((prev) => [...prev, issue]);
    setCurrentIssue(target);
    contentScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const parentFromIssue = useMemo(() => {
    if (historyStack.length > 0) return historyStack[historyStack.length - 1];
    if (issue?.parentIssueNumber) {
      return (allProjectIssues || []).find((i) => i.githubNumber === issue.parentIssueNumber) || null;
    }
    return null;
  }, [historyStack, issue?.parentIssueNumber, allProjectIssues]);

  const handleBackToParent = useCallback(() => {
    if (historyStack.length > 0) {
      setHistoryStack((prev) => {
        const copy = [...prev];
        const parent = copy.pop();
        if (parent) {
          setCurrentIssue(parent);
        }
        return copy;
      });
    } else if (parentFromIssue) {
      setCurrentIssue(parentFromIssue);
    }
    contentScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [historyStack, parentFromIssue]);

  const completedSubIssuesCount = subIssuesList.filter((s) => s.completed).length;
  const totalSubIssuesCount = subIssuesList.length;

  const displayedSubIssues = useMemo(() => {
    if (subIssuesFilter === 'open') {
      return subIssuesList.filter((item) => !item.completed);
    }
    return subIssuesList;
  }, [subIssuesList, subIssuesFilter]);

  const displayDescription = useMemo(() => {
    if (!issue?.description) return '';
    // Se a issue possui sub-tarefas na descrição, remove a seção para exibi-la exclusivamente no card dedicado de Sub-issues abaixo
    if (subIssuesList.length > 0) {
      return issue.description
        .replace(/(?:^|\n)#{1,4}\s+Sub-issues[\s\S]*?(?=(?:\n#{1,4}\s+)|$)/i, '')
        .trim();
    }
    return issue.description;
  }, [issue?.description, subIssuesList]);

  const handleToggleSubIssue = async (subIssue: { lineIndex: number; completed: boolean }) => {
    const lines = (issue.description || '').split('\n');
    const targetLine = lines[subIssue.lineIndex];
    if (!targetLine) return;

    const nextCheck = subIssue.completed ? ' ' : 'x';
    lines[subIssue.lineIndex] = targetLine.replace(/\[([ xX])\]/, `[${nextCheck}]`);
    const newDescription = lines.join('\n');

    setEditedDescription(newDescription);
    try {
      await onUpdateIssue?.({ description: newDescription });
      showToast(subIssue.completed ? 'Sub-tarefa desmarcada.' : 'Sub-tarefa concluída!');
    } catch (err: any) {
      showToast(err?.message || 'Erro ao atualizar sub-tarefa.');
    }
  };

  const handleRemoveSubIssue = async (subIssue: { lineIndex: number }) => {
    const lines = (issue.description || '').split('\n');
    lines.splice(subIssue.lineIndex, 1);
    const newDescription = lines.join('\n');
    setEditedDescription(newDescription);
    try {
      await onUpdateIssue?.({ description: newDescription });
      showToast('Sub-issue removida.');
    } catch (err: any) {
      showToast(err?.message || 'Erro ao remover sub-issue.');
    }
  };

  const handleAddSubIssue = async () => {
    if (!newSubIssueTitle.trim()) return;
    const itemLine = `- [ ] ${newSubIssueTitle.trim()}`;
    const desc = issue.description || '';
    const newDescription = desc ? `${desc}\n${itemLine}` : `### Sub-issues\n\n${itemLine}`;

    setEditedDescription(newDescription);
    setNewSubIssueTitle('');
    setIsAddingSubIssue(false);
    try {
      await onUpdateIssue?.({ description: newDescription });
      showToast('Sub-tarefa adicionada!');
    } catch (err: any) {
      showToast(err?.message || 'Erro ao adicionar sub-tarefa.');
    }
  };

  const handleSaveTitle = async () => {
    if (!editedTitle.trim() || editedTitle === issue.title) {
      setIsEditingTitle(false);
      return;
    }
    try {
      await onUpdateIssue?.({ title: editedTitle.trim() });
      setIsEditingTitle(false);
      showToast('Título atualizado.');
    } catch (err: any) {
      showToast(err?.message || 'Erro ao salvar título.');
    }
  };

  const handleSaveDescription = async () => {
    try {
      await onUpdateIssue?.({ description: editedDescription.trim() });
      setIsEditingDescription(false);
      showToast('Descrição atualizada.');
    } catch (err: any) {
      showToast(err?.message || 'Erro ao salvar descrição.');
    }
  };

  const handleToggleState = async () => {
    const nextState = isClosed ? 'open' : 'closed';
    const nextStatus = isClosed ? 'A Fazer' : 'Concluído';
    setIsSavingStatus(true);
    try {
      await onUpdateIssue?.({
        rawState: nextState,
        state: nextState,
        status: nextStatus,
      });
      showToast(nextState === 'open' ? 'Issue reaberta!' : 'Issue concluída!');
    } catch (err: any) {
      showToast(err?.message || 'Erro ao alternar status da issue.');
    } finally {
      setIsSavingStatus(false);
    }
  };

  const loadRepoIssuesForDuplicate = useCallback(async () => {
    if (!repoFullName) return;
    const parts = repoFullName.split('/');
    if (parts.length !== 2) return;
    const [owner, repo] = parts;
    setIsLoadingRepoIssues(true);
    try {
      const res = await window.electronAPI?.github?.fetchRepoIssues?.(owner, repo);
      if (res?.success && Array.isArray(res.issues)) {
        setRepoIssues(res.issues);
      }
    } catch (e) {
      console.error('Erro ao buscar issues do repo para duplicate:', e);
    } finally {
      setIsLoadingRepoIssues(false);
    }
  }, [repoFullName]);

  const handleCloseWithReason = async (reason: 'completed' | 'not_planned' | 'duplicate') => {
    setIsSavingStatus(true);
    setCloseReason(reason);
    try {
      if (reason === 'duplicate' && selectedDuplicateIssue && (issue.githubNumber || issue.number) && repoFullName) {
        const parts = repoFullName.split('/');
        if (parts.length === 2) {
          const [owner, repo] = parts;
          const targetNum = issue.githubNumber || issue.number;
          const dupComment = `Duplicate of #${selectedDuplicateIssue.number || selectedDuplicateIssue.githubNumber}`;
          await window.electronAPI?.github?.addIssueComment?.(owner, repo, targetNum, dupComment);
        }
      }
      await onUpdateIssue?.({
        rawState: 'closed',
        state: 'closed',
        status: 'Concluído',
        state_reason: reason === 'completed' ? 'completed' : 'not_planned',
      });
      if (reason === 'completed') showToast('Issue fechada como concluída!');
      else if (reason === 'not_planned') showToast('Issue fechada como não planejada.');
      else showToast(`Issue fechada como duplicada de #${selectedDuplicateIssue?.number || ''}!`);
    } catch (err: any) {
      showToast(err?.message || 'Erro ao fechar issue.');
    } finally {
      setIsSavingStatus(false);
      setIsCloseSplitOpen(false);
      setCloseSubView('main');
    }
  };

  const handleAddComment = async () => {
    if (!newCommentText.trim() || isSubmittingComment || !issue.githubNumber || !repoFullName) return;
    const parts = repoFullName.split('/');
    if (parts.length !== 2) return;
    const [owner, repo] = parts;

    setIsSubmittingComment(true);
    try {
      const res = await window.electronAPI?.github?.addIssueComment?.(owner, repo, issue.githubNumber, newCommentText.trim());
      if (res?.success && res.comment) {
        setComments((prev) => [...prev, res.comment]);
        setNewCommentText('');
        showToast('Comentário publicado com sucesso!');
      } else {
        throw new Error(res?.error || 'Erro ao enviar comentário.');
      }
    } catch (err: any) {
      showToast(err?.message || 'Erro ao enviar comentário no GitHub.');
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleInsertCommentMarkdown = (before: string, after: string = '') => {
    setNewCommentText((prev) => `${prev}${before}${after}`);
  };

  const handleCommentFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const name = file.name;
    handleInsertCommentMarkdown(`![${name}](${name})`);
    showToast(`Arquivo "${name}" inserido no comentário!`);
    e.target.value = '';
  };

  const handleCopyLink = () => {
    const url = issue.htmlUrl || (repoFullName ? `https://github.com/${repoFullName}/issues/${issueNumber}` : '');
    if (url) {
      navigator.clipboard?.writeText?.(url);
      showToast('Link da issue copiado para a área de transferência!');
    }
  };

  const handleOpenInBrowser = () => {
    const url = issue.htmlUrl || (repoFullName ? `https://github.com/${repoFullName}/issues/${issueNumber}` : '');
    if (url && window.electronAPI?.shell?.openExternal) {
      window.electronAPI.shell.openExternal(url);
    }
  };

  const handleInsertDescMarkdown = (before: string, after: string = '') => {
    setEditedDescription((prev) => `${prev}${before}${after}`);
  };

  const formatTimeAgo = (iso?: string) => {
    if (!iso) return 'recentemente';
    const timestamp = new Date(iso).getTime();
    if (Number.isNaN(timestamp)) return 'recentemente';
    const diff = Date.now() - timestamp;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'agora';
    if (mins < 60) return `${mins}m atrás`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h atrás`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d atrás`;
    const months = Math.floor(days / 30);
    return `${months}mês(es) atrás`;
  };

  const formatGitHubTimeAgo = (iso?: string) => {
    if (!iso) return 'recently';
    const timestamp = new Date(iso).getTime();
    if (Number.isNaN(timestamp)) return 'recently';
    const diff = Date.now() - timestamp;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    const weeks = Math.floor(days / 7);
    if (weeks < 4) return `${weeks}w ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}mo ago`;
    const years = Math.floor(days / 365);
    return `${years}y ago`;
  };

  const formatGitHubTimeAgoFull = (iso?: string) => {
    if (!iso) return '2 weeks ago';
    const timestamp = new Date(iso).getTime();
    if (Number.isNaN(timestamp)) return '2 weeks ago';
    const diff = Date.now() - timestamp;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins} minute${mins > 1 ? 's' : ''} ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
    const weeks = Math.floor(days / 7);
    if (weeks < 4) return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months} month${months > 1 ? 's' : ''} ago`;
    const years = Math.floor(days / 365);
    return `${years} year${years > 1 ? 's' : ''} ago`;
  };

  const handleQuoteReply = () => {
    const quote = (issue.description || '')
      .split('\n')
      .map((l) => `> ${l}`)
      .join('\n');
    setNewCommentText((prev) => (prev ? `${prev}\n\n${quote}\n\n` : `${quote}\n\n`));
    setTimeout(() => {
      const el = document.getElementById('issue-comment-textarea');
      if (el) {
        el.focus();
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  };

  const safeRenderMarkdown = (content: string) => {
    try {
      return renderMarkdownPreview(content, {
        textPrimary: sysTextPrimary,
        textSecondary: sysTextSecondary,
        textMuted: sysTextMuted,
        border: isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0',
        accentColor: accentColor || '#a855f7',
        isEffectiveDark: Boolean(isEffectiveDark),
        onToggleTask: (lineIndex, completed) => handleToggleSubIssue({ lineIndex, completed }),
      });
    } catch (err) {
      console.error('Erro ao renderizar markdown:', err);
      return (
        <div style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 13, color: sysTextPrimary }}>
          {content}
        </div>
      );
    }
  };

  const currentLabels = useMemo(() => {
    if (!issue) return [];
    const raw = Array.isArray(issue.rawLabels) && issue.rawLabels.length > 0 ? issue.rawLabels : issue.tag ? [issue.tag] : [];
    return raw.filter((l): l is string => typeof l === 'string' && Boolean(l.trim()));
  }, [issue?.rawLabels, issue?.tag]);

  const availableTags = ['Bug', 'Feature', 'Refactor', 'Docs', 'Test', 'Infra', 'UI/UX'];
  const priorityOptions: Array<{ key: 'Baixa' | 'Média' | 'Alta' | 'Urgente'; color: string; label: string }> = [
    { key: 'Baixa', color: '#10b981', label: 'Baixa' },
    { key: 'Média', color: '#3b82f6', label: 'Média' },
    { key: 'Alta', color: '#f59e0b', label: 'Alta' },
    { key: 'Urgente', color: '#ef4444', label: 'Urgente' },
  ];
  const statusOptions: Array<'A Fazer' | 'Em Progresso' | 'Concluído'> = ['A Fazer', 'Em Progresso', 'Concluído'];

  // Cores de superfície padrão DevFlow (sem bordas, baseadas no tema)
  const sidesheetBg = isEffectiveDark ? '#101010' : '#ffffff';
  const rightSidebarBg = isEffectiveDark ? '#141414' : '#f8fafc';
  const cardSurfaceBg = isEffectiveDark ? '#181818' : '#ffffff';
  const cardHeaderBg = isEffectiveDark ? '#1f1f1f' : '#f1f5f9';
  const controlElementBg = isEffectiveDark ? '#1e1e1e' : '#ffffff';
  const controlElementHoverBg = isEffectiveDark ? '#262626' : '#f1f5f9';
  const dropdownSurfaceBg = isEffectiveDark ? '#1e1e1e' : '#ffffff';
  const isClosing = isLocalClosing || !isOpen;

  if (!issue) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 99990,
        display: 'flex',
        justifyContent: 'flex-end',
        background: theme?.modalOverlay || 'rgba(0, 0, 0, 0.72)',
        backdropFilter: 'blur(6px)',
        animation: isClosing
          ? 'sidesheetOverlayFadeOut 0.26s cubic-bezier(0.16, 1, 0.3, 1) forwards'
          : 'sidesheetOverlayFadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        pointerEvents: isClosing ? 'none' : 'auto',
      }}
      onClick={isPinned ? undefined : handleClose}
    >
      {/* Sidesheet Container - Padrão DevFlow com Border Radius e Animação In/Out */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'clamp(820px, 72vw, 1120px)',
          maxWidth: '92vw',
          height: '100%',
          background: sidesheetBg,
          borderRadius: '16px 0 0 16px',
          border: 'none',
          boxShadow: isEffectiveDark ? '-16px 0 48px rgba(0, 0, 0, 0.8)' : '-12px 0 36px rgba(0, 0, 0, 0.14)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 99991,
          overflow: 'hidden',
          animation: isClosing
            ? 'sidesheetPanelSlideOut 0.26s cubic-bezier(0.16, 1, 0.3, 1) forwards'
            : 'sidesheetPanelSlideIn 0.32s cubic-bezier(0.16, 1, 0.3, 1) forwards',
          willChange: 'transform',
        }}
      >
        {/* ========================================================================= */}
        {/* TOP HEADER DA SIDESHEET (Alinhado perfeitamente com as 2 colunas abaixo)  */}
        {/* ========================================================================= */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 16,
            padding: '20px 20px 14px 24px',
            background: 'transparent',
            border: 'none',
            borderBottom: `1px solid ${sysBorder}`,
            flexShrink: 0,
          }}
        >
          {/* Lado Esquerdo do Header: Título + #ID + Lápis e Pills (Alinhado com a Coluna Esquerda) */}
          <div
            style={{
              flex: 1,
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            {/* Título com #ID e lápis inline */}
            <div>
              {isEditingTitle ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {Boolean(parentFromIssue) && (
                    <button
                      type="button"
                      onClick={handleBackToParent}
                      title={`Voltar para ${parentFromIssue.title || 'issue pai'} (#${parentFromIssue.githubNumber || ''})`}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        padding: '8px 12px',
                        background: isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
                        border: 'none',
                        borderRadius: 8,
                        color: theme?.textPrimary || '#fff',
                        cursor: 'pointer',
                        flexShrink: 0,
                      }}
                    >
                      <ArrowLeft size={16} />
                    </button>
                  )}
                  <input
                    type="text"
                    autoFocus
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveTitle();
                      if (e.key === 'Escape') setIsEditingTitle(false);
                    }}
                    style={{
                      flex: 1,
                      fontSize: 24,
                      fontWeight: 400,
                      background: isEffectiveDark ? '#1a1a1a' : '#f4f4f5',
                      color: theme?.textPrimary || '#fff',
                      border: 'none',
                      borderRadius: 8,
                      padding: '8px 14px',
                      outline: 'none',
                      fontFamily: 'inherit',
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleSaveTitle}
                    style={{
                      padding: '8px 16px',
                      background: accentColor,
                      color: accentContrastText,
                      border: 'none',
                      borderRadius: 7,
                      fontSize: 12.5,
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                  >
                    Salvar
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditingTitle(false)}
                    style={{
                      padding: '8px 14px',
                      background: isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)',
                      color: theme?.textSecondary || '#a1a1aa',
                      border: 'none',
                      borderRadius: 7,
                      fontSize: 12.5,
                      cursor: 'pointer',
                    }}
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '8px 12px',
                  }}
                >
                  {/* Botão de Voltar para a issue pai se estiver em uma sub-issue */}
                  {Boolean(parentFromIssue) && (
                    <button
                      type="button"
                      onClick={handleBackToParent}
                      title={`Voltar para ${parentFromIssue.title || 'issue pai'} (#${parentFromIssue.githubNumber || ''})`}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        padding: '6px 12px',
                        background: isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
                        border: `1px solid ${isEffectiveDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)'}`,
                        borderRadius: 8,
                        color: theme?.textPrimary || '#fff',
                        cursor: 'pointer',
                        fontSize: 13,
                        fontWeight: 500,
                        transition: 'all 0.15s ease',
                        flexShrink: 0,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = hexToRgba(accentColor, 0.18);
                        e.currentTarget.style.color = accentColor;
                        e.currentTarget.style.borderColor = accentColor;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';
                        e.currentTarget.style.color = theme?.textPrimary || '#fff';
                        e.currentTarget.style.borderColor = isEffectiveDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)';
                      }}
                    >
                      <ArrowLeft size={16} />
                      <span>Voltar</span>
                    </button>
                  )}

                  <span
                    style={{
                      margin: 0,
                      fontSize: 26,
                      fontWeight: 400,
                      color: theme?.textPrimary || '#fff',
                      lineHeight: 1.3,
                      letterSpacing: '-0.015em',
                      wordBreak: 'break-word',
                    }}
                  >
                    {issue.title || 'Sem título'}
                  </span>

                  {/* #ID estilo link sublinhado */}
                  <span
                    onClick={handleCopyLink}
                    title="Clique para copiar o link da issue"
                    style={{
                      fontSize: 26,
                      fontWeight: 400,
                      color: theme?.textSecondary || '#8b949e',
                      textDecoration: 'underline',
                      textUnderlineOffset: 4,
                      cursor: 'pointer',
                      userSelect: 'none',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    #{issueNumber}
                  </span>

                  {/* Botão de edição inline com ícone de lápis */}
                  <button
                    type="button"
                    onClick={() => {
                      setEditedTitle(issue.title || '');
                      setIsEditingTitle(true);
                    }}
                    title="Editar título"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 24,
                      height: 24,
                      padding: 0,
                      background: 'transparent',
                      border: 'none',
                      borderRadius: 4,
                      color: theme?.textSecondary || '#8b949e',
                      cursor: 'pointer',
                      opacity: 0.7,
                      transition: 'all 0.15s ease',
                      marginLeft: 2,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.opacity = '1';
                      e.currentTarget.style.color = theme?.textPrimary || '#fff';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.opacity = '0.7';
                      e.currentTarget.style.color = theme?.textSecondary || '#8b949e';
                    }}
                  >
                    <Pencil size={15} strokeWidth={1.8} />
                  </button>
                </div>
              )}
            </div>

            {/* Pills: Status, Sub-issues progress, Repo */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                flexWrap: 'wrap',
                marginTop: 2,
              }}
            >
              {/* Status Pill: (o) Open / Closed */}
              <button
                type="button"
                onClick={handleToggleState}
                disabled={isSavingStatus}
                title={`Status: ${isClosed ? 'Concluída / Fechada' : 'Aberta'}. Clique para alternar.`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '4px 11px',
                  borderRadius: 16,
                  background: isClosed ? '#8250df' : '#238636',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'opacity 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.88')}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
              >
                {isClosed ? <CheckCircle2 size={13} strokeWidth={2.5} /> : <CircleDot size={13} strokeWidth={2.5} />}
                <span>{isClosed ? 'Closed' : 'Open'}</span>
              </button>

              {/* Sub-issues progress pill (com anel circular de progresso em roxo) */}
              {totalSubIssuesCount > 0 && (
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 10px',
                    borderRadius: 16,
                    background: isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)',
                    border: 'none',
                    fontSize: 12,
                    fontWeight: 500,
                    color: isEffectiveDark ? '#e4e4e7' : '#24292f',
                  }}
                  title={`Sub-tarefas: ${completedSubIssuesCount} concluídas de ${totalSubIssuesCount}`}
                >
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 16 16"
                    style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}
                  >
                    <circle
                      cx="8"
                      cy="8"
                      r="6"
                      stroke={isEffectiveDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.15)'}
                      strokeWidth="2.2"
                      fill="none"
                    />
                    <circle
                      cx="8"
                      cy="8"
                      r="6"
                      stroke="#8957e5"
                      strokeWidth="2.2"
                      fill="none"
                      strokeDasharray={2 * Math.PI * 6}
                      strokeDashoffset={2 * Math.PI * 6 * (1 - (completedSubIssuesCount / totalSubIssuesCount))}
                      strokeLinecap="round"
                    />
                  </svg>
                  <span>{completedSubIssuesCount}/{totalSubIssuesCount} sub-issues</span>
                </div>
              )}

              {/* Repository Pill com ícone Bookmark e badge Private */}
              {repoFullName && (
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 10px',
                    borderRadius: 16,
                    background: isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)',
                    border: 'none',
                    fontSize: 12,
                    color: isEffectiveDark ? '#e4e4e7' : '#57606a',
                    maxWidth: 340,
                  }}
                  title={repoFullName}
                >
                  <Bookmark size={12} strokeWidth={2} style={{ flexShrink: 0, opacity: 0.8 }} />
                  <span
                    style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontWeight: 400,
                    }}
                  >
                    {repoFullName}
                  </span>
                  {isRepoPrivate && (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 500,
                        padding: '1px 6px',
                        borderRadius: 10,
                        background: isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
                        color: isEffectiveDark ? '#8b949e' : '#6e7681',
                        marginLeft: 2,
                      }}
                    >
                      Private
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Lado Direito do Header: Ações Rápidas (Alinhado com a Coluna Direita / Sidebar) */}
          <div
            style={{
              width: 290,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 4,
              paddingTop: 4,
            }}
          >
            {/* Copiar Link */}
            <button
              type="button"
              onClick={handleCopyLink}
              title="Copiar link da issue"
              style={{
                width: 30,
                height: 30,
                borderRadius: 7,
                background: 'transparent',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: theme?.textSecondary || '#8b949e',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = theme?.textPrimary || '#fff';
                e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = theme?.textSecondary || '#8b949e';
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <Copy size={16} strokeWidth={1.8} />
            </button>

            {/* Fixar Sidesheet (Pin) */}
            <button
              type="button"
              onClick={() => {
                setIsPinned((prev) => {
                  const next = !prev;
                  showToast(next ? 'Painel fixado (não fechará ao clicar fora)' : 'Painel desafixado');
                  return next;
                });
              }}
              title={isPinned ? 'Desafixar painel lateral' : 'Fixar painel lateral (não fechar ao clicar fora)'}
              style={{
                width: 30,
                height: 30,
                borderRadius: 7,
                background: isPinned
                  ? hexToRgba(accentColor, 0.18)
                  : 'transparent',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: isPinned ? accentColor : (theme?.textSecondary || '#8b949e'),
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                if (!isPinned) {
                  e.currentTarget.style.color = theme?.textPrimary || '#fff';
                  e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isPinned) {
                  e.currentTarget.style.color = theme?.textSecondary || '#8b949e';
                  e.currentTarget.style.background = 'transparent';
                }
              }}
            >
              <Pin size={16} strokeWidth={1.8} style={{ transform: isPinned ? 'rotate(45deg)' : 'none', transition: 'transform 0.15s ease' }} />
            </button>

            {/* Menu de Mais Opções (...) */}
            <div data-more-menu-container style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setIsMoreMenuOpen((prev) => !prev)}
                title="Mais opções"
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 7,
                  background: isMoreMenuOpen ? (isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)') : 'transparent',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: isMoreMenuOpen ? (theme?.textPrimary || '#fff') : (theme?.textSecondary || '#8b949e'),
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = theme?.textPrimary || '#fff';
                  e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';
                }}
                onMouseLeave={(e) => {
                  if (!isMoreMenuOpen) {
                    e.currentTarget.style.color = theme?.textSecondary || '#8b949e';
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                <MoreHorizontal size={17} strokeWidth={1.8} />
              </button>

              {/* Dropdown do Mais Opções */}
              {isMoreMenuOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: 6,
                    background: isEffectiveDark ? '#1e1e24' : '#ffffff',
                    borderRadius: 10,
                    border: 'none',
                    boxShadow: isEffectiveDark ? '0 10px 30px rgba(0,0,0,0.6)' : '0 10px 26px rgba(0,0,0,0.12)',
                    padding: 6,
                    minWidth: 200,
                    zIndex: 1000,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                  }}
                >
                  {onAskAiAboutIssue && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsMoreMenuOpen(false);
                        onAskAiAboutIssue(issue);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: 6,
                        background: 'transparent',
                        border: 'none',
                        color: theme?.textPrimary || '#fff',
                        fontSize: 12.5,
                        fontWeight: 500,
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = hexToRgba(accentColor, 0.12))}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <Sparkles size={14} color={accentColor} />
                      <span>Perguntar à IA</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setIsMoreMenuOpen(false);
                      handleOpenInBrowser();
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: 6,
                      background: 'transparent',
                      border: 'none',
                      color: theme?.textPrimary || '#fff',
                      fontSize: 12.5,
                      fontWeight: 500,
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = isEffectiveDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <ExternalLink size={14} color={theme?.textSecondary || '#a1a1aa'} />
                    <span>Abrir no GitHub</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsMoreMenuOpen(false);
                      handleCopyLink();
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: 6,
                      background: 'transparent',
                      border: 'none',
                      color: theme?.textPrimary || '#fff',
                      fontSize: 12.5,
                      fontWeight: 500,
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = isEffectiveDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <Copy size={14} color={theme?.textSecondary || '#a1a1aa'} />
                    <span>Copiar link da issue</span>
                  </button>

                  {onDeleteIssue && (
                    <>
                      <div style={{ height: 1, background: isEffectiveDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)', margin: '4px 0' }} />
                      <button
                        type="button"
                        onClick={() => {
                          setIsMoreMenuOpen(false);
                          onDeleteIssue(issue);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          width: '100%',
                          padding: '8px 10px',
                          borderRadius: 6,
                          background: 'transparent',
                          border: 'none',
                          color: '#ef4444',
                          fontSize: 12.5,
                          fontWeight: 500,
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <Trash2 size={14} color="#ef4444" />
                        <span>Excluir issue</span>
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Fechar Sidesheet (X) */}
            <button
              type="button"
              onClick={handleClose}
              title="Fechar painel lateral (Esc)"
              style={{
                width: 30,
                height: 30,
                borderRadius: 7,
                background: 'transparent',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: theme?.textSecondary || '#8b949e',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = theme?.textPrimary || '#fff';
                e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = theme?.textSecondary || '#8b949e';
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <X size={17} strokeWidth={1.8} />
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 3. LAYOUT DE 2 COLUNAS: ESQUERDA (CONTEÚDO) | DIREITA (METADADOS/SIDEBAR) */}
        {/* ========================================================================= */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            gap: 20,
            padding: '16px 20px 20px 24px',
            overflow: 'hidden',
            minHeight: 0,
          }}
        >
          {/* ======================================================================= */}
          {/* COLUNA ESQUERDA: DESCRIÇÃO, SUB-ISSUES, TIMELINE E COMENTÁRIOS          */}
          {/* ======================================================================= */}
          <div
            ref={contentScrollRef}
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '0 20px 16px 0',
              display: 'flex',
              flexDirection: 'column',
              gap: 20,
              background: 'transparent',
              border: 'none',
              borderRight: `1px solid ${sysBorder}`,
              minHeight: 0,
            }}
            className="no-scrollbar"
          >
            {/* 3.1 Card de Descrição Principal (Padrão DevFlow - sem borda, fundo levemente mais claro que a sidesheet) */}
            <div
              style={{
                borderRadius: 8,
                border: 'none',
                background: sysCardBg,
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {/* Header da Descrição */}
              <div
                style={{
                  padding: '10px 16px',
                  background: sysCardHeaderBg,
                  borderBottom: `1px solid ${sysBorder}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                }}
              >
                {/* Lado Esquerdo: Avatar + Walancy opened 2w ago */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <div
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      background: accentColor,
                      color: accentContrastText,
                      fontSize: 10.5,
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                      flexShrink: 0,
                    }}
                  >
                    {issue.authorAvatarUrl ? (
                      <img src={issue.authorAvatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      issue.author ? issue.author.charAt(0).toUpperCase() : 'W'
                    )}
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 600, color: sysTextPrimary, whiteSpace: 'nowrap' }}>
                    {issue.author || 'Walancy'}
                  </span>
                  <span style={{ fontSize: 13.5, fontWeight: 400, color: sysTextSecondary, whiteSpace: 'nowrap' }}>
                    opened {formatGitHubTimeAgo(issue.createdAtIso)}
                  </span>
                </div>

                {/* Lado Direito: Last edited by Walancy ▾ + Mais opções (...) */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  {/* Dropdown de Histórico de Edição */}
                  <div style={{ position: 'relative' }} ref={editHistoryRef}>
                    <button
                      type="button"
                      onClick={() => setIsEditHistoryOpen((v) => !v)}
                      style={{
                        background: isEditHistoryOpen
                          ? hexToRgba(accentColor, 0.12)
                          : sysHoverBg,
                        border: 'none',
                        borderRadius: 6,
                        padding: '3px 8px',
                        fontSize: 12.5,
                        fontWeight: 500,
                        color: isEditHistoryOpen
                          ? accentColor
                          : sysTextSecondary,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        transition: 'all 0.15s ease',
                        userSelect: 'none',
                      }}
                      onMouseEnter={(e) => {
                        if (!isEditHistoryOpen) {
                          e.currentTarget.style.background = hexToRgba(accentColor, 0.08);
                          e.currentTarget.style.color = accentColor;
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isEditHistoryOpen) {
                          e.currentTarget.style.background = sysHoverBg;
                          e.currentTarget.style.color = sysTextSecondary;
                        }
                      }}
                      title={issue.updatedAtIso ? `Última edição: ${new Date(issue.updatedAtIso).toLocaleString()}` : 'Última edição'}
                    >
                      <span>Last edited by {issue.author || 'Walancy'}</span>
                      <ChevronDown size={12} style={{ opacity: 0.8 }} />
                    </button>

                    {isEditHistoryOpen && (
                      <div
                        style={{
                          position: 'absolute',
                          top: 'calc(100% + 6px)',
                          right: 0,
                          zIndex: 110,
                          minWidth: 330,
                          background: sysPopupBg,
                          border: `1px solid ${sysPopupBorder}`,
                          borderRadius: 10,
                          boxShadow: sysPopupShadow,
                          padding: '12px 14px',
                          display: 'flex',
                          flexDirection: 'column',
                        }}
                      >
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: sysTextPrimary,
                            marginBottom: 12,
                          }}
                        >
                          Edited 1 time
                        </div>

                        {/* Evento 1: Mais recente */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            padding: '6px 6px',
                            borderRadius: 6,
                          }}
                        >
                          <div
                            style={{
                              width: 20,
                              height: 20,
                              borderRadius: '50%',
                              background: accentColor,
                              color: accentContrastText,
                              fontSize: 10,
                              fontWeight: 600,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              overflow: 'hidden',
                              flexShrink: 0,
                            }}
                          >
                            {issue.authorAvatarUrl || currentUser?.avatarUrl ? (
                              <img
                                src={issue.authorAvatarUrl || currentUser?.avatarUrl}
                                alt=""
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              />
                            ) : (
                              (issue.author || 'Walancy').charAt(0).toUpperCase()
                            )}
                          </div>
                          <span
                            style={{
                              fontSize: 13,
                              fontWeight: 600,
                              color: sysTextPrimary,
                            }}
                          >
                            {issue.author || 'Walancy'}
                          </span>
                          <span
                            style={{
                              fontSize: 13,
                              color: sysTextSecondary,
                            }}
                          >
                            {formatGitHubTimeAgoFull(issue.updatedAtIso || issue.createdAtIso)}
                          </span>
                          <span
                            style={{
                              marginLeft: 'auto',
                              padding: '2px 8px',
                              borderRadius: 12,
                              border: `1px solid ${hexToRgba(accentColor, 0.3)}`,
                              background: hexToRgba(accentColor, 0.08),
                              fontSize: 11,
                              fontWeight: 500,
                              color: accentColor,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            Most recent
                          </span>
                        </div>

                        {/* Evento 2: Criação */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            padding: '6px 6px',
                            borderRadius: 6,
                          }}
                        >
                          <div
                            style={{
                              width: 20,
                              height: 20,
                              borderRadius: '50%',
                              background: accentColor,
                              color: accentContrastText,
                              fontSize: 10,
                              fontWeight: 600,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              overflow: 'hidden',
                              flexShrink: 0,
                            }}
                          >
                            {issue.authorAvatarUrl ? (
                              <img
                                src={issue.authorAvatarUrl}
                                alt=""
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              />
                            ) : (
                              (issue.author || 'Walancy').charAt(0).toUpperCase()
                            )}
                          </div>
                          <span
                            style={{
                              fontSize: 13,
                              fontWeight: 600,
                              color: sysTextPrimary,
                            }}
                          >
                            {issue.author || 'Walancy'}
                          </span>
                          <span
                            style={{
                              fontSize: 13,
                              color: sysTextSecondary,
                            }}
                          >
                            created {formatGitHubTimeAgoFull(issue.createdAtIso)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Dropdown de 3 pontos */}
                  <div style={{ position: 'relative' }} ref={descMenuRef}>
                    <button
                      type="button"
                      onClick={() => setIsDescMenuOpen((v) => !v)}
                      title="Mais opções da descrição"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 28,
                        height: 28,
                        borderRadius: 6,
                        background: isDescMenuOpen
                          ? sysHoverBg
                          : 'transparent',
                        border: 'none',
                        color: isDescMenuOpen ? sysTextPrimary : sysTextSecondary,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        if (!isDescMenuOpen) {
                          e.currentTarget.style.background = sysHoverBg;
                          e.currentTarget.style.color = sysTextPrimary;
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isDescMenuOpen) {
                          e.currentTarget.style.background = 'transparent';
                          e.currentTarget.style.color = sysTextSecondary;
                        }
                      }}
                    >
                      <MoreHorizontal size={16} />
                    </button>

                    {isDescMenuOpen && (
                      <div
                        style={{
                          position: 'absolute',
                          top: 'calc(100% + 4px)',
                          right: 0,
                          zIndex: 100,
                          minWidth: 175,
                          background: sysPopupBg,
                          border: `1px solid ${sysPopupBorder}`,
                          borderRadius: 8,
                          boxShadow: sysPopupShadow,
                          padding: '4px 0',
                          display: 'flex',
                          flexDirection: 'column',
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setIsDescMenuOpen(false);
                            handleCopyLink();
                          }}
                          style={{
                            width: '100%',
                            padding: '7px 14px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            fontSize: 13,
                            color: sysTextPrimary,
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            textAlign: 'left',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = sysHoverBg)}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        >
                          <Link2 size={14} style={{ opacity: 0.8 }} />
                          <span>Copy link</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setIsDescMenuOpen(false);
                            navigator.clipboard?.writeText?.(issue.description || '');
                            showToast('Markdown da descrição copiado!');
                          }}
                          style={{
                            width: '100%',
                            padding: '7px 14px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            fontSize: 13,
                            color: sysTextPrimary,
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            textAlign: 'left',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = sysHoverBg)}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        >
                          <FileCode2 size={14} style={{ opacity: 0.8 }} />
                          <span>Copy Markdown</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setIsDescMenuOpen(false);
                            handleQuoteReply();
                          }}
                          style={{
                            width: '100%',
                            padding: '7px 14px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            fontSize: 13,
                            color: sysTextPrimary,
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            textAlign: 'left',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = sysHoverBg)}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        >
                          <Quote size={14} style={{ opacity: 0.8 }} />
                          <span>Quote reply</span>
                        </button>

                        <div
                          style={{
                            height: 1,
                            background: sysBorder,
                            margin: '4px 0',
                          }}
                        />

                        <button
                          type="button"
                          onClick={() => {
                            setIsDescMenuOpen(false);
                            setEditedDescription(issue.description || '');
                            setIsEditingDescription(true);
                            setDescTab('write');
                          }}
                          style={{
                            width: '100%',
                            padding: '7px 14px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            fontSize: 13,
                            color: sysTextPrimary,
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            textAlign: 'left',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = sysHoverBg)}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        >
                          <Pencil size={14} style={{ opacity: 0.8 }} />
                          <span>Edit</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Corpo da Descrição */}
              {isEditingDescription ? (
                <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {/* Abas e Ferramentas Markdown */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 6 }}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button
                        type="button"
                        onClick={() => setDescTab('write')}
                        style={{
                          padding: '5px 12px',
                          borderRadius: 6,
                          background: descTab === 'write' ? (isEffectiveDark ? '#262626' : '#e2e8f0') : 'transparent',
                          border: 'none',
                          color: descTab === 'write' ? (theme?.textPrimary || '#fff') : (theme?.textSecondary || '#a1a1aa'),
                          fontSize: 12,
                          fontWeight: 500,
                          cursor: 'pointer',
                        }}
                      >
                        Escrever
                      </button>
                      <button
                        type="button"
                        onClick={() => setDescTab('preview')}
                        style={{
                          padding: '5px 12px',
                          borderRadius: 6,
                          background: descTab === 'preview' ? (isEffectiveDark ? '#262626' : '#e2e8f0') : 'transparent',
                          border: 'none',
                          color: descTab === 'preview' ? (theme?.textPrimary || '#fff') : (theme?.textSecondary || '#a1a1aa'),
                          fontSize: 12,
                          fontWeight: 500,
                          cursor: 'pointer',
                        }}
                      >
                        Visualizar
                      </button>
                    </div>

                    {descTab === 'write' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        {[
                          { icon: <Heading size={13} />, action: () => handleInsertDescMarkdown('### ') },
                          { icon: <Bold size={13} />, action: () => handleInsertDescMarkdown('**', '**') },
                          { icon: <Italic size={13} />, action: () => handleInsertDescMarkdown('*', '*') },
                          { icon: <Code size={13} />, action: () => handleInsertDescMarkdown('`', '`') },
                          { icon: <Quote size={13} />, action: () => handleInsertDescMarkdown('> ') },
                          { icon: <List size={13} />, action: () => handleInsertDescMarkdown('- ') },
                          { icon: <ListChecks size={13} />, action: () => handleInsertDescMarkdown('- [ ] ') },
                        ].map((btn, bIdx) => (
                          <button
                            key={bIdx}
                            type="button"
                            onClick={btn.action}
                            style={{
                              width: 24,
                              height: 24,
                              background: 'transparent',
                              border: 'none',
                              color: theme?.textSecondary || '#a1a1aa',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderRadius: 4,
                            }}
                          >
                            {btn.icon}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {descTab === 'write' ? (
                    <textarea
                      rows={11}
                      value={editedDescription}
                      onChange={(e) => setEditedDescription(e.target.value)}
                      placeholder="Descreva esta tarefa detalhadamente usando Markdown..."
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        background: sysInputBg,
                        border: 'none',
                        borderRadius: 8,
                        padding: 12,
                        color: sysTextPrimary,
                        fontSize: 13,
                        lineHeight: 1.5,
                        fontFamily: 'inherit',
                        outline: 'none',
                        resize: 'vertical',
                        minHeight: 220,
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        padding: '8px 4px',
                        minHeight: 220,
                        maxHeight: 400,
                        overflowY: 'auto',
                        scrollbarWidth: 'thin',
                        scrollbarColor: isEffectiveDark ? 'rgba(255,255,255,0.18) transparent' : 'rgba(0,0,0,0.18) transparent',
                      }}
                    >
                      {safeRenderMarkdown(editedDescription)}
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                    <button
                      type="button"
                      onClick={() => setIsEditingDescription(false)}
                      style={{
                        padding: '6px 14px',
                        background: isEffectiveDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                        border: 'none',
                        borderRadius: 6,
                        color: theme?.textSecondary || '#a1a1aa',
                        fontSize: 12,
                        cursor: 'pointer',
                      }}
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveDescription}
                      style={{
                        padding: '6px 16px',
                        background: accentColor,
                        border: 'none',
                        borderRadius: 6,
                        color: accentContrastText,
                        fontSize: 12,
                        fontWeight: 500,
                        cursor: 'pointer',
                      }}
                    >
                      Salvar descrição
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    padding: '16px 18px 14px 18px',
                    fontSize: 14,
                    lineHeight: 1.6,
                    color: sysTextPrimary,
                    display: 'flex',
                    flexDirection: 'column',
                    minHeight: 240,
                  }}
                >
                  {/* Container de descrição com rolagem vertical e altura maior */}
                  <div
                    style={{
                      flex: 1,
                      minHeight: 160,
                      maxHeight: 380,
                      overflowY: 'auto',
                      paddingRight: 6,
                      scrollbarWidth: 'thin',
                      scrollbarColor: isEffectiveDark ? 'rgba(255,255,255,0.18) transparent' : 'rgba(0,0,0,0.18) transparent',
                    }}
                  >
                    {displayDescription ? (
                      safeRenderMarkdown(displayDescription)
                    ) : (
                      <div style={{ color: theme?.textSecondary || '#a1a1aa', fontStyle: 'italic', fontSize: 13 }}>
                        Nenhuma descrição fornecida para esta tarefa.
                      </div>
                    )}
                  </div>

                  {/* Barra inferior de reações com botão de Smile estilo GitHub */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      marginTop: 14,
                      paddingTop: 10,
                      borderTop: `1px solid ${isEffectiveDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)'}`,
                      position: 'relative',
                      flexShrink: 0,
                    }}
                    ref={reactionPickerRef}
                  >
                    <button
                      type="button"
                      onClick={() => setShowReactionPicker((v) => !v)}
                      title="Adicionar reação"
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        background: showReactionPicker
                          ? (isEffectiveDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)')
                          : (isEffectiveDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'),
                        border: `1px solid ${isEffectiveDark ? 'rgba(255, 255, 255, 0.1)' : '#d0d7de'}`,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: sysTextSecondary,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = isEffectiveDark ? 'rgba(255, 255, 255, 0.22)' : '#afb8c1';
                        e.currentTarget.style.color = sysTextPrimary;
                      }}
                      onMouseLeave={(e) => {
                        if (!showReactionPicker) {
                          e.currentTarget.style.borderColor = isEffectiveDark ? 'rgba(255, 255, 255, 0.1)' : '#d0d7de';
                          e.currentTarget.style.color = sysTextSecondary;
                        }
                      }}
                    >
                      <Smile size={15} />
                    </button>

                    {/* Pílulas de Reações ativas */}
                    {Object.entries(reactions).map(([emoji, count]) => {
                      if (count <= 0) return null;
                      return (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => {
                            setReactions((prev) => ({
                              ...prev,
                              [emoji]: Math.max(0, (prev[emoji] || 0) - 1),
                            }));
                          }}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            padding: '3px 9px',
                            borderRadius: 16,
                            background: isEffectiveDark ? 'rgba(255, 255, 255, 0.04)' : '#f4f4f5',
                            border: `1px solid ${sysBorder}`,
                            fontSize: 12,
                            color: sysTextPrimary,
                            cursor: 'pointer',
                          }}
                        >
                          <span>{emoji}</span>
                          <span style={{ fontWeight: 500, fontSize: 11.5 }}>{count}</span>
                        </button>
                      );
                    })}

                    {/* Picker de Emojis */}
                    {showReactionPicker && (
                      <div
                        style={{
                          position: 'absolute',
                          top: 'calc(100% + 6px)',
                          left: 0,
                          zIndex: 100,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '5px 8px',
                          background: sysPopupBg,
                          border: `1px solid ${sysPopupBorder}`,
                          borderRadius: 24,
                          boxShadow: sysPopupShadow,
                        }}
                      >
                        {['👍', '👎', '😄', '🎉', '❤️', '🚀', '👀'].map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => {
                              setReactions((prev) => ({
                                ...prev,
                                [emoji]: (prev[emoji] || 0) + 1,
                              }));
                              setShowReactionPicker(false);
                            }}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              fontSize: 16,
                              padding: '4px 6px',
                              borderRadius: 6,
                              cursor: 'pointer',
                              transition: 'transform 0.12s ease',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.25)')}
                            onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* 3.2 Card Dedicado de Sub-issues (Padrão DevFlow - sem borda, fundo levemente mais claro que a sidesheet) */}
            <div
              style={{
                borderRadius: 8,
                border: 'none',
                background: sysCardBg,
                position: 'relative',
                zIndex: isSubIssueSplitOpen ? 50 : 1,
              }}
            >
              {/* Header de Sub-issues */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 16px',
                  background: sysCardHeaderBg,
                  borderRadius: isSubIssuesCollapsed ? 8 : '8px 8px 0 0',
                  borderBottom: isSubIssuesCollapsed ? 'none' : `1px solid ${sysBorder}`,
                }}
              >
                {/* Lado Esquerdo: Chevron + Título "Sub-issues" + Badge de Progresso */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setIsSubIssuesCollapsed((prev) => !prev)}
                    title={isSubIssuesCollapsed ? 'Expandir sub-issues' : 'Recolher sub-issues'}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      background: 'transparent',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                      color: sysTextPrimary,
                    }}
                  >
                    <ChevronDown
                      size={14}
                      style={{
                        transform: isSubIssuesCollapsed ? 'rotate(-90deg)' : 'none',
                        transition: 'transform 0.15s ease',
                        color: sysTextSecondary,
                      }}
                    />
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: sysTextPrimary }}>
                      Sub-issues
                    </span>
                  </button>

                  {/* Badge de Progresso (ex: 8 of 9) */}
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      padding: '2px 8px',
                      borderRadius: 12,
                      background: isEffectiveDark ? 'rgba(255, 255, 255, 0.04)' : '#f4f4f5',
                      fontSize: 12,
                      color: sysTextSecondary,
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 16 16" style={{ transform: 'rotate(-90deg)' }}>
                      <circle
                        cx="8"
                        cy="8"
                        r="6"
                        stroke={isEffectiveDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.15)'}
                        strokeWidth="2.2"
                        fill="none"
                      />
                      <circle
                        cx="8"
                        cy="8"
                        r="6"
                        stroke={accentColor}
                        strokeWidth="2.2"
                        fill="none"
                        strokeDasharray={2 * Math.PI * 6}
                        strokeDashoffset={2 * Math.PI * 6 * (1 - (totalSubIssuesCount > 0 ? completedSubIssuesCount / totalSubIssuesCount : 0))}
                        strokeLinecap="round"
                      />
                    </svg>
                    <span style={{ fontSize: 11.5, fontWeight: 500 }}>
                      {completedSubIssuesCount} of {totalSubIssuesCount}
                    </span>
                  </div>
                </div>

                {/* Lado Direito: Botão de Filtro com Dropdown */}
                <div style={{ position: 'relative' }} ref={subIssuesFilterRef}>
                  <button
                    type="button"
                    onClick={() => setIsSubIssuesFilterOpen((prev) => !prev)}
                    title="Filtrar sub-issues"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 28,
                      height: 28,
                      borderRadius: 6,
                      background: isSubIssuesFilterOpen
                        ? sysHoverBg
                        : 'transparent',
                      border: 'none',
                      color: isSubIssuesFilterOpen ? sysTextPrimary : sysTextSecondary,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSubIssuesFilterOpen) {
                        e.currentTarget.style.background = sysHoverBg;
                        e.currentTarget.style.color = sysTextPrimary;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSubIssuesFilterOpen) {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = sysTextSecondary;
                      }
                    }}
                  >
                    <ListFilter size={15} />
                  </button>

                  {/* Dropdown de Filtro (Issues to include) */}
                  {isSubIssuesFilterOpen && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 'calc(100% + 4px)',
                        right: 0,
                        zIndex: 60,
                        minWidth: 175,
                        background: sysPopupBg,
                        border: `1px solid ${sysPopupBorder}`,
                        borderRadius: 8,
                        boxShadow: sysPopupShadow,
                        padding: '6px 0',
                        display: 'flex',
                        flexDirection: 'column',
                      }}
                    >
                      <div
                        style={{
                          padding: '6px 14px',
                          fontSize: 12,
                          fontWeight: 600,
                          color: sysTextSecondary,
                        }}
                      >
                        Issues to include
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSubIssuesFilter('all');
                          setIsSubIssuesFilterOpen(false);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '6px 14px',
                          fontSize: 13,
                          color: sysTextPrimary,
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = sysHoverBg)}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <div style={{ width: 14, display: 'flex', alignItems: 'center' }}>
                          {subIssuesFilter === 'all' && <Check size={14} />}
                        </div>
                        <span>Open and closed</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setSubIssuesFilter('open');
                          setIsSubIssuesFilterOpen(false);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '6px 14px',
                          fontSize: 13,
                          color: sysTextPrimary,
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = sysHoverBg)}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <div style={{ width: 14, display: 'flex', alignItems: 'center' }}>
                          {subIssuesFilter === 'open' && <Check size={14} />}
                        </div>
                        <span>Open only</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Lista de Sub-issues (quando não colapsado) */}
              {!isSubIssuesCollapsed && (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {displayedSubIssues.length === 0 ? (
                    <div
                      style={{
                        padding: '14px 16px',
                        borderBottom: `1px solid ${sysBorder}`,
                        fontSize: 13,
                        color: sysTextSecondary,
                        textAlign: 'center',
                      }}
                    >
                      {subIssuesFilter === 'open'
                        ? 'Nenhuma sub-issue aberta encontrada.'
                        : 'Nenhuma sub-issue adicionada a esta issue ainda.'}
                    </div>
                  ) : (
                    displayedSubIssues.map((item) => {
                      const issueNumMatch = item.text.match(/(#\d+)\b/);
                      const issueNum = issueNumMatch ? issueNumMatch[1] : null;
                      const cleanTitle = issueNumMatch
                        ? item.text.replace(issueNumMatch[1], '').trim()
                        : item.text;

                      return (
                        <div
                          key={item.index}
                          onClick={() => handleSelectSubIssue(item)}
                          title="Clique para ver os detalhes da sub-issue"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 12,
                            padding: '9px 16px',
                            borderBottom: `1px solid ${sysBorder}`,
                            transition: 'background 0.12s ease',
                            position: 'relative',
                            cursor: 'pointer',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = isEffectiveDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        >
                          {/* Lado Esquerdo: Ícone de Status + Título + #ID */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                            {/* Botão de Status (Círculo Verde ou Check Roxo) */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleSubIssue(item);
                              }}
                              title={item.completed ? 'Marcar como aberta' : 'Marcar como concluída'}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: 'transparent',
                                border: 'none',
                                padding: 0,
                                cursor: 'pointer',
                                flexShrink: 0,
                              }}
                            >
                              {item.completed ? (
                                <CheckCircle2 size={16} color="#8957e5" strokeWidth={2.2} />
                              ) : (
                                <CircleDot size={16} color="#3fb950" strokeWidth={2.2} />
                              )}
                            </button>

                            {/* Título da sub-issue */}
                            <div
                              style={{
                                fontSize: 13.5,
                                fontWeight: 500,
                                color: isEffectiveDark ? '#e6edf3' : '#1f2328',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                flex: 1,
                                minWidth: 0,
                              }}
                            >
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {cleanTitle}
                              </span>
                              {issueNum && (
                                <span
                                  style={{
                                    color: isEffectiveDark ? '#8b949e' : '#656d76',
                                    fontWeight: 400,
                                    flexShrink: 0,
                                  }}
                                >
                                  {issueNum}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Lado Direito: Placeholder de Assignee + Mais opções (...) */}
                          <div
                            style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {/* Avatar placeholder de responsável */}
                            <div
                              title="Sem responsável atribuído"
                              style={{
                                width: 20,
                                height: 20,
                                borderRadius: '50%',
                                border: `1px solid ${isEffectiveDark ? 'rgba(255, 255, 255, 0.1)' : '#d0d7de'}`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyCenter: 'center',
                                color: sysTextSecondary,
                              }}
                            >
                              <User size={12} strokeWidth={1.8} />
                            </div>

                            {/* Botão de mais opções (...) */}
                            <div style={{ position: 'relative' }}>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveSubIssueMenuIdx(activeSubIssueMenuIdx === item.index ? null : item.index);
                                }}
                                title="Opções da sub-issue"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  width: 24,
                                  height: 24,
                                  borderRadius: 4,
                                  background: 'transparent',
                                  border: 'none',
                                  color: sysTextSecondary,
                                  cursor: 'pointer',
                                }}
                              >
                                <MoreHorizontal size={15} />
                              </button>

                              {/* Menu de Ações da Sub-issue */}
                              {activeSubIssueMenuIdx === item.index && (
                                <div
                                  ref={subIssueMenuRef}
                                  style={{
                                    position: 'absolute',
                                    top: 'calc(100% + 4px)',
                                    right: 0,
                                    zIndex: 70,
                                    minWidth: 170,
                                    background: sysPopupBg,
                                    border: `1px solid ${sysPopupBorder}`,
                                    borderRadius: 8,
                                    boxShadow: sysPopupShadow,
                                    padding: '4px 0',
                                    display: 'flex',
                                    flexDirection: 'column',
                                  }}
                                >
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveSubIssueMenuIdx(null);
                                      handleSelectSubIssue(item);
                                    }}
                                    style={{
                                      padding: '6px 12px',
                                      fontSize: 12.5,
                                      color: sysTextPrimary,
                                      background: 'transparent',
                                      border: 'none',
                                      cursor: 'pointer',
                                      textAlign: 'left',
                                    }}
                                    onMouseEnter={(e) => (e.currentTarget.style.background = sysHoverBg)}
                                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                                  >
                                    Abrir detalhes da sub-issue
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveSubIssueMenuIdx(null);
                                      handleToggleSubIssue(item);
                                    }}
                                    style={{
                                      padding: '6px 12px',
                                      fontSize: 12.5,
                                      color: sysTextPrimary,
                                      background: 'transparent',
                                      border: 'none',
                                      cursor: 'pointer',
                                      textAlign: 'left',
                                    }}
                                    onMouseEnter={(e) => (e.currentTarget.style.background = sysHoverBg)}
                                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                                  >
                                    {item.completed ? 'Reabrir sub-issue' : 'Concluir sub-issue'}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveSubIssueMenuIdx(null);
                                      navigator.clipboard?.writeText?.(item.text);
                                      showToast('Título da sub-issue copiado!');
                                    }}
                                    style={{
                                      padding: '6px 12px',
                                      fontSize: 12.5,
                                      color: sysTextPrimary,
                                      background: 'transparent',
                                      border: 'none',
                                      cursor: 'pointer',
                                      textAlign: 'left',
                                    }}
                                    onMouseEnter={(e) => (e.currentTarget.style.background = sysHoverBg)}
                                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                                  >
                                    Copiar título
                                  </button>

                                  <div style={{ height: 1, background: isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : '#d0d7de', margin: '4px 0' }} />

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveSubIssueMenuIdx(null);
                                      handleRemoveSubIssue(item);
                                    }}
                                    style={{
                                      padding: '6px 12px',
                                      fontSize: 12.5,
                                      color: '#f85149',
                                      background: 'transparent',
                                      border: 'none',
                                      cursor: 'pointer',
                                      textAlign: 'left',
                                    }}
                                    onMouseEnter={(e) => (e.currentTarget.style.background = sysHoverBg)}
                                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                                  >
                                    Remover sub-issue
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}

                  {/* Footer com Botão "Create sub-issue" Split Button */}
                  <div
                    style={{
                      padding: '8px 16px',
                      borderTop: `1px solid ${sysBorder}`,
                      background: sysCardHeaderBg,
                      borderRadius: '0 0 8px 8px',
                    }}
                  >
                    {isAddingSubIssue ? (
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input
                          type="text"
                          autoFocus
                          value={newSubIssueTitle}
                          onChange={(e) => setNewSubIssueTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleAddSubIssue();
                            if (e.key === 'Escape') setIsAddingSubIssue(false);
                          }}
                          placeholder="Adicionar título da sub-issue (Pressione Enter para salvar)..."
                          style={{
                            flex: 1,
                            padding: '6px 10px',
                            borderRadius: 6,
                            border: `1px solid ${sysBorder}`,
                            background: sysInputBg,
                            color: sysTextPrimary,
                            fontSize: 13,
                            outline: 'none',
                          }}
                          onFocus={(e) => (e.currentTarget.style.borderColor = accentColor)}
                          onBlur={(e) => (e.currentTarget.style.borderColor = sysBorder)}
                        />
                        <button
                          type="button"
                          onClick={handleAddSubIssue}
                          style={{
                            padding: '6px 14px',
                            background: accentColor,
                            border: 'none',
                            borderRadius: 6,
                            color: accentContrastText,
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          Adicionar
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsAddingSubIssue(false)}
                          style={{
                            padding: '6px 10px',
                            background: sysHoverBg,
                            border: 'none',
                            borderRadius: 6,
                            color: sysTextSecondary,
                            fontSize: 12,
                            cursor: 'pointer',
                          }}
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <div style={{ position: 'relative', zIndex: isSubIssueSplitOpen ? 100 : 1 }} ref={subIssueSplitRef}>
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'stretch',
                            height: 28,
                            borderRadius: 6,
                            overflow: 'hidden',
                            border: `1px solid ${sysBorder}`,
                            background: isEffectiveDark ? 'rgba(255, 255, 255, 0.04)' : '#f8fafc',
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => setIsAddingSubIssue(true)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 5,
                              padding: '0 10px',
                              background: 'transparent',
                              border: 'none',
                              color: sysTextPrimary,
                              fontSize: 12,
                              fontWeight: 500,
                              cursor: 'pointer',
                              transition: 'background 0.12s ease',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                          >
                            <span>Create sub-issue</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsSubIssueSplitOpen((v) => !v)}
                            title="More sub-issue options"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              padding: '0 7px',
                              background: isSubIssueSplitOpen ? (isEffectiveDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)') : 'transparent',
                              border: 'none',
                              borderLeft: `1px solid ${sysBorder}`,
                              color: sysTextSecondary,
                              cursor: 'pointer',
                              transition: 'background 0.12s ease',
                            }}
                            onMouseEnter={(e) => {
                              if (!isSubIssueSplitOpen) e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)';
                            }}
                            onMouseLeave={(e) => {
                              if (!isSubIssueSplitOpen) e.currentTarget.style.background = 'transparent';
                            }}
                          >
                            <ChevronDown size={12} />
                          </button>
                        </div>

                        {/* Sub-issue Split Menu Popup */}
                        {isSubIssueSplitOpen && (
                          <div
                            style={{
                              position: 'absolute',
                              bottom: 'calc(100% + 6px)',
                              left: 0,
                              width: 250,
                              background: sysPopupBg,
                              border: `1px solid ${sysPopupBorder}`,
                              borderRadius: 8,
                              boxShadow: sysPopupShadow,
                              zIndex: 1050,
                              padding: '4px',
                              display: 'flex',
                              flexDirection: 'column',
                            }}
                          >
                            {/* Option 1: Create sub-issue */}
                            <button
                              type="button"
                              onClick={() => {
                                setIsSubIssueSplitOpen(false);
                                setIsAddingSubIssue(true);
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '7px 10px',
                                borderRadius: 6,
                                background: 'transparent',
                                border: 'none',
                                color: sysTextPrimary,
                                fontSize: 13,
                                cursor: 'pointer',
                                textAlign: 'left',
                                transition: 'background 0.12s ease',
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = sysHoverBg)}
                              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                                <PlusCircle size={15} color={sysTextSecondary} />
                                <span>Create sub-issue</span>
                              </div>
                              <kbd
                                style={{
                                  padding: '1px 5px',
                                  fontSize: 10.5,
                                  borderRadius: 4,
                                  border: `1px solid ${sysBorder}`,
                                  background: sysInputBg,
                                  color: sysTextSecondary,
                                  fontFamily: 'inherit',
                                }}
                              >
                                ⌥ ⇧ C
                              </kbd>
                            </button>

                            {/* Option 2: Add existing issue */}
                            <button
                              type="button"
                              onClick={() => {
                                setIsSubIssueSplitOpen(false);
                                setIsAddingSubIssue(true);
                                setNewSubIssueTitle('#');
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '7px 10px',
                                borderRadius: 6,
                                background: 'transparent',
                                border: 'none',
                                color: sysTextPrimary,
                                fontSize: 13,
                                cursor: 'pointer',
                                textAlign: 'left',
                                transition: 'background 0.12s ease',
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = sysHoverBg)}
                              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                                <CircleDot size={15} color={sysTextSecondary} />
                                <span>Add existing issue</span>
                              </div>
                              <kbd
                                style={{
                                  padding: '1px 5px',
                                  fontSize: 10.5,
                                  borderRadius: 4,
                                  border: `1px solid ${sysBorder}`,
                                  background: sysInputBg,
                                  color: sysTextSecondary,
                                  fontFamily: 'inherit',
                                }}
                              >
                                ⌥ ⇧ A
                              </kbd>
                            </button>

                            <div style={{ height: 1, background: sysBorder, margin: '4px 0' }} />

                            {/* Option 3: Draft with Copilot / AI */}
                            <button
                              type="button"
                              onClick={() => {
                                setIsSubIssueSplitOpen(false);
                                if (onAskAiAboutIssue) {
                                  onAskAiAboutIssue(issue);
                                } else {
                                  showToast('Abrindo assistente de IA para sugerir sub-tarefas...');
                                }
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '7px 10px',
                                borderRadius: 6,
                                background: 'transparent',
                                border: 'none',
                                color: sysTextPrimary,
                                fontSize: 13,
                                cursor: 'pointer',
                                textAlign: 'left',
                                transition: 'background 0.12s ease',
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = sysHoverBg)}
                              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                                <Sparkles size={15} color={accentColor} />
                                <span>Draft with Copilot</span>
                              </div>
                              <ArrowUpRight size={14} color={sysTextSecondary} />
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* 3.3 Timeline & Comentários */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: theme?.textPrimary || '#fff' }}>
                <MessageSquare size={15} color={theme?.textSecondary || '#a1a1aa'} />
                <span>Atividade e Comentários ({comments.length})</span>
              </div>

              {isLoadingComments ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 14, color: theme?.textSecondary || '#a1a1aa', fontSize: 12.5 }}>
                  <Loader2 size={14} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
                  <span>Carregando comentários do GitHub...</span>
                </div>
              ) : comments.length === 0 ? (
                <div style={{ padding: '14px 16px', borderRadius: 8, border: 'none', background: sysCardBg, fontSize: 12.5, color: sysTextSecondary }}>
                  Nenhum comentário adicionado ainda. Deixe um comentário abaixo para iniciar a discussão.
                </div>
              ) : (
                comments.map((c, cIdx) => (
                  <div
                    key={c.id || cIdx}
                    style={{
                      borderRadius: 8,
                      border: 'none',
                      background: sysCardBg,
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        padding: '9px 16px',
                        background: sysCardHeaderBg,
                        borderBottom: `1px solid ${sysBorder}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 20, height: 20, borderRadius: '50%', overflow: 'hidden', background: accentColor }}>
                          {c.user?.avatar_url && <img src={c.user.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                        </div>
                        <span style={{ fontSize: 12.5, fontWeight: 600, color: sysTextPrimary }}>
                          {c.user?.login || 'comentador'}
                        </span>
                        <span style={{ fontSize: 12, color: sysTextSecondary }}>
                          comentou {formatTimeAgo(c.created_at)}
                        </span>
                      </div>
                    </div>
                    <div style={{ padding: '14px 16px', fontSize: 13.5, lineHeight: 1.55, color: sysTextPrimary }}>
                      {safeRenderMarkdown(c.body || '')}
                    </div>
                  </div>
                ))
              )}

              {/* 3.4 Formulário de Adicionar Comentário */}
              <div style={{ marginTop: 20 }}>
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 600,
                    color: sysTextPrimary,
                    marginBottom: 8,
                  }}
                >
                  Add a comment
                </div>

                {/* Outer Comment Box (sem borda, fundo levemente mais claro que a sidesheet) */}
                <div
                  style={{
                    borderRadius: 8,
                    border: 'none',
                    background: sysCardBg,
                    position: 'relative',
                    zIndex: isCloseSplitOpen ? 50 : 1,
                  }}
                >
                  {/* Tabs & Toolbar Header */}
                  <div
                    style={{
                      padding: '8px 16px 0 16px',
                      background: sysCardHeaderBg,
                      borderRadius: '8px 8px 0 0',
                      borderBottom: `1px solid ${sysBorder}`,
                      display: 'flex',
                      alignItems: 'flex-end',
                      justifyContent: 'space-between',
                      gap: 8,
                      flexWrap: 'wrap',
                    }}
                  >
                    {/* Left: Write / Preview Tabs */}
                    <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
                      <button
                        type="button"
                        onClick={() => setCommentTab('write')}
                        style={{
                          padding: '6px 12px',
                          border: 'none',
                          borderBottom: commentTab === 'write' ? `2px solid ${accentColor}` : '2px solid transparent',
                          marginBottom: -1,
                          background: 'transparent',
                          color: commentTab === 'write' ? sysTextPrimary : sysTextSecondary,
                          fontSize: 13.5,
                          fontWeight: commentTab === 'write' ? 600 : 400,
                          cursor: 'pointer',
                          transition: 'color 0.15s ease',
                        }}
                      >
                        Write
                      </button>
                      <button
                        type="button"
                        onClick={() => setCommentTab('preview')}
                        style={{
                          padding: '6px 12px',
                          border: 'none',
                          borderBottom: commentTab === 'preview' ? `2px solid ${accentColor}` : '2px solid transparent',
                          marginBottom: -1,
                          background: 'transparent',
                          color: commentTab === 'preview' ? sysTextPrimary : sysTextSecondary,
                          fontSize: 13.5,
                          fontWeight: commentTab === 'preview' ? 600 : 400,
                          cursor: 'pointer',
                          transition: 'color 0.15s ease',
                        }}
                      >
                        Preview
                      </button>
                    </div>

                    {/* Right: Markdown Toolbar */}
                    {commentTab === 'write' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 2, paddingBottom: 6 }}>
                        <button
                          type="button"
                          title="Heading"
                          onClick={() => handleInsertCommentMarkdown('### ')}
                          style={{
                            width: 26,
                            height: 26,
                            borderRadius: 4,
                            border: 'none',
                            background: 'transparent',
                            color: isEffectiveDark ? '#848d97' : '#656d76',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: 13,
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = isEffectiveDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'; e.currentTarget.style.color = isEffectiveDark ? '#e6edf3' : '#1f2328'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = isEffectiveDark ? '#848d97' : '#656d76'; }}
                        >
                          H
                        </button>
                        <button
                          type="button"
                          title="Bold"
                          onClick={() => handleInsertCommentMarkdown('**', '**')}
                          style={{
                            width: 26,
                            height: 26,
                            borderRadius: 4,
                            border: 'none',
                            background: 'transparent',
                            color: isEffectiveDark ? '#848d97' : '#656d76',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 800,
                            fontSize: 14,
                            fontFamily: 'serif',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = isEffectiveDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'; e.currentTarget.style.color = isEffectiveDark ? '#e6edf3' : '#1f2328'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = isEffectiveDark ? '#848d97' : '#656d76'; }}
                        >
                          B
                        </button>
                        <button
                          type="button"
                          title="Italic"
                          onClick={() => handleInsertCommentMarkdown('_', '_')}
                          style={{
                            width: 26,
                            height: 26,
                            borderRadius: 4,
                            border: 'none',
                            background: 'transparent',
                            color: isEffectiveDark ? '#848d97' : '#656d76',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontStyle: 'italic',
                            fontWeight: 600,
                            fontSize: 14,
                            fontFamily: 'serif',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = isEffectiveDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'; e.currentTarget.style.color = isEffectiveDark ? '#e6edf3' : '#1f2328'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = isEffectiveDark ? '#848d97' : '#656d76'; }}
                        >
                          I
                        </button>
                        <button
                          type="button"
                          title="Quote"
                          onClick={() => handleInsertCommentMarkdown('> ')}
                          style={{
                            width: 26,
                            height: 26,
                            borderRadius: 4,
                            border: 'none',
                            background: 'transparent',
                            color: isEffectiveDark ? '#848d97' : '#656d76',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = isEffectiveDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'; e.currentTarget.style.color = isEffectiveDark ? '#e6edf3' : '#1f2328'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = isEffectiveDark ? '#848d97' : '#656d76'; }}
                        >
                          <Quote size={13} />
                        </button>
                        <button
                          type="button"
                          title="Code"
                          onClick={() => handleInsertCommentMarkdown('`', '`')}
                          style={{
                            width: 26,
                            height: 26,
                            borderRadius: 4,
                            border: 'none',
                            background: 'transparent',
                            color: isEffectiveDark ? '#848d97' : '#656d76',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = isEffectiveDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'; e.currentTarget.style.color = isEffectiveDark ? '#e6edf3' : '#1f2328'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = isEffectiveDark ? '#848d97' : '#656d76'; }}
                        >
                          <Code size={13} />
                        </button>
                        <button
                          type="button"
                          title="Link"
                          onClick={() => handleInsertCommentMarkdown('[', '](url)')}
                          style={{
                            width: 26,
                            height: 26,
                            borderRadius: 4,
                            border: 'none',
                            background: 'transparent',
                            color: isEffectiveDark ? '#848d97' : '#656d76',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = isEffectiveDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'; e.currentTarget.style.color = isEffectiveDark ? '#e6edf3' : '#1f2328'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = isEffectiveDark ? '#848d97' : '#656d76'; }}
                        >
                          <Link2 size={13} />
                        </button>

                        <div style={{ width: 1, height: 16, background: isEffectiveDark ? 'rgba(255, 255, 255, 0.1)' : '#d0d7de', margin: '0 3px' }} />

                        <button
                          type="button"
                          title="Bulleted list"
                          onClick={() => handleInsertCommentMarkdown('- ')}
                          style={{
                            width: 26,
                            height: 26,
                            borderRadius: 4,
                            border: 'none',
                            background: 'transparent',
                            color: sysTextSecondary,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = sysHoverBg; e.currentTarget.style.color = sysTextPrimary; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = sysTextSecondary; }}
                        >
                          <List size={14} />
                        </button>
                        <button
                          type="button"
                          title="Numbered list"
                          onClick={() => handleInsertCommentMarkdown('1. ')}
                          style={{
                            width: 26,
                            height: 26,
                            borderRadius: 4,
                            border: 'none',
                            background: 'transparent',
                            color: sysTextSecondary,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = sysHoverBg; e.currentTarget.style.color = sysTextPrimary; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = sysTextSecondary; }}
                        >
                          <ListOrdered size={14} />
                        </button>
                        <button
                          type="button"
                          title="Task list"
                          onClick={() => handleInsertCommentMarkdown('- [ ] ')}
                          style={{
                            width: 26,
                            height: 26,
                            borderRadius: 4,
                            border: 'none',
                            background: 'transparent',
                            color: sysTextSecondary,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = sysHoverBg; e.currentTarget.style.color = sysTextPrimary; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = sysTextSecondary; }}
                        >
                          <ListChecks size={14} />
                        </button>

                        <div style={{ width: 1, height: 16, background: isEffectiveDark ? 'rgba(255, 255, 255, 0.1)' : '#d0d7de', margin: '0 3px' }} />

                        <button
                          type="button"
                          title="Mention a user"
                          onClick={() => handleInsertCommentMarkdown('@')}
                          style={{
                            width: 26,
                            height: 26,
                            borderRadius: 4,
                            border: 'none',
                            background: 'transparent',
                            color: isEffectiveDark ? '#848d97' : '#656d76',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = isEffectiveDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'; e.currentTarget.style.color = isEffectiveDark ? '#e6edf3' : '#1f2328'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = isEffectiveDark ? '#848d97' : '#656d76'; }}
                        >
                          <AtSign size={13} />
                        </button>
                        <button
                          type="button"
                          title="Reference an issue or PR"
                          onClick={() => handleInsertCommentMarkdown('#')}
                          style={{
                            width: 26,
                            height: 26,
                            borderRadius: 4,
                            border: 'none',
                            background: 'transparent',
                            color: isEffectiveDark ? '#848d97' : '#656d76',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = isEffectiveDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'; e.currentTarget.style.color = isEffectiveDark ? '#e6edf3' : '#1f2328'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = isEffectiveDark ? '#848d97' : '#656d76'; }}
                        >
                          <Reply size={13} />
                        </button>
                        <button
                          type="button"
                          title="Code block"
                          onClick={() => handleInsertCommentMarkdown('```\n', '\n```')}
                          style={{
                            width: 26,
                            height: 26,
                            borderRadius: 4,
                            border: 'none',
                            background: 'transparent',
                            color: isEffectiveDark ? '#848d97' : '#656d76',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = isEffectiveDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'; e.currentTarget.style.color = isEffectiveDark ? '#e6edf3' : '#1f2328'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = isEffectiveDark ? '#848d97' : '#656d76'; }}
                        >
                          <FileCode2 size={13} />
                        </button>
                        <button
                          type="button"
                          title="Undo"
                          onClick={() => setNewCommentText((prev) => prev.slice(0, -1))}
                          style={{
                            width: 26,
                            height: 26,
                            borderRadius: 4,
                            border: 'none',
                            background: 'transparent',
                            color: isEffectiveDark ? '#848d97' : '#656d76',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = isEffectiveDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'; e.currentTarget.style.color = isEffectiveDark ? '#e6edf3' : '#1f2328'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = isEffectiveDark ? '#848d97' : '#656d76'; }}
                        >
                          <Undo size={13} />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Inner Textarea / Preview Box */}
                  <div style={{ padding: '12px 16px' }}>
                    {commentTab === 'write' ? (
                      <div
                        style={{
                          borderRadius: 6,
                          border: `1px solid ${sysBorder}`,
                          background: sysInputBg,
                          position: 'relative',
                        }}
                      >
                        <textarea
                          rows={5}
                          value={newCommentText}
                          onChange={(e) => setNewCommentText(e.target.value)}
                          placeholder="Use Markdown to format your comment"
                          style={{
                            width: '100%',
                            boxSizing: 'border-box',
                            padding: '10px 12px',
                            background: 'transparent',
                            border: 'none',
                            color: sysTextPrimary,
                            fontSize: 13.5,
                            lineHeight: 1.5,
                            fontFamily: 'inherit',
                            outline: 'none',
                            resize: 'vertical',
                            minHeight: 100,
                          }}
                          onFocus={(e) => {
                            const p = e.currentTarget.parentElement;
                            if (p) {
                              p.style.borderColor = accentColor;
                              p.style.boxShadow = `0 0 0 1px ${accentColor}`;
                            }
                          }}
                          onBlur={(e) => {
                            const p = e.currentTarget.parentElement;
                            if (p) {
                              p.style.borderColor = sysBorder;
                              p.style.boxShadow = 'none';
                            }
                          }}
                        />
                      </div>
                    ) : (
                      <div
                        style={{
                          borderRadius: 6,
                          border: `1px solid ${sysBorder}`,
                          background: sysInputBg,
                          padding: '12px 14px',
                          minHeight: 100,
                        }}
                      >
                        {newCommentText.trim() ? (
                          safeRenderMarkdown(newCommentText)
                        ) : (
                          <span style={{ color: sysTextSecondary, fontStyle: 'italic', fontSize: 13 }}>
                            Nothing to preview.
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Row: File Attachment Hint + Action Buttons */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginTop: 10,
                    gap: 12,
                    flexWrap: 'wrap',
                  }}
                >
                  {/* Left: Attachment trigger */}
                  <div>
                    <input
                      type="file"
                      ref={commentFileInputRef}
                      onChange={handleCommentFileUpload}
                      style={{ display: 'none' }}
                    />
                    <button
                      type="button"
                      onClick={() => commentFileInputRef.current?.click()}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        background: 'transparent',
                        border: 'none',
                        color: isEffectiveDark ? '#848d97' : '#656d76',
                        fontSize: 13,
                        cursor: 'pointer',
                        padding: '4px 6px',
                        borderRadius: 6,
                        transition: 'color 0.15s ease',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = '#58a6ff'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = isEffectiveDark ? '#848d97' : '#656d76'; }}
                    >
                      <Paperclip size={15} style={{ transform: 'rotate(-45deg)' }} />
                      <span>Paste, drop, or click to add files</span>
                    </button>
                  </div>

                  {/* Right: Close Issue Split Button + Comment Button */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {/* Split Button: Close Issue with Dropdown Popup */}
                    <div style={{ position: 'relative', zIndex: isCloseSplitOpen ? 100 : 1 }} ref={closeSplitRef}>
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'stretch',
                          height: 32,
                          borderRadius: 6,
                          overflow: 'hidden',
                          border: `1px solid ${sysBorder}`,
                          background: isEffectiveDark ? 'rgba(255, 255, 255, 0.04)' : '#f8fafc',
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            if (isClosed) {
                              handleToggleState();
                            } else {
                              handleCloseWithReason(closeReason);
                            }
                          }}
                          disabled={isSavingStatus}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                            padding: '0 12px',
                            background: 'transparent',
                            border: 'none',
                            color: sysTextPrimary,
                            fontSize: 13,
                            fontWeight: 500,
                            cursor: isSavingStatus ? 'wait' : 'pointer',
                            transition: 'background 0.15s ease',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                        >
                          {isClosed ? (
                            <CircleDot size={14} color="#3fb950" />
                          ) : closeReason === 'not_planned' || closeReason === 'duplicate' ? (
                            <CircleSlash size={14} color={sysTextSecondary} />
                          ) : (
                            <CheckCircle2 size={14} color="#a371f7" />
                          )}
                          <span>
                            {isClosed
                              ? 'Reopen issue'
                              : closeReason === 'not_planned'
                              ? 'Close as not planned'
                              : closeReason === 'duplicate'
                              ? 'Close as duplicate'
                              : 'Close issue'}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsCloseSplitOpen((v) => !v)}
                          disabled={isSavingStatus}
                          title="More closing options"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '0 8px',
                            background: isCloseSplitOpen ? (isEffectiveDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)') : 'transparent',
                            border: 'none',
                            borderLeft: `1px solid ${sysBorder}`,
                            color: sysTextSecondary,
                            cursor: isSavingStatus ? 'wait' : 'pointer',
                            transition: 'background 0.15s ease',
                          }}
                          onMouseEnter={(e) => {
                            if (!isCloseSplitOpen) e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)';
                          }}
                          onMouseLeave={(e) => {
                            if (!isCloseSplitOpen) e.currentTarget.style.background = 'transparent';
                          }}
                        >
                          <ChevronDown size={13} />
                        </button>
                      </div>

                      {/* Close Issue Split Menu Popup */}
                      {isCloseSplitOpen && (
                        <div
                          style={{
                            position: 'absolute',
                            bottom: 'calc(100% + 6px)',
                            right: 0,
                            width: closeSubView === 'duplicate' ? 320 : 290,
                            background: sysPopupBg,
                            border: `1px solid ${sysPopupBorder}`,
                            borderRadius: 8,
                            boxShadow: sysPopupShadow,
                            zIndex: 1050,
                            padding: closeSubView === 'duplicate' ? 0 : '4px',
                            display: 'flex',
                            flexDirection: 'column',
                            overflow: 'hidden',
                          }}
                        >
                          {closeSubView === 'duplicate' ? (
                            /* Sub-view: Search Duplicate Issues (Imagem 1) */
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              {/* Header com Botão Voltar e Nome do Repositório */}
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 10,
                                  padding: '10px 12px',
                                  borderBottom: `1px solid ${sysBorder}`,
                                }}
                              >
                                <button
                                  type="button"
                                  onClick={() => setCloseSubView('main')}
                                  title="Voltar"
                                  style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: sysTextSecondary,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: '2px 4px',
                                    borderRadius: 4,
                                    transition: 'color 0.12s ease',
                                  }}
                                  onMouseEnter={(e) => (e.currentTarget.style.color = sysTextPrimary)}
                                  onMouseLeave={(e) => (e.currentTarget.style.color = sysTextSecondary)}
                                >
                                  <ArrowLeft size={15} />
                                </button>
                                <span
                                  style={{
                                    fontSize: 13,
                                    fontWeight: 600,
                                    color: sysTextPrimary,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {repoFullName || 'Search issues'}
                                </span>
                              </div>

                              {/* Barra de Busca de Issues */}
                              <div style={{ padding: '8px 10px', borderBottom: `1px solid ${sysBorder}` }}>
                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    padding: '5px 10px',
                                    borderRadius: 6,
                                    border: `1px solid ${sysBorder}`,
                                    background: sysInputBg,
                                    boxShadow: `0 0 0 2px ${hexToRgba(accentColor, 0.2)}`,
                                    transition: 'all 0.15s ease',
                                  }}
                                >
                                  <Search size={14} color={sysTextSecondary} />
                                  <input
                                    type="text"
                                    autoFocus
                                    value={duplicateSearchQuery}
                                    onChange={(e) => setDuplicateSearchQuery(e.target.value)}
                                    placeholder="Search issues"
                                    style={{
                                      flex: 1,
                                      background: 'transparent',
                                      border: 'none',
                                      color: sysTextPrimary,
                                      fontSize: 13,
                                      outline: 'none',
                                    }}
                                  />
                                </div>
                              </div>

                              {/* Lista Filtrável de Issues */}
                              <div
                                style={{
                                  maxHeight: 280,
                                  overflowY: 'auto',
                                  display: 'flex',
                                  flexDirection: 'column',
                                }}
                                className="no-scrollbar"
                              >
                                {isLoadingRepoIssues ? (
                                  <div style={{ padding: '24px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: sysTextSecondary, fontSize: 13 }}>
                                    <Loader2 size={15} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
                                    <span>Carregando issues...</span>
                                  </div>
                                ) : (() => {
                                  const filtered = repoIssues.filter((i) => {
                                    const num = i.number || i.githubNumber;
                                    const currentNum = issue.githubNumber || issue.number;
                                    if (num && currentNum && num === currentNum) return false;
                                    if (!duplicateSearchQuery.trim()) return true;
                                    const q = duplicateSearchQuery.toLowerCase();
                                    return (i.title && i.title.toLowerCase().includes(q)) || (num && String(num).includes(q));
                                  });

                                  if (filtered.length === 0) {
                                    return (
                                      <div style={{ padding: '24px 16px', textAlign: 'center', color: sysTextSecondary, fontSize: 13 }}>
                                        Nenhuma issue encontrada
                                      </div>
                                    );
                                  }

                                  return filtered.map((item) => {
                                    const itemNum = item.number || item.githubNumber;
                                    const isSelected = selectedDuplicateIssue?.number === itemNum;
                                    return (
                                      <button
                                        key={item.id || itemNum}
                                        type="button"
                                        onClick={() => {
                                          setSelectedDuplicateIssue(item);
                                          setCloseReason('duplicate');
                                          setIsCloseSplitOpen(false);
                                          setCloseSubView('main');
                                          showToast(`Issue #${itemNum} selecionada como duplicada.`);
                                        }}
                                        style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'space-between',
                                          gap: 10,
                                          padding: '8px 12px 8px 10px',
                                          border: 'none',
                                          borderBottom: `1px solid ${sysBorder}`,
                                          background: isSelected ? sysHoverBg : 'transparent',
                                          cursor: 'pointer',
                                          textAlign: 'left',
                                          width: '100%',
                                          position: 'relative',
                                          transition: 'background 0.12s ease',
                                        }}
                                        onMouseEnter={(e) => {
                                          e.currentTarget.style.background = sysHoverBg;
                                          const bar = e.currentTarget.querySelector('.dup-bar') as HTMLElement;
                                          if (bar) bar.style.opacity = '1';
                                        }}
                                        onMouseLeave={(e) => {
                                          if (!isSelected) e.currentTarget.style.background = 'transparent';
                                          const bar = e.currentTarget.querySelector('.dup-bar') as HTMLElement;
                                          if (bar && !isSelected) bar.style.opacity = '0';
                                        }}
                                      >
                                        {/* Barra indicadora à esquerda em accentColor */}
                                        <div
                                          className="dup-bar"
                                          style={{
                                            position: 'absolute',
                                            left: 0,
                                            top: 0,
                                            bottom: 0,
                                            width: 3,
                                            background: accentColor,
                                            opacity: isSelected ? 1 : 0,
                                            transition: 'opacity 0.12s ease',
                                          }}
                                        />
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0, flex: 1, paddingLeft: 4 }}>
                                          {item.state === 'closed' ? (
                                            <CheckCircle2 size={15} color="#a371f7" style={{ flexShrink: 0 }} />
                                          ) : (
                                            <CircleDot size={15} color="#3fb950" style={{ flexShrink: 0 }} />
                                          )}
                                          <span
                                            style={{
                                              fontSize: 13,
                                              color: sysTextPrimary,
                                              fontWeight: 500,
                                              overflow: 'hidden',
                                              textOverflow: 'ellipsis',
                                              whiteSpace: 'nowrap',
                                            }}
                                          >
                                            {item.title}
                                          </span>
                                        </div>
                                        <span style={{ fontSize: 12, color: sysTextSecondary, flexShrink: 0, marginLeft: 6 }}>
                                          #{itemNum}
                                        </span>
                                      </button>
                                    );
                                  });
                                })()}
                              </div>
                            </div>
                          ) : (
                            /* Menu Principal (Imagem 2) */
                            <>
                              {isClosed ? (
                                /* Reopen option if already closed */
                                <button
                                  type="button"
                                  onClick={() => {
                                    setIsCloseSplitOpen(false);
                                    handleToggleState();
                                  }}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    gap: 10,
                                    padding: '8px 10px',
                                    borderRadius: 6,
                                    background: 'transparent',
                                    border: 'none',
                                    color: sysTextPrimary,
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    transition: 'background 0.12s ease',
                                  }}
                                  onMouseEnter={(e) => (e.currentTarget.style.background = sysHoverBg)}
                                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                                >
                                  <CircleDot size={16} color="#3fb950" style={{ marginTop: 2, flexShrink: 0 }} />
                                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ fontSize: 13, fontWeight: 600, color: sysTextPrimary }}>
                                      Reopen issue
                                    </span>
                                    <span style={{ fontSize: 12, color: sysTextSecondary, marginTop: 2 }}>
                                      Reopen this issue for further work
                                    </span>
                                  </div>
                                </button>
                              ) : null}

                              {/* Option 1: Close as completed */}
                              <button
                                type="button"
                                onClick={() => handleCloseWithReason('completed')}
                                style={{
                                  display: 'flex',
                                  alignItems: 'flex-start',
                                  gap: 10,
                                  padding: '8px 10px',
                                  borderRadius: 6,
                                  background: 'transparent',
                                  border: 'none',
                                  color: sysTextPrimary,
                                  cursor: 'pointer',
                                  textAlign: 'left',
                                  transition: 'background 0.12s ease',
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.background = sysHoverBg)}
                                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                              >
                                <div style={{ width: 14, display: 'flex', justifyContent: 'center', marginTop: 3, flexShrink: 0 }}>
                                  {closeReason === 'completed' && !isClosed ? (
                                    <Check size={14} color={sysTextPrimary} />
                                  ) : null}
                                </div>
                                <CheckCircle2 size={16} color="#a371f7" style={{ marginTop: 2, flexShrink: 0 }} />
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                  <span style={{ fontSize: 13, fontWeight: 600, color: sysTextPrimary }}>
                                    Close as completed
                                  </span>
                                  <span style={{ fontSize: 12, color: sysTextSecondary, marginTop: 2 }}>
                                    Done, closed, fixed, resolved
                                  </span>
                                </div>
                              </button>

                              <div style={{ height: 1, background: sysBorder, margin: '4px 0' }} />

                              {/* Option 2: Close as not planned */}
                              <button
                                type="button"
                                onClick={() => handleCloseWithReason('not_planned')}
                                style={{
                                  display: 'flex',
                                  alignItems: 'flex-start',
                                  gap: 10,
                                  padding: '8px 10px',
                                  borderRadius: 6,
                                  background: 'transparent',
                                  border: 'none',
                                  color: sysTextPrimary,
                                  cursor: 'pointer',
                                  textAlign: 'left',
                                  transition: 'background 0.12s ease',
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.background = sysHoverBg)}
                                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                              >
                                <div style={{ width: 14, display: 'flex', justifyContent: 'center', marginTop: 3, flexShrink: 0 }}>
                                  {closeReason === 'not_planned' && !isClosed ? (
                                    <Check size={14} color={sysTextPrimary} />
                                  ) : null}
                                </div>
                                <CircleSlash size={16} color={sysTextSecondary} style={{ marginTop: 2, flexShrink: 0 }} />
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                  <span style={{ fontSize: 13, fontWeight: 600, color: sysTextPrimary }}>
                                    Close as not planned
                                  </span>
                                  <span style={{ fontSize: 12, color: sysTextSecondary, marginTop: 2 }}>
                                    Won't fix, can't repro, stale
                                  </span>
                                </div>
                              </button>

                              <div style={{ height: 1, background: sysBorder, margin: '4px 0' }} />

                              {/* Option 3: Close as duplicate (Transiciona para sub-view) */}
                              <button
                                type="button"
                                onClick={() => {
                                  setCloseSubView('duplicate');
                                  loadRepoIssuesForDuplicate();
                                }}
                                style={{
                                  display: 'flex',
                                  alignItems: 'flex-start',
                                  justifyContent: 'space-between',
                                  gap: 10,
                                  padding: '8px 10px',
                                  borderRadius: 6,
                                  background: 'transparent',
                                  border: 'none',
                                  color: sysTextPrimary,
                                  cursor: 'pointer',
                                  textAlign: 'left',
                                  transition: 'background 0.12s ease',
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.background = sysHoverBg)}
                                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                              >
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                                  <div style={{ width: 14, display: 'flex', justifyContent: 'center', marginTop: 3, flexShrink: 0 }}>
                                    {closeReason === 'duplicate' && !isClosed ? (
                                      <Check size={14} color={sysTextPrimary} />
                                    ) : null}
                                  </div>
                                  <CircleSlash size={16} color={sysTextSecondary} style={{ marginTop: 2, flexShrink: 0 }} />
                                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ fontSize: 13, fontWeight: 600, color: sysTextPrimary }}>
                                      Close as duplicate
                                    </span>
                                    <span style={{ fontSize: 12, color: sysTextSecondary, marginTop: 2 }}>
                                      {selectedDuplicateIssue ? `Duplicate of #${selectedDuplicateIssue.number || selectedDuplicateIssue.githubNumber}` : 'Duplicate of another issue'}
                                    </span>
                                  </div>
                                </div>
                                <ArrowRight size={14} color={sysTextSecondary} style={{ marginTop: 4, flexShrink: 0 }} />
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Comment Button */}
                    <button
                      type="button"
                      onClick={handleAddComment}
                      disabled={!newCommentText.trim() || isSubmittingComment}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        height: 32,
                        padding: '0 16px',
                        background: accentColor,
                        border: 'none',
                        borderRadius: 6,
                        color: accentContrastText,
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: !newCommentText.trim() || isSubmittingComment ? 'not-allowed' : 'pointer',
                        opacity: !newCommentText.trim() || isSubmittingComment ? 0.6 : 1,
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        if (newCommentText.trim() && !isSubmittingComment) {
                          e.currentTarget.style.filter = 'brightness(1.08)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.filter = 'none';
                      }}
                    >
                      {isSubmittingComment ? (
                        <Loader2 size={13} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
                      ) : null}
                      <span>Comment</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ======================================================================= */}
          {/* COLUNA DIREITA: METADADOS DA SIDEBAR (Sem fundo com linhas divisórias)  */}
          {/* ======================================================================= */}
          <div
            style={{
              width: 290,
              flexShrink: 0,
              border: 'none',
              background: 'transparent',
              overflowY: 'auto',
              padding: '6px 12px 32px 6px',
              display: 'flex',
              flexDirection: 'column',
              gap: 0,
              minHeight: 0,
            }}
            className="no-scrollbar"
          >
            {/* 1. Assignees */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                position: 'relative',
                padding: '12px 0',
                borderBottom: `1px solid ${sysBorder}`,
              }}
            >
              <div
                data-sidebar-trigger="assignees"
                onClick={() => {
                  setActiveSidebarPopup((prev) => (prev === 'assignees' ? null : 'assignees'));
                  setAssigneeSearch('');
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '4px 6px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  background: activeSidebarPopup === 'assignees' ? (isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : '#f0f2f5') : 'transparent',
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  if (activeSidebarPopup !== 'assignees') {
                    e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeSidebarPopup !== 'assignees') {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 600, color: isEffectiveDark ? '#c9d1d9' : '#24292f' }}>Assignees</span>
                <Settings size={14} color={isEffectiveDark ? '#8b949e' : '#57606a'} />
              </div>

              {issue.assignees && issue.assignees.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '0 6px' }}>
                  {issue.assignees.map((a, aIdx) => {
                    const aName = a?.name || 'Responsável';
                    const aInitial = a?.initial || (a?.name ? a.name.charAt(0).toUpperCase() : '?');
                    return (
                      <div key={aIdx} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div
                          style={{
                            width: 20,
                            height: 20,
                            borderRadius: '50%',
                            background: a?.avatarBg || accentColor,
                            color: '#fff',
                            fontSize: 10,
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            overflow: 'hidden',
                            flexShrink: 0,
                          }}
                        >
                          {a?.avatarUrl ? <img src={a.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : aInitial}
                        </div>
                        <span style={{ fontSize: 12, color: theme?.textPrimary || '#fff', fontWeight: 500 }}>{aName}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ fontSize: 12, color: theme?.textSecondary || '#8b949e', padding: '0 6px' }}>
                  No one –{' '}
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      if (currentUser?.login) {
                        const next = [{ name: currentUser.login, avatarUrl: currentUser.avatarUrl, initial: currentUser.login.charAt(0).toUpperCase(), avatarBg: accentColor }];
                        onUpdateIssue?.({ assignees: next });
                        showToast('Atribuído a você!');
                      } else {
                        setActiveSidebarPopup('assignees');
                      }
                    }}
                    style={{ color: '#58a6ff', cursor: 'pointer', textDecoration: 'none' }}
                  >
                    Assign yourself
                  </span>
                </div>
              )}

              {/* Popup Select Assignees */}
              {activeSidebarPopup === 'assignees' && (
                <div
                  data-sidebar-popup="assignees"
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 2px)',
                    left: 0,
                    right: 0,
                    background: sysPopupBg,
                    border: `1px solid ${sysPopupBorder}`,
                    borderRadius: 8,
                    boxShadow: sysPopupShadow,
                    zIndex: 1000,
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ padding: '12px 14px 8px 14px', fontSize: 13.5, fontWeight: 600, color: sysTextPrimary }}>
                    Select assignees
                  </div>
                  <div style={{ padding: '0 12px 10px 12px' }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        background: sysInputBg,
                        border: `1px solid ${sysBorder}`,
                        borderRadius: 6,
                        padding: '5px 8px',
                      }}
                    >
                      <Search size={14} color={sysTextSecondary} />
                      <input
                        autoFocus
                        value={assigneeSearch}
                        onChange={(e) => setAssigneeSearch(e.target.value)}
                        placeholder="Filter assignees"
                        style={{
                          background: 'transparent',
                          border: 'none',
                          outline: 'none',
                          color: sysTextPrimary,
                          fontSize: 13,
                          width: '100%',
                        }}
                        onFocus={(e) => {
                          const p = e.currentTarget.parentElement;
                          if (p) {
                            p.style.borderColor = accentColor;
                            p.style.boxShadow = `0 0 0 1px ${accentColor}`;
                          }
                        }}
                        onBlur={(e) => {
                          const p = e.currentTarget.parentElement;
                          if (p) {
                            p.style.borderColor = sysBorder;
                            p.style.boxShadow = 'none';
                          }
                        }}
                      />
                    </div>
                  </div>
                  <div style={{ borderBottom: `1px solid ${sysBorder}` }} />

                  {/* Lista de Colaboradores */}
                  <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                    {(() => {
                      const list: Array<{ login: string; name?: string; avatarUrl?: string }> = [];
                      if (currentUser?.login) {
                        list.push({ login: currentUser.login, name: currentUser.name || currentUser.login, avatarUrl: currentUser.avatarUrl });
                      }
                      collaborators.forEach((c) => {
                        if (!list.some((item) => item.login === c.login)) {
                          list.push({ login: c.login, name: c.name || c.login, avatarUrl: c.avatarUrl });
                        }
                      });

                      const filtered = list.filter((p) =>
                        p.login.toLowerCase().includes(assigneeSearch.toLowerCase()) ||
                        (p.name && p.name.toLowerCase().includes(assigneeSearch.toLowerCase()))
                      );

                      if (filtered.length === 0) {
                        return (
                          <div style={{ padding: '14px 12px', fontSize: 12.5, color: '#8b949e', textAlign: 'center' }}>
                            Nenhum responsável encontrado
                          </div>
                        );
                      }

                      return filtered.map((p) => {
                        const isAssigned = (issue.assignees || []).some((a) => a.name === p.login);
                        return (
                          <div
                            key={p.login}
                            onClick={() => {
                              const next = isAssigned
                                ? (issue.assignees || []).filter((a) => a.name !== p.login)
                                : [
                                    ...(issue.assignees || []),
                                    {
                                      name: p.login,
                                      avatarUrl: p.avatarUrl,
                                      initial: p.login.charAt(0).toUpperCase(),
                                      avatarBg: accentColor,
                                    },
                                  ];
                              onUpdateIssue?.({ assignees: next });
                            }}
                            style={{
                              position: 'relative',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 10,
                              padding: '8px 12px',
                              cursor: 'pointer',
                              background: isAssigned ? hexToRgba(accentColor, 0.08) : 'transparent',
                              transition: 'background 0.1s ease',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = sysHoverBg;
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = isAssigned ? hexToRgba(accentColor, 0.08) : 'transparent';
                            }}
                          >
                            {isAssigned && (
                              <div
                                style={{
                                  position: 'absolute',
                                  left: 0,
                                  top: 0,
                                  bottom: 0,
                                  width: 3,
                                  background: accentColor,
                                  borderRadius: '0 2px 2px 0',
                                }}
                              />
                            )}

                            <div
                              style={{
                                width: 16,
                                height: 16,
                                borderRadius: 3,
                                background: isAssigned ? accentColor : 'transparent',
                                border: isAssigned ? `1px solid ${accentColor}` : `1px solid ${sysBorder}`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                              }}
                            >
                              {isAssigned && <Check size={11} color={accentContrastText} strokeWidth={3} />}
                            </div>

                            <div
                              style={{
                                width: 20,
                                height: 20,
                                borderRadius: '50%',
                                background: accentColor,
                                color: '#fff',
                                fontSize: 10,
                                fontWeight: 600,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                overflow: 'hidden',
                                flexShrink: 0,
                              }}
                            >
                              {p.avatarUrl ? (
                                <img src={p.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              ) : (
                                p.login.charAt(0).toUpperCase()
                              )}
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                              <span style={{ fontSize: 13, fontWeight: 600, color: isEffectiveDark ? '#e6edf3' : '#1f2328' }}>
                                {p.login}
                              </span>
                              {p.name && (
                                <span style={{ fontSize: 12.5, color: '#8b949e', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                                  {p.name}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              )}
            </div>

            {/* 2. Labels */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                position: 'relative',
                padding: '12px 0',
                borderBottom: `1px solid ${sysBorder}`,
              }}
            >
              <div
                data-sidebar-trigger="labels"
                onClick={() => {
                  setActiveSidebarPopup((prev) => (prev === 'labels' ? null : 'labels'));
                  setLabelSearch('');
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '4px 6px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  background: activeSidebarPopup === 'labels' ? (isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : '#f0f2f5') : 'transparent',
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  if (activeSidebarPopup !== 'labels') {
                    e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeSidebarPopup !== 'labels') {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 600, color: isEffectiveDark ? '#c9d1d9' : '#24292f' }}>Labels</span>
                <Settings size={14} color={isEffectiveDark ? '#8b949e' : '#57606a'} />
              </div>

              {currentLabels.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '0 6px' }}>
                  {currentLabels.map((lbl, idx) => {
                    const isRed = String(lbl).toLowerCase().includes('alta') || String(lbl).toLowerCase().includes('urgent') || String(lbl).toLowerCase().includes('bug');
                    return (
                      <span
                        key={idx}
                        style={{
                          fontSize: 11,
                          fontWeight: 500,
                          padding: '2px 8px',
                          borderRadius: 12,
                          background: isRed ? 'rgba(248, 81, 73, 0.15)' : 'rgba(56, 139, 253, 0.15)',
                          color: isRed ? '#f85149' : '#58a6ff',
                          border: isRed ? '1px solid rgba(248, 81, 73, 0.35)' : '1px solid rgba(56, 139, 253, 0.35)',
                        }}
                      >
                        {lbl}
                      </span>
                    );
                  })}
                </div>
              ) : (
                <div style={{ fontSize: 12, color: theme?.textSecondary || '#8b949e', padding: '0 6px' }}>None yet</div>
              )}

              {/* Popup Apply Labels */}
              {activeSidebarPopup === 'labels' && (
                <div
                  data-sidebar-popup="labels"
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 2px)',
                    left: 0,
                    right: 0,
                    background: sysPopupBg,
                    border: `1px solid ${sysPopupBorder}`,
                    borderRadius: 8,
                    boxShadow: sysPopupShadow,
                    zIndex: 1000,
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ padding: '12px 14px 8px 14px', fontSize: 13.5, fontWeight: 600, color: sysTextPrimary }}>
                    Apply labels to this issue
                  </div>
                  <div style={{ padding: '0 12px 10px 12px' }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        background: sysInputBg,
                        border: `1px solid ${sysBorder}`,
                        borderRadius: 6,
                        padding: '5px 8px',
                      }}
                    >
                      <Search size={14} color={sysTextSecondary} />
                      <input
                        autoFocus
                        value={labelSearch}
                        onChange={(e) => setLabelSearch(e.target.value)}
                        placeholder="Filter labels"
                        style={{
                          background: 'transparent',
                          border: 'none',
                          outline: 'none',
                          color: sysTextPrimary,
                          fontSize: 13,
                          width: '100%',
                        }}
                        onFocus={(e) => {
                          const p = e.currentTarget.parentElement;
                          if (p) {
                            p.style.borderColor = accentColor;
                            p.style.boxShadow = `0 0 0 1px ${accentColor}`;
                          }
                        }}
                        onBlur={(e) => {
                          const p = e.currentTarget.parentElement;
                          if (p) {
                            p.style.borderColor = sysBorder;
                            p.style.boxShadow = 'none';
                          }
                        }}
                      />
                    </div>
                  </div>
                  <div style={{ borderBottom: `1px solid ${sysBorder}` }} />

                  <div style={{ maxHeight: 250, overflowY: 'auto' }}>
                    {(() => {
                      const standardLabels: Array<{ name: string; description: string; color: string; recent?: boolean }> = [
                        { name: 'mobile', description: 'Tarefas do app mobile', color: '#388bfd' },
                        { name: 'prioridade: alta', description: 'Prioridade alta', color: '#f85149' },
                        { name: 'prioridade: média', description: 'Prioridade média', color: '#d29922', recent: true },
                        { name: 'prioridade: baixa', description: 'Prioridade baixa', color: '#238636', recent: true },
                        { name: 'bug', description: 'Algo não está funcionando como esperado', color: '#f85149' },
                        { name: 'feature', description: 'Nova funcionalidade ou melhoria', color: '#a371f7' },
                        { name: 'documentation', description: 'Melhorias na documentação', color: '#0075ca' },
                        { name: 'ui/ux', description: 'Design e experiência de usuário', color: '#e36209' },
                      ];

                      // Garantir que labels existentes na issue também apareçam
                      currentLabels.forEach((cl) => {
                        if (!standardLabels.some((sl) => sl.name.toLowerCase() === cl.toLowerCase())) {
                          standardLabels.push({
                            name: cl,
                            description: `Tag ${cl}`,
                            color: '#388bfd',
                          });
                        }
                      });

                      const selectedItems = standardLabels.filter((l) =>
                        currentLabels.some((cl) => cl.toLowerCase() === l.name.toLowerCase()) &&
                        (l.name.toLowerCase().includes(labelSearch.toLowerCase()) || l.description.toLowerCase().includes(labelSearch.toLowerCase()))
                      );

                      const suggestionItems = standardLabels.filter((l) =>
                        !currentLabels.some((cl) => cl.toLowerCase() === l.name.toLowerCase()) &&
                        (l.name.toLowerCase().includes(labelSearch.toLowerCase()) || l.description.toLowerCase().includes(labelSearch.toLowerCase()))
                      );

                      return (
                        <>
                          {/* Section: Selected */}
                          {selectedItems.length > 0 && (
                            <div>
                              <div
                                style={{
                                  padding: '6px 12px',
                                  background: isEffectiveDark ? '#161616' : '#f0f2f5',
                                  fontSize: 11.5,
                                  fontWeight: 600,
                                  color: sysTextSecondary,
                                  borderBottom: `1px solid ${isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : '#d0d7de'}`,
                                }}
                              >
                                Selected
                              </div>
                              {selectedItems.map((lbl) => (
                                <div
                                  key={lbl.name}
                                  onClick={() => {
                                    const next = currentLabels.filter((l) => l.toLowerCase() !== lbl.name.toLowerCase());
                                    onUpdateIssue?.({ tag: next[0] || '', rawLabels: next });
                                  }}
                                  style={{
                                    position: 'relative',
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    gap: 10,
                                    padding: '8px 12px',
                                    cursor: 'pointer',
                                    background: hexToRgba(accentColor, 0.08),
                                    borderBottom: `1px solid ${sysBorder}`,
                                  }}
                                  onMouseEnter={(e) => { e.currentTarget.style.background = sysHoverBg; }}
                                  onMouseLeave={(e) => { e.currentTarget.style.background = hexToRgba(accentColor, 0.08); }}
                                >
                                  <div
                                    style={{
                                      position: 'absolute',
                                      left: 0,
                                      top: 0,
                                      bottom: 0,
                                      width: 3,
                                      background: accentColor,
                                      borderRadius: '0 2px 2px 0',
                                    }}
                                  />
                                  <div
                                    style={{
                                      width: 16,
                                      height: 16,
                                      borderRadius: 3,
                                      background: accentColor,
                                      border: `1px solid ${accentColor}`,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      flexShrink: 0,
                                      marginTop: 2,
                                    }}
                                  >
                                    <Check size={11} color={accentContrastText} strokeWidth={3} />
                                  </div>
                                  <div
                                    style={{
                                      width: 10,
                                      height: 10,
                                      borderRadius: '50%',
                                      background: lbl.color,
                                      flexShrink: 0,
                                      marginTop: 5,
                                    }}
                                  />
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: sysTextPrimary }}>
                                      {lbl.name}
                                    </div>
                                    <div style={{ fontSize: 11.5, color: sysTextSecondary, marginTop: 1 }}>
                                      {lbl.description}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Section: Suggestions */}
                          {suggestionItems.length > 0 && (
                            <div>
                              <div
                                style={{
                                  padding: '6px 12px',
                                  background: isEffectiveDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.02)',
                                  fontSize: 11.5,
                                  fontWeight: 600,
                                  color: sysTextSecondary,
                                  borderBottom: `1px solid ${sysBorder}`,
                                }}
                              >
                                Suggestions
                              </div>
                              {suggestionItems.map((lbl) => (
                                <div
                                  key={lbl.name}
                                  onClick={() => {
                                    const next = [...currentLabels, lbl.name];
                                    onUpdateIssue?.({ tag: next[0] || '', rawLabels: next });
                                  }}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    gap: 10,
                                    padding: '8px 12px',
                                    cursor: 'pointer',
                                    borderBottom: `1px solid ${sysBorder}`,
                                    transition: 'background 0.1s ease',
                                  }}
                                  onMouseEnter={(e) => { e.currentTarget.style.background = sysHoverBg; }}
                                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                                >
                                  <div
                                    style={{
                                      width: 16,
                                      height: 16,
                                      borderRadius: 3,
                                      background: 'transparent',
                                      border: `1px solid ${sysBorder}`,
                                      flexShrink: 0,
                                      marginTop: 2,
                                    }}
                                  />
                                  <div
                                    style={{
                                      width: 10,
                                      height: 10,
                                      borderRadius: '50%',
                                      background: lbl.color,
                                      flexShrink: 0,
                                      marginTop: 5,
                                    }}
                                  />
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: sysTextPrimary }}>
                                      {lbl.name}
                                    </div>
                                    <div style={{ fontSize: 11.5, color: sysTextSecondary, marginTop: 1 }}>
                                      {lbl.description}
                                    </div>
                                  </div>
                                  {lbl.recent && (
                                    <span style={{ fontSize: 11.5, color: sysTextSecondary, alignSelf: 'center' }}>
                                      Recent
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>

                  {/* Footer Edit labels */}
                  <div
                    onClick={() => {
                      showToast('Editor avançado de labels aberto.');
                      setActiveSidebarPopup(null);
                    }}
                    style={{
                      padding: '9px 12px',
                      textAlign: 'center',
                      fontSize: 12.5,
                      fontWeight: 600,
                      color: sysTextPrimary,
                      cursor: 'pointer',
                      borderTop: `1px solid ${sysBorder}`,
                      background: sysPopupBg,
                      transition: 'color 0.15s ease',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = accentColor; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = sysTextPrimary; }}
                  >
                    Edit labels
                  </div>
                </div>
              )}
            </div>

            {/* 3. Type */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                position: 'relative',
                padding: '12px 0',
                borderBottom: `1px solid ${sysBorder}`,
              }}
            >
              <div
                data-sidebar-trigger="type"
                onClick={() => {
                  setActiveSidebarPopup((prev) => (prev === 'type' ? null : 'type'));
                  setTypeSearch('');
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '4px 6px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  background: activeSidebarPopup === 'type' ? (isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : '#f0f2f5') : 'transparent',
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  if (activeSidebarPopup !== 'type') {
                    e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeSidebarPopup !== 'type') {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 600, color: isEffectiveDark ? '#c9d1d9' : '#24292f' }}>Type</span>
                <Settings size={14} color={isEffectiveDark ? '#8b949e' : '#57606a'} />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: selectedType !== 'No type' ? (theme?.textPrimary || '#fff') : (theme?.textSecondary || '#8b949e'), padding: '0 6px' }}>
                {selectedType === 'Bug' && <div style={{ width: 10, height: 10, borderRadius: '50%', border: '2px solid #f85149' }} />}
                {selectedType === 'Feature' && <div style={{ width: 10, height: 10, borderRadius: '50%', border: '2px solid #388bfd' }} />}
                {selectedType === 'Task' && <div style={{ width: 10, height: 10, borderRadius: '50%', border: '2px solid #d29922' }} />}
                <span>{selectedType}</span>
              </div>

              {/* Popup Select Issue Type */}
              {activeSidebarPopup === 'type' && (
                <div
                  data-sidebar-popup="type"
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 2px)',
                    left: 0,
                    right: 0,
                    background: sysPopupBg,
                    border: `1px solid ${sysPopupBorder}`,
                    borderRadius: 8,
                    boxShadow: sysPopupShadow,
                    zIndex: 1000,
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ padding: '12px 14px 8px 14px', fontSize: 13.5, fontWeight: 600, color: sysTextPrimary }}>
                    Select issue type
                  </div>
                  <div style={{ padding: '0 12px 10px 12px' }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        background: sysInputBg,
                        border: `1px solid ${sysBorder}`,
                        borderRadius: 6,
                        padding: '5px 8px',
                      }}
                    >
                      <Search size={14} color={sysTextSecondary} />
                      <input
                        autoFocus
                        value={typeSearch}
                        onChange={(e) => setTypeSearch(e.target.value)}
                        placeholder="Filter types"
                        style={{
                          background: 'transparent',
                          border: 'none',
                          outline: 'none',
                          color: sysTextPrimary,
                          fontSize: 13,
                          width: '100%',
                        }}
                        onFocus={(e) => {
                          const p = e.currentTarget.parentElement;
                          if (p) {
                            p.style.borderColor = accentColor;
                            p.style.boxShadow = `0 0 0 1px ${accentColor}`;
                          }
                        }}
                        onBlur={(e) => {
                          const p = e.currentTarget.parentElement;
                          if (p) {
                            p.style.borderColor = sysBorder;
                            p.style.boxShadow = 'none';
                          }
                        }}
                      />
                    </div>
                  </div>
                  <div style={{ borderBottom: `1px solid ${sysBorder}` }} />

                  <div>
                    {[
                      { key: 'Bug', title: 'Bug', description: 'An unexpected problem or behavior', color: '#f85149' },
                      { key: 'Feature', title: 'Feature', description: 'A request, idea, or new functionality', color: '#388bfd' },
                      { key: 'Task', title: 'Task', description: 'A specific piece of work', color: '#d29922' },
                    ]
                      .filter((t) => t.title.toLowerCase().includes(typeSearch.toLowerCase()) || t.description.toLowerCase().includes(typeSearch.toLowerCase()))
                      .map((t) => {
                        const isSelected = selectedType === t.key;
                        return (
                          <div
                            key={t.key}
                            onClick={() => {
                              setSelectedType(t.key);
                              setActiveSidebarPopup(null);
                            }}
                            style={{
                              position: 'relative',
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: 12,
                              padding: '10px 14px',
                              cursor: 'pointer',
                              background: isSelected ? hexToRgba(accentColor, 0.08) : 'transparent',
                              borderBottom: `1px solid ${sysBorder}`,
                              transition: 'background 0.1s ease',
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = sysHoverBg; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = isSelected ? hexToRgba(accentColor, 0.08) : 'transparent'; }}
                          >
                            {isSelected && (
                              <div
                                style={{
                                  position: 'absolute',
                                  left: 0,
                                  top: 0,
                                  bottom: 0,
                                  width: 3,
                                  background: accentColor,
                                  borderRadius: '0 2px 2px 0',
                                }}
                              />
                            )}

                            {/* Hollow Circle */}
                            <div
                              style={{
                                width: 14,
                                height: 14,
                                borderRadius: '50%',
                                border: `2px solid ${t.color}`,
                                flexShrink: 0,
                                marginTop: 3,
                              }}
                            />

                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 13.5, fontWeight: 600, color: sysTextPrimary }}>
                                {t.title}
                              </div>
                              <div style={{ fontSize: 12, color: sysTextSecondary, marginTop: 2 }}>
                                {t.description}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>

            {/* 4. Fields (Priority) */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                position: 'relative',
                padding: '12px 0',
                borderBottom: `1px solid ${sysBorder}`,
              }}
            >
              <div
                data-sidebar-trigger="priority"
                onClick={() => {
                  setActiveSidebarPopup((prev) => (prev === 'priority' ? null : 'priority'));
                  setPrioritySearch('');
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '4px 6px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  background: activeSidebarPopup === 'priority' ? (isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : '#f0f2f5') : 'transparent',
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  if (activeSidebarPopup !== 'priority') {
                    e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeSidebarPopup !== 'priority') {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 600, color: isEffectiveDark ? '#c9d1d9' : '#24292f' }}>Fields</span>
              </div>

              <div
                data-sidebar-trigger="priority"
                onClick={() => {
                  setActiveSidebarPopup((prev) => (prev === 'priority' ? null : 'priority'));
                  setPrioritySearch('');
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '6px 8px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  background: isEffectiveDark ? 'rgba(255,255,255,0.03)' : '#f6f8fa',
                  border: isEffectiveDark ? '1px solid rgba(255, 255, 255, 0.06)' : '1px solid #d0d7de',
                }}
              >
                <span style={{ fontSize: 12, color: theme?.textSecondary || '#8b949e' }}>Priority</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                  {issue.priority && (
                    <div
                      style={{
                        width: 9,
                        height: 9,
                        borderRadius: '50%',
                        border: `2px solid ${
                          issue.priority === 'Urgente' || issue.priority === 'Urgent' as any
                            ? '#d254a6'
                            : issue.priority === 'Alta' || issue.priority === 'High' as any
                            ? '#f85149'
                            : issue.priority === 'Média' || issue.priority === 'Medium' as any
                            ? '#d29922'
                            : '#238636'
                        }`,
                      }}
                    />
                  )}
                  <span style={{ color: issue.priority ? (theme?.textPrimary || '#fff') : (theme?.textSecondary || '#8b949e') }}>
                    {issue.priority || 'Choose an option'}
                  </span>
                </div>
              </div>

              {/* Popup Select Priority */}
              {activeSidebarPopup === 'priority' && (
                <div
                  data-sidebar-popup="priority"
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 2px)',
                    left: 0,
                    right: 0,
                    background: sysPopupBg,
                    border: `1px solid ${sysPopupBorder}`,
                    borderRadius: 8,
                    boxShadow: sysPopupShadow,
                    zIndex: 1000,
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ padding: '12px 14px 8px 14px', fontSize: 13.5, fontWeight: 600, color: sysTextPrimary }}>
                    Select Priority
                  </div>
                  <div style={{ padding: '0 12px 10px 12px' }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        background: sysInputBg,
                        border: `1px solid ${sysBorder}`,
                        borderRadius: 6,
                        padding: '5px 8px',
                      }}
                    >
                      <Search size={14} color={sysTextSecondary} />
                      <input
                        autoFocus
                        value={prioritySearch}
                        onChange={(e) => setPrioritySearch(e.target.value)}
                        placeholder="Filter option"
                        style={{
                          background: 'transparent',
                          border: 'none',
                          outline: 'none',
                          color: sysTextPrimary,
                          fontSize: 13,
                          width: '100%',
                        }}
                        onFocus={(e) => {
                          const p = e.currentTarget.parentElement;
                          if (p) {
                            p.style.borderColor = accentColor;
                            p.style.boxShadow = `0 0 0 1px ${accentColor}`;
                          }
                        }}
                        onBlur={(e) => {
                          const p = e.currentTarget.parentElement;
                          if (p) {
                            p.style.borderColor = sysBorder;
                            p.style.boxShadow = 'none';
                          }
                        }}
                      />
                    </div>
                  </div>
                  <div style={{ borderBottom: `1px solid ${sysBorder}` }} />

                  <div>
                    {[
                      { key: 'Urgente', label: 'Urgent', color: '#d254a6' },
                      { key: 'Alta', label: 'High', color: '#f85149' },
                      { key: 'Média', label: 'Medium', color: '#d29922' },
                      { key: 'Baixa', label: 'Low', color: '#238636' },
                    ]
                      .filter((p) => p.label.toLowerCase().includes(prioritySearch.toLowerCase()) || p.key.toLowerCase().includes(prioritySearch.toLowerCase()))
                      .map((p) => {
                        const isSelected = issue.priority === p.key || issue.priority === p.label as any;
                        return (
                          <div
                            key={p.key}
                            onClick={() => {
                              onUpdateIssue?.({ priority: p.key as any });
                              setActiveSidebarPopup(null);
                            }}
                            style={{
                              position: 'relative',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 12,
                              padding: '10px 14px',
                              cursor: 'pointer',
                              background: isSelected ? hexToRgba(accentColor, 0.08) : 'transparent',
                              borderBottom: `1px solid ${sysBorder}`,
                              transition: 'background 0.1s ease',
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = sysHoverBg; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = isSelected ? hexToRgba(accentColor, 0.08) : 'transparent'; }}
                          >
                            {isSelected && (
                              <div
                                style={{
                                  position: 'absolute',
                                  left: 0,
                                  top: 0,
                                  bottom: 0,
                                  width: 3,
                                  background: accentColor,
                                  borderRadius: '0 2px 2px 0',
                                }}
                              />
                            )}

                            {/* Hollow Circle */}
                            <div
                              style={{
                                width: 14,
                                height: 14,
                                borderRadius: '50%',
                                border: `2px solid ${p.color}`,
                                flexShrink: 0,
                              }}
                            />

                            <span style={{ fontSize: 13.5, fontWeight: 600, color: sysTextPrimary }}>
                              {p.label}
                            </span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>

            {/* 5. Projects */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                position: 'relative',
                padding: '12px 0',
                borderBottom: `1px solid ${sysBorder}`,
              }}
            >
              <div
                data-sidebar-trigger="projects"
                onClick={() => {
                  setActiveSidebarPopup((prev) => (prev === 'projects' ? null : 'projects'));
                  setProjectSearch('');
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '4px 6px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  background: activeSidebarPopup === 'projects' ? (isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : '#f0f2f5') : 'transparent',
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  if (activeSidebarPopup !== 'projects') {
                    e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeSidebarPopup !== 'projects') {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 600, color: isEffectiveDark ? '#c9d1d9' : '#24292f' }}>Projects</span>
                <Settings size={14} color={isEffectiveDark ? '#8b949e' : '#57606a'} />
              </div>

              {/* Popup Select Projects */}
              {activeSidebarPopup === 'projects' && (
                <div
                  data-sidebar-popup="projects"
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 2px)',
                    left: 0,
                    right: 0,
                    background: sysPopupBg,
                    border: `1px solid ${sysPopupBorder}`,
                    borderRadius: 8,
                    boxShadow: sysPopupShadow,
                    zIndex: 1000,
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ padding: '12px 14px 8px 14px', fontSize: 13.5, fontWeight: 600, color: sysTextPrimary }}>
                    Select projects
                  </div>
                  <div style={{ padding: '0 12px 10px 12px' }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        background: sysInputBg,
                        border: `1px solid ${sysBorder}`,
                        borderRadius: 6,
                        padding: '5px 8px',
                      }}
                    >
                      <Search size={14} color={sysTextSecondary} />
                      <input
                        autoFocus
                        value={projectSearch}
                        onChange={(e) => setProjectSearch(e.target.value)}
                        placeholder="Filter projects"
                        style={{
                          background: 'transparent',
                          border: 'none',
                          outline: 'none',
                          color: sysTextPrimary,
                          fontSize: 13,
                          width: '100%',
                        }}
                        onFocus={(e) => {
                          const p = e.currentTarget.parentElement;
                          if (p) {
                            p.style.borderColor = accentColor;
                            p.style.boxShadow = `0 0 0 1px ${accentColor}`;
                          }
                        }}
                        onBlur={(e) => {
                          const p = e.currentTarget.parentElement;
                          if (p) {
                            p.style.borderColor = sysBorder;
                            p.style.boxShadow = 'none';
                          }
                        }}
                      />
                    </div>
                  </div>
                  <div style={{ borderBottom: `1px solid ${sysBorder}` }} />

                  <div style={{ maxHeight: 250, overflowY: 'auto' }}>
                    {/* Section: Group selected */}
                    {(() => {
                      const activeProject = repoFullName?.split('/')[1] || issue.projectTitle || 'Estância Bahia';
                      const recentProjects = ['AgroBravo', 'Aura Dev', 'Click Fan', 'Calcfarm'].filter((p) => p !== activeProject);
                      const orgProjects = ['Sanspray'].filter((p) => p !== activeProject);

                      const matchesSearch = (title: string) => title.toLowerCase().includes(projectSearch.toLowerCase());

                      return (
                        <>
                          {matchesSearch(activeProject) && (
                            <div>
                              <div
                                style={{
                                  padding: '6px 12px',
                                  background: isEffectiveDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.02)',
                                  fontSize: 11.5,
                                  fontWeight: 600,
                                  color: sysTextSecondary,
                                  borderBottom: `1px solid ${sysBorder}`,
                                }}
                              >
                                Group selected
                              </div>
                              <div
                                onClick={() => {
                                  showToast(`Projeto "${activeProject}" ativo!`);
                                }}
                                style={{
                                  position: 'relative',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 10,
                                  padding: '8px 12px',
                                  cursor: 'pointer',
                                  background: hexToRgba(accentColor, 0.08),
                                  borderBottom: `1px solid ${sysBorder}`,
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.background = sysHoverBg; }}
                                onMouseLeave={(e) => { e.currentTarget.style.background = hexToRgba(accentColor, 0.08); }}
                              >
                                <div
                                  style={{
                                    position: 'absolute',
                                    left: 0,
                                    top: 0,
                                    bottom: 0,
                                    width: 3,
                                    background: accentColor,
                                    borderRadius: '0 2px 2px 0',
                                  }}
                                />
                                <div
                                  style={{
                                    width: 16,
                                    height: 16,
                                    borderRadius: 3,
                                    background: accentColor,
                                    border: `1px solid ${accentColor}`,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                  }}
                                >
                                  <Check size={11} color={accentContrastText} strokeWidth={3} />
                                </div>
                                <Columns3 size={15} color={sysTextSecondary} />
                                <span style={{ fontSize: 13, fontWeight: 600, color: sysTextPrimary }}>
                                  {activeProject}
                                </span>
                              </div>
                            </div>
                          )}

                          {/* Section: Recent */}
                          {recentProjects.some(matchesSearch) && (
                            <div>
                              <div
                                style={{
                                  padding: '6px 12px',
                                  background: isEffectiveDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.02)',
                                  fontSize: 11.5,
                                  fontWeight: 600,
                                  color: sysTextSecondary,
                                  borderTop: `1px solid ${sysBorder}`,
                                  borderBottom: `1px solid ${sysBorder}`,
                                }}
                              >
                                Recent
                              </div>
                              {recentProjects.filter(matchesSearch).map((proj) => (
                                <div
                                  key={proj}
                                  onClick={() => {
                                    onUpdateIssue?.({ projectTitle: proj });
                                    showToast(`Projeto alterado para "${proj}"!`);
                                    setActiveSidebarPopup(null);
                                  }}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 10,
                                    padding: '8px 12px',
                                    cursor: 'pointer',
                                    borderBottom: `1px solid ${sysBorder}`,
                                    transition: 'background 0.1s ease',
                                  }}
                                  onMouseEnter={(e) => { e.currentTarget.style.background = sysHoverBg; }}
                                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                                >
                                  <div
                                    style={{
                                      width: 16,
                                      height: 16,
                                      borderRadius: 3,
                                      background: 'transparent',
                                      border: `1px solid ${sysBorder}`,
                                      flexShrink: 0,
                                    }}
                                  />
                                  <Columns3 size={15} color={sysTextSecondary} />
                                  <span style={{ fontSize: 13, fontWeight: 500, color: sysTextPrimary }}>
                                    {proj}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Section: Repository */}
                          <div
                            style={{
                              padding: '6px 12px',
                              background: isEffectiveDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.02)',
                              fontSize: 11.5,
                              fontWeight: 600,
                              color: sysTextSecondary,
                              borderTop: `1px solid ${sysBorder}`,
                            }}
                          >
                            Repository
                          </div>

                          {/* Section: Organization */}
                          <div>
                            <div
                              style={{
                                padding: '6px 12px',
                                background: isEffectiveDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.02)',
                                fontSize: 11.5,
                                fontWeight: 600,
                                color: sysTextSecondary,
                                borderTop: `1px solid ${sysBorder}`,
                                borderBottom: `1px solid ${sysBorder}`,
                              }}
                            >
                              Organization
                            </div>
                            {orgProjects.filter(matchesSearch).map((proj) => (
                              <div
                                key={proj}
                                onClick={() => {
                                  onUpdateIssue?.({ projectTitle: proj });
                                  showToast(`Projeto alterado para "${proj}"!`);
                                  setActiveSidebarPopup(null);
                                }}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 10,
                                  padding: '8px 12px',
                                  cursor: 'pointer',
                                  borderBottom: `1px solid ${sysBorder}`,
                                  transition: 'background 0.1s ease',
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.background = sysHoverBg; }}
                                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                              >
                                <div
                                  style={{
                                    width: 16,
                                    height: 16,
                                    borderRadius: 3,
                                    background: 'transparent',
                                    border: `1px solid ${sysBorder}`,
                                    flexShrink: 0,
                                  }}
                                />
                                <Columns3 size={15} color={sysTextSecondary} />
                                <span style={{ fontSize: 13, fontWeight: 500, color: sysTextPrimary }}>
                                  {proj}
                                </span>
                              </div>
                            ))}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* Project Card */}
              <div
                style={{
                  borderRadius: 8,
                  border: 'none',
                  background: isEffectiveDark ? 'rgba(255, 255, 255, 0.04)' : '#f6f8fa',
                  padding: '10px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                {/* Card Title */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Columns3 size={14} color={theme?.textSecondary || '#8b949e'} />
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: theme?.textPrimary || '#fff' }}>
                    {repoFullName?.split('/')[1] || issue.projectTitle || 'Estância Bahia'}
                  </span>
                </div>

                {/* Status Row */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, color: theme?.textSecondary || '#8b949e' }}>Status</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => setIsStatusDropdownOpen((prev) => !prev)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '2px 8px',
                        borderRadius: 12,
                        background: 'rgba(35, 134, 54, 0.2)',
                        border: '1px solid rgba(35, 134, 54, 0.4)',
                        color: '#3fb950',
                        fontSize: 11.5,
                        fontWeight: 500,
                        cursor: 'pointer',
                      }}
                    >
                      <span>{issue.status || 'Backlog'}</span>
                      <ChevronDown size={11} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsProjectCardExpanded((prev) => !prev)}
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 4,
                        background: isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)',
                        border: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        color: theme?.textSecondary || '#8b949e',
                      }}
                    >
                      {isProjectCardExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </button>
                  </div>
                </div>

                {/* Expanded Fields */}
                {isProjectCardExpanded && (
                  <div
                    style={{
                      borderTop: 'none',
                      paddingTop: 4,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      fontSize: 12,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
                      <span style={{ color: theme?.textSecondary || '#8b949e' }}>Size</span>
                      <button
                        type="button"
                        onClick={() => setIsSizeDropdownOpen((prev) => !prev)}
                        style={{ background: 'transparent', border: 'none', color: selectedSize ? (theme?.textPrimary || '#fff') : (theme?.textSecondary || '#8b949e'), fontSize: 12, cursor: 'pointer' }}
                      >
                        {selectedSize || 'Choose an option'}
                      </button>
                      {isSizeDropdownOpen && (
                        <div
                          style={{
                            position: 'absolute',
                            top: 'calc(100% + 4px)',
                            right: 0,
                            background: dropdownSurfaceBg,
                            border: 'none',
                            borderRadius: 8,
                            padding: 4,
                            boxShadow: isEffectiveDark ? '0 8px 24px rgba(0,0,0,0.7)' : '0 4px 16px rgba(0,0,0,0.1)',
                            zIndex: 100,
                            minWidth: 100,
                          }}
                        >
                          {['XS', 'S', 'M', 'L', 'XL'].map((s) => (
                            <div
                              key={s}
                              onClick={() => {
                                setSelectedSize(s);
                                setIsSizeDropdownOpen(false);
                              }}
                              style={{ padding: '4px 8px', borderRadius: 4, cursor: 'pointer', fontSize: 11.5, color: selectedSize === s ? accentColor : (theme?.textPrimary || '#fff') }}
                            >
                              {s}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ color: theme?.textSecondary || '#8b949e' }}>Estimate</span>
                      <input
                        type="text"
                        value={estimateValue}
                        placeholder="Enter number..."
                        onChange={(e) => setEstimateValue(e.target.value)}
                        style={{
                          width: 100,
                          background: 'transparent',
                          border: 'none',
                          textAlign: 'right',
                          color: theme?.textPrimary || '#fff',
                          fontSize: 12,
                          outline: 'none',
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ color: theme?.textSecondary || '#8b949e' }}>Sprint</span>
                      <button
                        type="button"
                        onClick={() => setIsSprintDropdownOpen((prev) => !prev)}
                        style={{ background: 'transparent', border: 'none', color: issue.milestoneTitle ? (theme?.textPrimary || '#fff') : (theme?.textSecondary || '#8b949e'), fontSize: 12, cursor: 'pointer', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      >
                        {issue.milestoneTitle || 'Choose an iteration'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Status Dropdown */}
              {isStatusDropdownOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 4px)',
                    left: 0,
                    right: 0,
                    background: dropdownSurfaceBg,
                    border: 'none',
                    borderRadius: 10,
                    padding: 6,
                    boxShadow: isEffectiveDark ? '0 12px 36px rgba(0,0,0,0.7)' : '0 8px 24px rgba(0,0,0,0.12)',
                    zIndex: 100,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                  }}
                >
                  {statusOptions.map((st) => (
                    <div
                      key={st}
                      onClick={() => {
                        const rawState = st === 'Concluído' ? 'closed' : 'open';
                        onUpdateIssue?.({ status: st, rawState, state: rawState });
                        setIsStatusDropdownOpen(false);
                      }}
                      style={{
                        padding: '6px 8px',
                        borderRadius: 6,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        fontSize: 12,
                        color: issue.status === st ? accentColor : (theme?.textPrimary || '#fff'),
                      }}
                    >
                      <span>{st}</span>
                      {issue.status === st && <Check size={12} color={accentColor} />}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 6. Milestone */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                position: 'relative',
                padding: '12px 0',
                borderBottom: `1px solid ${sysBorder}`,
              }}
            >
              <div
                data-sidebar-trigger="milestone"
                onClick={() => {
                  setActiveSidebarPopup((prev) => (prev === 'milestone' ? null : 'milestone'));
                  setMilestoneSearch('');
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '4px 6px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  background: activeSidebarPopup === 'milestone' ? (isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : '#f0f2f5') : 'transparent',
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  if (activeSidebarPopup !== 'milestone') {
                    e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeSidebarPopup !== 'milestone') {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 600, color: isEffectiveDark ? '#c9d1d9' : '#24292f' }}>Milestone</span>
                <Settings size={14} color={isEffectiveDark ? '#8b949e' : '#57606a'} />
              </div>

              {issue.milestoneTitle ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '0 6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <Target size={14} color="#a371f7" />
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: theme?.textPrimary || '#fff' }}>
                      {issue.milestoneTitle}
                    </span>
                  </div>
                  <span style={{ fontSize: 11, color: theme?.textSecondary || '#8b949e', paddingLeft: 21 }}>
                    {issue.dueDateIso ? `Due ${issue.dueDateIso}` : 'No due date'}
                  </span>
                </div>
              ) : (
                <span style={{ fontSize: 12, color: theme?.textSecondary || '#8b949e', padding: '0 6px' }}>No milestone</span>
              )}

              {/* Popup Set Milestone */}
              {activeSidebarPopup === 'milestone' && (
                <div
                  data-sidebar-popup="milestone"
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 2px)',
                    left: 0,
                    right: 0,
                    background: sysPopupBg,
                    border: `1px solid ${sysPopupBorder}`,
                    borderRadius: 8,
                    boxShadow: sysPopupShadow,
                    zIndex: 1000,
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ padding: '12px 14px 8px 14px', fontSize: 13.5, fontWeight: 600, color: sysTextPrimary }}>
                    Set milestone
                  </div>
                  <div style={{ padding: '0 12px 10px 12px' }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        background: sysInputBg,
                        border: `1px solid ${sysBorder}`,
                        borderRadius: 6,
                        padding: '5px 8px',
                      }}
                    >
                      <Search size={14} color={sysTextSecondary} />
                      <input
                        autoFocus
                        value={milestoneSearch}
                        onChange={(e) => setMilestoneSearch(e.target.value)}
                        placeholder="Filter milestones"
                        style={{
                          background: 'transparent',
                          border: 'none',
                          outline: 'none',
                          color: sysTextPrimary,
                          fontSize: 13,
                          width: '100%',
                        }}
                        onFocus={(e) => {
                          const p = e.currentTarget.parentElement;
                          if (p) {
                            p.style.borderColor = accentColor;
                            p.style.boxShadow = `0 0 0 1px ${accentColor}`;
                          }
                        }}
                        onBlur={(e) => {
                          const p = e.currentTarget.parentElement;
                          if (p) {
                            p.style.borderColor = sysBorder;
                            p.style.boxShadow = 'none';
                          }
                        }}
                      />
                    </div>
                  </div>
                  <div style={{ borderBottom: `1px solid ${sysBorder}` }} />

                  <div style={{ maxHeight: 250, overflowY: 'auto' }}>
                    {(() => {
                      const allMilestones: Array<{ number: number; title: string; dueDate?: string }> =
                        availableSprints && availableSprints.length > 0
                          ? availableSprints.map((sp) => ({
                              number: sp.number ?? 1,
                              title: sp.title || `Sprint ${sp.number}`,
                              dueDate: 'No due date',
                            }))
                          : [
                              { number: 1, title: 'Redesign Home - Sprint 1', dueDate: 'No due date' },
                              { number: 2, title: 'Sprint 2 - Backend & Auth', dueDate: 'No due date' },
                            ];

                      if (
                        issue.milestoneTitle &&
                        !allMilestones.some((m) => m.title.toLowerCase() === issue.milestoneTitle?.toLowerCase())
                      ) {
                        allMilestones.unshift({
                          number: issue.milestoneNumber ?? 1,
                          title: issue.milestoneTitle,
                          dueDate: issue.dueDateIso ? `Due ${issue.dueDateIso}` : 'No due date',
                        });
                      }

                      const filtered = allMilestones.filter((m) =>
                        m.title.toLowerCase().includes(milestoneSearch.toLowerCase())
                      );

                      if (filtered.length === 0) {
                        return (
                          <div style={{ padding: '14px 12px', fontSize: 12.5, color: sysTextSecondary, textAlign: 'center' }}>
                            Nenhuma milestone encontrada
                          </div>
                        );
                      }

                      return (
                        <>
                          {issue.milestoneTitle && (
                            <div
                              onClick={() => {
                                onUpdateIssue?.({ milestoneNumber: null, milestoneTitle: undefined });
                                setActiveSidebarPopup(null);
                                showToast('Milestone desvinculada!');
                              }}
                              style={{
                                padding: '8px 14px',
                                fontSize: 12,
                                color: '#f85149',
                                cursor: 'pointer',
                                borderBottom: `1px solid ${sysBorder}`,
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.background = sysHoverBg; }}
                              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                            >
                              Clear milestone
                            </div>
                          )}

                          {filtered.map((m) => {
                            const isSelected =
                              issue.milestoneNumber === m.number ||
                              issue.milestoneTitle?.toLowerCase() === m.title.toLowerCase();

                            return (
                              <div
                                key={m.number}
                                onClick={() => {
                                  onUpdateIssue?.({ milestoneNumber: m.number, milestoneTitle: m.title });
                                  setActiveSidebarPopup(null);
                                  showToast(`Milestone alterada para "${m.title}"!`);
                                }}
                                style={{
                                  position: 'relative',
                                  display: 'flex',
                                  alignItems: 'flex-start',
                                  gap: 10,
                                  padding: '10px 14px',
                                  cursor: 'pointer',
                                  background: isSelected ? hexToRgba(accentColor, 0.08) : 'transparent',
                                  borderBottom: `1px solid ${sysBorder}`,
                                  transition: 'background 0.1s ease',
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.background = sysHoverBg; }}
                                onMouseLeave={(e) => { e.currentTarget.style.background = isSelected ? hexToRgba(accentColor, 0.08) : 'transparent'; }}
                              >
                                {isSelected && (
                                  <div
                                    style={{
                                      position: 'absolute',
                                      left: 0,
                                      top: 0,
                                      bottom: 0,
                                      width: 3,
                                      background: accentColor,
                                      borderRadius: '0 2px 2px 0',
                                    }}
                                  />
                                )}

                                <div style={{ width: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>
                                  {isSelected ? (
                                    <Check size={14} color={accentColor} strokeWidth={2.5} />
                                  ) : null}
                                </div>

                                <Milestone size={15} color={isSelected ? accentColor : sysTextSecondary} style={{ marginTop: 2, flexShrink: 0 }} />

                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: 13, fontWeight: 600, color: sysTextPrimary }}>
                                    {m.title}
                                  </div>
                                  <div style={{ fontSize: 11.5, color: sysTextSecondary, marginTop: 2 }}>
                                    {m.dueDate || 'No due date'}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>

            {/* 7. Relationships */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                position: 'relative',
                padding: '12px 0',
                borderBottom: `1px solid ${sysBorder}`,
              }}
            >
              <div
                data-sidebar-trigger="relationships"
                onClick={() => setActiveSidebarPopup((prev) => (prev === 'relationships' ? null : 'relationships'))}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '4px 6px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  background: activeSidebarPopup === 'relationships' ? (isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : '#f0f2f5') : 'transparent',
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  if (activeSidebarPopup !== 'relationships') {
                    e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeSidebarPopup !== 'relationships') {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 600, color: isEffectiveDark ? '#c9d1d9' : '#24292f' }}>Relationships</span>
                <Settings size={14} color={isEffectiveDark ? '#8b949e' : '#57606a'} />
              </div>
              <div style={{ fontSize: 12, color: theme?.textSecondary || '#8b949e', padding: '0 6px' }}>None yet</div>

              {/* Popup Relationships */}
              {activeSidebarPopup === 'relationships' && (
                <div
                  data-sidebar-popup="relationships"
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 2px)',
                    left: 0,
                    right: 0,
                    background: sysPopupBg,
                    border: `1px solid ${sysPopupBorder}`,
                    borderRadius: 8,
                    padding: 4,
                    boxShadow: sysPopupShadow,
                    zIndex: 1000,
                    overflow: 'hidden',
                  }}
                >
                  {[
                    { label: 'Add parent', shortcut: '⌥ ⇧ P' },
                    { label: 'Mark as blocked by', shortcuts: ['B', 'B'] },
                    { label: 'Mark as blocking', shortcuts: ['B', 'X'] },
                    { label: 'Add relates to', shortcuts: ['B', 'R'] },
                    { label: 'Add security alert' },
                  ].map((item, idx) => (
                    <div
                      key={idx}
                      onClick={() => {
                        showToast(`Ação "${item.label}" executada.`);
                        setActiveSidebarPopup(null);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        borderRadius: 6,
                        cursor: 'pointer',
                        fontSize: 13,
                        color: sysTextPrimary,
                        transition: 'background 0.1s ease',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = sysHoverBg; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      <span>{item.label}</span>
                      {item.shortcut && (
                        <kbd
                          style={{
                            background: sysInputBg,
                            border: `1px solid ${sysBorder}`,
                            borderRadius: 4,
                            padding: '1px 5px',
                            fontSize: 11,
                            color: sysTextSecondary,
                            fontFamily: 'inherit',
                          }}
                        >
                          {item.shortcut}
                        </kbd>
                      )}
                      {item.shortcuts && (
                        <div style={{ display: 'flex', gap: 3 }}>
                          {item.shortcuts.map((sc, sIdx) => (
                            <kbd
                              key={sIdx}
                              style={{
                                background: sysInputBg,
                                border: `1px solid ${sysBorder}`,
                                borderRadius: 4,
                                padding: '1px 5px',
                                fontSize: 11,
                                color: sysTextSecondary,
                                fontFamily: 'inherit',
                              }}
                            >
                              {sc}
                            </kbd>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 8. Development */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                position: 'relative',
                padding: '12px 0',
                borderBottom: `1px solid ${sysBorder}`,
              }}
            >
              <div
                data-sidebar-trigger="development"
                onClick={() => {
                  setActiveSidebarPopup((prev) => (prev === 'development' ? null : 'development'));
                  setPrSearch('');
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '4px 6px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  background: activeSidebarPopup === 'development' ? (isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : '#f0f2f5') : 'transparent',
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  if (activeSidebarPopup !== 'development') {
                    e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeSidebarPopup !== 'development') {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 600, color: isEffectiveDark ? '#c9d1d9' : '#24292f' }}>Development</span>
                <Settings size={14} color={isEffectiveDark ? '#8b949e' : '#57606a'} />
              </div>
              <div style={{ fontSize: 12, color: theme?.textSecondary || '#8b949e', lineHeight: 1.45, padding: '0 6px' }}>
                <span
                  onClick={() => onCreateBranchForIssue?.(issue)}
                  style={{ color: '#58a6ff', cursor: 'pointer', textDecoration: 'none' }}
                >
                  Create a branch
                </span>{' '}
                for this issue or link a pull request.
              </div>
              {issue.pullRequest && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: theme?.textPrimary || '#fff', marginTop: 4, padding: '0 6px' }}>
                  <GitPullRequest size={13} color="#22c55e" />
                  <span>PR #{issue.pullRequest.number}: {issue.pullRequest.title}</span>
                </div>
              )}

              {/* Popup Development */}
              {activeSidebarPopup === 'development' && (
                <div
                  data-sidebar-popup="development"
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 2px)',
                    left: 0,
                    right: 0,
                    background: sysPopupBg,
                    border: `1px solid ${sysPopupBorder}`,
                    borderRadius: 8,
                    boxShadow: sysPopupShadow,
                    zIndex: 1000,
                    overflow: 'hidden',
                  }}
                >
                  {/* Top Repo Header */}
                  <div style={{ padding: '10px 12px 6px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => setActiveSidebarPopup(null)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: sysTextPrimary,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        padding: 2,
                      }}
                    >
                      <ArrowLeft size={14} />
                    </button>
                    <span style={{ fontSize: 13, fontWeight: 700, color: sysTextPrimary }}>
                      {repoFullName || 'appmoove/estancia-bahia-mobile'}
                    </span>
                  </div>

                  {/* Subtitle */}
                  <div style={{ padding: '0 12px 8px 12px', fontSize: 12, color: sysTextSecondary, lineHeight: 1.4 }}>
                    Link a branch, pull request, or{' '}
                    <span
                      onClick={() => {
                        onCreateBranchForIssue?.(issue);
                        setActiveSidebarPopup(null);
                      }}
                      style={{ color: accentColor, cursor: 'pointer', textDecoration: 'underline' }}
                    >
                      create a branch
                    </span>
                  </div>

                  {/* Search Input */}
                  <div style={{ padding: '0 12px 10px 12px' }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        background: sysInputBg,
                        border: `1px solid ${sysBorder}`,
                        borderRadius: 6,
                        padding: '5px 8px',
                      }}
                    >
                      <Search size={14} color={sysTextSecondary} />
                      <input
                        autoFocus
                        value={prSearch}
                        onChange={(e) => setPrSearch(e.target.value)}
                        placeholder="Search pull requests"
                        style={{
                          background: 'transparent',
                          border: 'none',
                          outline: 'none',
                          color: sysTextPrimary,
                          fontSize: 13,
                          width: '100%',
                        }}
                        onFocus={(e) => {
                          const p = e.currentTarget.parentElement;
                          if (p) {
                            p.style.borderColor = accentColor;
                            p.style.boxShadow = `0 0 0 1px ${accentColor}`;
                          }
                        }}
                        onBlur={(e) => {
                          const p = e.currentTarget.parentElement;
                          if (p) {
                            p.style.borderColor = sysBorder;
                            p.style.boxShadow = 'none';
                          }
                        }}
                      />
                    </div>
                  </div>
                  <div style={{ borderBottom: `1px solid ${sysBorder}` }} />

                  {/* Pull Request / Branch Items */}
                  <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                    {(() => {
                      const prTitle = issue.pullRequest?.title || 'Issue 18 eb360 requisitos';
                      const prNum = issue.pullRequest?.number || 61;
                      const repoName = repoFullName || 'appmoove/estancia-bahia-mobile';

                      if (prSearch && !prTitle.toLowerCase().includes(prSearch.toLowerCase())) {
                        return (
                          <div style={{ padding: '14px 12px', fontSize: 12.5, color: sysTextSecondary, textAlign: 'center' }}>
                            Nenhum pull request encontrado
                          </div>
                        );
                      }

                      return (
                        <div
                          onClick={() => {
                            showToast(`PR #${prNum} vinculado à issue!`);
                            setActiveSidebarPopup(null);
                          }}
                          style={{
                            position: 'relative',
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 10,
                            padding: '10px 14px',
                            cursor: 'pointer',
                            background: hexToRgba(accentColor, 0.08),
                            borderBottom: `1px solid ${sysBorder}`,
                            transition: 'background 0.1s ease',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = sysHoverBg; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = hexToRgba(accentColor, 0.08); }}
                        >
                          <div
                            style={{
                              position: 'absolute',
                              left: 0,
                              top: 0,
                              bottom: 0,
                              width: 3,
                              background: accentColor,
                              borderRadius: '0 2px 2px 0',
                            }}
                          />

                          <div
                            style={{
                              width: 16,
                              height: 16,
                              borderRadius: 3,
                              background: 'transparent',
                              border: `1px solid ${sysBorder}`,
                              flexShrink: 0,
                              marginTop: 2,
                            }}
                          />

                          <GitPullRequest size={15} color={accentColor} style={{ marginTop: 2, flexShrink: 0 }} />

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: sysTextPrimary }}>
                              {prTitle}
                            </div>
                            <div style={{ fontSize: 11.5, color: sysTextSecondary, marginTop: 2 }}>
                              {repoName}#{prNum}
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>

            {/* 9. Notifications */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                padding: '12px 0',
                borderBottom: `1px solid ${sysBorder}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: isEffectiveDark ? '#c9d1d9' : '#24292f' }}>Notifications</span>
                <span style={{ fontSize: 11.5, color: '#58a6ff', cursor: 'pointer' }}>Customize</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsSubscribed((prev) => !prev);
                  showToast(isSubscribed ? 'Notificações desativadas para esta issue.' : 'Notificações ativadas para esta issue.');
                }}
                style={{
                  width: '100%',
                  padding: '6px 12px',
                  borderRadius: 6,
                  background: isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : '#f6f8fa',
                  border: isEffectiveDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid #d0d7de',
                  color: theme?.textPrimary || '#fff',
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  transition: 'background 0.15s ease',
                }}
              >
                {isSubscribed ? <BellOff size={13} /> : <Bell size={13} />}
                <span>{isSubscribed ? 'Unsubscribe' : 'Subscribe'}</span>
              </button>
              <span style={{ fontSize: 11, color: theme?.textSecondary || '#8b949e', lineHeight: 1.35 }}>
                {isSubscribed
                  ? "You're receiving notifications because you're subscribed to this thread."
                  : "You're not receiving notifications from this thread."}
              </span>
            </div>

            {/* 10. Participants */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                padding: '12px 0',
                borderBottom: `1px solid ${sysBorder}`,
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 600, color: isEffectiveDark ? '#c9d1d9' : '#24292f' }}>Participants</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                {participants.length > 0 ? (
                  participants.map((p, pIdx) => (
                    <div
                      key={pIdx}
                      title={p.login}
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: '50%',
                        overflow: 'hidden',
                        background: accentColor,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 10,
                        fontWeight: 600,
                        color: '#fff',
                      }}
                    >
                      {p.avatarUrl ? <img src={p.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : p.initial}
                    </div>
                  ))
                ) : (
                  <div
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      background: accentColor,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 10,
                      fontWeight: 600,
                      color: '#fff',
                    }}
                  >
                    W
                  </div>
                )}
              </div>
            </div>

            {/* 11. Ações de Rodapé (Estilo GitHub) */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                paddingTop: 12,
              }}
            >
              {/* Open in GitHub Copilot app */}
              <button
                type="button"
                onClick={() => onAskAiAboutIssue?.(issue)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '6px 8px',
                  borderRadius: 6,
                  background: 'transparent',
                  border: 'none',
                  color: theme?.textPrimary || '#fff',
                  fontSize: 12,
                  fontWeight: 400,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background 0.12s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <Sparkles size={14} color={accentColor} />
                <span>Open in GitHub Copilot app</span>
              </button>

              {/* Transfer issue */}
              <button
                type="button"
                onClick={() => showToast('Transferência de issue em breve')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '6px 8px',
                  borderRadius: 6,
                  background: 'transparent',
                  border: 'none',
                  color: theme?.textPrimary || '#fff',
                  fontSize: 12,
                  fontWeight: 400,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background 0.12s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <ArrowRight size={14} color={theme?.textSecondary || '#8b949e'} />
                <span>Transfer issue</span>
              </button>

              {/* Clone issue */}
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText?.(`${issue.title}\n\n${issue.description || ''}`);
                  showToast('Conteúdo da issue clonado para área de transferência!');
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '6px 8px',
                  borderRadius: 6,
                  background: 'transparent',
                  border: 'none',
                  color: theme?.textPrimary || '#fff',
                  fontSize: 12,
                  fontWeight: 400,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background 0.12s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <Copy size={14} color={theme?.textSecondary || '#8b949e'} />
                <span>Clone issue</span>
              </button>

              {/* Lock conversation */}
              <button
                type="button"
                onClick={() => {
                  setIsConversationLocked((prev) => !prev);
                  showToast(isConversationLocked ? 'Conversa desbloqueada.' : 'Conversa bloqueada.');
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '6px 8px',
                  borderRadius: 6,
                  background: 'transparent',
                  border: 'none',
                  color: theme?.textPrimary || '#fff',
                  fontSize: 12,
                  fontWeight: 400,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background 0.12s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <Lock size={14} color={isConversationLocked ? '#e3b341' : (theme?.textSecondary || '#8b949e')} />
                <span>{isConversationLocked ? 'Unlock conversation' : 'Lock conversation'}</span>
              </button>

              {/* Pin issue */}
              <button
                type="button"
                onClick={() => {
                  setIsPinned((prev) => {
                    const next = !prev;
                    showToast(next ? 'Issue fixada!' : 'Issue desafixada.');
                    return next;
                  });
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '6px 8px',
                  borderRadius: 6,
                  background: 'transparent',
                  border: 'none',
                  color: theme?.textPrimary || '#fff',
                  fontSize: 12,
                  fontWeight: 400,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background 0.12s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <Pin size={14} color={isPinned ? accentColor : (theme?.textSecondary || '#8b949e')} />
                <span>{isPinned ? 'Unpin issue' : 'Pin issue'}</span>
              </button>

              {/* Delete issue (abre ConfirmDeleteModal obrigatoriamente) */}
              {onDeleteIssue && (
                <button
                  type="button"
                  onClick={() => onDeleteIssue(issue)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '6px 8px',
                    borderRadius: 6,
                    background: 'transparent',
                    border: 'none',
                    color: '#f85149',
                    fontSize: 12,
                    fontWeight: 400,
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background 0.12s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(248, 81, 73, 0.1)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <Trash2 size={14} color="#f85149" />
                  <span>Delete issue</span>
                </button>
              )}

              {/* Give feedback */}
              <button
                type="button"
                onClick={() => {
                  window.electronAPI?.shell?.openExternal?.('https://github.com/feedback') || showToast('Obrigado pelo seu feedback!');
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '6px 8px',
                  borderRadius: 6,
                  background: 'transparent',
                  border: 'none',
                  color: theme?.textPrimary || '#fff',
                  fontSize: 12,
                  fontWeight: 400,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background 0.12s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <Heart size={14} color={theme?.textSecondary || '#8b949e'} />
                <span>Give feedback</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const IssueDetailSidesheet: React.FC<IssueDetailSidesheetProps> = (props) => {
  const [isRendered, setIsRendered] = useState(props.isOpen && Boolean(props.issue));
  const cachedPropsRef = useRef<IssueDetailSidesheetProps>(props);

  if (props.isOpen && props.issue) {
    cachedPropsRef.current = props;
  }

  useEffect(() => {
    if (props.isOpen && props.issue) {
      setIsRendered(true);
    } else {
      const timer = setTimeout(() => {
        setIsRendered(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [props.isOpen, Boolean(props.issue)]);

  if (!isRendered || !cachedPropsRef.current.issue) return null;

  return (
    <SidesheetErrorBoundary onClose={props.onClose} isEffectiveDark={props.isEffectiveDark}>
      <IssueDetailSidesheetInner
        {...cachedPropsRef.current}
        isOpen={props.isOpen}
        onClose={props.onClose}
      />
    </SidesheetErrorBoundary>
  );
};
