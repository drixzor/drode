# Contributing to Drode

Thanks for your interest in contributing. This guide covers everything you need to get started.

## Development Setup

### Prerequisites

1. **Node.js 18+** -- [nodejs.org](https://nodejs.org)
2. **Rust (latest stable)** -- [rustup.rs](https://rustup.rs)
3. **Tauri system dependencies** -- [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/)
4. **Claude Code CLI** -- [installation guide](https://docs.anthropic.com/en/docs/claude-code)

### Getting Started

```bash
git clone https://github.com/drode-app/drode.git
cd drode
npm install
npm run tauri:dev
```

This starts both the Vite dev server (frontend) and the Tauri app (backend). The frontend hot-reloads on change. Rust backend changes trigger a recompile.

### Available Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server only (no native window) |
| `npm run tauri:dev` | Full app with Tauri window + hot reload |
| `npm run build` | TypeScript check + Vite production build |
| `npm run tauri:build` | Package the app for distribution |

## Project Structure

The codebase has two sides:

**Frontend** (`src/renderer/`) -- React + TypeScript, renders in the Tauri webview.

**Backend** (`src-tauri/src/`) -- Rust, handles system operations and Claude CLI communication.

The frontend calls the backend through Tauri's `invoke()` IPC. The backend emits events back to the frontend through Tauri's event system.

### Key directories

```
src/renderer/
├── components/    # React components, grouped by feature
├── hooks/         # Custom hooks for state management
├── services/      # Claude CLI bridge, Tauri API wrapper
├── types/         # Shared TypeScript interfaces
├── utils/         # Helper functions
└── styles/        # Global CSS + Tailwind

src-tauri/src/
└── lib.rs         # All backend logic (IPC handlers, file ops, CLI bridge)
```

## How to Contribute

### Reporting Bugs

Open an issue with:
- Steps to reproduce
- Expected vs actual behavior
- Your OS and Drode version
- Any relevant error output from the terminal

### Suggesting Features

Open an issue describing:
- The problem you're trying to solve
- Your proposed solution
- Any alternatives you've considered

Check [ROADMAP.md](ROADMAP.md) first -- your idea might already be planned.

### Submitting Code

1. Fork the repository
2. Create a branch from `main` (`git checkout -b feature/my-feature`)
3. Make your changes
4. Test locally with `npm run tauri:dev`
5. Run `npm run build` to check for TypeScript errors
6. Commit with a clear message
7. Open a pull request against `main`

### Commit Messages

Use clear, descriptive commit messages:

```
Add file drag-and-drop to chat input
Fix conversation not saving on project switch
Update Monaco editor to support .vue files
```

No specific format is enforced, but keep the first line under 72 characters and write in imperative mood ("Add" not "Added").

## Code Style

### TypeScript (Frontend)

- Strict mode is enabled (`tsconfig.json`)
- Use functional components with hooks
- Keep components focused -- one component per feature area
- Types go in `src/renderer/types/index.ts` or co-located with the component
- Use the `@/` path alias for imports from `src/renderer/`

### Rust (Backend)

- Follow standard Rust conventions (`cargo fmt`, `cargo clippy`)
- IPC handlers use `#[tauri::command]`
- Return `OperationResult` for fallible operations
- Use `serde` for JSON serialization with `camelCase` renames

### CSS

- Use Tailwind utility classes for component styling
- Custom theme colors are prefixed with `claude-` (e.g., `bg-claude-surface`)
- Global styles live in `src/renderer/styles/index.css`
- Avoid inline styles unless dynamic values require it

## Architecture Decisions

- **Tauri over Electron**: Smaller binary, lower memory usage, Rust safety
- **Custom hooks over state library**: Keeps state management simple and co-located
- **Claude CLI --print mode**: Avoids TTY requirements; each message spawns a new process with `--resume` for session continuity
- **Stream-JSON parsing**: Claude's `--output-format stream-json` gives structured output that can be parsed into tool executions, text content, and metadata
- **File-based persistence**: Config stored as JSON in the OS app data directory; no database dependency

## Need Help?

Open an issue or start a discussion. We're happy to help with setup, architecture questions, or pointing you toward good first issues.
