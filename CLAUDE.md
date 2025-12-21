# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

This is a Next.js 15 project built with React 19, TypeScript, and Tailwind CSS. Uses pnpm as the package manager.

```bash
# Development
pnpm dev              # Start development server with Turbopack
pnpm build            # Build for production
pnpm start            # Start production server
pnpm lint             # Run ESLint
pnpm typecheck        # Run TypeScript type checking
pnpm prettier         # Format code with Prettier
```

## Architecture Overview

**Kladde** is an AI-powered visual knowledge canvas application that enables users to create, connect, and organize various types of content tiles on infinite canvas workspaces.

### Core Architecture

**Multi-Board System**: The application uses a hierarchical organization:

- **Workstreams**: Top-level containers (like folders) that group related boards
- **Boards**: Individual canvas workspaces containing tiles and connections
- **Tiles**: Content blocks (text, code, documents, diagrams, etc.) positioned on the canvas

### Key Technologies

- **Frontend**: Next.js 15 with React 19, TypeScript
- **State Management**: Zustand with IndexedDB persistence via `idb-keyval`
- **Text Editing**: Lexical editor framework for rich text content
- **Diagrams**: Mermaid for chart/diagram rendering
- **UI Components**: Radix UI with Tailwind CSS styling
- **AI Integration**: Built for AI workflow enhancement (currently mock implementation)

### Data Flow & Storage

**Local-First Architecture**: The app prioritizes local data storage with optional remote sync:

1. **Primary Store**: `useBoardStore` (Zustand) in `stores/board-management-store.ts`
   - Manages all board data, tiles, connections, and UI state
   - Automatically persists to IndexedDB via Zustand persist middleware
   - Handles patch-based updates for efficient syncing

2. **Data Structure**:
   - `BoardData`: Contains tiles, connections, assets for a specific board
   - `TileData`: Individual content blocks with position, size, content, and type
   - `Connection`: Links between tiles with anchor points and routing

3. **State Management Pattern**:
   - Immutable updates using Immer-style patterns
   - Patch queuing system for potential remote synchronization
   - Real-time local persistence with auto-save functionality

### Canvas System

**Infinite Canvas**: Built around `CanvasWorkspace` component:

- **Zoom/Pan**: Mouse wheel zoom with viewport transformation
- **Grid System**: Optional grid overlay for alignment
- **Selection System**: Multi-select with keyboard/mouse combinations
- **Connection System**: Visual connections between tiles with automatic routing

**Tile Types**:

- `text`: Rich text content using Lexical editor
- `code`: Syntax-highlighted code blocks
- `document`: Structured documents with metadata, subtasks, comments
- `mermaid`: Interactive diagram rendering
- `note`: Simple text notes
- `image`: Image display and management
- `shape`: Basic geometric shapes

### Component Organization

```
components/
├── canvas-workspace.tsx          # Main canvas container
├── canvas-tile.tsx               # Individual tile renderer
├── canvas-toolbar.tsx            # Tool selection and canvas controls
├── content-renderers/            # Tile-specific content renderers
├── dashboard/                    # Board management and navigation
├── navigation/                   # App navigation components
└── ui/                          # Reusable UI components (Radix-based)
```

### API Structure

Currently uses mock APIs for development:

- `/api/ai/mock/route.ts`: Mock AI completion endpoint
- `/api/boards/[id]/route.ts`: Board CRUD operations (planned)

The architecture is designed to eventually support real AI integration and remote collaboration while maintaining local-first principles.

### Development Notes

- **Canvas Bounds**: Dynamic calculation based on tile positions with buffer zones
- **Performance**: Uses React.useMemo and useCallback for optimization
- **Keyboard Shortcuts**: Extensive keyboard support for canvas operations
- **History System**: Undo/redo functionality via `useCanvasHistory` hook
- **Auto-save**: Automatic persistence with manual save capabilities

### File Structure Patterns

- `types/canvas.ts`: Core type definitions for all canvas entities
- `lib/`: Utility functions for board operations and tile management
- `hooks/`: Custom React hooks for canvas functionality
- `stores/`: Zustand stores with persistence configuration
- `workers/`: Web workers for background processing (e.g., autosave)

The codebase follows a feature-based organization with clear separation between canvas logic, data management, and UI presentation.
