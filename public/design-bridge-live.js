/**
 * Aura Dev — Design Bridge Live Runtime (No-op / Safe Cleanup)
 * All Design Bridge UI is managed natively by React (App.tsx, SidebarPanels.tsx, CliTerminalView.tsx, FigcraftStudioView.tsx).
 */
(function () {
  var legacyInjectedIds = [
    'df-design-selection-bar-v5',
    'df-live-design-canvas-bar',
    'df-live-ide-design-btn',
    'df-live-ide-design-popup',
    'df-live-ide-left-design-panel',
    'df-live-ide-central-preview',
    'df-live-cli-central-preview',
    'df-live-ide-sidebar-section'
  ];
  for (var i = 0; i < legacyInjectedIds.length; i++) {
    var el = document.getElementById(legacyInjectedIds[i]);
    if (el && el.parentNode) {
      try {
        el.parentNode.removeChild(el);
      } catch (e) {}
    }
  }
})();
