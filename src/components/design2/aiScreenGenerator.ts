import type { Shape } from './types';

export interface PrototypeScreenOptions {
  prompt: string;
  pageId: string;
  startX: number;
  startY: number;
  accentColor: string;
  isDark?: boolean;
  providerName?: string;
  targetFrame?: Shape | null;
}

/**
 * Utilitário para gerar UUID curto e consistente
 */
function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Detecta se o prompt pede um formato mobile ou desktop
 */
function detectDeviceType(prompt: string): 'mobile' | 'desktop' {
  const p = prompt.toLowerCase();
  if (
    p.includes('mobile') ||
    p.includes('celular') ||
    p.includes('app') ||
    p.includes('smartphone') ||
    p.includes('iphone') ||
    p.includes('android') ||
    p.includes('feed') ||
    p.includes('stories')
  ) {
    return 'mobile';
  }
  return 'desktop';
}

/**
 * Detecta a categoria de tela desejada a partir do prompt do usuário
 */
function detectScreenCategory(prompt: string): 'login' | 'dashboard' | 'ecommerce' | 'kanban' | 'profile' | 'mobile_feed' | 'custom' {
  const p = prompt.toLowerCase();
  if (p.includes('login') || p.includes('entrar') || p.includes('auth') || p.includes('senha') || p.includes('cadastro') || p.includes('signup') || p.includes('sign in')) {
    return 'login';
  }
  if (p.includes('dashboard') || p.includes('kpi') || p.includes('métrica') || p.includes('metrica') || p.includes('analytics') || p.includes('gráfico') || p.includes('grafico') || p.includes('financeiro') || p.includes('faturamento')) {
    return 'dashboard';
  }
  if (p.includes('ecommerce') || p.includes('e-commerce') || p.includes('loja') || p.includes('produto') || p.includes('carrinho') || p.includes('checkout') || p.includes('comprar')) {
    return 'ecommerce';
  }
  if (p.includes('kanban') || p.includes('tarefa') || p.includes('sprint') || p.includes('board') || p.includes('coluna') || p.includes('quadro')) {
    return 'kanban';
  }
  if (p.includes('perfil') || p.includes('configuraç') || p.includes('configurac') || p.includes('profile') || p.includes('settings') || p.includes('usuário') || p.includes('usuario')) {
    return 'profile';
  }
  if (detectDeviceType(prompt) === 'mobile') {
    return 'mobile_feed';
  }
  return 'custom';
}

/**
 * Gera protótipo de tela completo e estilizado de acordo com o pedido do usuário
 */
export function generateAiPrototypeScreen(options: PrototypeScreenOptions): { shapes: Shape[]; mainFrameId: string; width: number; height: number } {
  const { prompt, pageId, accentColor, isDark = true, targetFrame } = options;
  const startX = targetFrame ? targetFrame.x : options.startX;
  const startY = targetFrame ? targetFrame.y : options.startY;
  const category = detectScreenCategory(prompt);
  const device = targetFrame ? (targetFrame.width < 500 ? 'mobile' : 'desktop') : detectDeviceType(prompt);

  // Paleta de cores moderna
  const bgFrame = targetFrame?.fill && targetFrame.fill !== 'transparent' ? targetFrame.fill : (isDark ? '#141414' : '#F8FAFC');
  const bgCard = isDark ? '#1E1E1E' : '#FFFFFF';
  const bgCardSecondary = isDark ? '#262626' : '#F1F5F9';
  const textPrimary = isDark ? '#FFFFFF' : '#0F172A';
  const textSecondary = isDark ? '#A1A1AA' : '#64748B';
  const textMuted = isDark ? '#71717A' : '#94A3B8';
  const border = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)';
  const borderActive = accentColor;
  const successColor = '#10B981';
  const warningColor = '#F59E0B';

  const shapes: Shape[] = [];
  let z = targetFrame ? targetFrame.zIndex + 1 : 100;

  const getOrCreateFrame = (defaultFrameId: string, defaultName: string, defaultW: number, defaultH: number, defaultRadius: number) => {
    const frameId = targetFrame ? targetFrame.id : defaultFrameId;
    const frameW = targetFrame ? targetFrame.width : defaultW;
    const frameH = targetFrame ? targetFrame.height : defaultH;
    const frameShape: Shape = targetFrame
      ? {
          ...targetFrame,
          x: startX,
          y: startY,
          width: frameW,
          height: frameH,
          pageId: targetFrame.pageId || pageId,
        }
      : {
          id: frameId,
          name: defaultName,
          type: 'frame',
          pageId,
          x: startX,
          y: startY,
          width: frameW,
          height: frameH,
          rotation: 0,
          fill: bgFrame,
          stroke: border,
          strokeWidth: 1,
          opacity: 1,
          cornerRadius: defaultRadius,
          zIndex: z++,
          visible: true,
        };
    return { frameId, frameW, frameH, frameShape };
  };

  // =========================================================================
  // 1. TELA DE LOGIN / AUTENTICAÇÃO
  // =========================================================================
  if (category === 'login') {
    const isMobile = device === 'mobile';
    const { frameId, frameW, frameH, frameShape } = getOrCreateFrame(
      uid('frame-login'),
      `Login & Auth • ${isMobile ? 'Mobile' : 'Desktop'}`,
      isMobile ? 390 : 1280,
      isMobile ? 844 : 800,
      isMobile ? 40 : 16
    );
    shapes.push(frameShape);

    const cardW = isMobile ? 340 : 440;
    const cardH = isMobile ? 620 : 580;
    const cardX = startX + (frameW - cardW) / 2;
    const cardY = startY + (frameH - cardH) / 2;
    const cardId = uid('card-auth');

    // Card central de login
    shapes.push({
      id: cardId,
      parentId: frameId,
      name: 'Auth Card',
      type: 'rect',
      pageId,
      x: cardX,
      y: cardY,
      width: cardW,
      height: cardH,
      rotation: 0,
      fill: bgCard,
      stroke: border,
      strokeWidth: 1,
      cornerRadius: 16,
      effects: [
        { id: uid('eff'), type: 'drop-shadow', color: '#000000', opacity: 0.35, x: 0, y: 12, blur: 24, spread: 0, visible: true },
      ],
      zIndex: z++,
      visible: true,
    });

    // Logo / Ícone
    const iconSize = 44;
    shapes.push({
      id: uid('auth-logo'),
      parentId: frameId,
      name: 'App Logo',
      type: 'rect',
      pageId,
      x: cardX + (cardW - iconSize) / 2,
      y: cardY + 36,
      width: iconSize,
      height: iconSize,
      rotation: 0,
      fill: accentColor,
      cornerRadius: 12,
      zIndex: z++,
      visible: true,
    });

    // Título
    shapes.push({
      id: uid('auth-title'),
      parentId: frameId,
      name: 'Título',
      type: 'text',
      pageId,
      x: cardX + 32,
      y: cardY + 96,
      width: cardW - 64,
      height: 32,
      fill: textPrimary,
      text: 'Bem-vindo de volta',
      fontSize: 22,
      zIndex: z++,
      visible: true,
    });

    // Subtítulo
    shapes.push({
      id: uid('auth-sub'),
      parentId: frameId,
      name: 'Subtítulo',
      type: 'text',
      pageId,
      x: cardX + 32,
      y: cardY + 128,
      width: cardW - 64,
      height: 20,
      fill: textSecondary,
      text: 'Insira suas credenciais para acessar a plataforma',
      fontSize: 12,
      zIndex: z++,
      visible: true,
    });

    // Botão Social Google
    const socialBtnY = cardY + 160;
    shapes.push({
      id: uid('btn-google'),
      parentId: frameId,
      name: 'Botão Google',
      type: 'rect',
      pageId,
      x: cardX + 32,
      y: socialBtnY,
      width: cardW - 64,
      height: 42,
      fill: bgCardSecondary,
      stroke: border,
      strokeWidth: 1,
      cornerRadius: 8,
      zIndex: z++,
      visible: true,
    });
    shapes.push({
      id: uid('txt-google'),
      parentId: frameId,
      name: 'Texto Google',
      type: 'text',
      pageId,
      x: cardX + 40,
      y: socialBtnY + 12,
      width: cardW - 80,
      height: 20,
      fill: textPrimary,
      text: 'Continuar com Google',
      fontSize: 13,
      zIndex: z++,
      visible: true,
    });

    // Divisor
    const divY = socialBtnY + 56;
    shapes.push({
      id: uid('divider-auth'),
      parentId: frameId,
      name: 'Divisor',
      type: 'line',
      pageId,
      x: cardX + 32,
      y: divY + 8,
      width: cardW - 64,
      height: 0,
      stroke: border,
      strokeWidth: 1,
      fill: 'none',
      zIndex: z++,
      visible: true,
    });
    shapes.push({
      id: uid('txt-or'),
      parentId: frameId,
      name: 'Texto Ou',
      type: 'text',
      pageId,
      x: cardX + (cardW - 120) / 2,
      y: divY,
      width: 120,
      height: 16,
      fill: textMuted,
      text: 'ou com e-mail',
      fontSize: 11,
      zIndex: z++,
      visible: true,
    });

    // Campo E-mail
    const emailY = divY + 30;
    shapes.push({
      id: uid('lbl-email'),
      parentId: frameId,
      name: 'Label E-mail',
      type: 'text',
      pageId,
      x: cardX + 32,
      y: emailY,
      width: cardW - 64,
      height: 18,
      fill: textSecondary,
      text: 'E-mail corporativo',
      fontSize: 12,
      zIndex: z++,
      visible: true,
    });
    shapes.push({
      id: uid('input-email'),
      parentId: frameId,
      name: 'Input E-mail',
      type: 'rect',
      pageId,
      x: cardX + 32,
      y: emailY + 22,
      width: cardW - 64,
      height: 42,
      fill: bgCardSecondary,
      stroke: border,
      strokeWidth: 1,
      cornerRadius: 8,
      zIndex: z++,
      visible: true,
    });
    shapes.push({
      id: uid('placeholder-email'),
      parentId: frameId,
      name: 'Placeholder E-mail',
      type: 'text',
      pageId,
      x: cardX + 44,
      y: emailY + 34,
      width: cardW - 88,
      height: 18,
      fill: textMuted,
      text: 'alex@empresa.com.br',
      fontSize: 12,
      zIndex: z++,
      visible: true,
    });

    // Campo Senha
    const passY = emailY + 76;
    shapes.push({
      id: uid('lbl-pass'),
      parentId: frameId,
      name: 'Label Senha',
      type: 'text',
      pageId,
      x: cardX + 32,
      y: passY,
      width: cardW - 64,
      height: 18,
      fill: textSecondary,
      text: 'Senha de acesso',
      fontSize: 12,
      zIndex: z++,
      visible: true,
    });
    shapes.push({
      id: uid('input-pass'),
      parentId: frameId,
      name: 'Input Senha',
      type: 'rect',
      pageId,
      x: cardX + 32,
      y: passY + 22,
      width: cardW - 64,
      height: 42,
      fill: bgCardSecondary,
      stroke: border,
      strokeWidth: 1,
      cornerRadius: 8,
      zIndex: z++,
      visible: true,
    });
    shapes.push({
      id: uid('placeholder-pass'),
      parentId: frameId,
      name: 'Placeholder Senha',
      type: 'text',
      pageId,
      x: cardX + 44,
      y: passY + 34,
      width: cardW - 88,
      height: 18,
      fill: textMuted,
      text: '••••••••••••••••',
      fontSize: 14,
      zIndex: z++,
      visible: true,
    });

    // Botão Entrar Primário
    const btnSubmitY = passY + 84;
    shapes.push({
      id: uid('btn-submit'),
      parentId: frameId,
      name: 'Botão Entrar',
      type: 'rect',
      pageId,
      x: cardX + 32,
      y: btnSubmitY,
      width: cardW - 64,
      height: 44,
      fill: accentColor,
      stroke: 'transparent',
      strokeWidth: 0,
      cornerRadius: 8,
      effects: [
        { id: uid('eff-btn'), type: 'drop-shadow', color: accentColor, opacity: 0.35, x: 0, y: 4, blur: 12, spread: 0, visible: true },
      ],
      zIndex: z++,
      visible: true,
    });
    shapes.push({
      id: uid('txt-submit'),
      parentId: frameId,
      name: 'Texto Entrar',
      type: 'text',
      pageId,
      x: cardX + 40,
      y: btnSubmitY + 13,
      width: cardW - 80,
      height: 20,
      fill: '#FFFFFF',
      text: 'Entrar na Plataforma',
      fontSize: 13,
      zIndex: z++,
      visible: true,
    });

    // Link rodapé
    shapes.push({
      id: uid('footer-auth'),
      parentId: frameId,
      name: 'Rodapé Cadastro',
      type: 'text',
      pageId,
      x: cardX + 32,
      y: btnSubmitY + 58,
      width: cardW - 64,
      height: 18,
      fill: textSecondary,
      text: 'Não possui uma conta? Criar conta gratuita',
      fontSize: 11,
      zIndex: z++,
      visible: true,
    });

    return { shapes, mainFrameId: frameId, width: frameW, height: frameH };
  }

  // =========================================================================
  // 2. DASHBOARD / ANALYTICS COM KPIS E GRÁFICOS
  // =========================================================================
  if (category === 'dashboard' || category === 'custom') {
    const { frameId, frameW, frameH, frameShape } = getOrCreateFrame(
      uid('frame-dash'),
      `Dashboard • ${prompt.slice(0, 28) || 'Analytics'}`,
      1440,
      900,
      16
    );
    shapes.push(frameShape);

    // Sidebar Lateral Esquerda (240px)
    const sidebarW = 240;
    shapes.push({
      id: uid('sidebar'),
      parentId: frameId,
      name: 'Sidebar Navigation',
      type: 'rect',
      pageId,
      x: startX,
      y: startY,
      width: sidebarW,
      height: frameH,
      fill: isDark ? '#111111' : '#F1F5F9',
      stroke: border,
      strokeWidth: 1,
      topLeftRadius: 16,
      bottomLeftRadius: 16,
      zIndex: z++,
      visible: true,
    });

    // Logo & App Name
    shapes.push({
      id: uid('sb-logo'),
      parentId: frameId,
      name: 'Logo Icon',
      type: 'rect',
      pageId,
      x: startX + 20,
      y: startY + 24,
      width: 28,
      height: 28,
      fill: accentColor,
      cornerRadius: 6,
      zIndex: z++,
      visible: true,
    });
    shapes.push({
      id: uid('sb-brand'),
      parentId: frameId,
      name: 'Brand Name',
      type: 'text',
      pageId,
      x: startX + 56,
      y: startY + 28,
      width: 160,
      height: 20,
      fill: textPrimary,
      text: 'Aura Studio',
      fontSize: 15,
      zIndex: z++,
      visible: true,
    });

    // Menu Itens
    const menuItems = ['Visão Geral', 'Projetos', 'Métricas & KPIs', 'Clientes', 'Financeiro', 'Configurações'];
    menuItems.forEach((item, idx) => {
      const itemY = startY + 80 + idx * 42;
      const isActive = idx === 0;

      shapes.push({
        id: uid(`nav-item-${idx}`),
        parentId: frameId,
        name: `Nav Item ${item}`,
        type: 'rect',
        pageId,
        x: startX + 12,
        y: itemY,
        width: sidebarW - 24,
        height: 36,
        fill: isActive ? (isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)') : 'transparent',
        borderLeft: isActive ? `3px solid ${accentColor}` : undefined,
        cornerRadius: 8,
        zIndex: z++,
        visible: true,
      });

      shapes.push({
        id: uid(`nav-txt-${idx}`),
        parentId: frameId,
        name: `Nav Text ${item}`,
        type: 'text',
        pageId,
        x: startX + 28,
        y: itemY + 10,
        width: 160,
        height: 18,
        fill: isActive ? textPrimary : textSecondary,
        text: item,
        fontSize: 12.5,
        zIndex: z++,
        visible: true,
      });
    });

    // Topbar Superior (x: 240, width: 1200)
    const topbarH = 64;
    shapes.push({
      id: uid('topbar'),
      parentId: frameId,
      name: 'Topbar Header',
      type: 'rect',
      pageId,
      x: startX + sidebarW,
      y: startY,
      width: frameW - sidebarW,
      height: topbarH,
      fill: bgCard,
      stroke: border,
      strokeWidth: 1,
      topRightRadius: 16,
      zIndex: z++,
      visible: true,
    });

    // Busca no Topbar
    shapes.push({
      id: uid('search-bar'),
      parentId: frameId,
      name: 'Input de Busca',
      type: 'rect',
      pageId,
      x: startX + sidebarW + 28,
      y: startY + 14,
      width: 320,
      height: 36,
      fill: bgCardSecondary,
      stroke: border,
      strokeWidth: 1,
      cornerRadius: 8,
      zIndex: z++,
      visible: true,
    });
    shapes.push({
      id: uid('search-txt'),
      parentId: frameId,
      name: 'Busca Placeholder',
      type: 'text',
      pageId,
      x: startX + sidebarW + 42,
      y: startY + 24,
      width: 280,
      height: 18,
      fill: textMuted,
      text: 'Buscar projetos, tarefas ou relatórios...',
      fontSize: 12,
      zIndex: z++,
      visible: true,
    });

    // Avatar do Usuário Topbar
    shapes.push({
      id: uid('user-avatar'),
      parentId: frameId,
      name: 'User Avatar',
      type: 'ellipse',
      pageId,
      x: startX + frameW - 60,
      y: startY + 14,
      width: 36,
      height: 36,
      fill: accentColor,
      stroke: 'none',
      strokeWidth: 0,
      zIndex: z++,
      visible: true,
    });

    // Título da Página de Conteúdo
    const contentX = startX + sidebarW + 28;
    const contentY = startY + topbarH + 24;
    shapes.push({
      id: uid('title-dash'),
      parentId: frameId,
      name: 'Page Title',
      type: 'text',
      pageId,
      x: contentX,
      y: contentY,
      width: 600,
      height: 28,
      fill: textPrimary,
      text: 'Painel Geral de Métricas',
      fontSize: 20,
      zIndex: z++,
      visible: true,
    });
    shapes.push({
      id: uid('sub-dash'),
      parentId: frameId,
      name: 'Page Subtitle',
      type: 'text',
      pageId,
      x: contentX,
      y: contentY + 28,
      width: 600,
      height: 18,
      fill: textSecondary,
      text: 'Dados consolidados dos últimos 30 dias em tempo real',
      fontSize: 12,
      zIndex: z++,
      visible: true,
    });

    // 4 Cards de KPI
    const kpiY = contentY + 60;
    const kpiW = 270;
    const kpiH = 110;
    const kpiGap = 20;

    const kpiData = [
      { title: 'Faturamento Total', val: 'R$ 148.920', badge: '+18.4%', good: true },
      { title: 'Usuários Ativos', val: '4.892', badge: '+9.2%', good: true },
      { title: 'Taxa de Conversão', val: '4.62%', badge: '+1.4%', good: true },
      { title: 'Tempo Médio', val: '14m 20s', badge: '-3.1%', good: false },
    ];

    kpiData.forEach((kpi, i) => {
      const cardX = contentX + i * (kpiW + kpiGap);
      shapes.push({
        id: uid(`kpi-card-${i}`),
        parentId: frameId,
        name: `KPI ${kpi.title}`,
        type: 'rect',
        pageId,
        x: cardX,
        y: kpiY,
        width: kpiW,
        height: kpiH,
        fill: bgCard,
        stroke: border,
        strokeWidth: 1,
        cornerRadius: 12,
        effects: [
          { id: uid('eff-kpi'), type: 'drop-shadow', color: '#000000', opacity: 0.15, x: 0, y: 4, blur: 8, spread: 0, visible: true },
        ],
        zIndex: z++,
        visible: true,
      });

      shapes.push({
        id: uid(`kpi-title-${i}`),
        parentId: frameId,
        name: `KPI Title ${kpi.title}`,
        type: 'text',
        pageId,
        x: cardX + 16,
        y: kpiY + 16,
        width: kpiW - 32,
        height: 16,
        fill: textSecondary,
        text: kpi.title,
        fontSize: 12,
        zIndex: z++,
        visible: true,
      });

      shapes.push({
        id: uid(`kpi-val-${i}`),
        parentId: frameId,
        name: `KPI Value ${kpi.val}`,
        type: 'text',
        pageId,
        x: cardX + 16,
        y: kpiY + 44,
        width: 170,
        height: 28,
        fill: textPrimary,
        text: kpi.val,
        fontSize: 22,
        zIndex: z++,
        visible: true,
      });

      shapes.push({
        id: uid(`kpi-badge-${i}`),
        parentId: frameId,
        name: `KPI Badge`,
        type: 'rect',
        pageId,
        x: cardX + kpiW - 74,
        y: kpiY + 48,
        width: 58,
        height: 22,
        fill: kpi.good ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
        cornerRadius: 6,
        zIndex: z++,
        visible: true,
      });

      shapes.push({
        id: uid(`kpi-badgetxt-${i}`),
        parentId: frameId,
        name: `KPI Badge Text`,
        type: 'text',
        pageId,
        x: cardX + kpiW - 68,
        y: kpiY + 52,
        width: 50,
        height: 14,
        fill: kpi.good ? successColor : '#EF4444',
        text: kpi.badge,
        fontSize: 11,
        zIndex: z++,
        visible: true,
      });
    });

    // Seção Central de Gráficos e Tabela
    const chartY = kpiY + kpiH + 24;
    const chartW = 720;
    const chartH = 430;

    // Card do Gráfico
    shapes.push({
      id: uid('chart-card'),
      parentId: frameId,
      name: 'Gráfico Card',
      type: 'rect',
      pageId,
      x: contentX,
      y: chartY,
      width: chartW,
      height: chartH,
      fill: bgCard,
      stroke: border,
      strokeWidth: 1,
      cornerRadius: 12,
      zIndex: z++,
      visible: true,
    });

    shapes.push({
      id: uid('chart-title'),
      parentId: frameId,
      name: 'Chart Title',
      type: 'text',
      pageId,
      x: contentX + 20,
      y: chartY + 20,
      width: 400,
      height: 20,
      fill: textPrimary,
      text: 'Evolução Mensal de Faturamento',
      fontSize: 14,
      zIndex: z++,
      visible: true,
    });

    // 7 Barras do Gráfico
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul'];
    const heights = [120, 160, 140, 210, 190, 260, 290];
    const barW = 42;
    const barSpacing = (chartW - 80) / months.length;

    months.forEach((m, idx) => {
      const bx = contentX + 40 + idx * barSpacing + 10;
      const bh = heights[idx];
      const by = chartY + chartH - 60 - bh;

      // Barra do gráfico
      shapes.push({
        id: uid(`bar-${idx}`),
        parentId: frameId,
        name: `Bar ${m}`,
        type: 'rect',
        pageId,
        x: bx,
        y: by,
        width: barW,
        height: bh,
        fill: idx === 6 ? accentColor : (isDark ? '#2E2E2E' : '#CBD5E1'),
        cornerRadius: 6,
        zIndex: z++,
        visible: true,
      });

      // Rótulo do Mês
      shapes.push({
        id: uid(`bar-lbl-${idx}`),
        parentId: frameId,
        name: `Month ${m}`,
        type: 'text',
        pageId,
        x: bx + 8,
        y: chartY + chartH - 40,
        width: barW,
        height: 16,
        fill: textSecondary,
        text: m,
        fontSize: 11,
        zIndex: z++,
        visible: true,
      });
    });

    // Card de Atividades / Transações Recentes (Direita do Gráfico)
    const tableX = contentX + chartW + 20;
    const tableW = frameW - tableX - 28;
    const tableH = chartH;

    shapes.push({
      id: uid('table-card'),
      parentId: frameId,
      name: 'Tabela de Transações',
      type: 'rect',
      pageId,
      x: tableX,
      y: chartY,
      width: tableW,
      height: tableH,
      fill: bgCard,
      stroke: border,
      strokeWidth: 1,
      cornerRadius: 12,
      zIndex: z++,
      visible: true,
    });

    shapes.push({
      id: uid('table-title'),
      parentId: frameId,
      name: 'Tabela Título',
      type: 'text',
      pageId,
      x: tableX + 20,
      y: chartY + 20,
      width: 260,
      height: 20,
      fill: textPrimary,
      text: 'Transações Recentes',
      fontSize: 14,
      zIndex: z++,
      visible: true,
    });

    const rows = [
      { name: 'Stripe Gateway', cat: 'Software', val: 'R$ 2.450', st: 'Concluído' },
      { name: 'Contrato Aura Dev', cat: 'Licença', val: 'R$ 18.900', st: 'Concluído' },
      { name: 'Google Cloud Platform', cat: 'Infra', val: 'R$ 1.280', st: 'Pendente' },
      { name: 'Assinatura Figma Beta', cat: 'Design', val: 'R$ 490', st: 'Concluído' },
      { name: 'AWS Hosting Services', cat: 'Cloud', val: 'R$ 3.820', st: 'Concluído' },
    ];

    rows.forEach((r, idx) => {
      const ry = chartY + 60 + idx * 58;

      shapes.push({
        id: uid(`row-rect-${idx}`),
        parentId: frameId,
        name: `Row ${r.name}`,
        type: 'rect',
        pageId,
        x: tableX + 16,
        y: ry,
        width: tableW - 32,
        height: 48,
        fill: bgCardSecondary,
        stroke: border,
        strokeWidth: 1,
        cornerRadius: 8,
        zIndex: z++,
        visible: true,
      });

      shapes.push({
        id: uid(`row-name-${idx}`),
        parentId: frameId,
        name: `Row Name ${r.name}`,
        type: 'text',
        pageId,
        x: tableX + 28,
        y: ry + 10,
        width: 180,
        height: 16,
        fill: textPrimary,
        text: r.name,
        fontSize: 12,
        zIndex: z++,
        visible: true,
      });

      shapes.push({
        id: uid(`row-cat-${idx}`),
        parentId: frameId,
        name: `Row Cat ${r.cat}`,
        type: 'text',
        pageId,
        x: tableX + 28,
        y: ry + 28,
        width: 140,
        height: 14,
        fill: textMuted,
        text: r.cat,
        fontSize: 10,
        zIndex: z++,
        visible: true,
      });

      shapes.push({
        id: uid(`row-val-${idx}`),
        parentId: frameId,
        name: `Row Val ${r.val}`,
        type: 'text',
        pageId,
        x: tableX + tableW - 130,
        y: ry + 16,
        width: 100,
        height: 18,
        fill: textPrimary,
        text: r.val,
        fontSize: 12.5,
        zIndex: z++,
        visible: true,
      });
    });

    return { shapes, mainFrameId: frameId, width: frameW, height: frameH };
  }

  // =========================================================================
  // 3. E-COMMERCE / CATÁLOGO DE PRODUTOS
  // =========================================================================
  if (category === 'ecommerce') {
    const { frameId, frameW, frameH, frameShape } = getOrCreateFrame(
      uid('frame-ecom'),
      `E-Commerce • Loja & Produtos`,
      1280,
      880,
      16
    );
    shapes.push(frameShape);

    // Header Store
    shapes.push({
      id: uid('ecom-header'),
      parentId: frameId,
      name: 'Store Header',
      type: 'rect',
      pageId,
      x: startX,
      y: startY,
      width: frameW,
      height: 68,
      fill: bgCard,
      stroke: border,
      strokeWidth: 1,
      topRightRadius: 16,
      topLeftRadius: 16,
      zIndex: z++,
      visible: true,
    });

    shapes.push({
      id: uid('ecom-logo'),
      parentId: frameId,
      name: 'Store Logo',
      type: 'text',
      pageId,
      x: startX + 32,
      y: startY + 24,
      width: 180,
      height: 24,
      fill: textPrimary,
      text: 'Aura Store ✦',
      fontSize: 18,
      zIndex: z++,
      visible: true,
    });

    // Hero Banner Promo
    const heroY = startY + 92;
    shapes.push({
      id: uid('ecom-hero'),
      parentId: frameId,
      name: 'Hero Banner',
      type: 'rect',
      pageId,
      x: startX + 32,
      y: heroY,
      width: frameW - 64,
      height: 180,
      fill: isDark ? '#222222' : '#E2E8F0',
      stroke: border,
      strokeWidth: 1,
      cornerRadius: 14,
      zIndex: z++,
      visible: true,
    });

    shapes.push({
      id: uid('hero-txt-title'),
      parentId: frameId,
      name: 'Hero Title',
      type: 'text',
      pageId,
      x: startX + 64,
      y: heroY + 40,
      width: 500,
      height: 32,
      fill: textPrimary,
      text: 'Nova Coleção Pro 2026',
      fontSize: 26,
      zIndex: z++,
      visible: true,
    });

    shapes.push({
      id: uid('hero-txt-sub'),
      parentId: frameId,
      name: 'Hero Subtitle',
      type: 'text',
      pageId,
      x: startX + 64,
      y: heroY + 80,
      width: 450,
      height: 20,
      fill: textSecondary,
      text: 'Aproveite até 40% OFF com entrega expressa para todo o Brasil',
      fontSize: 13,
      zIndex: z++,
      visible: true,
    });

    shapes.push({
      id: uid('hero-btn'),
      parentId: frameId,
      name: 'Hero CTA',
      type: 'rect',
      pageId,
      x: startX + 64,
      y: heroY + 115,
      width: 140,
      height: 38,
      fill: accentColor,
      cornerRadius: 8,
      zIndex: z++,
      visible: true,
    });

    shapes.push({
      id: uid('hero-btn-txt'),
      parentId: frameId,
      name: 'Hero CTA Text',
      type: 'text',
      pageId,
      x: startX + 86,
      y: heroY + 126,
      width: 100,
      height: 18,
      fill: '#FFFFFF',
      text: 'Explorar Agora',
      fontSize: 12,
      zIndex: z++,
      visible: true,
    });

    // 4 Cards de Produtos
    const prodY = heroY + 210;
    const prodW = 280;
    const prodH = 340;
    const prodGap = (frameW - 64 - 4 * prodW) / 3;

    const products = [
      { name: 'Headphone Wireless Pro', price: 'R$ 489,00', tag: 'Destaque' },
      { name: 'Smartwatch Ultra 2', price: 'R$ 899,00', tag: 'Novo' },
      { name: 'Teclado Mecânico RGB', price: 'R$ 349,00', tag: 'Mais vendido' },
      { name: 'Mouse Ergonômico 4K', price: 'R$ 219,00', tag: 'Promo' },
    ];

    products.forEach((p, i) => {
      const px = startX + 32 + i * (prodW + prodGap);

      // Card Produto
      shapes.push({
        id: uid(`prod-card-${i}`),
        parentId: frameId,
        name: `Product Card ${p.name}`,
        type: 'rect',
        pageId,
        x: px,
        y: prodY,
        width: prodW,
        height: prodH,
        fill: bgCard,
        stroke: border,
        strokeWidth: 1,
        cornerRadius: 12,
        zIndex: z++,
        visible: true,
      });

      // Imagem placeholder do produto
      shapes.push({
        id: uid(`prod-img-${i}`),
        parentId: frameId,
        name: `Product Image ${p.name}`,
        type: 'rect',
        pageId,
        x: px + 12,
        y: prodY + 12,
        width: prodW - 24,
        height: 170,
        fill: bgCardSecondary,
        cornerRadius: 8,
        zIndex: z++,
        visible: true,
      });

      // Tag de produto
      shapes.push({
        id: uid(`prod-tag-${i}`),
        parentId: frameId,
        name: `Tag ${p.tag}`,
        type: 'rect',
        pageId,
        x: px + 20,
        y: prodY + 20,
        width: 76,
        height: 22,
        fill: accentColor,
        cornerRadius: 5,
        zIndex: z++,
        visible: true,
      });
      shapes.push({
        id: uid(`prod-tagtxt-${i}`),
        parentId: frameId,
        name: `Tag Text`,
        type: 'text',
        pageId,
        x: px + 26,
        y: prodY + 24,
        width: 66,
        height: 14,
        fill: '#FFFFFF',
        text: p.tag,
        fontSize: 10,
        zIndex: z++,
        visible: true,
      });

      // Nome do Produto
      shapes.push({
        id: uid(`prod-title-${i}`),
        parentId: frameId,
        name: `Product Title`,
        type: 'text',
        pageId,
        x: px + 14,
        y: prodY + 196,
        width: prodW - 28,
        height: 20,
        fill: textPrimary,
        text: p.name,
        fontSize: 13,
        zIndex: z++,
        visible: true,
      });

      // Preço
      shapes.push({
        id: uid(`prod-price-${i}`),
        parentId: frameId,
        name: `Product Price`,
        type: 'text',
        pageId,
        x: px + 14,
        y: prodY + 230,
        width: 150,
        height: 22,
        fill: textPrimary,
        text: p.price,
        fontSize: 16,
        zIndex: z++,
        visible: true,
      });

      // Botão Comprar
      shapes.push({
        id: uid(`prod-btn-${i}`),
        parentId: frameId,
        name: `Botão Comprar`,
        type: 'rect',
        pageId,
        x: px + 14,
        y: prodY + 280,
        width: prodW - 28,
        height: 38,
        fill: accentColor,
        cornerRadius: 8,
        zIndex: z++,
        visible: true,
      });
      shapes.push({
        id: uid(`prod-btntxt-${i}`),
        parentId: frameId,
        name: `Comprar Text`,
        type: 'text',
        pageId,
        x: px + 20,
        y: prodY + 291,
        width: prodW - 40,
        height: 18,
        fill: '#FFFFFF',
        text: 'Adicionar ao Carrinho',
        fontSize: 12,
        zIndex: z++,
        visible: true,
      });
    });

    return { shapes, mainFrameId: frameId, width: frameW, height: frameH };
  }

  // =========================================================================
  // 4. KANBAN BOARD / GERENCIADOR DE TAREFAS
  // =========================================================================
  if (category === 'kanban') {
    const { frameId, frameW, frameH, frameShape } = getOrCreateFrame(
      uid('frame-kanban'),
      `Kanban • Quadro de Sprints`,
      1380,
      860,
      16
    );
    shapes.push(frameShape);

    // Top Header Kanban
    shapes.push({
      id: uid('kb-header'),
      parentId: frameId,
      name: 'Kanban Header',
      type: 'rect',
      pageId,
      x: startX,
      y: startY,
      width: frameW,
      height: 64,
      fill: bgCard,
      stroke: border,
      strokeWidth: 1,
      topRightRadius: 16,
      topLeftRadius: 16,
      zIndex: z++,
      visible: true,
    });

    shapes.push({
      id: uid('kb-title'),
      parentId: frameId,
      name: 'Kanban Title',
      type: 'text',
      pageId,
      x: startX + 28,
      y: startY + 22,
      width: 300,
      height: 24,
      fill: textPrimary,
      text: 'Sprint 24 • Aura Dev Core',
      fontSize: 18,
      zIndex: z++,
      visible: true,
    });

    // Botão Nova Tarefa Topo
    shapes.push({
      id: uid('kb-new-btn'),
      parentId: frameId,
      name: 'Botão Nova Tarefa',
      type: 'rect',
      pageId,
      x: startX + frameW - 160,
      y: startY + 14,
      width: 132,
      height: 36,
      fill: accentColor,
      cornerRadius: 8,
      zIndex: z++,
      visible: true,
    });
    shapes.push({
      id: uid('kb-new-txt'),
      parentId: frameId,
      name: 'Texto Nova Tarefa',
      type: 'text',
      pageId,
      x: startX + frameW - 146,
      y: startY + 24,
      width: 110,
      height: 18,
      fill: '#FFFFFF',
      text: '+ Nova Tarefa',
      fontSize: 12,
      zIndex: z++,
      visible: true,
    });

    // 3 Colunas Kanban
    const columns = [
      {
        title: 'A Fazer',
        count: '3',
        cards: [
          { title: 'Refatorar serviço de autenticação JWT', tag: 'Backend', color: '#6366F1' },
          { title: 'Criar protótipos de tela mobile', tag: 'Design', color: accentColor },
          { title: 'Otimizar queries do PostgreSQL', tag: 'Database', color: '#10B981' },
        ],
      },
      {
        title: 'Em Progresso',
        count: '2',
        cards: [
          { title: 'Implementar Toolbar estilo Figma UI3', tag: 'Frontend', color: '#EC4899' },
          { title: 'Testes de integração ponta a ponta', tag: 'QA', color: '#F59E0B' },
        ],
      },
      {
        title: 'Concluído',
        count: '3',
        cards: [
          { title: 'Setup de CI/CD via GitHub Actions', tag: 'DevOps', color: '#10B981' },
          { title: 'Migração de banco para multi-tenant', tag: 'Database', color: '#10B981' },
          { title: 'Landing page oficial v2.0', tag: 'Marketing', color: '#8B5CF6' },
        ],
      },
    ];

    const colW = (frameW - 56 - 2 * 20) / 3;
    const colY = startY + 84;
    const colH = frameH - 108;

    columns.forEach((col, cIdx) => {
      const colX = startX + 28 + cIdx * (colW + 20);

      // Fundo da coluna
      shapes.push({
        id: uid(`col-bg-${cIdx}`),
        parentId: frameId,
        name: `Coluna ${col.title}`,
        type: 'rect',
        pageId,
        x: colX,
        y: colY,
        width: colW,
        height: colH,
        fill: bgCard,
        stroke: border,
        strokeWidth: 1,
        cornerRadius: 12,
        zIndex: z++,
        visible: true,
      });

      // Cabeçalho da coluna
      shapes.push({
        id: uid(`col-title-${cIdx}`),
        parentId: frameId,
        name: `Col Title ${col.title}`,
        type: 'text',
        pageId,
        x: colX + 16,
        y: colY + 16,
        width: 180,
        height: 20,
        fill: textPrimary,
        text: col.title,
        fontSize: 14,
        zIndex: z++,
        visible: true,
      });

      // Contador
      shapes.push({
        id: uid(`col-cnt-${cIdx}`),
        parentId: frameId,
        name: `Col Count`,
        type: 'rect',
        pageId,
        x: colX + colW - 44,
        y: colY + 14,
        width: 28,
        height: 22,
        fill: bgCardSecondary,
        cornerRadius: 6,
        zIndex: z++,
        visible: true,
      });
      shapes.push({
        id: uid(`col-cnttxt-${cIdx}`),
        parentId: frameId,
        name: `Col Count Text`,
        type: 'text',
        pageId,
        x: colX + colW - 36,
        y: colY + 18,
        width: 14,
        height: 14,
        fill: textSecondary,
        text: col.count,
        fontSize: 11,
        zIndex: z++,
        visible: true,
      });

      // Cards da coluna
      col.cards.forEach((card, cardIdx) => {
        const cardY = colY + 54 + cardIdx * 110;

        shapes.push({
          id: uid(`kb-card-${cIdx}-${cardIdx}`),
          parentId: frameId,
          name: `Card ${card.title}`,
          type: 'rect',
          pageId,
          x: colX + 12,
          y: cardY,
          width: colW - 24,
          height: 96,
          fill: bgCardSecondary,
          stroke: border,
          strokeWidth: 1,
          cornerRadius: 8,
          zIndex: z++,
          visible: true,
        });

        // Tag
        shapes.push({
          id: uid(`card-tag-${cIdx}-${cardIdx}`),
          parentId: frameId,
          name: `Tag`,
          type: 'rect',
          pageId,
          x: colX + 22,
          y: cardY + 12,
          width: 64,
          height: 18,
          fill: card.color,
          cornerRadius: 4,
          zIndex: z++,
          visible: true,
        });
        shapes.push({
          id: uid(`card-tagtxt-${cIdx}-${cardIdx}`),
          parentId: frameId,
          name: `Tag Text`,
          type: 'text',
          pageId,
          x: colX + 26,
          y: cardY + 14,
          width: 56,
          height: 14,
          fill: '#FFFFFF',
          text: card.tag,
          fontSize: 10,
          zIndex: z++,
          visible: true,
        });

        // Título da tarefa
        shapes.push({
          id: uid(`card-title-${cIdx}-${cardIdx}`),
          parentId: frameId,
          name: `Card Title`,
          type: 'text',
          pageId,
          x: colX + 22,
          y: cardY + 38,
          width: colW - 44,
          height: 34,
          fill: textPrimary,
          text: card.title,
          fontSize: 12,
          zIndex: z++,
          visible: true,
        });
      });
    });

    return { shapes, mainFrameId: frameId, width: frameW, height: frameH };
  }

  // =========================================================================
  // 5. MOBILE APP / FEED & STORIES
  // =========================================================================
  const { frameId, frameW, frameH, frameShape } = getOrCreateFrame(
    uid('frame-mobile'),
    `Mobile Screen • 390x844`,
    390,
    844,
    44
  );
  shapes.push(frameShape);

  // iOS Status Bar
  shapes.push({
    id: uid('status-bar'),
    parentId: frameId,
    name: 'Status Bar',
    type: 'text',
    pageId,
    x: startX + 32,
    y: startY + 16,
    width: 60,
    height: 18,
    fill: textPrimary,
    text: '9:41',
    fontSize: 14,
    zIndex: z++,
    visible: true,
  });

  // App Bar
  shapes.push({
    id: uid('app-header'),
    parentId: frameId,
    name: 'App Bar',
    type: 'text',
    pageId,
    x: startX + 24,
    y: startY + 54,
    width: 200,
    height: 24,
    fill: textPrimary,
    text: 'Explorar Feed',
    fontSize: 20,
    zIndex: z++,
    visible: true,
  });

  // Stories Circles (4 stories)
  for (let sIdx = 0; sIdx < 4; sIdx++) {
    const sx = startX + 24 + sIdx * 86;
    shapes.push({
      id: uid(`story-${sIdx}`),
      parentId: frameId,
      name: `Story Avatar ${sIdx + 1}`,
      type: 'ellipse',
      pageId,
      x: sx,
      y: startY + 94,
      width: 64,
      height: 64,
      fill: bgCardSecondary,
      stroke: accentColor,
      strokeWidth: 2,
      zIndex: z++,
      visible: true,
    });
  }

  // Card do Feed 1
  const postY = startY + 180;
  shapes.push({
    id: uid('feed-card-1'),
    parentId: frameId,
    name: 'Feed Card 1',
    type: 'rect',
    pageId,
    x: startX + 16,
    y: postY,
    width: frameW - 32,
    height: 320,
    fill: bgCard,
    stroke: border,
    strokeWidth: 1,
    cornerRadius: 16,
    zIndex: z++,
    visible: true,
  });

  // Imagem do Post
  shapes.push({
    id: uid('post-img-1'),
    parentId: frameId,
    name: 'Post Media',
    type: 'rect',
    pageId,
    x: startX + 28,
    y: postY + 48,
    width: frameW - 56,
    height: 200,
    fill: bgCardSecondary,
    cornerRadius: 10,
    zIndex: z++,
    visible: true,
  });

  // Botões de Interação (Like / Comentar)
  shapes.push({
    id: uid('btn-like-1'),
    parentId: frameId,
    name: 'Curtir Button',
    type: 'rect',
    pageId,
    x: startX + 28,
    y: postY + 264,
    width: 80,
    height: 32,
    fill: bgCardSecondary,
    cornerRadius: 8,
    zIndex: z++,
    visible: true,
  });
  shapes.push({
    id: uid('txt-like-1'),
    parentId: frameId,
    name: 'Curtir Text',
    type: 'text',
    pageId,
    x: startX + 42,
    y: postY + 273,
    width: 60,
    height: 16,
    fill: textPrimary,
    text: '♥ 248',
    fontSize: 12,
    zIndex: z++,
    visible: true,
  });

  // Bottom Navigation Bar
  shapes.push({
    id: uid('bottom-nav'),
    parentId: frameId,
    name: 'Bottom Tab Navigation',
    type: 'rect',
    pageId,
    x: startX,
    y: startY + frameH - 68,
    width: frameW,
    height: 68,
    fill: bgCard,
    stroke: border,
    strokeWidth: 1,
    bottomLeftRadius: 44,
    bottomRightRadius: 44,
    zIndex: z++,
    visible: true,
  });

  return { shapes, mainFrameId: frameId, width: frameW, height: frameH };
}
