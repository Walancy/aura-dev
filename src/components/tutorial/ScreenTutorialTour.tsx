import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EVENTS, Joyride, STATUS, type EventData, type Step } from 'react-joyride';
import type { ThemeTokens } from '../../types/ide';
import { logSystemActivity } from '../../utils/brainService';
import { ScreenTutorialThemeContext, ScreenTutorialTooltip } from './ScreenTutorialTooltip';
import {
  getActiveTutorialOverlay,
  getProjectSubflowContext,
  hasSeenScreenTutorial,
  isOverlayTutorialContext,
  markScreenTutorialSeen,
  resolveActiveTutorialContext,
  resolveStepsForScreen,
  SCREEN_TUTORIAL_LABELS,
  subscribeTutorialContextChange,
  subscribeTutorialRequests,
  type OverlayTutorialId,
  type ProjectSubTutorialId,
  type TutorialContextId,
  type TutorialScreenId,
} from './tutorialStore';

export interface ScreenTutorialTourProps {
  activeScreen: TutorialScreenId;
  isAuthenticated: boolean;
  manualStartCounter: number;
  themeTokens: ThemeTokens;
  isEffectiveDark: boolean;
  accentColor: string;
  contextName?: string;
}

export const ScreenTutorialTour: React.FC<ScreenTutorialTourProps> = ({
  activeScreen,
  isAuthenticated,
  manualStartCounter,
  themeTokens,
  isEffectiveDark,
  accentColor,
  contextName,
}) => {
  const [run, setRun] = useState(false);
  const [steps, setSteps] = useState<Step[]>([]);
  const [tourContext, setTourContext] = useState<TutorialContextId>(activeScreen);
  const [tourInstanceKey, setTourInstanceKey] = useState(0);
  const [contextRevision, setContextRevision] = useState(0);

  const prevManualCounterRef = useRef(manualStartCounter);
  const activeScreenRef = useRef(activeScreen);
  activeScreenRef.current = activeScreen;
  const contextNameRef = useRef(contextName);
  contextNameRef.current = contextName;

  // Evita exibir dois tutoriais seguidos sem interação logo após o tour inicial de Projetos
  const suppressedSubflowRef = useRef<ProjectSubTutorialId | null>(null);
  const tourSnapshotRef = useRef<{
    screen: TutorialScreenId;
    overlay: OverlayTutorialId | null;
    subflow: ProjectSubTutorialId | null;
  }>({
    screen: activeScreen,
    overlay: getActiveTutorialOverlay(),
    subflow: getProjectSubflowContext(),
  });

  useEffect(() => {
    return subscribeTutorialContextChange(() => {
      setContextRevision((prev) => prev + 1);
    });
  }, []);

  const activeOverlay = useMemo(() => {
    void contextRevision;
    return getActiveTutorialOverlay();
  }, [contextRevision]);

  const activeSubflow = useMemo(() => {
    void contextRevision;
    return getProjectSubflowContext();
  }, [contextRevision]);

  useEffect(() => {
    if (
      suppressedSubflowRef.current &&
      (activeScreen !== 'projetos' ||
        activeOverlay !== null ||
        activeSubflow !== suppressedSubflowRef.current)
    ) {
      suppressedSubflowRef.current = null;
    }
  }, [activeScreen, activeOverlay, activeSubflow]);

  const startTutorialForContext = useCallback(
    (targetContext: TutorialContextId, mode: 'primeira_vez' | 'manual') => {
      const resolved = resolveStepsForScreen(targetContext);
      if (mode === 'primeira_vez' && targetContext === 'projetos') {
        suppressedSubflowRef.current = getProjectSubflowContext();
      }
      markScreenTutorialSeen(targetContext);
      tourSnapshotRef.current = {
        screen: activeScreenRef.current,
        overlay: getActiveTutorialOverlay(),
        subflow: getProjectSubflowContext(),
      };
      setTourContext(targetContext);
      setSteps(resolved);
      setTourInstanceKey((prev) => prev + 1);
      setRun(true);

      logSystemActivity(
        'tutorial',
        mode === 'primeira_vez' ? 'iniciar_primeira_vez' : 'iniciar_manual',
        contextNameRef.current || 'Sistema',
        {
          fluxo: targetContext,
          passos: resolved.length,
        }
      );
    },
    []
  );

  // Encerra o tour em andamento se a tela base, o overlay ativo ou o submódulo mudarem
  useEffect(() => {
    if (!run) return;
    const snap = tourSnapshotRef.current;
    const screenChanged = activeScreen !== snap.screen;
    const overlayChanged = activeOverlay !== snap.overlay;
    const subflowChanged =
      !isOverlayTutorialContext(tourContext) &&
      tourContext !== snap.screen &&
      activeSubflow !== snap.subflow;

    if (screenChanged || overlayChanged || subflowChanged) {
      setRun(false);
    }
  }, [run, activeScreen, activeOverlay, activeSubflow, tourContext]);

  // Exibição automática na primeira vez em cada tela, modal, popup ou submódulo
  useEffect(() => {
    if (!isAuthenticated || run) return;

    const targetContext = resolveActiveTutorialContext(activeScreen);
    if (
      targetContext === suppressedSubflowRef.current &&
      activeOverlay === null &&
      activeScreen === 'projetos'
    ) {
      return;
    }
    if (hasSeenScreenTutorial(targetContext)) return;

    const delayMs = isOverlayTutorialContext(targetContext) ? 340 : 420;
    const timer = window.setTimeout(() => {
      const latestContext = resolveActiveTutorialContext(activeScreenRef.current);
      if (latestContext !== targetContext) return;
      if (hasSeenScreenTutorial(latestContext)) return;
      startTutorialForContext(latestContext, 'primeira_vez');
    }, delayMs);

    return () => window.clearTimeout(timer);
  }, [
    activeScreen,
    activeOverlay,
    activeSubflow,
    contextRevision,
    isAuthenticated,
    run,
    startTutorialForContext,
  ]);

  // Exibição manual via botão "Tutorial" no menu de configurações da header
  useEffect(() => {
    if (manualStartCounter === prevManualCounterRef.current) return;
    prevManualCounterRef.current = manualStartCounter;
    if (manualStartCounter <= 0 || !isAuthenticated) return;

    const timer = window.setTimeout(() => {
      const targetContext = resolveActiveTutorialContext(activeScreenRef.current, {
        preferSubflow: true,
      });
      startTutorialForContext(targetContext, 'manual');
    }, 90);

    return () => window.clearTimeout(timer);
  }, [manualStartCounter, isAuthenticated, startTutorialForContext]);

  // Exibição manual via TutorialTriggerButton em modais, popups e painéis
  useEffect(() => {
    let pendingTimer: number | null = null;
    const unsubscribe = subscribeTutorialRequests((explicitContextId) => {
      if (!isAuthenticated) return;
      if (pendingTimer !== null) {
        window.clearTimeout(pendingTimer);
      }
      pendingTimer = window.setTimeout(() => {
        pendingTimer = null;
        const targetContext =
          explicitContextId ||
          resolveActiveTutorialContext(activeScreenRef.current, { preferSubflow: true });
        startTutorialForContext(targetContext, 'manual');
      }, 90);
    });

    return () => {
      if (pendingTimer !== null) {
        window.clearTimeout(pendingTimer);
      }
      unsubscribe();
    };
  }, [isAuthenticated, startTutorialForContext]);

  // Tecla Escape fecha apenas o tutorial sem fechar o modal/painel aberto por baixo
  useEffect(() => {
    if (!run) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        setRun(false);
        logSystemActivity('tutorial', 'fechar_esc', contextNameRef.current || 'Sistema', {
          fluxo: tourContext,
        });
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [run, tourContext]);

  const handleJoyrideEvent = useCallback(
    (data: EventData) => {
      if (
        data.type === EVENTS.TOUR_END ||
        data.status === STATUS.FINISHED ||
        data.status === STATUS.SKIPPED
      ) {
        setRun(false);
        logSystemActivity(
          'tutorial',
          data.status === STATUS.FINISHED ? 'concluir_tutorial' : 'pular_tutorial',
          contextNameRef.current || 'Sistema',
          {
            fluxo: tourContext,
            passoFinal: data.index + 1,
          }
        );
      }
    },
    [tourContext]
  );

  const tooltipBg = isEffectiveDark ? '#161618' : '#ffffff';
  const overlayColor = isEffectiveDark ? 'rgba(0, 0, 0, 0.72)' : 'rgba(15, 23, 42, 0.46)';

  const themeContextValue = useMemo(
    () => ({
      themeTokens,
      isEffectiveDark,
      accentColor,
      screenLabel: `Tutorial · ${SCREEN_TUTORIAL_LABELS[tourContext]}`,
    }),
    [themeTokens, isEffectiveDark, accentColor, tourContext]
  );

  const joyrideOptions = useMemo(
    () => ({
      skipBeacon: true,
      closeButtonAction: 'skip' as const,
      dismissKeyAction: false as const,
      overlayClickAction: false as const,
      disableFocusTrap: true,
      blockTargetInteraction: true,
      backgroundColor: tooltipBg,
      arrowColor: tooltipBg,
      primaryColor: accentColor,
      textColor: themeTokens.textPrimary,
      overlayColor,
      spotlightRadius: 10,
      spotlightPadding: 6,
      offset: 10,
      zIndex: 2000005,
    }),
    [tooltipBg, accentColor, themeTokens.textPrimary, overlayColor]
  );

  const joyrideFloatingOptions = useMemo(
    () => ({
      hideArrow: true,
    }),
    []
  );

  const joyrideStyles = useMemo(
    () => ({
      floater: {
        filter: 'none',
        boxShadow: 'none',
      },
      tooltip: {
        boxShadow: 'none',
        border: 'none',
        padding: 0,
        backgroundColor: 'transparent',
      },
    }),
    []
  );

  if (!run || steps.length === 0) return null;

  return (
    <ScreenTutorialThemeContext.Provider value={themeContextValue}>
      <Joyride
        key={`auradev-tour-${tourContext}-${tourInstanceKey}`}
        steps={steps}
        run={run}
        continuous
        scrollToFirstStep
        loaderComponent={null}
        tooltipComponent={ScreenTutorialTooltip}
        options={joyrideOptions}
        floatingOptions={joyrideFloatingOptions}
        styles={joyrideStyles}
        onEvent={handleJoyrideEvent}
      />
    </ScreenTutorialThemeContext.Provider>
  );
};
