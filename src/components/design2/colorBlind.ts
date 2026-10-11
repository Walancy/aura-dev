/** Simulação de daltonismo: matrizes de cor (linhas R G B A) aplicadas como filtro SVG sobre o canvas inteiro. */
export const COLOR_BLIND: Record<string, { label: string; matrix: string }> = {
  protanopia: { label: 'Protanopia (sem vermelho)', matrix: '0.567 0.433 0 0 0  0.558 0.442 0 0 0  0 0.242 0.758 0 0  0 0 0 1 0' },
  deuteranopia: { label: 'Deuteranopia (sem verde)', matrix: '0.625 0.375 0 0 0  0.7 0.3 0 0 0  0 0.3 0.7 0 0  0 0 0 1 0' },
  tritanopia: { label: 'Tritanopia (sem azul)', matrix: '0.95 0.05 0 0 0  0 0.433 0.567 0 0  0 0.475 0.525 0 0  0 0 0 1 0' },
  achromatopsia: { label: 'Acromatopsia (sem cor)', matrix: '0.299 0.587 0.114 0 0  0.299 0.587 0.114 0 0  0.299 0.587 0.114 0 0  0 0 0 1 0' },
};
