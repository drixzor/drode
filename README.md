<div align="center">

<img src="drode-logo.svg" alt="Drode" width="300" />

**D**evelop. **R**un. **O**rchestrate. **D**ebug. **E**volve.

### The Desktop IDE for Claude Code

**Chat with AI. Edit code. Build anything. All in one native app.**

[![License: MIT](https://img.shields.io/badge/License-MIT-d97757.svg?style=flat-square)](LICENSE)
[![Built with Tauri](https://img.shields.io/badge/Built_with-Tauri_2-24C8D8?style=flat-square&logo=tauri&logoColor=white)](https://tauri.app)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://typescriptlang.org)

---

Drode wraps the [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) in a native desktop experience with a file explorer, code editor, terminal, GitHub integration, database management, deployment control, and multi-conversation chat -- so you can go from idea to production without leaving the app.

[Getting Started](#getting-started) · [Features](#features) · [Integrations](#integrations) · [Architecture](#architecture) · [Contributing](#contributing) · [Roadmap](ROADMAP.md)

</div>

---

## Why Drode?

The Claude Code CLI is incredibly powerful, but it lives in a terminal. You end up constantly switching between your editor, your file browser, and the CLI. Drode puts all three in one window:

- **See what Claude sees.** The file explorer shows your project tree in real-time. When Claude reads or edits a file, you can watch it happen.
- **Edit alongside the AI.** The Monaco-powered editor lets you open any file Claude references. Read the code, understand the changes, stay in context.
- **Manage multiple conversations.** Different tasks? Different conversations. Switch between them without losing history.
- **Run commands without switching.** The integrated terminal runs your builds, tests, and scripts right where you're working.
- **Ship from one window.** Browse GitHub repos, manage Supabase databases, trigger Vercel deployments, and preview your app -- all without leaving Drode.

---

## Features

### Chat Interface
Full-featured chat with Claude Code, including real-time streaming, markdown rendering with syntax highlighting, and tool execution visibility. See every file read, every edit, every command Claude runs.

### File Explorer
Tree view of your project with lazy-loaded subdirectories, file change indicators, and a context menu for creating, renaming, and deleting files. Changes made by Claude show up in real-time.

### Code Editor
Monaco Editor (the same engine behind VS Code) with syntax highlighting for every major language, multi-tab support, and keyboard shortcuts for tab management.

### Multi-Conversation Support
Create, rename, and switch between multiple conversations per project. Each conversation maintains its own history and session continuity with Claude.

### Integrated Terminal
Run shell commands in a bottom panel without leaving the app. View and manage open ports. Quick-action buttons for common commands.

### Activity Log
A cross-cutting event timeline that records everything happening across your project: commits pushed, deployments triggered, database migrations run, errors encountered. Filter by category (GitHub, Supabase, Vercel, Claude, Terminal) to focus on what matters.

### Localhost Preview
Embed your running dev server directly in the app. Multiple preview tabs for different ports/URLs, a URL bar for navigation, and one-click refresh. No more Alt-Tabbing to the browser during development.

### Keyboard-First Workflow

| Shortcut | Action |
|---|---|
| `Cmd/Ctrl + K` | Focus chat input |
| `Cmd/Ctrl + `` ` | Toggle terminal |
| `Cmd/Ctrl + B` | Toggle file explorer |
| `Cmd/Ctrl + E` | Toggle code editor |
| `Cmd/Ctrl + W` | Close active tab |
| `Cmd/Ctrl + Tab` | Cycle editor tabs |

### Resizable Panels
Every panel (file explorer, chat, editor, terminal) is resizable. Double-click a splitter to reset it. Collapse panels you don't need.

---

## Integrations

Drode connects to external services via OAuth2 (PKCE flow) so you can manage your full-stack workflow from one window.

### GitHub Integration
Browse your repositories, navigate file trees, and edit files directly in the Monaco editor. Commit changes, create branches, and open pull requests without touching the command line.

- **Repository browser** in the left panel (tab alongside the file explorer)
- **Branch management** -- switch branches, create feature branches
- **File editing** -- GitHub files open in Monaco just like local files; saving triggers a commit dialog
- **Pull requests** -- create PRs with title, description, head/base branch selection

### Supabase Database Panel
Connect to your Supabase projects and manage your database from the center panel.

- **Table browser** -- sidebar listing all tables with column counts
- **Data grid** -- paginated table viewer with sorting, inline editing, row insert/delete
- **SQL editor** -- write and execute raw SQL queries with tabular results
- **Migrations** -- run named migrations against your database

### Vercel Deployments Panel
Monitor and control your Vercel deployments from the center panel.

- **Deployment list** -- status badges (READY, BUILDING, ERROR), git info, relative timestamps
- **Build logs** -- click any deployment to view its full build output
- **One-click deploy** -- trigger new deployments with optional git ref
- **Domain management** -- add, remove, and verify custom domains
- **Promote & rollback** -- promote a deployment to production or roll back to a previous one

### OAuth2 Setup

Each integration authenticates via OAuth2. Set the following environment variables before launching the app:

| Integration | Environment Variables |
|---|---|
| GitHub | `DRODE_GITHUB_CLIENT_ID`, `DRODE_GITHUB_CLIENT_ID_SECRET` |
| Supabase | `DRODE_SUPABASE_CLIENT_ID`, `DRODE_SUPABASE_CLIENT_ID_SECRET` |
| Vercel | `DRODE_VERCEL_CLIENT_ID`, `DRODE_VERCEL_CLIENT_ID_SECRET` |

See [`.env.example`](.env.example) for setup instructions, including where to create each OAuth app and what to set as the callback URL (`http://127.0.0.1:17391/callback`).

Connection status is shown as three dots in the top bar (green = connected, gray = disconnected). Each panel shows a "Connect" button when not authenticated.

---

## ⚠️ Security Notice

**By default, Drode runs in Safe Mode** where Claude Code's tool executions require approval through the CLI's built-in permission system.

You can optionally enable **Dangerous Mode** (via the shield icon in the top bar) which uses `--dangerously-skip-permissions` to auto-approve all tool executions. This is faster but means Claude can:
- Read any file in your project
- Write/modify any file without confirmation  
- Execute arbitrary shell commands
- Make network requests

**Only enable Dangerous Mode if you understand the risks and trust the prompts you're sending.** For untrusted projects or experimental prompts, keep Safe Mode enabled.

---

## Getting Started

### Prerequisites

- **Node.js** 18+
- **Rust** (latest stable) -- [install via rustup](https://rustup.rs)
- **Claude Code CLI** installed and in your PATH ([installation guide](https://docs.anthropic.com/en/docs/claude-code))
- **Platform dependencies** for Tauri -- [see Tauri prerequisites](https://v2.tauri.app/start/prerequisites/)

### Install

```bash
# Clone the repository
git clone https://github.com/drode-app/drode.git
cd drode

# Install dependencies
npm install

# Start the app in development mode
npm run tauri:dev
```

The app will open with hot-reload enabled. Changes to the React frontend update instantly; Rust backend changes trigger a recompile.

### Build for Production

```bash
# Build a distributable application for your platform
npm run tauri:build
```

The packaged app will be in `src-tauri/target/release/bundle/`.

---

## Architecture

```
drode/
├── src/                          # Frontend (React + TypeScript)
│   └── renderer/
│       ├── components/           # UI components
│       │   ├── Chat/             # Chat interface & message rendering
│       │   ├── CodeEditor/       # Monaco editor with tabs
│       │   ├── FileExplorer/     # Project file tree
│       │   ├── Terminal/         # Terminal, ports, quick actions
│       │   ├── ConversationList/ # Multi-conversation sidebar
│       │   ├── TopBar/           # Header, project switcher, auth indicators
│       │   ├── StatusBar/        # Bottom status indicators
│       │   ├── Permissions/      # Tool approval dialogs
│       │   ├── ResizablePanel/   # Panel layout system
│       │   ├── GitHub/           # Repo browser, branch picker, commit/PR dialogs
│       │   ├── Database/         # Supabase table viewer, SQL editor, row editor
│       │   ├── Deployments/      # Vercel deployment list, build logs, domains
│       │   ├── ActivityLog/      # Cross-cutting event timeline
│       │   └── Preview/          # Localhost iframe preview with tabs
│       ├── stores/               # Zustand state management
│       │   ├── layoutStore       # Panel widths, collapse state, view tabs (persisted)
│       │   ├── editorStore       # Tab CRUD, reordering, GitHub file support
│       │   ├── projectStore      # Project selection & recent projects
│       │   ├── fileSystemStore   # File ops, directory/file caching
│       │   ├── permissionStore   # Tool permission queue & session approve
│       │   ├── conversationStore # Messages, conversation CRUD
│       │   ├── authStore         # OAuth2 connection state per provider
│       │   ├── githubStore       # Repos, branches, tree, pull requests
│       │   ├── supabaseStore     # Projects, tables, query results
│       │   ├── vercelStore       # Projects, deployments, domains, logs
│       │   ├── activityStore     # Event timeline with category filtering
│       │   └── previewStore      # Preview tab management
│       ├── services/
│       │   ├── claudeCodeBridge  # Claude CLI stream parser
│       │   ├── tauri-api         # Frontend-to-backend IPC
│       │   └── activityBus       # Cross-feature event logging helper
│       └── types/                # Shared TypeScript interfaces
│
├── src-tauri/                    # Backend (Rust + Tauri 2)
│   └── src/
│       ├── commands/             # IPC command handlers
│       │   ├── projects          # Project management
│       │   ├── files             # File system operations
│       │   ├── claude            # Claude CLI bridge
│       │   ├── conversations     # Conversation & message CRUD
│       │   ├── terminal          # Terminal process management
│       │   ├── ports             # Port scanning & management
│       │   ├── activity          # Activity event logging & querying
│       │   ├── oauth             # OAuth2 PKCE flow & token management
│       │   ├── github            # GitHub REST API (repos, files, PRs)
│       │   ├── supabase          # Supabase Management API & PostgREST
│       │   └── vercel            # Vercel API (deploys, domains, logs)
│       ├── db/                   # SQLite persistence layer
│       │   ├── schema            # DDL, FTS5, migrations (v1 + v2)
│       │   ├── settings          # Key-value settings storage
│       │   ├── projects          # Recent projects CRUD
│       │   ├── conversations     # Conversation + message storage
│       │   ├── search            # FTS5 full-text search (roadmap)
│       │   ├── activity          # Activity event storage & querying
│       │   └── oauth             # OAuth token storage & retrieval
│       ├── state.rs              # AppState with SQLite connection
│       └── lib.rs                # App setup & invoke handler registration
├── tailwind.config.js            # Custom dark theme (Claude-inspired)
└── vite.config.ts                # Vite + React + path aliases
```

### How It Works

```
┌──────────────────────────────────────────────────────────────────┐
│                       Drode (Tauri Window)                        │
│                                                                  │
│  ┌──────────────┐  ┌────────────────────────┐  ┌─────────────┐  │
│  │  Files |     │  │  Chat | Database |     │  │    Code     │  │
│  │  GitHub      │  │       Deployments      │  │   Editor    │  │
│  │              │  │                        │  │  (Monaco)   │  │
│  │  Convos      │  ├────────────────────────┤  │             │  │
│  │              │  │ Terminal | Ports |      │  │  Local +    │  │
│  │              │  │ Activity | Preview     │  │  GitHub     │  │
│  └──────────────┘  └────────────────────────┘  └─────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────────┐│
│  │                        Status Bar                            ││
│  └──────────────────────────────────────────────────────────────┘│
└───────────────┬──────────────────────────────────────────────────┘
                │ Tauri IPC
┌───────────────┴──────────────────────────────────────────────────┐
│                        Rust Backend                               │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐         │
│  │  File  │ │ Claude │ │Terminal│ │  Port  │ │ OAuth2 │         │
│  │ System │ │  CLI   │ │Process │ │  Mgmt  │ │  PKCE  │         │
│  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘         │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────────────────┐         │
│  │GitHub  │ │Supa-   │ │Vercel  │ │  Activity Events   │         │
│  │  API   │ │ base   │ │  API   │ │   (SQLite + emit)  │         │
│  └────────┘ └────────┘ └────────┘ └────────────────────┘         │
└──────────────────────────────────────────────────────────────────┘
              │                    │
     ┌────────┴────────┐  ┌───────┴───────┐
     │  claude --print │  │  External APIs │
     │  (stream-json)  │  │  GitHub/Supa-  │
     └─────────────────┘  │  base/Vercel   │
                          └───────────────┘
```

**Frontend** (React/TypeScript): Renders the UI, manages state through 12 Zustand stores (zero-prop components), and communicates with the backend via Tauri's IPC invoke system. Each integration (GitHub, Supabase, Vercel) has its own store and component directory.

**Backend** (Rust): Modular command handlers for file system operations, Claude CLI streaming, terminal process management, OAuth2 authentication, external API proxying, and SQLite-backed persistence with WAL mode for crash safety. All external API calls (GitHub, Supabase, Vercel) go through Rust via `reqwest`, keeping tokens secure on the native side.

**Claude CLI Bridge**: The app spawns `claude --print --output-format stream-json` per message. Output is streamed line-by-line through Tauri events, parsed for text content, tool executions, and metadata, then assembled into conversation messages.

**Activity Bus**: All integrations emit structured events through the activity log system. Events are persisted to SQLite and broadcast to the frontend via Tauri events, providing a unified timeline of actions across GitHub, Supabase, Vercel, Claude, and the terminal.

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Desktop Runtime | [Tauri 2](https://v2.tauri.app) | Native window, system access, small binary |
| Frontend | [React 18](https://react.dev) | Component-based UI |
| State | [Zustand](https://github.com/pmndrs/zustand) | Zero-dependency state management with persistence |
| Language | [TypeScript](https://typescriptlang.org) (strict) | Type safety across the entire frontend |
| Build | [Vite 5](https://vitejs.dev) | Fast HMR and optimized builds |
| Styling | [Tailwind CSS](https://tailwindcss.com) | Utility-first CSS with custom dark theme |
| Editor | [Monaco Editor](https://microsoft.github.io/monaco-editor/) | VS Code-grade editing |
| Backend | [Rust](https://rust-lang.org) | Safe, fast native operations |
| Database | [SQLite](https://sqlite.org) (rusqlite) | WAL-mode persistence with FTS5 search |
| HTTP Client | [reqwest](https://docs.rs/reqwest) | GitHub, Supabase, Vercel API calls from Rust |
| OAuth2 | [tiny_http](https://docs.rs/tiny_http) + PKCE | Localhost callback server for OAuth flows |
| CLI | [Claude Code](https://docs.anthropic.com/en/docs/claude-code) | AI-powered coding assistant |

---

## Configuration

Drode stores its data in a SQLite database in your OS app data directory:

| Platform | Path |
|---|---|
| macOS | `~/Library/Application Support/com.drode.app/drode.db` |
| Linux | `~/.config/com.drode.app/drode.db` |
| Windows | `%APPDATA%\com.drode.app\drode.db` |

**Stored data:**
- Recent projects (up to 10)
- Active project path
- Conversation history per project (multiple conversations)
- Full-text search index (FTS5) for messages
- Window dimensions and layout preferences
- OAuth2 tokens for GitHub, Supabase, and Vercel (per provider)
- Activity event log per project (timestamped, categorized, filterable)

The database uses WAL mode for crash safety and foreign keys for cascade deletes. Schema versioning supports incremental migrations (currently at v2). See [CHANGELOG.md](CHANGELOG.md) for implementation details.

---

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and guidelines.

**Quick start for contributors:**
```bash
git clone https://github.com/drode-app/drode.git
cd drode
npm install
npm run tauri:dev
```

---

## Roadmap

We have ambitious plans for Drode. See [ROADMAP.md](ROADMAP.md) for the full vision, including:

- Drag-and-drop file references into chat
- `@`-mention files and symbols
- Inline diff viewer for AI edits
- Conversation branching and templates
- Plugin/extension system
- And much more

---

## License

[MIT](LICENSE) -- free for personal and commercial use.

---

<div align="center">

**Built for developers who want the power of Claude Code with the comfort of an IDE.**

[Report a Bug](https://github.com/drode-app/drode/issues) · [Request a Feature](https://github.com/drode-app/drode/issues) · [Roadmap](ROADMAP.md)

</div>
