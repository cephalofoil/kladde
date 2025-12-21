# Repository Guidelines

## Project Structure & Module Organization

- `app/`: Next.js App Router entry (`page.tsx`, `layout.tsx`) and API routes under `app/api/`.
- `components/`: Reusable UI and feature components (e.g., `components/ui`, `content-renderers/`).
- `stores/`: Zustand state management (e.g., `canvas-store.ts`).
- `hooks/`: Reusable React hooks.
- `lib/`: Utilities and helpers (e.g., `tile-utils.ts`).
- `styles/`: Global styles (`globals.css`, Tailwind 4).
- `public/`: Static assets (images, fonts).
- `types/`: Shared TypeScript types.

## Build, Test, and Development Commands

- `pnpm dev`: Start local dev server with Turbopack.
- `pnpm build`: Create a production build (`.next/`).
- `pnpm start`: Run the production server.
- `pnpm lint`: Lint with ESLint’s Next + TS rules.
- `pnpm typecheck`: Type-check the project with `tsc`.
- `pnpm prettier`: Format codebase with Prettier.

Tip: If you prefer npm, replace `pnpm <script>` with `npm run <script>`.

## Coding Style & Naming Conventions

- TypeScript strict mode; prefer explicit types for public APIs.
- Filenames: kebab-case (e.g., `canvas-workspace.tsx`); component names: PascalCase.
- Imports: use `@/*` alias for root-relative imports.
- Formatting: Prettier defaults (2 spaces, semicolons); run `pnpm prettier`.
- Linting: ESLint extends `next/core-web-vitals` and `next/typescript`.
- UI: Tailwind CSS 4 in `styles/globals.css`; keep utility classes readable and grouped logically.

## Testing Guidelines

- No unit/e2e test runner is configured yet.
- Minimum checks before PR: `pnpm typecheck && pnpm lint && pnpm build`.
- When adding tests, prefer colocated `*.test.ts(x)` or a `__tests__/` directory and aim for meaningful coverage of stores, hooks, and component logic.

## Commit & Pull Request Guidelines

- Commit messages: follow Conventional Commits where possible (`feat:`, `fix:`, `docs:`, `refactor:`, `chore:`).
- Branch names: `feat/<slug>`, `fix/<slug>`, `chore/<slug>`.
- PRs should include: purpose summary, linked issues (`Closes #123`), screenshots for UI changes, and notes on state or API impacts.
- Ensure CI-pass locally by running `pnpm lint && pnpm typecheck && pnpm build`.

## Security & Configuration Tips

- Environment: prefer `.env.local` for secrets; never commit `.env*`.
- Client-safe vars must be prefixed `NEXT_PUBLIC_`.
- Avoid heavy logs in production (`process.env.NODE_ENV` guards already exist in components).
