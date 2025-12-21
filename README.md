<<<<<<< HEAD
# Kladde

> **Kladde** - An AI-powered visual knowledge canvas for organizing ideas, code, and collaborative workflows.

[![Next.js](https://img.shields.io/badge/Next.js-15.2.4-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.1.9-06B6D4?logo=tailwindcss)](https://tailwindcss.com/)

## 🎯 Overview

Kladde is a modern, local-first visual knowledge management application that combines the flexibility of an infinite canvas with AI-powered content generation. Built for developers, designers, and knowledge workers who need a powerful tool for organizing complex ideas and workflows.

### Key Features

- **🎨 Infinite Canvas**: Unlimited workspace with zoom, pan, and drag interactions
- **🧩 Modular Tiles**: Rich content blocks including text, code, notes, diagrams, and documents
- **🤖 AI Integration**: Built-in AI assistance for content generation and workflow automation
- **🏢 Multi-Board Architecture**: Organize work into Workstreams → Boards → Tiles hierarchy
- **💾 Local-First**: IndexedDB persistence with optional remote synchronization
- **📝 Rich Text Editing**: Powered by Lexical editor with markdown support
- **🔗 Visual Connections**: Link tiles with labeled connections and automatic routing
- **📊 Mermaid Diagrams**: Native support for flowcharts, sequence diagrams, and more
- **⚡ Real-time Updates**: Optimistic UI with patch-based state management

## 🏗️ Architecture

### Technology Stack

**Frontend Framework**

- **Next.js 15** with App Router and React 19
- **TypeScript** for type safety and developer experience
- **Tailwind CSS 4** for styling with custom design system

**State Management**

- **Zustand** with persistence middleware
- **IndexedDB** via idb-keyval for local storage
- **Immer** for immutable state updates

**UI Components**

- **Radix UI** primitives for accessible components
- **Lucide React** for consistent iconography
- **cmdk** for command palette functionality

**Content & Editing**

- **Lexical** editor for rich text experiences
- **Mermaid** for diagram rendering
- **AI SDK** for OpenAI integration

### Project Structure

```
kladde/
├── app/                          # Next.js App Router pages
│   ├── board/[boardId]/         # Individual board view
│   ├── workstream/[workstreamId]/ # Workstream dashboard
│   ├── api/                     # API routes
│   └── globals.css              # Global styles
├── components/                   # React components
│   ├── ui/                      # Base UI components (shadcn/ui)
│   ├── content-renderers/       # Tile content renderers
│   ├── navigation/              # Navigation components
│   ├── canvas-workspace.tsx     # Main canvas component
│   └── canvas-tile.tsx          # Individual tile component
├── stores/                      # Zustand state stores
│   ├── board-management-store.ts # Multi-board state management
│   └── patch-utils.ts           # State patching utilities
├── types/                       # TypeScript type definitions
│   ├── canvas.ts               # Core canvas types
│   └── version.ts              # Version constants
├── lib/                        # Utility functions
│   ├── board-utils.ts          # Board manipulation utilities
│   ├── tile-utils.ts           # Tile size and positioning
│   └── utils.ts                # General utilities
└── hooks/                      # Custom React hooks
```

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18+
- **pnpm** (recommended) or npm/yarn

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/your-org/kladde.git
   cd kladde
   ```

2. **Install dependencies**

   ```bash
   pnpm install
   ```

3. **Start development server**

   ```bash
   pnpm dev
   ```

4. **Open in browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

### Development Commands

```bash
# Development with Turbopack
pnpm dev

# Type checking
pnpm typecheck

# Linting
pnpm lint

# Code formatting
pnpm prettier

# Production build
pnpm build

# Start production server
pnpm start
```

## 📖 Usage Guide

### Creating Your First Board

1. **Create a Workstream**: Organize related boards under workstreams (projects, topics, etc.)
2. **Add a Board**: Each board is an infinite canvas for your content
3. **Add Tiles**: Create text, code, notes, or diagram tiles by clicking and dragging
4. **Connect Ideas**: Link related tiles with visual connections
5. **Leverage AI**: Use the prompt writer for AI-generated content

### Tile Types

- **📄 Text**: Rich text with markdown support
- **💻 Code**: Syntax-highlighted code blocks with multiple language support
- **📝 Note**: Structured notes with metadata, tags, and task management
- **🖼️ Image**: Image tiles with drag-and-drop support
- **📊 Mermaid**: Interactive diagram generation
- **📋 Document**: Long-form document editing with Lexical

### Keyboard Shortcuts

- **⌘+K**: Open command palette
- **Space + Drag**: Pan canvas
- **⌘+Z/⌘+Y**: Undo/Redo
- **Delete**: Delete selected tiles
- **Escape**: Deselect all / Cancel operations

## 🔧 Configuration

### Environment Variables

Create a `.env.local` file in the root directory:

```env
# Claude AI API Key (required for AI features)
# Get your API key from: https://console.anthropic.com/
CLAUDE_API_KEY=your_claude_api_key_here

# Next.js Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Optional: OpenAI API Key (if using OpenAI features)
OPENAI_API_KEY=your_openai_api_key_here
```

### Customization

The application uses a centralized design system with Tailwind CSS. Key customization points:

- **Colors**: Modify the color palette in `tailwind.config.js`
- **Components**: Extend base components in `components/ui/`
- **Tile Types**: Add new tile types in `components/content-renderers/`

## 🏢 Multi-Board Architecture

Kladde organizes content in a three-tier hierarchy:

```
Workstream (Project/Topic)
├── Board 1 (Canvas)
│   ├── Tile A (Content)
│   ├── Tile B (Content)
│   └── Connection A→B
└── Board 2 (Canvas)
    └── Tile C (Content)
```

### Workstreams

- High-level organization (projects, departments, topics)
- Contain multiple related boards
- Color-coded for visual distinction

### Boards

- Individual infinite canvases
- Support tiles, connections, and collaborative features
- Local-first with automatic persistence

### Tiles

- Modular content blocks with rich editing capabilities
- Support drag, resize, rotate, and connect operations
- Multiple content types with extensible architecture

## 🔌 API Integration

### AI Features

The application integrates with Claude AI for content generation:

```typescript
// Example: AI-powered tile content generation
const response = await fetch("/api/ai/claude", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    prompt: "Generate a summary of...",
  }),
});
```

### Data Persistence

All data is stored locally using IndexedDB with automatic synchronization:

```typescript
// Board data is automatically persisted
const boardData = {
  tiles: [...],
  connections: [...],
  version: BOARD_DATA_VERSION,
};
```

## 🛠️ Development

### Contributing

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Make your changes** following the existing code style
4. **Write tests** for new functionality
5. **Run quality checks**: `pnpm typecheck && pnpm lint`
6. **Commit changes**: `git commit -m 'feat: add amazing feature'`
7. **Push to branch**: `git push origin feature/amazing-feature`
8. **Open a Pull Request**

### Code Style

The project follows strict TypeScript and ESLint rules:

- **Conventional Commits** for commit messages
- **Prettier** for code formatting
- **ESLint** for code quality
- **TypeScript strict mode** enabled

### Testing

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Generate coverage report
pnpm test:coverage
```

## 📦 Deployment

### Production Build

```bash
pnpm build
pnpm start
```

### Vercel Deployment

The application is optimized for Vercel deployment:

1. Connect your GitHub repository to Vercel
2. Configure environment variables
3. Deploy automatically on push to main branch

## 🔒 Security & Privacy

- **Local-First**: All data stored locally by default
- **No Tracking**: No analytics or user tracking
- **Content Security**: XSS protection and input sanitization
- **API Security**: Rate limiting and input validation on all endpoints

## 🐛 Troubleshooting

### Common Issues

**Build Errors**

```bash
# Clear Next.js cache
rm -rf .next
pnpm build
```

**Type Errors**

```bash
# Regenerate type definitions
pnpm typegen
pnpm typecheck
```

**Storage Issues**

```bash
# Clear browser storage
# Open DevTools → Application → Storage → Clear Site Data
```

## 🤝 Support

- **Documentation**: [Wiki](https://github.com/your-org/kladde/wiki)
- **Issues**: [GitHub Issues](https://github.com/your-org/kladde/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-org/kladde/discussions)

## 🎉 Acknowledgments

- **Next.js Team** for the amazing framework
- **Radix UI** for accessible component primitives
- **Lexical Team** for the powerful editor framework
- **Vercel** for hosting and deployment platform

---

**Built with ❤️ using modern web technologies**
=======
# kladde-client
>>>>>>> 441d2fc897353ae9d91b39538272bd6af1e0bff3
