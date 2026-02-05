# Drode - Claude Code GUI

A desktop application that wraps the Claude Code CLI with a user-friendly graphical interface.

## Features

- **Chat Interface**: Terminal-like chat window with full conversation history, real-time streaming responses, and markdown rendering with syntax highlighting
- **File Explorer**: Tree view of your project directory with auto-refresh on file changes, visual indicators for modified files, and context menu for file operations
- **Code Editor**: Monaco Editor with syntax highlighting for all major languages, read-only mode by default, and file path display
- **Project Management**: Quick project switcher, recent projects list (up to 10), and project-specific settings persistence
- **CLI Bridge**: Seamless integration with Claude Code CLI, capturing stdout/stderr streams and handling stdin for messages

## Tech Stack

- **Electron** - Cross-platform desktop app framework
- **React** - UI library
- **TypeScript** - Type safety
- **Vite** - Fast development and bundling
- **Tailwind CSS** - Styling
- **Monaco Editor** - Code editor
- **Chokidar** - File watching

## Prerequisites

- Node.js 18+
- npm or yarn
- Claude Code CLI installed and accessible in PATH (`claude` command)

## Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd drode
```

2. Install dependencies:
```bash
npm install
```

3. Start development server:
```bash
npm run electron:dev
```

## Development

### Available Scripts

- `npm run dev` - Start Vite dev server only (for web preview)
- `npm run electron:dev` - Start full Electron app in development mode
- `npm run build` - Build for production
- `npm run electron:build` - Build and package Electron app

### Project Structure

```
src/
├── main/                 # Electron main process
│   ├── main.ts          # Main entry point
│   └── preload.ts       # Preload script for IPC
├── renderer/            # React application
│   ├── components/      # UI components
│   │   ├── Chat/        # Chat interface
│   │   ├── CodeEditor/  # Monaco editor wrapper
│   │   ├── FileExplorer/# File tree
│   │   ├── ProjectSwitcher/
│   │   ├── ResizablePanel/
│   │   └── TopBar/
│   ├── hooks/           # React hooks
│   │   ├── useConversation.ts
│   │   ├── useFileSystem.ts
│   │   └── useProject.ts
│   ├── services/        # Business logic
│   │   └── claudeCodeBridge.ts
│   ├── styles/          # CSS
│   ├── types/           # TypeScript types
│   ├── utils/           # Utilities
│   ├── App.tsx          # Main app component
│   └── main.tsx         # React entry point
```

## Keyboard Shortcuts

- `Cmd/Ctrl + K` - Focus chat input

## Layout

- **Top Bar**: Project switcher, app title, Claude status, settings
- **Left Sidebar (25%)**: File tree explorer
- **Center (50%)**: Chat interface
- **Right Sidebar (25%)**: Code editor/file viewer
- All panels are resizable with drag handles

## Configuration

The app stores configuration in the user's app data directory:
- Recent projects (up to 10)
- Current project
- Window bounds
- Conversation history per project

## Building for Production

```bash
# Build for current platform
npm run electron:build
```

Built applications will be in the `release/` directory.

## License

MIT
