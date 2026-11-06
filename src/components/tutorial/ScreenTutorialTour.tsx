import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EVENTS, Joyride, STATUS, type EventData, type Step } from 'react-joyride';
import type { ThemeTokens } from '../../types/ide';
import { logSystemActivity } from '../../utils/brainService';
import { ScreenTutorialThemeContext, ScreenTutorialTooltip } from './ScreenTutorialTooltip';
import {
  hasSeenScreenTutorial,
  markScreenTutorialSeen,
  resolveStepsForScreen,
  SCREEN_TUTORIAL_LABELS,
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
  const [tourScreen, setTourScreen] = useState<TutorialScreenId>(activeScreen);
  const [tourInstanceKey, setTourInstanceKey] = useState(0);

  const prevManualCounterRef = useRef(manualStartCounter);
  const activeScreenRef = useRef(activeScreen);
  activeScreenRef.current = activeScreen;
  const contextNameRef = useRef(contextName);
  contextNameRef.current = contextName;

  // Encerra o tour anterior imediatamente se o usuário trocar de aba no meio do guia
  useEffect(() => {
    if (run && activeScreen !== tourScreen) {
      setRun(false);
    }
  }, [activeScreen, run, tourScreen]);

  // Exibição automática na primeira vez que o usuário acessa cada tela
  useEffect(() => {
    if (!isAuthenticated) return;
    if (hasSeenScreenTutorial(activeScreen)) return;

    const timer = window.setTimeout(() => {
      if (activeScreenRef.current !== activeScreen) return;
      if (hasSeenScreenTutorial(activeScreen)) return;

      const resolved = resolveStepsForScreen(activeScreen);
      markScreenTutorialSeen(activeScreen);
      setTourScreen(activeScreen);
      setSteps(resolved);
      setTourInstanceKey((prev) => prev + 1);
      setRun(true);

      logSystemActivity('tutorial', 'iniciar_primeira_vez', contextNameRef.current || 'Sistema', {
        tela: activeScreen,
        passos: resolved.length,
      });
    }, 420);

    return () => window.clearTimeout(timer);
  }, [activeScreen, isAuthenticated]);

  // Exibição manual ao clicar em "Tutorial" no popup de configurações da header
  useEffect(() => {
    if (manualStartCounter === prevManualCounterRef.current) return;
    prevManualCounterRef.current = manualStartCounter;
    if (manualStartCounter <= 0 || !isAuthenticated) return;

    const targetScreen = activeScreenRef.current;
    const timer = window.setTimeout(() => {
      const resolved = resolveStepsForScreen(targetScreen);
      markScreenTutorialSeen(targetScreen);
      setTourScreen(targetScreen);
      setSteps(resolved);
      setTourInstanceKey((prev) => prev + 1);
      setRun(true);

      logSystemActivity('tutorial', 'iniciar_manual', contextNameRef.current || 'Sistema', {
        tela: targetScreen,
        passos: resolved.length,
      });
    }, 80);

    return () => window.clearTimeout(timer);
  }, [manualStartCounter, isAuthenticated]);

  // Tecla Escape fecha o tutorial inteiro de forma limpa
  useEffect(() => {
    if (!run) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setRun(false);
        logSystemActivity('tutorial', 'fechar_esc', contextNameRef.current || 'Sistema', {
          tela: tourScreen,
        });
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [run, tourScreen]);

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
            tela: tourScreen,
            passoFinal: data.index + 1,
          }
        );
      }
    },
    [tourScreen]
  );

  const tooltipBg = isEffectiveDark ? '#161618' : '#ffffff';
  const overlayColor = isEffectiveDark ? 'rgba(0, 0, 0, 0.72)' : 'rgba(15, 23, 42, 0.46)';

  const themeContextValue = useMemo(
    () => ({
      themeTokens,
      isEffectiveDark,
      accentColor,
      screenLabel: `Tutorial · ${SCREEN_TUTORIAL_LABELS[tourScreen]}`,
    }),
    [themeTokens, isEffectiveDark, accentColor, tourScreen]
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
      zIndex: 1000005,
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
        key={`auradev-tour-${tourScreen}-${tourInstanceKey}`}
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
