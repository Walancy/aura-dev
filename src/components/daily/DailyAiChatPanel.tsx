import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ArrowRight,
  Sparkles,
  RotateCcw,
  Check,
  Plus,
  GitCommit,
  Calendar,
  AlertTriangle,
  Clock,
  ChevronRight,
  ChevronDown,
  FolderGit2,
  ListTodo,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import { renderAiIcon } from '../icons/AiProviderIcons';
import { DailyItem, WeeklyGoal } from './DailySchedulerView';
import { AI_BRAND_COLORS, AI_PROVIDERS, formatModelDisplayName } from '../../constants/ai';
import { logSystemActivity } from '../../utils/brainService';

function hexToRgba(hex: string, alpha: number): string {
  if (!hex) return `rgba(255, 255, 255, ${alpha})`;
  const clean = hex.replace('#', '');
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  const r = parseInt(clean.substring(0, 2), 16) || 0;
  const g = parseInt(clean.substring(2, 4), 16) || 0;
  const b = parseInt(clean.substring(4, 6), 16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export interface SuggestedTask {
  id: string;
  category: 'yesterday' | 'today' | 'blocker' | 'weekly';
  title: string;
  description?: string;
  projectName?: string;
  tag?: string;
  priority?: 'Baixa' | 'Média' | 'Alta' | 'Urgente';
  estimatedHours?: number;
  added?: boolean;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: number;
  suggestedTasks?: SuggestedTask[];
  commitsReferenced?: Array<{ project: string; hash: string; message: string; relativeDate: string }>;
  usedCli?: string;
  modelUsed?: string;
}

export function extractTasksFromMarkdown(
  text: string,
  defaultProject: string,
  detectedProjects: string[] = [],
  _allCommitsList: Array<{ project: string; hash: string; message: string }> = []
): SuggestedTask[] {
  if (!text) return [];

  const lines = text.split('\n');
  const tasks: SuggestedTask[] = [];

  let currentCategory: 'yesterday' | 'today' | 'blocker' | 'weekly' = 'today';
  let currentProject = defaultProject || 'Geral';

  const ignorePatterns = [
    /não consultei/i,
    /apenas o registro/i,
    /risco de haver/i,
    /estancia bahia/i,
    /#ponytail/i,
    /#uiux/i,
    /#/i,
    /copilot de engenharia/i,
    /aqui está o resumo/i,
    /com base nos commits/i,
    /analisei os/i,
    /conforme solicitado/i,
    /bom dia/i,
    /olá/i,
    /ola/i,
  ];

  const projRegex = /(?:(?:no\s+)?(?:projeto|reposit[óo]rio|repo))\s*(?::|\-)?\s*([a-zA-Z0-9_\-\.\/]+)/i;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i].trim();
    if (!rawLine) continue;

    if (ignorePatterns.some((p) => p.test(rawLine))) continue;

    const lowerLine = rawLine.toLowerCase();
    const bulletMatch = rawLine.match(/^[\s]*(?:[•\-\*\+—]|\d+[\.\)])\s+(.*)$/);

    // Se NÃO for um item de lista, pode ser um cabeçalho de categoria ou de projeto
    if (!bulletMatch) {
      if (
        lowerLine.includes('ontem') ||
        lowerLine.includes('concluíd') ||
        lowerLine.includes('finalizad') ||
        lowerLine.includes('entregue') ||
        lowerLine.includes('yesterday') ||
        lowerLine.includes('feito ontem')
      ) {
        currentCategory = 'yesterday';
      } else if (
        lowerLine.includes('impedimento') ||
        lowerLine.includes('bloqueio') ||
        lowerLine.includes('travament') ||
        lowerLine.includes('risco') ||
        lowerLine.includes('blocker')
      ) {
        currentCategory = 'blocker';
      } else if (
        lowerLine.includes('weekly') ||
        lowerLine.includes('semana') ||
        lowerLine.includes('meta da semana') ||
        lowerLine.includes('metas semanais')
      ) {
        currentCategory = 'weekly';
      } else if (
        lowerLine.includes('hoje') ||
        lowerLine.includes('a fazer') ||
        lowerLine.includes('planejad') ||
        lowerLine.includes('today') ||
        lowerLine.includes('para hoje')
      ) {
        currentCategory = 'today';
      }

      const pMatch = rawLine.match(projRegex);
      if (pMatch) {
        const candidate = pMatch[1].replace(/[:,\*\s]+$/, '').trim();
        if (
          candidate &&
          candidate.length > 2 &&
          !['hoje', 'ontem', 'daily', 'weekly', 'geral', 'o', 'um', 'uma'].includes(candidate.toLowerCase())
        ) {
          currentProject = candidate;
        }
      }

      for (const dp of detectedProjects) {
        if (lowerLine.includes(dp.toLowerCase())) {
          currentProject = dp;
          break;
        }
      }
      continue;
    }

    // É um item de tarefa/atividade!
    let itemContent = bulletMatch[1].trim();
    if (ignorePatterns.some((p) => p.test(itemContent))) continue;
    if (itemContent.length < 4) continue;

    let itemProject = currentProject;
    const inlineProjMatch =
      itemContent.match(/^\[([a-zA-Z0-9_\-\.\/]+)\]\s*(.*)$/) ||
      itemContent.match(/^\(([a-zA-Z0-9_\-\.\/]+)\)\s*(.*)$/);
    if (inlineProjMatch) {
      itemProject = inlineProjMatch[1];
      itemContent = inlineProjMatch[2];
    }

    let title = itemContent;
    let description = '';

    const boldMatch = itemContent.match(/^\*\*(.*?)\*\*(?::?\s*(.*))?$/);
    if (boldMatch) {
      title = boldMatch[1].trim();
      description = boldMatch[2]?.trim() || '';
    } else {
      const colonIdx = itemContent.indexOf(':');
      if (colonIdx > 8 && colonIdx < 60) {
        title = itemContent.slice(0, colonIdx).trim();
        description = itemContent.slice(colonIdx + 1).trim();
      }
    }

    title = title.replace(/\*\*/g, '').replace(/`/g, '').trim();
    description = description.replace(/\*\*/g, '').replace(/`/g, '').trim();

    if (title.length >= 4) {
      tasks.push({
        id: `task_parsed_${Date.now()}_${tasks.length}_${Math.random().toString(36).slice(2, 6)}`,
        category: currentCategory,
        title,
        description: description || `Identificado na análise da Daily (${itemProject})`,
        projectName: itemProject,
        tag:
          currentCategory === 'yesterday'
            ? 'Git Sync'
            : currentCategory === 'blocker'
            ? 'Impedimento'
            : currentCategory === 'weekly'
            ? 'Weekly'
            : 'Hoje',
        priority: currentCategory === 'blocker' ? 'Alta' : 'Média',
        estimatedHours: 2,
      });
    }
  }

  return tasks;
}

interface DailyAiChatPanelProps {
  selectedDate: Date;
  selectedDateIso: string;
  workspacePath?: string;
  repoName?: string;
  themeTokens: any;
  isEffectiveDark: boolean;
  accentColor: string;
  currentDailyItems: DailyItem[];
  weeklyGoals: WeeklyGoal[];
  onAddDailyItem: (item: Partial<DailyItem>) => void;
  onAddWeeklyGoal: (goal: Partial<WeeklyGoal>) => void;
  selectedAiProvider?: string;
  selectedModel?: string;
  activeModels?: Record<string, any>;
  onSelectAiProvider?: (providerId: string) => void;
  onSelectModel?: (modelItem: { id: string; label: string } | string, providerId?: string) => void;
  onToast?: (msg: string) => void;
}

export const DailyAiChatPanel: React.FC<DailyAiChatPanelProps> = ({
  selectedDate,
  selectedDateIso,
  workspacePath,
  repoName,
  themeTokens,
  isEffectiveDark,
  accentColor,
  currentDailyItems,
  weeklyGoals,
  onAddDailyItem,
  onAddWeeklyGoal,
  selectedAiProvider = 'claude',
  selectedModel,
  activeModels,
  onSelectAiProvider,
  onSelectModel,
  onToast,
}) => {
  const [currentAiProvider, setCurrentAiProvider] = useState<string>(selectedAiProvider || 'claude');
  const [currentModel, setCurrentModel] = useState<string>(selectedModel || '');
  const [isAiDropdownOpen, setIsAiDropdownOpen] = useState(false);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);

  useEffect(() => {
    if (selectedAiProvider && selectedAiProvider !== currentAiProvider) {
      setCurrentAiProvider(selectedAiProvider);
    }
  }, [selectedAiProvider]);

  useEffect(() => {
    if (selectedModel && selectedModel !== currentModel) {
      setCurrentModel(selectedModel);
    }
  }, [selectedModel]);

  const availableModels = useMemo(() => {
    const dyn = activeModels?.[currentAiProvider]?.models || [];
    if (dyn.length > 0) {
      return dyn.map((m: any) => (typeof m === 'string' ? { id: m, label: m } : m));
    }
    const prov = AI_PROVIDERS.find((p) => p.id === currentAiProvider);
    return (prov?.models || []).map((m) => ({ id: m, label: m }));
  }, [currentAiProvider, activeModels]);

  const currentModelDisplay = useMemo(() => {
    const active = currentModel || activeModels?.[currentAiProvider]?.currentModel;
    if (active) return formatModelDisplayName(active) || active;
    if (availableModels.length > 0) {
      return formatModelDisplayName(availableModels[0].label) || availableModels[0].label;
    }
    return 'Padrão';
  }, [currentModel, currentAiProvider, activeModels, availableModels]);

  const currentProviderName = useMemo(() => {
    const p = AI_PROVIDERS.find((item) => item.id === currentAiProvider);
    return p?.name || currentAiProvider || 'IA';
  }, [currentAiProvider]);

  const handleSelectProvider = (provId: string) => {
    setCurrentAiProvider(provId);
    setIsAiDropdownOpen(false);
    setIsModelDropdownOpen(false);

    const provModels = activeModels?.[provId]?.models || AI_PROVIDERS.find((p) => p.id === provId)?.models || [];
    const firstModel = provModels[0];
    const firstModelLabel = typeof firstModel === 'string' ? firstModel : firstModel?.label || '';
    const firstModelId = typeof firstModel === 'string' ? firstModel : firstModel?.id || firstModelLabel;

    if (firstModelLabel) {
      setCurrentModel(firstModelLabel);
    }

    if (onSelectAiProvider) {
      onSelectAiProvider(provId);
    }
    if (onSelectModel && firstModelLabel) {
      onSelectModel({ id: firstModelId, label: firstModelLabel }, provId);
    }

    const provName = AI_PROVIDERS.find((p) => p.id === provId)?.name || provId;
    logSystemActivity('daily_copilot', 'Troca de IA', repoName || 'Daily', {
      provider: provId,
      model: firstModelLabel,
    });
    onToast?.(`IA alterada para ${provName}`);
  };

  const handleSelectModelOption = (modelItem: { id: string; label: string }) => {
    setCurrentModel(modelItem.label);
    setIsModelDropdownOpen(false);

    if (onSelectModel) {
      onSelectModel(modelItem, currentAiProvider);
    }

    logSystemActivity('daily_copilot', 'Troca de Modelo', repoName || 'Daily', {
      provider: currentAiProvider,
      model: modelItem.label,
    });
    onToast?.(`Modelo alterado para ${formatModelDisplayName(modelItem.label) || modelItem.label}`);
  };

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    return [
      {
        id: 'msg_welcome',
        sender: 'assistant',
        text: `Olá! Sou seu Copilot de Daily e Weekly. Posso analisar seus commits locais de hoje e ontem em todos os projetos para montar sua Daily automaticamente ou ajudar a planejar as entregas da Weekly.`,
        timestamp: Date.now(),
      },
    ];
  });

  const [inputPrompt, setInputPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(Math.max(textareaRef.current.scrollHeight, 28), 120)}px`;
    }
  }, [inputPrompt]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Consulta commits recentes via IPC
  const fetchRecentCommits = async (days = 4) => {
    try {
      if (window.electronAPI?.git?.getRecentCommitsSummary) {
        const summaries = await window.electronAPI.git.getRecentCommitsSummary(days);
        if (Array.isArray(summaries) && summaries.length > 0) {
          return summaries;
        }
      }
    } catch (e) {
      console.warn('[DailyAiChat] Erro ao buscar commits locais:', e);
    }
    return [];
  };

  // Trata adição de sugestão
  const handleApplyTask = (msgId: string, task: SuggestedTask) => {
    if (task.category === 'weekly') {
      onAddWeeklyGoal({
        title: task.title,
        priority: (task.priority as any) || 'Alta',
      });
      onToast?.(`Demanda adicionada à Weekly: "${task.title}"`);
    } else {
      onAddDailyItem({
        category: task.category,
        title: task.title,
        description: task.description || 'Sugerido com base no histórico de commits e atividades.',
        projectName: task.projectName || repoName || 'Geral',
        tag: task.tag || (task.category === 'yesterday' ? 'Git Feito' : task.category === 'blocker' ? 'Impedimento' : 'Planejado'),
        priority: task.priority || 'Média',
        estimatedHours: task.estimatedHours || 2,
        dateIso: selectedDateIso,
      });
      onToast?.(`Tarefa adicionada à Daily: "${task.title}"`);
    }

    logSystemActivity('daily_copilot', 'Sugestão aplicada', task.projectName || repoName || 'Daily', {
      taskTitle: task.title,
      category: task.category,
    });

    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.id !== msgId || !msg.suggestedTasks) return msg;
        return {
          ...msg,
          suggestedTasks: msg.suggestedTasks.map((t) => (t.id === task.id ? { ...t, added: true } : t)),
        };
      })
    );
  };

  const handleApplyAllTasks = (msgId: string, tasks: SuggestedTask[]) => {
    tasks.forEach((t) => {
      if (!t.added) {
        handleApplyTask(msgId, t);
      }
    });
    onToast?.(`${tasks.length} tarefa(s) adicionadas com sucesso!`);
  };

  const cliInfo = useMemo(() => {
    const p = (currentAiProvider || '').toLowerCase();
    if (p.includes('codex')) return { cmd: 'codex', label: 'Codex CLI' };
    if (p.includes('antigravity') || p.includes('agy')) return { cmd: 'agy', label: 'Antigravity CLI' };
    if (p.includes('gemini')) return { cmd: 'gemini', label: 'Gemini CLI' };
    return { cmd: 'claude', label: 'Claude Code CLI' };
  }, [currentAiProvider]);

  const chatAccentColor = useMemo(() => {
    const p = (currentAiProvider || '').toLowerCase();
    if (p.includes('antigravity') || p.includes('agy')) return AI_BRAND_COLORS.antigravity || '#69C2FD';
    if (p.includes('claude')) return AI_BRAND_COLORS.claude || '#FF8B67';
    if (p.includes('codex')) return AI_BRAND_COLORS.codex || '#8975B9';
    if (p.includes('gemini')) return AI_BRAND_COLORS.gemini || '#589EFF';
    if (p.includes('ollama')) return AI_BRAND_COLORS.ollama || '#ECECEC';
    return (currentAiProvider && AI_BRAND_COLORS[currentAiProvider]) || accentColor || '#69C2FD';
  }, [currentAiProvider, accentColor]);

  const panelBackground = isEffectiveDark
    ? `radial-gradient(ellipse 120.00% 159.98% at 5.85% 100.00%, ${hexToRgba(chatAccentColor, 0.20)} 0%, #101010 100%)`
    : `radial-gradient(ellipse 120.00% 159.98% at 5.85% 100.00%, ${hexToRgba(chatAccentColor, 0.22)} 0%, #ffffff 100%)`;

  const renderFormattedText = (raw: string) => {
    const lines = raw.split('\n');
    return lines.map((line, idx) => {
      const isBullet = line.trim().startsWith('- ') || line.trim().startsWith('• ');
      const cleanLine = isBullet ? line.trim().replace(/^[-•]\s*/, '') : line;
      const parts = cleanLine.split(/(\*\*.*?\*\*)/g);
      const content = parts.map((p, pIdx) => {
        if (p.startsWith('**') && p.endsWith('**')) {
          return (
            <strong
              key={pIdx}
              style={{
                fontWeight: 500,
                color: isEffectiveDark ? '#ffffff' : '#0f172a',
              }}
            >
              {p.slice(2, -2)}
            </strong>
          );
        }
        return p;
      });

      if (isBullet) {
        return (
          <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginTop: 2, marginBottom: 2 }}>
            <span style={{ color: chatAccentColor, fontSize: 10, lineHeight: '18px' }}>•</span>
            <span style={{ flex: 1, lineHeight: '20px' }}>{content}</span>
          </div>
        );
      }

      if (!line.trim()) {
        return <div key={idx} style={{ height: 6 }} />;
      }

      return (
        <div key={idx} style={{ lineHeight: 1.45 }}>
          {content}
        </div>
      );
    });
  };

  // Detecta se o usuário está pedindo explicitamente pra montar/sugerir tarefas (Daily/Weekly),
  // em vez de tratar TODA mensagem como um pedido de sugestão de tarefas.
  const TASK_INTENT_KEYWORDS = [
    'tarefa', 'tarefas', 'sugest', 'sugir', 'monta', 'montar', 'planej',
    'daily', 'weekly', 'demanda', 'demandas', 'backlog', 'sprint',
    'atividade', 'atividades', 'ontem', 'hoje', 'commit', 'commits',
    'fiz', 'feito', 'fazer', 'trabalhei', 'status', 'progresso',
    'resumo', 'update', 'oque', 'o que', 'qual', 'quais', 'lista',
    'estancia', 'painel', 'ajuda', 'ajude', 'verifique', 'analise',
  ];
  const detectsTaskIntent = (text: string) => {
    const lower = text.toLowerCase();
    return TASK_INTENT_KEYWORDS.some((k) => lower.includes(k));
  };

  // Chama o CLI nativo configurado (Claude Code, AGY, Codex...) com fallback pra API direta.
  // Reaproveitado tanto no modo "sugerir tarefas" quanto no chat natural.
  const callAi = async (aiPrompt: string): Promise<{ rawOutput: string; usedCliName: string; usedModelName?: string }> => {
    let rawOutput = '';
    let usedCliName = '';
    const activeModelToUse = currentModel || selectedModel;
    let usedModelName = activeModelToUse;

    if (window.electronAPI?.ai?.runCli) {
      try {
        const cliRes = await window.electronAPI.ai.runCli({
          cliCmd: cliInfo.cmd,
          prompt: aiPrompt,
          model: activeModelToUse || undefined,
          cwd: workspacePath || undefined,
        });

        const stdout = cliRes?.stdout?.trim() || '';
        const isErrorOutput =
          cliRes?.exitCode !== 0 ||
          stdout.includes("There's an issue with the selected model") ||
          stdout.includes('[claude-code:unrecognized_model]') ||
          stdout.startsWith('Error:');

        if (stdout && !isErrorOutput) {
          rawOutput = stdout;
          usedCliName = cliInfo.label;
        } else if (activeModelToUse) {
          // Tenta sem model parameter (fallback para modelo nativo default do CLI)
          const retryRes = await window.electronAPI.ai.runCli({
            cliCmd: cliInfo.cmd,
            prompt: aiPrompt,
            model: undefined,
            cwd: workspacePath || undefined,
          });
          const retryStdout = retryRes?.stdout?.trim() || '';
          if (retryStdout && retryRes?.exitCode === 0) {
            rawOutput = retryStdout;
            usedCliName = cliInfo.label;
            usedModelName = 'default';
          }
        }
      } catch (cliErr) {
        console.warn(`[DailyAiChat] Falha ao executar ${cliInfo.cmd}:`, cliErr);
      }
    }

    // Fallback para window.electronAPI.ai.prompt (chamada direta, sem CLI)
    if (!rawOutput && window.electronAPI?.ai?.prompt) {
      try {
        const pRes = await window.electronAPI.ai.prompt(aiPrompt, activeModelToUse || 'claude-headless', workspacePath);
        if (pRes?.response) {
          rawOutput = pRes.response.trim();
          usedCliName = 'IA API';
        }
      } catch (promptErr) {
        console.warn('[DailyAiChat] Falha no fallback ai.prompt:', promptErr);
      }
    }

    return { rawOutput, usedCliName, usedModelName };
  };

  // Processador com chamada real ao CLI nativo (Claude Code, Antigravity, etc.)
  const processUserRequest = async (userText: string) => {
    const userMsg: ChatMessage = {
      id: `msg_user_${Date.now()}`,
      sender: 'user',
      text: userText,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputPrompt('');
    setIsLoading(true);

    logSystemActivity('daily_copilot', 'Consulta ao Copilot', repoName || 'Daily', {
      userText,
      selectedAiProvider,
    });

    // Evita sugerir de novo algo que já está na Daily/Weekly
    const normalizeTitle = (s: string) =>
      s
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const existingTitles = [
      ...currentDailyItems.map((i) => normalizeTitle(i.title)),
      ...weeklyGoals.map((g) => normalizeTitle(g.title)),
    ].filter(Boolean);

    const isDuplicateOfExisting = (title: string) => {
      const norm = normalizeTitle(title);
      if (!norm) return false;
      return existingTitles.some((existing) => {
        if (existing === norm) return true;
        const wordsA = new Set(norm.split(' ').filter((w) => w.length > 2));
        const wordsB = new Set(existing.split(' ').filter((w) => w.length > 2));
        if (wordsA.size === 0 || wordsB.size === 0) return false;
        const intersection = [...wordsA].filter((w) => wordsB.has(w)).length;
        const overlapRatio = intersection / Math.min(wordsA.size, wordsB.size);
        return overlapRatio >= 0.7;
      });
    };

    const wantsTaskSuggestions = detectsTaskIntent(userText);

    // Modo conversa natural: sem forçar geração de tarefas, sem fallback inventado.
    if (!wantsTaskSuggestions) {
      try {
        const dailySummary =
          currentDailyItems.length > 0
            ? currentDailyItems.slice(0, 8).map((i) => `- [${i.category.toUpperCase()}] [${i.projectName || 'Geral'}] ${i.title}`).join('\n')
            : 'Nenhuma tarefa cadastrada na Daily para esta data ainda.';

        const chatPrompt = `Você é o Copilot de Engenharia do Aura Dev. Converse de forma natural, direta e útil em português do Brasil.
Responda exatamente o que o desenvolvedor perguntou — não force uma lista de tarefas nem inclua blocos JSON. Só sugira tarefas se ele pedir isso explicitamente.

Contexto (use apenas se for relevante para a pergunta):
[TAREFAS ATUAIS DA DAILY]:
${dailySummary}
[PROJETO ATIVO]: ${repoName || 'Geral'}

Mensagem do desenvolvedor: "${userText}"`;

        const { rawOutput, usedCliName, usedModelName } = await callAi(chatPrompt);

        // Se a resposta conversacional tiver trazido atividades em bullets (ex: /tmp/df/50.png)
        const convTasks = extractTasksFromMarkdown(rawOutput, repoName || 'Geral', [], []);
        const autoCreatedConv: SuggestedTask[] = [];

        if (convTasks.length > 0) {
          convTasks.forEach((t) => {
            if (isDuplicateOfExisting(t.title)) return;
            existingTitles.push(normalizeTitle(t.title));

            if (t.category === 'weekly') {
              onAddWeeklyGoal({
                title: t.title,
                priority: (t.priority as any) || 'Alta',
              });
            } else {
              onAddDailyItem({
                category: t.category,
                title: t.title,
                description: t.description || 'Criado automaticamente pelo Copilot de Daily.',
                projectName: t.projectName || repoName || 'Geral',
                tag: t.tag || (t.category === 'yesterday' ? 'Git Sync' : t.category === 'blocker' ? 'Impedimento' : 'Hoje'),
                priority: t.priority || 'Média',
                estimatedHours: t.estimatedHours || 2,
                dateIso: selectedDateIso,
              });
            }
            t.added = true;
            autoCreatedConv.push(t);
          });

          if (autoCreatedConv.length > 0) {
            const targetProj = autoCreatedConv[0]?.projectName || repoName || 'Daily';
            logSystemActivity('daily_copilot', 'Criação Automática de Cards Daily', targetProj, {
              count: autoCreatedConv.length,
              tasks: autoCreatedConv.map((task) => ({ title: task.title, category: task.category, project: task.projectName })),
              selectedAiProvider: currentAiProvider,
              model: usedModelName,
            });
            onToast?.(`${autoCreatedConv.length} card(s) de daily criados automaticamente pela IA!`);
          }
        }

        const assistantMsg: ChatMessage = {
          id: `msg_asst_${Date.now()}`,
          sender: 'assistant',
          text: rawOutput || 'Não consegui me conectar à IA agora. Verifique se o CLI configurado está instalado e tente novamente.',
          timestamp: Date.now(),
          suggestedTasks: autoCreatedConv.length > 0 ? autoCreatedConv : undefined,
          usedCli: usedCliName,
          modelUsed: usedModelName,
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } catch (err) {
        console.error('[DailyAiChat] Erro ao processar chat:', err);
        setMessages((prev) => [
          ...prev,
          {
            id: `msg_err_${Date.now()}`,
            sender: 'assistant',
            text: 'Desculpe, ocorreu uma instabilidade ao processar a consulta.',
            timestamp: Date.now(),
          },
        ]);
      } finally {
        setIsLoading(false);
      }
      return;
    }

    try {
      const commitsData = await fetchRecentCommits(5);
      const isAskingWeekly =
        userText.toLowerCase().includes('weekly') ||
        userText.toLowerCase().includes('semana') ||
        userText.toLowerCase().includes('planejar demandas');

      // Compila lista de commits de hoje e ontem
      const allCommitsList: Array<{ project: string; hash: string; message: string; relativeDate: string; isToday: boolean; isYesterday: boolean }> = [];
      commitsData.forEach((p) => {
        p.commits.forEach((c) => {
          allCommitsList.push({
            project: p.projectName,
            hash: c.hash,
            message: c.message,
            relativeDate: c.relativeDate,
            isToday: c.isToday,
            isYesterday: c.isYesterday,
          });
        });
      });

      // Identifica todos os repositórios que tiveram commits recentes
      const detectedProjects = Array.from(
        new Set(allCommitsList.map((c) => c.project).filter((p): p is string => Boolean(p && p.trim())))
      );
      const cleanHeaderRepo = repoName?.includes('/') ? repoName.split('/').pop()! : repoName;
      const primaryActiveRepo = detectedProjects[0] || cleanHeaderRepo || 'Geral';

      const commitsSummary =
        allCommitsList.length > 0
          ? allCommitsList
              .slice(0, 15)
              .map(
                (c) =>
                  `- [REPOSITÓRIO: ${c.project}] commit ${c.hash.slice(0, 7)}: ${c.message} (${c.relativeDate}${
                    c.isToday ? ', HOJE' : c.isYesterday ? ', ONTEM' : ''
                  })`
              )
              .join('\n')
          : 'Nenhum commit local detectado nas últimas 48h.';

      const dailySummary =
        currentDailyItems.length > 0
          ? currentDailyItems
              .slice(0, 8)
              .map((i) => `- [${i.category.toUpperCase()}] [${i.projectName || 'Geral'}] ${i.title}`)
              .join('\n')
          : 'Nenhuma tarefa cadastrada na Daily para esta data ainda.';

      const weeklySummary =
        weeklyGoals.length > 0
          ? weeklyGoals.slice(0, 6).map((g) => `- [WEEKLY] ${g.title} (${g.priority})`).join('\n')
          : 'Nenhuma meta registrada na Weekly atual.';

      const aiPrompt = `Você é o Copilot de Engenharia do Aura Dev, especialista em Daily Scrum e Weekly Planning.
Analise os dados reais dos repositórios e projetos locais abaixo e responda ao desenvolvedor:

[REPOSITÓRIOS COM ATIVIDADES DETECTADAS NOS COMMITS]:
${detectedProjects.length > 0 ? detectedProjects.map((p) => `- ${p}`).join('\n') : `- ${primaryActiveRepo}`}

[REPOSITÓRIO ATIVO NO CABEÇALHO DO AURA DEV]:
${repoName || 'Geral'}

[DATA SELECIONADA]: ${selectedDateIso}

[COMMITS RECENTES DOS PROJETOS LOCAIS]:
${commitsSummary}

[TAREFAS ATUAIS DA DAILY]:
${dailySummary}

[METAS DA WEEKLY]:
${weeklySummary}

[PEDIDO DO USUÁRIO]:
"${userText}"

DIRETRIZES OBRIGATÓRIAS:
1. Responda em Português do Brasil com tom ágil, técnico, objetivo e colaborativo.
2. Analise os commits reais para identificar o que já foi entregue (categoria "yesterday") e o que deve ser priorizado ou continuado para hoje (categoria "today") ou potenciais impedimentos ("blocker").
3. CADA ATIVIDADE IDENTIFICADA SERÁ AUTOMATICAMENTE CRIADA COMO CARD NA DAILY DO USUÁRIO. Liste claramente as tarefas encontradas indicando o projeto específico. Se o pedido for sobre Weekly, sugira metas estratégicas da semana com categoria "weekly".
4. REGRA FUNDAMENTAL PARA O CAMPO "projectName":
   - Cada tarefa DEVE OBRIGATORIAMENTE ter o campo "projectName" preenchido com o NOME EXATO do repositório/projeto onde a alteração/commit realmente aconteceu (ex: "${primaryActiveRepo}").
   - NUNCA use o repositório selecionado no cabeçalho (${repoName}) se os commits vieram de outro repositório! Use sempre o nome do repositório onde o commit foi realizado (ex: ${detectedProjects.join(', ') || primaryActiveRepo}).
5. NÃO DUPLICAR: antes de sugerir qualquer tarefa nova, compare com a lista em [TAREFAS ATUAIS DA DAILY] e [METAS DA WEEKLY] acima. Se uma atividade equivalente (mesmo assunto/commit/entrega, mesmo com título ligeiramente diferente) já está nessas listas, NÃO a inclua de novo — sugira apenas o que ainda não está coberto. Se não houver nada novo para sugerir, retorne um array vazio "[]" em vez de repetir o que já existe.
6. Ao final da sua resposta, inclua OBRIGATORIAMENTE um bloco com array JSON válido no formato:
\`\`\`json
[
  {
    "category": "yesterday" | "today" | "blocker" | "weekly",
    "title": "Título conciso da tarefa",
    "description": "Explicação breve ou contexto do commit/demanda",
    "projectName": "${primaryActiveRepo}",
    "priority": "Baixa" | "Média" | "Alta" | "Urgente",
    "tag": "Git Sync" | "Hoje" | "Impedimento" | "Weekly" | "Feature"
  }
]
\`\`\`
Não adicione texto explicativo dentro do bloco json. Retorne entre 2 e 5 tarefas relevantes.`;

      const { rawOutput, usedCliName, usedModelName } = await callAi(aiPrompt);

      // Função inteligente para resolver o repositório real da tarefa com base nos commits analisados
      const resolveTaskProject = (
        rawProject: string | undefined,
        title: string,
        desc: string,
        commitHash?: string
      ): string => {
        const combined = `${title} ${desc}`.toLowerCase();

        // A) Se tem commit hash direto
        if (commitHash) {
          const found = allCommitsList.find((c) => c.hash.toLowerCase().startsWith(commitHash.toLowerCase()));
          if (found) return found.project;
        }

        // B) Se algum commit hash está mencionado no título ou descrição
        for (const c of allCommitsList) {
          const short = c.hash.slice(0, 7).toLowerCase();
          if (combined.includes(short)) {
            return c.project;
          }
        }

        // C) Se a IA retornou um projectName que coincide com um dos repositórios com commits
        if (rawProject && rawProject !== 'Projeto' && rawProject !== 'Geral') {
          const cleanRaw = rawProject.includes('/') ? rawProject.split('/').pop()! : rawProject;
          const match = detectedProjects.find(
            (dp) => dp.toLowerCase() === cleanRaw.toLowerCase() || dp.toLowerCase() === rawProject.toLowerCase()
          );
          if (match) return match;
        }

        // D) Tentar casar por palavras-chave ou texto da mensagem do commit
        for (const c of allCommitsList) {
          const cleanMsg = c.message
            .replace(/^(feat|fix|refactor|chore|style)\([^)]*\):\s*/i, '')
            .trim()
            .toLowerCase();
          if (
            cleanMsg.length > 7 &&
            (combined.includes(cleanMsg.slice(0, 20)) || cleanMsg.includes(title.toLowerCase().slice(0, 20)))
          ) {
            return c.project;
          }
        }

        // E) Se todos os commits detectados vieram de um único repositório (ex: 'ainaobra')
        if (detectedProjects.length === 1) {
          return detectedProjects[0];
        }

        // F) Se rawProject for válido e não for genérico nem o repo da header quando não houve commits nele
        if (rawProject && rawProject !== 'Projeto' && rawProject !== 'Geral') {
          const clean = rawProject.includes('/') ? rawProject.split('/').pop()! : rawProject;
          return clean;
        }

        return primaryActiveRepo;
      };

      let assistantText = '';
      const suggestedTasks: SuggestedTask[] = [];
      const pushIfNotDuplicate = (task: SuggestedTask) => {
        if (isDuplicateOfExisting(task.title)) return;
        existingTitles.push(normalizeTitle(task.title));
        suggestedTasks.push(task);
      };

      if (rawOutput) {
        // 1. Extrair bloco JSON se existir (suporta ```json ... ``` ou ``` ... ``` ou array puro)
        const jsonMatch =
          rawOutput.match(/```(?:json)?\s*(\[\s*\{[\s\S]*?\}\s*\])\s*```/i) ||
          rawOutput.match(/(\[\s*\{\s*(?:"category"|"titulo"|"title")[\s\S]*?\}\s*\])/i);

        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[1]);
            if (Array.isArray(parsed) && parsed.length > 0) {
              parsed.forEach((item: any, idx: number) => {
                const catLower = String(item.category || item.status || '').toLowerCase();
                let category: 'yesterday' | 'today' | 'blocker' | 'weekly' = 'today';
                if (catLower.includes('yesterday') || catLower.includes('ontem') || catLower.includes('concluido')) {
                  category = 'yesterday';
                } else if (catLower.includes('blocker') || catLower.includes('impedimento')) {
                  category = 'blocker';
                } else if (catLower.includes('weekly') || catLower.includes('semana')) {
                  category = 'weekly';
                }

                const resolvedProject = resolveTaskProject(
                  item.projectName || item.projeto || item.escopo,
                  item.title || item.titulo || item.name || '',
                  item.description || item.descricao || '',
                  item.commit
                );

                pushIfNotDuplicate({
                  id: `task_ai_${Date.now()}_${idx}`,
                  category,
                  title: item.title || item.titulo || item.name || 'Nova demanda sugerida',
                  description: item.description || item.descricao || (item.commit ? `Commit ${item.commit}` : ''),
                  projectName: resolvedProject,
                  tag: item.tag || (category === 'yesterday' ? 'Git Sync' : category === 'blocker' ? 'Impedimento' : category === 'weekly' ? 'Weekly' : 'Hoje'),
                  priority: item.priority || item.prioridade || 'Média',
                  estimatedHours: item.estimatedHours || 2,
                });
              });
            }
            // Remove o bloco JSON para manter a mensagem do assistente limpa e conversacional
            assistantText = rawOutput.replace(/```(?:json)?\s*[\s\S]*?```/gi, '').trim();
          } catch (parseErr) {
            console.warn('[DailyAiChat] Erro no JSON parse da IA:', parseErr);
            assistantText = rawOutput;
          }
        } else {
          assistantText = rawOutput;
        }

        // 2. Extração complementar via markdown se o JSON não trouxe tarefas ou a IA respondeu em bullet points (como em /tmp/df/50.png)
        const markdownTasks = extractTasksFromMarkdown(
          rawOutput,
          primaryActiveRepo,
          detectedProjects,
          allCommitsList
        );

        if (markdownTasks.length > 0) {
          markdownTasks.forEach((mTask) => {
            const resolvedProject = resolveTaskProject(
              mTask.projectName,
              mTask.title,
              mTask.description || ''
            );
            pushIfNotDuplicate({
              ...mTask,
              projectName: resolvedProject,
            });
          });
        }

        if (!assistantText) {
          assistantText = 'Analisei seu histórico de commits e atividades recentes. Aqui estão as sugestões organizadas:';
        }
      } else {
        // 3. Fallback inteligente local caso o CLI não esteja instalado ou esteja offline
        if (isAskingWeekly) {
          assistantText = `Não foi possível conectar ao CLI (${cliInfo.label}), mas analisei seus projetos locais diretamente. Sugiro as seguintes **demandas prioritárias para a Weekly**:`;
          const activeProjects = commitsData.length > 0 ? commitsData.map((c) => c.projectName) : [repoName || 'Projeto Principal'];

          pushIfNotDuplicate({
            id: `task_wk_${Date.now()}_1`,
            category: 'weekly',
            title: `Finalizar ciclo de refatoração e testes no ${activeProjects[0] || 'projeto'}`,
            description: 'Garantir cobertura e estabilidade nas rotas críticas.',
            projectName: activeProjects[0] || repoName,
            priority: 'Alta',
          });
          pushIfNotDuplicate({
            id: `task_wk_${Date.now()}_2`,
            category: 'weekly',
            title: `Otimizar performance de carregamento e sincronização em background`,
            description: 'Reduzir latência de resposta nos fluxos de dados principais.',
            projectName: activeProjects[1] || activeProjects[0] || repoName,
            priority: 'Média',
          });
        } else if (allCommitsList.length > 0) {
          const yesterdayCommits = allCommitsList.filter((c) => c.isYesterday || !c.isToday).slice(0, 3);
          const todayCommits = allCommitsList.filter((c) => c.isToday).slice(0, 3);

          assistantText = `Identifiquei **${allCommitsList.length} commits recentes** nos seus projetos locais. Aqui está o resumo e as tarefas sugeridas para a sua Daily:`;

          if (yesterdayCommits.length > 0) {
            yesterdayCommits.forEach((c, idx) => {
              pushIfNotDuplicate({
                id: `task_y_${Date.now()}_${idx}`,
                category: 'yesterday',
                title: c.message.replace(/^feat:|^fix:|^refactor:|^chore:/i, '').trim(),
                description: `Commit ${c.hash.slice(0, 7)} em ${c.project} (${c.relativeDate})`,
                projectName: c.project,
                tag: 'Git Sync',
                priority: 'Média',
                estimatedHours: 2,
              });
            });
          }

          const targetProj = commitsData[0]?.projectName || repoName || 'Aura Dev';
          pushIfNotDuplicate({
            id: `task_t_${Date.now()}_1`,
            category: 'today',
            title: `Continuidade das implementações e cobertura de testes em ${targetProj}`,
            description: 'Avançar nas demandas planejadas e validação das alterações.',
            projectName: targetProj,
            tag: 'Hoje',
            priority: 'Alta',
            estimatedHours: 3,
          });
        } else {
          assistantText = `Não consegui me conectar à IA e não encontrei commits recentes nas últimas 48h para basear uma sugestão. Verifique se o CLI configurado (${cliInfo.label}) está instalado, ou me conte diretamente o que você fez.`;
        }
      }

      // 4. CRIAÇÃO AUTOMÁTICA DOS CARDS NO QUADRO DA DAILY / WEEKLY
      // A IA da Daily deve criar cards de daily com as atividades que ela encontrar automaticamente
      const autoCreatedTasks: SuggestedTask[] = [];

      suggestedTasks.forEach((t) => {
        if (!t.added) {
          if (t.category === 'weekly') {
            onAddWeeklyGoal({
              title: t.title,
              priority: (t.priority as any) || 'Alta',
            });
          } else {
            onAddDailyItem({
              category: t.category,
              title: t.title,
              description: t.description || 'Criado automaticamente pelo Copilot de Daily.',
              projectName: t.projectName || repoName || 'Geral',
              tag: t.tag || (t.category === 'yesterday' ? 'Git Sync' : t.category === 'blocker' ? 'Impedimento' : 'Hoje'),
              priority: t.priority || 'Média',
              estimatedHours: t.estimatedHours || 2,
              dateIso: selectedDateIso,
            });
          }
          t.added = true;
          autoCreatedTasks.push(t);
        }
      });

      if (autoCreatedTasks.length > 0) {
        const targetProj = autoCreatedTasks[0]?.projectName || repoName || 'Daily';
        logSystemActivity('daily_copilot', 'Criação Automática de Cards Daily', targetProj, {
          count: autoCreatedTasks.length,
          tasks: autoCreatedTasks.map((task) => ({
            title: task.title,
            category: task.category,
            project: task.projectName,
          })),
          selectedAiProvider: currentAiProvider,
          model: usedModelName,
        });

        onToast?.(`${autoCreatedTasks.length} card(s) de daily criados automaticamente pela IA!`);
      }

      const assistantMsg: ChatMessage = {
        id: `msg_asst_${Date.now()}`,
        sender: 'assistant',
        text: assistantText,
        timestamp: Date.now(),
        suggestedTasks,
        commitsReferenced: allCommitsList.slice(0, 6),
        usedCli: usedCliName,
        modelUsed: usedModelName,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      console.error('[DailyAiChat] Erro ao processar:', err);
      setMessages((prev) => [
        ...prev,
        {
          id: `msg_err_${Date.now()}`,
          sender: 'assistant',
          text: 'Desculpe, ocorreu uma instabilidade ao processar a consulta. Você ainda pode usar os atalhos rápidos abaixo.',
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const getCategoryBadge = (cat: string) => {
    switch (cat) {
      case 'yesterday':
        return { label: 'Feito Ontem', bg: '#22c55e18', color: '#22c55e' };
      case 'today':
        return { label: 'Para Hoje', bg: hexToRgba(chatAccentColor, 0.15), color: chatAccentColor };
      case 'blocker':
        return { label: 'Impedimento', bg: '#ef444418', color: '#ef4444' };
      case 'weekly':
        return { label: 'Weekly', bg: '#8b5cf618', color: '#a78bfa' };
      default:
        return { label: 'Tarefa', bg: isEffectiveDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', color: themeTokens.textPrimary };
    }
  };

  const divider = isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (inputPrompt.trim() && !isLoading) {
        processUserRequest(inputPrompt.trim());
      }
    }
  };

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        width: '100%',
        background: panelBackground,
        borderRadius: 10,
        border: 'none',
        boxShadow: 'none',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        overflow: 'hidden',
        position: 'relative',
        transition: 'background 0.2s ease',
      }}
    >
      {/* 1. Header do Chat: Apenas Seletor de IA/Modelos e Botão de Reload */}
      <div
        style={{
          padding: '6px 8px',
          borderBottom: `1px solid ${divider}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'transparent',
          flexShrink: 0,
          gap: 6,
          position: 'relative',
          zIndex: 30,
        }}
      >
        {/* Seletor de IA e Modelos (microcomponente integrado com divisória sutil) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            background: isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
            borderRadius: 6,
            padding: 2,
            gap: 2,
            minWidth: 0,
            maxWidth: 'calc(100% - 36px)',
          }}
        >
          {/* Seletor de IA */}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => {
                setIsAiDropdownOpen((prev) => !prev);
                setIsModelDropdownOpen(false);
              }}
              title={`IA ativa: ${currentProviderName}`}
              style={{
                height: 28,
                padding: '0 7px',
                borderRadius: 5,
                border: 'none',
                background: isAiDropdownOpen
                  ? isEffectiveDark
                    ? 'rgba(255, 255, 255, 0.1)'
                    : 'rgba(0, 0, 0, 0.08)'
                  : 'transparent',
                color: themeTokens.textPrimary,
                fontSize: 11.5,
                fontWeight: 400,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                transition: 'background 0.15s ease',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
              onMouseEnter={(e) => {
                if (!isAiDropdownOpen) {
                  e.currentTarget.style.background = isEffectiveDark
                    ? 'rgba(255, 255, 255, 0.07)'
                    : 'rgba(0, 0, 0, 0.06)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isAiDropdownOpen) {
                  e.currentTarget.style.background = 'transparent';
                }
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center' }}>
                {renderAiIcon(currentAiProvider || 'claude', 13)}
              </span>
              <span>{currentProviderName}</span>
              <ChevronDown
                size={10}
                color={themeTokens.textSecondary}
                style={{
                  transform: isAiDropdownOpen ? 'rotate(180deg)' : 'none',
                  transition: 'transform 0.15s ease',
                  flexShrink: 0,
                }}
              />
            </button>

            {isAiDropdownOpen && (
              <>
                <div
                  style={{ position: 'fixed', inset: 0, zIndex: 99998 }}
                  onClick={() => setIsAiDropdownOpen(false)}
                />
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 4px)',
                    left: 0,
                    background: isEffectiveDark ? '#1a1a1c' : '#ffffff',
                    borderRadius: 8,
                    border: 'none',
                    boxShadow: 'none',
                    padding: 4,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                    zIndex: 99999,
                    minWidth: 160,
                    animation: 'fadeIn 0.12s ease-out',
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div
                    style={{
                      padding: '3px 8px 4px',
                      fontSize: 10,
                      fontWeight: 400,
                      color: themeTokens.textSecondary,
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                    }}
                  >
                    Provedor de IA
                  </div>
                  {AI_PROVIDERS.map((prov) => {
                    const isSelected = prov.id === currentAiProvider;
                    return (
                      <div
                        key={prov.id}
                        onClick={() => handleSelectProvider(prov.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 8,
                          padding: '6px 8px',
                          borderRadius: 6,
                          cursor: 'pointer',
                          fontSize: 11.5,
                          fontWeight: 400,
                          color: isSelected ? accentColor : themeTokens.textPrimary,
                          background: isSelected
                            ? hexToRgba(accentColor, 0.12)
                            : 'transparent',
                          transition: 'background 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) {
                            e.currentTarget.style.background = isEffectiveDark
                              ? 'rgba(255, 255, 255, 0.06)'
                              : 'rgba(0, 0, 0, 0.05)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) {
                            e.currentTarget.style.background = 'transparent';
                          }
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                          {renderAiIcon(prov.id, 14)}
                          <span style={{ whiteSpace: 'nowrap' }}>{prov.name}</span>
                        </div>
                        {isSelected && <Check size={12} color={accentColor} style={{ flexShrink: 0 }} />}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Divisória vertical de baixa opacidade */}
          <div
            style={{
              width: 1,
              height: 14,
              background: divider,
              flexShrink: 0,
            }}
          />

          {/* Seletor de Modelo */}
          <div style={{ position: 'relative', minWidth: 0, flex: 1 }}>
            <button
              type="button"
              onClick={() => {
                setIsModelDropdownOpen((prev) => !prev);
                setIsAiDropdownOpen(false);
              }}
              title={`Modelo ativo: ${currentModelDisplay}`}
              style={{
                height: 28,
                padding: '0 7px',
                borderRadius: 5,
                border: 'none',
                background: isModelDropdownOpen
                  ? isEffectiveDark
                    ? 'rgba(255, 255, 255, 0.1)'
                    : 'rgba(0, 0, 0, 0.08)'
                  : 'transparent',
                color: themeTokens.textSecondary,
                fontSize: 11,
                fontWeight: 400,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                transition: 'background 0.15s ease',
                minWidth: 0,
                maxWidth: 145,
                width: '100%',
              }}
              onMouseEnter={(e) => {
                if (!isModelDropdownOpen) {
                  e.currentTarget.style.background = isEffectiveDark
                    ? 'rgba(255, 255, 255, 0.07)'
                    : 'rgba(0, 0, 0, 0.06)';
                  e.currentTarget.style.color = themeTokens.textPrimary;
                }
              }}
              onMouseLeave={(e) => {
                if (!isModelDropdownOpen) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = themeTokens.textSecondary;
                }
              }}
            >
              <span
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  flex: 1,
                  textAlign: 'left',
                }}
              >
                {currentModelDisplay}
              </span>
              <ChevronDown
                size={10}
                color={themeTokens.textSecondary}
                style={{
                  transform: isModelDropdownOpen ? 'rotate(180deg)' : 'none',
                  transition: 'transform 0.15s ease',
                  flexShrink: 0,
                }}
              />
            </button>

            {isModelDropdownOpen && (
              <>
                <div
                  style={{ position: 'fixed', inset: 0, zIndex: 99998 }}
                  onClick={() => setIsModelDropdownOpen(false)}
                />
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 4px)',
                    left: 0,
                    background: isEffectiveDark ? '#1a1a1c' : '#ffffff',
                    borderRadius: 8,
                    border: 'none',
                    boxShadow: 'none',
                    padding: 4,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                    zIndex: 99999,
                    minWidth: 170,
                    maxWidth: 240,
                    maxHeight: 240,
                    overflowY: 'auto',
                    animation: 'fadeIn 0.12s ease-out',
                  }}
                  className="no-scrollbar"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div
                    style={{
                      padding: '3px 8px 4px',
                      fontSize: 10,
                      fontWeight: 400,
                      color: themeTokens.textSecondary,
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                    }}
                  >
                    Modelos {currentProviderName}
                  </div>
                  {availableModels.map((m) => {
                    const formatted = formatModelDisplayName(m.label) || m.label;
                    const isSelected =
                      m.label === currentModel ||
                      m.id === currentModel ||
                      formatted === currentModelDisplay;
                    return (
                      <div
                        key={m.id}
                        onClick={() => handleSelectModelOption(m)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 8,
                          padding: '6px 8px',
                          borderRadius: 6,
                          cursor: 'pointer',
                          fontSize: 11.5,
                          fontWeight: 400,
                          color: isSelected ? accentColor : themeTokens.textPrimary,
                          background: isSelected
                            ? hexToRgba(accentColor, 0.12)
                            : 'transparent',
                          transition: 'background 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) {
                            e.currentTarget.style.background = isEffectiveDark
                              ? 'rgba(255, 255, 255, 0.06)'
                              : 'rgba(0, 0, 0, 0.05)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) {
                            e.currentTarget.style.background = 'transparent';
                          }
                        }}
                      >
                        <span
                          style={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {formatted}
                        </span>
                        {isSelected && <Check size={12} color={accentColor} style={{ flexShrink: 0 }} />}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Botão de Reload / Limpar chat à direita */}
        <button
          type="button"
          onClick={() => {
            setMessages([
              {
                id: `welcome_${Date.now()}`,
                sender: 'assistant',
                text: 'Conversa reiniciada. Como posso ajudar com a sua Daily ou Weekly hoje?',
                timestamp: Date.now(),
              },
            ]);
            logSystemActivity('daily_copilot', 'Chat reiniciado', repoName || 'Daily', {
              provider: currentAiProvider,
              model: currentModel,
            });
            onToast?.('Chat reiniciado');
          }}
          style={{
            width: 28,
            height: 28,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: themeTokens.textSecondary,
            borderRadius: 6,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s ease',
            flexShrink: 0,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = isEffectiveDark
              ? 'rgba(255, 255, 255, 0.06)'
              : 'rgba(0, 0, 0, 0.06)';
            e.currentTarget.style.color = themeTokens.textPrimary;
            e.currentTarget.style.transform = 'rotate(-45deg)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = themeTokens.textSecondary;
            e.currentTarget.style.transform = 'rotate(0deg)';
          }}
          title="Limpar histórico do chat"
        >
          <RotateCcw size={13} />
        </button>
      </div>

      {/* 2. Área de Mensagens com Scroll */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '10px 10px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          fontSize: 12,
          minHeight: 0,
          position: 'relative',
        }}
      >
        {/* Marca d'água da IA no fundo quando chat tem poucas mensagens */}
        {messages.length <= 1 && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
              zIndex: 0,
              userSelect: 'none',
            }}
          >
            <div
              style={{
                opacity: isEffectiveDark ? 0.08 : 0.06,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'opacity 0.25s ease, transform 0.25s ease',
              }}
            >
              {renderAiIcon((currentAiProvider === 'agy' ? 'antigravity' : currentAiProvider) || 'antigravity', 140)}
            </div>
          </div>
        )}

        {messages.map((msg) => {
          const isUser = msg.sender === 'user';
          if (isUser) {
            return (
              <div
                key={msg.id}
                style={{
                  alignSelf: 'flex-end',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-end',
                  maxWidth: '88%',
                  position: 'relative',
                  zIndex: 1,
                }}
              >
                <div
                  style={{
                    background: hexToRgba(chatAccentColor, 0.16),
                    color: themeTokens.textPrimary,
                    padding: '8px 12px',
                    borderRadius: '8px 2px 8px 8px',
                    border: 'none',
                    boxShadow: 'none',
                    wordBreak: 'break-word',
                    whiteSpace: 'pre-wrap',
                    fontWeight: 400,
                    lineHeight: '18px',
                    fontSize: 12.5,
                  }}
                >
                  {msg.text}
                </div>
              </div>
            );
          }

          return (
            <div
              key={msg.id}
              style={{
                alignSelf: 'flex-start',
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'flex-start',
                gap: 8,
                maxWidth: '96%',
                width: '100%',
                position: 'relative',
                zIndex: 1,
              }}
            >
              {/* Assistant Avatar */}
              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 5,
                  background: isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  marginTop: 2,
                }}
              >
                {renderAiIcon(currentAiProvider || 'claude', 14)}
              </div>

              {/* Content Container */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  flex: '1 1 auto',
                  minWidth: 0,
                }}
              >
                {/* Tag do CLI / IA utilizada */}
                {(msg.usedCli || (msg.commitsReferenced && msg.commitsReferenced.length > 0)) && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: themeTokens.textSecondary }}>
                    {msg.usedCli && (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '2px 6px',
                          borderRadius: 4,
                          background: hexToRgba(chatAccentColor, 0.12),
                          color: chatAccentColor,
                          fontWeight: 500,
                          fontSize: 10,
                        }}
                      >
                        <Sparkles size={10} />
                        {msg.usedCli}
                        {msg.modelUsed ? ` (${msg.modelUsed})` : ''}
                      </span>
                    )}
                    {msg.commitsReferenced && msg.commitsReferenced.length > 0 && (
                      <span style={{ fontSize: 10, opacity: 0.8 }}>
                        {msg.commitsReferenced.length} commits analisados
                      </span>
                    )}
                  </div>
                )}

                {/* Balão de Texto do Assistente */}
                <div
                  style={{
                    background: isEffectiveDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)',
                    color: themeTokens.textPrimary,
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: 'none',
                    boxShadow: 'none',
                    wordBreak: 'break-word',
                    lineHeight: '20px',
                    fontSize: 12.5,
                    fontWeight: 400,
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {renderFormattedText(msg.text)}
                </div>

                {/* Commits referenciados (se houver) */}
                {msg.commitsReferenced && msg.commitsReferenced.length > 0 && (
                  <div
                    style={{
                      background: isEffectiveDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.02)',
                      borderRadius: 8,
                      padding: 8,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                      border: 'none',
                      boxShadow: 'none',
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 500,
                        color: themeTokens.textSecondary,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5,
                      }}
                    >
                      <GitCommit size={12} color={chatAccentColor} />
                      <span>Commits analisados no dia/ontem:</span>
                    </div>
                    {msg.commitsReferenced.slice(0, 3).map((c, i) => (
                      <div
                        key={i}
                        style={{
                          fontSize: 11,
                          color: themeTokens.textPrimary,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 6,
                        }}
                      >
                        <span
                          style={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            maxWidth: 190,
                          }}
                        >
                          <strong style={{ color: chatAccentColor, fontWeight: 500 }}>{c.project}:</strong> {c.message}
                        </span>
                        <span style={{ color: themeTokens.textSecondary, flexShrink: 0, fontSize: 10 }}>
                          {c.hash}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Tarefas Sugeridas / Cards Criados */}
                {msg.suggestedTasks && msg.suggestedTasks.length > 0 && (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                    }}
                  >
                    {/* Status informando a criação automática dos cards */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 8px',
                        background: isEffectiveDark ? 'rgba(34, 197, 94, 0.08)' : 'rgba(34, 197, 94, 0.06)',
                        borderRadius: 6,
                        color: '#22c55e',
                        fontSize: 11,
                        fontWeight: 400,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Check size={12} color="#22c55e" />
                        <span>
                          {msg.suggestedTasks.filter((t) => t.added).length === msg.suggestedTasks.length
                            ? `${msg.suggestedTasks.length} card(s) criados automaticamente na Daily`
                            : `${msg.suggestedTasks.length} atividade(s) identificadas`}
                        </span>
                      </div>
                    </div>

                    {/* Botão de Adicionar Todas (caso alguma ainda não tenha sido aplicada) */}
                    {msg.suggestedTasks.some((t) => !t.added) && (
                      <button
                        type="button"
                        onClick={() => handleApplyAllTasks(msg.id, msg.suggestedTasks!)}
                        style={{
                          height: 28,
                          padding: '0 8px',
                          background: chatAccentColor,
                          border: 'none',
                          borderRadius: 6,
                          color: '#ffffff',
                          fontSize: 11.5,
                          fontWeight: 400,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          cursor: 'pointer',
                          boxShadow: 'none',
                          transition: 'opacity 0.15s ease',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
                        onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
                      >
                        <Plus size={12} />
                        <span>Adicionar todas as sugestões à Daily</span>
                      </button>
                    )}

                    {msg.suggestedTasks.map((t) => {
                      const badge = getCategoryBadge(t.category);
                      return (
                        <div
                          key={t.id}
                          style={{
                            background: isEffectiveDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                            border: 'none',
                            boxShadow: 'none',
                            borderRadius: 8,
                            padding: 8,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 8,
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                            <span
                              style={{
                                fontSize: 9.5,
                                fontWeight: 400,
                                textTransform: 'uppercase',
                                padding: '2px 6px',
                                borderRadius: 4,
                                background: badge.bg,
                                color: badge.color,
                                border: 'none',
                              }}
                            >
                              {badge.label}
                            </span>

                            {t.projectName && (
                              <span
                                style={{
                                  fontSize: 10,
                                  color: themeTokens.textSecondary,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  maxWidth: 140,
                                  fontWeight: 400,
                                }}
                              >
                                {t.projectName}
                              </span>
                            )}
                          </div>

                          <div
                            style={{
                              fontSize: 12,
                              fontWeight: 400,
                              color: themeTokens.textPrimary,
                              lineHeight: '16px',
                            }}
                          >
                            {t.title}
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingTop: 2 }}>
                            {t.added ? (
                              <span
                                style={{
                                  height: 28,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  fontSize: 11,
                                  color: '#22c55e',
                                  fontWeight: 400,
                                }}
                              >
                                <Check size={12} />
                                <span>Card criado no quadro</span>
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleApplyTask(msg.id, t)}
                                style={{
                                  height: 28,
                                  background: isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)',
                                  border: 'none',
                                  boxShadow: 'none',
                                  color: chatAccentColor,
                                  borderRadius: 6,
                                  padding: '0 8px',
                                  fontSize: 11,
                                  fontWeight: 400,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 5,
                                  transition: 'all 0.15s ease',
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = chatAccentColor;
                                  e.currentTarget.style.color = '#ffffff';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)';
                                  e.currentTarget.style.color = chatAccentColor;
                                }}
                              >
                                <Plus size={11} />
                                <span>Adicionar à {t.category === 'weekly' ? 'Weekly' : 'Daily'}</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Loading Indicator */}
        {isLoading && (
          <div
            style={{
              alignSelf: 'flex-start',
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              padding: 8,
              borderRadius: 8,
              background: isEffectiveDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
              color: themeTokens.textSecondary,
              fontSize: 12,
              fontWeight: 400,
              border: 'none',
              boxShadow: 'none',
              width: 'fit-content',
            }}
          >
            <Loader2 size={13} className="animate-spin" style={{ color: chatAccentColor, flexShrink: 0 }} />
            <span>Consultando commits locais e executando {cliInfo.label}...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 3. Atalhos Rápidos (Chips) */}
      <div
        style={{
          padding: '8px 10px',
          display: 'flex',
          gap: 8,
          overflowX: 'auto',
          borderTop: `1px solid ${divider}`,
          background: 'transparent',
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          disabled={isLoading}
          onClick={() => processUserRequest('Sugerir Daily completa com base nos meus commits de hoje e ontem')}
          style={{
            height: 28,
            whiteSpace: 'nowrap',
            padding: '0 10px',
            borderRadius: 6,
            border: 'none',
            boxShadow: 'none',
            background: isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
            color: themeTokens.textPrimary,
            fontSize: 11.5,
            fontWeight: 400,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)';
          }}
        >
          <Sparkles size={12} color={chatAccentColor} />
          <span>Sugerir Daily com commits</span>
        </button>

        <button
          type="button"
          disabled={isLoading}
          onClick={() => processUserRequest('Planejar demandas prioritárias da semana para a Weekly')}
          style={{
            height: 28,
            whiteSpace: 'nowrap',
            padding: '0 10px',
            borderRadius: 6,
            border: 'none',
            boxShadow: 'none',
            background: isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
            color: themeTokens.textPrimary,
            fontSize: 11.5,
            fontWeight: 400,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)';
          }}
        >
          <Calendar size={12} color={chatAccentColor} />
          <span>Planejar Weekly</span>
        </button>

        <button
          type="button"
          disabled={isLoading}
          onClick={() => processUserRequest('O que fiz ontem e hoje nos projetos?')}
          style={{
            height: 28,
            whiteSpace: 'nowrap',
            padding: '0 10px',
            borderRadius: 6,
            border: 'none',
            boxShadow: 'none',
            background: isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
            color: themeTokens.textPrimary,
            fontSize: 11.5,
            fontWeight: 400,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)';
          }}
        >
          <GitCommit size={12} color={chatAccentColor} />
          <span>Commits recentes</span>
        </button>
      </div>

      {/* 4. Barra de Input em Card Unificado */}
      <div
        style={{
          padding: '8px 10px 10px 10px',
          borderTop: `1px solid ${divider}`,
          background: 'transparent',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <div
          style={{
            background: isEffectiveDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)',
            borderRadius: 8,
            border: 'none',
            boxShadow: 'none',
            padding: 8,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            transition: 'background 0.15s ease',
          }}
        >
          <textarea
            ref={textareaRef}
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Pergunte sobre seus commits, daily ou weekly..."
            disabled={isLoading}
            rows={1}
            style={{
              width: '100%',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: themeTokens.textPrimary,
              fontSize: 12,
              fontFamily: 'Poppins, sans-serif',
              fontWeight: 400,
              lineHeight: '18px',
              minHeight: 28,
              maxHeight: 120,
              resize: 'none',
              boxSizing: 'border-box',
              padding: 0,
            }}
          />

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
            }}
          >
            <span
              style={{
                fontSize: 10.5,
                color: themeTokens.textSecondary,
                opacity: 0.7,
                fontWeight: 400,
                userSelect: 'none',
              }}
            >
              Enter para enviar
            </span>

            <button
              type="button"
              disabled={!inputPrompt.trim() || isLoading}
              onClick={() => {
                if (inputPrompt.trim() && !isLoading) {
                  processUserRequest(inputPrompt.trim());
                }
              }}
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                background: inputPrompt.trim() && !isLoading ? chatAccentColor : (isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)'),
                border: 'none',
                outline: 'none',
                boxShadow: 'none',
                color: inputPrompt.trim() && !isLoading ? '#ffffff' : (isEffectiveDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)'),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: inputPrompt.trim() && !isLoading ? 'pointer' : 'default',
                transition: 'all 0.15s ease',
                flexShrink: 0,
              }}
              title="Enviar mensagem"
            >
              <ArrowRight size={13} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
