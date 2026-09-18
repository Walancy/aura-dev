import React from 'react';
import { FileText } from 'lucide-react';

// Eagerly import all file and folder SVG icons from assets
const fileIconsMap = import.meta.glob<string>('../assets/file-icons/files/*.svg', {
  eager: true,
  import: 'default',
});

const folderIconsMap = import.meta.glob<string>('../assets/file-icons/folders/*.svg', {
  eager: true,
  import: 'default',
});

// Helper to look up an icon URL by icon base name
function getFileSvgUrl(iconName: string): string {
  const key = `../assets/file-icons/files/${iconName}.svg`;
  return fileIconsMap[key] || fileIconsMap['../assets/file-icons/files/document.svg'] || '';
}

function getFolderSvgUrl(iconName: string, isOpen: boolean): string {
  if (iconName === 'folder') {
    const key = isOpen
      ? '../assets/file-icons/folders/folder-open.svg'
      : '../assets/file-icons/folders/folder.svg';
    return folderIconsMap[key] || folderIconsMap['../assets/file-icons/folders/folder.svg'] || '';
  }
  const key = `../assets/file-icons/folders/${iconName}.svg`;
  return folderIconsMap[key] || folderIconsMap['../assets/file-icons/folders/folder.svg'] || '';
}

// Special exact file name mappings
const EXACT_FILE_MAP: Record<string, string> = {
  'package.json': 'npm',
  'package-lock.json': 'npm',
  'bun.lock': 'bun',
  'bun.lockb': 'bun',
  'bunfig.toml': 'bun',
  'yarn.lock': 'yarn',
  'pnpm-lock.yaml': 'pnpm',
  '.gitignore': 'git',
  '.gitmodules': 'git',
  '.gitattributes': 'git',
  '.gitkeep': 'git',
  'dockerfile': 'docker',
  'docker-compose.yml': 'docker',
  'docker-compose.yaml': 'docker',
  'captain-definition': 'docker',
  'tsconfig.json': 'tsconfig',
  'tsconfig.node.json': 'tsconfig',
  'tsconfig.electron.json': 'tsconfig',
  'vite.config.ts': 'vite',
  'vite.config.js': 'vite',
  'vite.config.mjs': 'vite',
  'vitest.config.ts': 'vitest',
  'vitest.config.js': 'vitest',
  'next.config.js': 'next',
  'next.config.mjs': 'next',
  'next.config.ts': 'next',
  'tailwind.config.js': 'tailwind',
  'tailwind.config.ts': 'tailwind',
  'tailwind.config.cjs': 'tailwind',
  'postcss.config.js': 'postcss',
  '.eslintrc': 'eslint',
  '.eslintrc.js': 'eslint',
  '.eslintrc.json': 'eslint',
  '.eslintrc.yml': 'eslint',
  'eslint.config.js': 'eslint',
  'eslint.config.mjs': 'eslint',
  'eslint.config.ts': 'eslint',
  '.prettierrc': 'prettier',
  '.prettierrc.json': 'prettier',
  'prettier.config.js': 'prettier',
  'turbo.json': 'turborepo',
  'readme.md': 'markdown',
  'changelog.md': 'markdown',
  'license': 'license',
  'license.md': 'license',
  'license.txt': 'license',
  'supabase.config.toml': 'supabase',
  'skills-lock.json': 'brackets-yellow',
  '.editorconfig': 'editorconfig',
  '.npmrc': 'npm',
  '.nvmrc': 'node',
  '.babelrc': 'babel',
  '.babelrc.json': 'babel',
  'babel.config.js': 'babel',
  'babel.config.json': 'babel',
  '.stylelintrc': 'stylelint',
  '.stylelintrc.json': 'stylelint',
  'stylelint.config.js': 'stylelint',
  'cmakelists.txt': 'cmake',
  'jenkinsfile': 'jenkins',
  'cypress.config.js': 'cypress',
  'cypress.config.ts': 'cypress',
  'jest.config.js': 'jest',
  'jest.config.ts': 'jest',
  'webpack.config.js': 'webpack',
  'webpack.config.ts': 'webpack',
  'rollup.config.js': 'webpack',
};

// Extension mappings
const EXTENSION_MAP: Record<string, string> = {
  ts: 'ts',
  tsx: 'react-ts',
  js: 'js',
  jsx: 'react',
  mjs: 'js',
  cjs: 'js',
  json: 'brackets-yellow',
  jsonc: 'brackets-yellow',
  md: 'markdown',
  mdx: 'mdx',
  html: 'code-orange',
  htm: 'code-orange',
  css: 'code-sky',
  scss: 'sass',
  sass: 'sass',
  less: 'code-blue',
  py: 'python',
  rs: 'rust',
  go: 'go',
  java: 'java',
  c: 'c',
  cpp: 'cplus',
  h: 'h',
  hpp: 'h',
  cs: 'csharp',
  php: 'php',
  rb: 'ruby',
  sql: 'database',
  prisma: 'prisma',
  sh: 'shell',
  bash: 'shell',
  zsh: 'shell',
  yaml: 'yaml',
  yml: 'yaml',
  xml: 'xml',
  svg: 'svg',
  png: 'image',
  jpg: 'image',
  jpeg: 'image',
  webp: 'image',
  gif: 'gif',
  ico: 'image',
  pdf: 'pdf',
  env: 'gear',
  toml: 'gear',
  lock: 'lock',
  vue: 'vue',
  svelte: 'svelte',
  astro: 'astro',
  graphql: 'graphql',
  gql: 'graphql',
  wasm: 'code-purple',
  lua: 'lua',
  dart: 'dart',
  swift: 'swift',
  kt: 'kotlin',
  kotlin: 'kotlin',
  txt: 'text',
  log: 'text',
  csv: 'csv',
  tsv: 'csv',
  ini: 'gear',
  conf: 'gear',
  cfg: 'gear',
  properties: 'gear',
  patch: 'patch',
  diff: 'patch',
  proto: 'proto',
  r: 'r',
  jl: 'julia',
  ex: 'elixir',
  exs: 'elixir',
  erl: 'erlang',
  hs: 'haskell',
  clj: 'clojure',
  cljs: 'clojure',
  zig: 'zig',
  nix: 'nix',
  tf: 'terraform',
  tfvars: 'terraform',
  pl: 'perl',
  pm: 'perl',
  twig: 'twig',
  styl: 'stylus',
  ipynb: 'notebook',
  http: 'http',
  rest: 'http',
  pkl: 'pkl',
  v: 'v',
  cr: 'crystal',
  ml: 'ocaml',
  mli: 'ocaml',
  fs: 'fsharp',
  fsx: 'fsharp',
  tex: 'tex',
  mp3: 'audio',
  wav: 'audio',
  ogg: 'audio',
  flac: 'audio',
  mp4: 'video',
  mov: 'video',
  avi: 'video',
  webm: 'video',
  ttf: 'font',
  otf: 'font',
  woff: 'font',
  woff2: 'font',
  exe: 'exe',
};

// Special folder name mappings
const FOLDER_MAP: Record<string, string> = {
  '.github': 'folder-github',
  '.git': 'folder-red',
  'supabase': 'folder-supabase',
  '.supabase': 'folder-supabase',
  'app': 'folder-app',
  'apps': 'folder-app',
  'packages': 'folder-modules',
  'modules': 'folder-modules',
  'src': 'folder-src',
  'source': 'folder-src',
  'dist': 'folder-purple-outline',
  'build': 'folder-purple-outline',
  'out': 'folder-purple-outline',
  'public': 'folder-purple-outline',
  'static': 'folder-assets',
  'assets': 'folder-assets',
  'images': 'folder-assets',
  'img': 'folder-assets',
  'components': 'folder-green-code',
  'docs': 'folder-blue',
  'doc': 'folder-blue',
  'documentation': 'folder-blue',
  'node_modules': 'folder-green',
  'config': 'folder-config',
  '.config': 'folder-config',
  'server': 'folder-orange',
  'client': 'folder-blue',
  'api': 'folder-red',
  'database': 'folder-database',
  'db': 'folder-database',
  'prisma': 'folder-prisma',
  'drizzle': 'folder-drizzle',
  '.drizzle': 'folder-drizzle',
  'utils': 'folder-utils',
  'util': 'folder-utils',
  'lib': 'folder-utils',
  'helpers': 'folder-helpers',
  'routes': 'folder-router',
  'router': 'folder-router',
  'models': 'folder-models',
  'types': 'folder-blue-code',
  'styles': 'folder-sky-code',
  'css': 'folder-sky-code',
  'scripts': 'folder-red-code',
  '.vscode': 'folder-blue',
  '.claude': 'folder-orange',
  '.agents': 'folder-purple',
  '.windsurf': 'folder-sky',
  'bot': 'folder-blue-code',
  'fluxos de telas': 'folder-layout',
  'layout': 'folder-layout',
  'layouts': 'folder-layout',
};

export interface FileIconProps {
  fileName: string;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function getFileSvgUrlForName(fileName: string): string {
  const lowerName = fileName.toLowerCase();
  let iconName = 'document';
  if (EXACT_FILE_MAP[lowerName]) {
    iconName = EXACT_FILE_MAP[lowerName];
  } else if (lowerName.startsWith('.env')) {
    iconName = 'gear';
  } else if (lowerName.endsWith('.test.ts') || lowerName.endsWith('.spec.ts')) {
    iconName = 'ts-test';
  } else if (lowerName.endsWith('.test.js') || lowerName.endsWith('.spec.js')) {
    iconName = 'js-test';
  } else {
    const ext = lowerName.split('.').pop() || '';
    if (EXTENSION_MAP[ext]) {
      iconName = EXTENSION_MAP[ext];
    }
  }
  return getFileSvgUrl(iconName);
}

export const FileIcon: React.FC<FileIconProps> = ({ fileName, size = 15, className, style }) => {
  const iconUrl = getFileSvgUrlForName(fileName);

  if (!iconUrl) {
    return (
      <div
        style={{
          width: size,
          height: size,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 10,
          color: '#888',
          ...style,
        }}
      >
        <FileText size={size * 0.8} color="#888" />
      </div>
    );
  }

  return (
    <img
      src={iconUrl}
      alt={fileName}
      className={className}
      style={{
        width: size,
        height: size,
        objectFit: 'contain',
        flexShrink: 0,
        display: 'inline-block',
        verticalAlign: 'middle',
        userSelect: 'none',
        ...style,
      }}
      draggable={false}
    />
  );
};

export interface FolderIconProps {
  folderName: string;
  isOpen: boolean;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export const FolderIcon: React.FC<FolderIconProps> = ({
  folderName,
  isOpen,
  size = 15,
  className,
  style,
}) => {
  const lowerName = folderName.toLowerCase();
  const matchedFolder = FOLDER_MAP[lowerName] || 'folder';
  const iconUrl = getFolderSvgUrl(matchedFolder, isOpen);

  return (
    <img
      src={iconUrl}
      alt={folderName}
      className={className}
      style={{
        width: size,
        height: size,
        objectFit: 'contain',
        flexShrink: 0,
        display: 'inline-block',
        verticalAlign: 'middle',
        userSelect: 'none',
        ...style,
      }}
      draggable={false}
    />
  );
};
