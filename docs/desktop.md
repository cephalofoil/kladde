# Desktop wrapper plan

## Goals
- Keep the web app unchanged and wrap it with Electron.
- Share the same Next.js build for both web and desktop.
- Keep the desktop layer isolated for easy updates.

## Approach
- Use Next.js standalone output for a portable production server.
- Add an Electron main process that loads the dev server in development and
  launches the standalone server in production.
- Package with electron-builder, keeping the build artifacts in
  `dist-electron`.

## Commands
- `pnpm dev:electron` runs Next.js and Electron together.
- `pnpm build:electron` builds Next.js and prepares an unpacked Electron build.
- `pnpm dist:electron` builds installers.

## Notes for maintainability
- Desktop-specific code lives only in `electron/` and `docs/desktop.md`.
- The web app remains the source of truth; desktop updates are mostly
  rebuilds.
- Next.js configuration uses `output: "standalone"` so packaging stays
  lightweight and consistent across updates.
