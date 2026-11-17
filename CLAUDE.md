
Default to using Bun instead of Node.js.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun build <file.html|file.ts|file.css>` instead of `webpack` or `esbuild`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun run <script>` instead of `npm run <script>` or `yarn run <script>` or `pnpm run <script>`
- Use `bunx <package> <command>` instead of `npx <package> <command>`
- Bun automatically loads .env, so don't use dotenv.

## APIs

- `Bun.serve()` supports WebSockets, HTTPS, and routes. Don't use `express`.
- `bun:sqlite` for SQLite. Don't use `better-sqlite3`.
- `Bun.redis` for Redis. Don't use `ioredis`.
- `Bun.sql` for Postgres. Don't use `pg` or `postgres.js`.
- `WebSocket` is built-in. Don't use `ws`.
- Prefer `Bun.file` over `node:fs`'s readFile/writeFile
- Bun.$`ls` instead of execa.

## Testing

Use `bun test` to run tests.

```ts#index.test.ts
import { test, expect } from "bun:test";

test("hello world", () => {
  expect(1).toBe(1);
});
```

## Frontend

Use HTML imports with `Bun.serve()`. Don't use `vite`. HTML imports fully support React, CSS, Tailwind.

Server:

```ts#index.ts
import index from "./index.html"

Bun.serve({
  routes: {
    "/": index,
    "/api/users/:id": {
      GET: (req) => {
        return new Response(JSON.stringify({ id: req.params.id }));
      },
    },
  },
  // optional websocket support
  websocket: {
    open: (ws) => {
      ws.send("Hello, world!");
    },
    message: (ws, message) => {
      ws.send(message);
    },
    close: (ws) => {
      // handle close
    }
  },
  development: {
    hmr: true,
    console: true,
  }
})
```

HTML files can import .tsx, .jsx or .js files directly and Bun's bundler will transpile & bundle automatically. `<link>` tags can point to stylesheets and Bun's CSS bundler will bundle.

```html#index.html
<html>
  <body>
    <h1>Hello, world!</h1>
    <script type="module" src="./frontend.tsx"></script>
  </body>
</html>
```

With the following `frontend.tsx`:

```tsx#frontend.tsx
import React from "react";
import { createRoot } from "react-dom/client";

// import .css files directly and it works
import './index.css';

const root = createRoot(document.body);

export default function Frontend() {
  return <h1>Hello, world!</h1>;
}

root.render(<Frontend />);
```

Then, run index.ts

```sh
bun --hot ./index.ts
```

For more information, read the Bun API docs in `node_modules/bun-types/docs/**.mdx`.

## Regra Obrigatória: Changelog e Novidades em Toda Release

Toda release (tag `v*`) deve sair com o changelog de tudo o que mudou, e o app mostra isso ao usuário na primeira abertura depois de instalar ou atualizar.

1. **Mantenha o `CHANGELOG.md` (raiz) a cada mudança que o usuário percebe.** Registre em `## [Não lançado]`, nas seções `### Novidades`, `### Melhorias` e `### Correções`. Cada item: `- **Título**: descrição curta, do ponto de vista de quem usa` (sem jargão técnico, sem emojis).
2. **Ao lançar**, renomeie `[Não lançado]` para `## [x.y.z] - AAAA-MM-DD` (a mesma versão do `package.json` e da tag) e crie um novo `## [Não lançado]` vazio acima dele. Nunca crie a tag sem essa seção: o workflow de release roda `bun scripts/changelog.ts check` e falha sem ela.
3. **Prints de referência** quando ajudarem a entender uma novidade visual: salve em `public/changelog/x.y.z/` e coloque `![descrição](changelog/x.y.z/nome.png)` logo abaixo do item. O script de release falha se o arquivo não existir.
4. **O modal de novidades** (`WhatsNewModal`) abre sozinho na primeira execução depois de instalar ou atualizar, com as versões ainda não vistas (no máximo 3) lidas do `CHANGELOG.md`. A versão vista fica em `localStorage` (`aura_last_seen_version`). Não crie outra fonte de novidades: o `CHANGELOG.md` é a única, e também vira o texto da release no GitHub.
5. **Antes de dar a release como pronta**, rode `bun scripts/changelog.ts check <versão>` e confira se o modal mostra o texto e os prints corretamente.
