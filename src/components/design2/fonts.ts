/** Garante que uma família de fonte esteja carregada (Google Fonts) para a prévia, o canvas e a exportação. */
const loaded = new Set<string>(['poppins', 'jetbrains mono']);

export function ensureGoogleFont(family?: string | null): void {
  const name = (family || '').trim();
  if (!name || typeof document === 'undefined' || !/^[\w\s\-]{2,40}$/.test(name)) return;
  const key = name.toLowerCase();
  if (loaded.has(key)) return;
  loaded.add(key);
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(name).replace(/%20/g, '+')}:wght@100;200;300;400;500;600;700;800;900&display=swap`;
  link.onerror = () => loaded.delete(key); // fonte que não existe no Google Fonts: tenta de novo se o usuário mudar o nome
  document.head.appendChild(link);
}

export const FONT_OPTIONS: Array<{ name: string; group: 'Sans' | 'Serifa' | 'Mono' | 'Display' }> = [
  ...['Poppins', 'Inter', 'Roboto', 'Open Sans', 'Montserrat', 'Lato', 'Nunito', 'Nunito Sans', 'Source Sans 3', 'Work Sans', 'DM Sans', 'Manrope', 'Plus Jakarta Sans', 'Outfit', 'Urbanist', 'Sora', 'Figtree', 'Raleway', 'Rubik', 'Mulish', 'Karla', 'IBM Plex Sans', 'Noto Sans', 'Barlow', 'Space Grotesk', 'Lexend'].map((name) => ({ name, group: 'Sans' as const })),
  ...['Playfair Display', 'Merriweather', 'Lora', 'DM Serif Display', 'Cormorant Garamond', 'Libre Baskerville', 'Source Serif 4', 'Crimson Text'].map((name) => ({ name, group: 'Serifa' as const })),
  ...['JetBrains Mono', 'IBM Plex Mono', 'Fira Code', 'Space Mono', 'Roboto Mono'].map((name) => ({ name, group: 'Mono' as const })),
  ...['Bebas Neue', 'Oswald', 'Anton', 'Abril Fatface', 'Pacifico', 'Lobster'].map((name) => ({ name, group: 'Display' as const })),
];

let previewsLoaded = false;
/** Carrega, numa única requisição leve (só as letras dos nomes), todas as fontes da lista para o nome de cada uma ser exibido na própria fonte. */
export function ensureFontPreviews(): void {
  if (previewsLoaded || typeof document === 'undefined') return;
  previewsLoaded = true;
  const text = [...new Set(FONT_OPTIONS.map((f) => f.name).join('').split(''))].join('');
  const families = FONT_OPTIONS.map((f) => `family=${encodeURIComponent(f.name).replace(/%20/g, '+')}`).join('&');
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?${families}&text=${encodeURIComponent(text)}&display=swap`;
  link.onerror = () => { previewsLoaded = false; };
  document.head.appendChild(link);
}
