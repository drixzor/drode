# Drode Roadmap

This document outlines the future direction of Drode. It's organized into tiers based on how fundamentally each feature changes the experience. Items within each tier are not in strict priority order.

This is a living document. If you want to work on any of these, open an issue to discuss the approach before starting.

---

## Tier 1: File & Context Awareness

These features make Drode context-aware -- the AI knows what you're looking at, and you can point it at specific things.

### Drag & Drop File References

Drag files from the file explorer directly into the chat input. When dropped, the file path is inserted as a reference that Claude can read. Drop multiple files to reference an entire feature's worth of code in one message.

**How it works:**
- Drag a file from the tree into the chat input area
- A pill/chip appears showing the filename (e.g., `[src/App.tsx]`)
- When the message is sent, the file paths are prepended to the prompt as context
- Claude reads the files as part of processing the message

**Stretch:** Drop a folder to reference all files within it. The system would expand the folder into individual file references, respecting `.gitignore`.

### @-Mention Files and Symbols

Type `@` in the chat input to open a fuzzy-search dropdown. Search for files, functions, classes, or variables. Select one to insert a reference.

**Levels of mention:**
- `@filename` -- reference a file by name (fuzzy matched)
- `@filename:function` -- reference a specific function or export
- `@filename:L10-L25` -- reference a specific line range
- `@symbol` -- search across the project for a class, function, or type

**Implementation notes:**
- Build a lightweight symbol index by parsing TypeScript/JavaScript ASTs (or use tree-sitter for multi-language support)
- Cache the index and invalidate on file change
- The dropdown should feel instant -- debounced search, virtual scrolling

### Active File Context

Automatically include the currently-open editor file(s) as context when sending a message. A toggle in the chat input area lets you control this:

- **Auto:** Currently active tab is sent as context
- **Pinned:** Specific tabs are always sent
- **Manual:** Only explicit references are sent (current behavior)

This means you can open a file in the editor, switch to chat, and say "refactor this" without needing to mention which file.

### Image & Screenshot References

Paste or drag screenshots directly into the chat. Claude (multimodal) can analyze UI screenshots, error dialogs, terminal output images, or design mockups and respond with code.

**Use cases:**
- Paste a screenshot of a bug: "Why does it look like this?"
- Drag in a design mockup: "Implement this layout"
- Share terminal error output as an image when text copy isn't possible

---

## Tier 2: Diff & Edit Visualization

These features make Claude's code changes visible, reviewable, and controllable.

### Inline Diff Viewer

When Claude edits a file, show the diff inline in the editor panel instead of just updating the file. A split or unified diff view lets you:

- See exactly what changed (red/green highlighting)
- Accept or reject individual hunks
- Edit the proposed changes before applying
- Navigate between changes with keyboard shortcuts

This transforms the editor from a passive viewer into an active code review tool.

### Edit History Timeline

A timeline view showing every change Claude made during a conversation:

- Chronological list of file modifications
- Click any entry to see the diff at that point
- "Revert to this point" to undo changes after a specific edit
- Export the full change history as a patch file

### Live File Watching with Change Indicators

Enhance the existing file change detection:

- Files modified by Claude get a distinct icon/badge in the explorer
- Files modified externally (by you in another editor) get a different indicator
- Files with unsaved changes show a dot on their tab
- A "Changes" panel lists all modified files since the conversation started

### Multi-File Diff View

When Claude modifies multiple files in one response, show all changes in a single reviewable interface (similar to a pull request diff view). Accept or reject changes per-file.

---

## Tier 3: Terminal & Execution

These features make the terminal and command execution more powerful.

### Smart Command Suggestions

Based on the project type and conversation context, suggest relevant commands:

- Detected `package.json` scripts → show buttons for `npm run dev`, `npm test`, etc.
- After Claude writes a test → suggest running the test suite
- After a build error → suggest the relevant fix command
- Context-aware: suggestions update as the conversation progresses

### Terminal Output as Context

Pipe terminal output back into the chat as context. If a command fails, one click sends the error output to Claude with "This command failed, can you help?"

### Command Palette

A VS Code-style command palette (`Cmd+Shift+P`) with:

- All keyboard shortcuts
- All available actions (new conversation, open project, toggle panels, etc.)
- Recent commands
- Fuzzy search

### Background Task Manager

Track long-running processes (dev servers, builds, watchers):

- See all running processes in a panel
- Auto-restart crashed processes
- Log output for each process
- Quick kill/restart buttons

---

## Tier 4: Conversation Intelligence

These features make conversations smarter and more useful.

### Conversation Search

Full-text search across all conversations in a project. Find that prompt you wrote last week, or search for when Claude explained a specific concept.

### Conversation Branching

Fork a conversation at any point. Ask Claude a different question from message #5 without losing the original thread. Visualize branches as a tree.

### Conversation Templates

Start new conversations from templates:

- **Code Review:** "Review the changes in [files] for bugs, performance issues, and style"
- **Refactor:** "Refactor [file] to improve readability and reduce complexity"
- **Test Writing:** "Write comprehensive tests for [file]"
- **Debug:** "Help me debug [description]. Here's the error: [paste]"
- **Explain:** "Explain how [file/function] works, step by step"

Users can create and share their own templates.

### System Prompt Customization

Per-project system prompts that are prepended to every conversation:

- "This is a Next.js 14 app using the App Router and Prisma ORM"
- "Always use TypeScript strict mode. Prefer functional components."
- "This project follows the repository pattern for data access."

Stored in `.drode/system-prompt.md` in the project root (version-controllable).

### Token Usage Dashboard

Visualize token consumption across conversations:

- Cost per conversation
- Input vs output token breakdown
- Cache hit rates
- Model usage distribution
- Daily/weekly/monthly trends

---

## Tier 5: Git Integration

These features connect Drode to your version control workflow.

### Git Status in File Explorer

Show git status inline in the file tree:

- Modified files highlighted
- Untracked files marked
- Current branch shown in the top bar
- Staged vs unstaged indicators

### Commit from Drode

After Claude makes changes, create a commit without leaving the app:

- Select which files to stage
- AI-generated commit message based on the changes
- Review the diff before committing
- Push to remote

### Branch Management

Create, switch, and manage branches:

- Create a feature branch before asking Claude to make changes
- Switch branches and have the conversation context update
- Compare branches side by side

### PR Description Generator

After a series of changes, generate a pull request description:

- Summarize all changes made during the conversation
- List files modified
- Describe the rationale based on the conversation history
- Format for GitHub/GitLab

---

## Tier 6: Multi-Model & Provider Support

Extend beyond Claude Code to support other AI backends.

### Model Switching

Switch between Claude models mid-conversation:

- Use Haiku for quick questions, Opus for complex tasks
- Model indicator in the chat showing which model responded
- Per-conversation model preferences

### Alternative CLI Backends

Support other AI coding tools alongside Claude Code:

- Aider
- Continue
- Cursor-style backends
- Local models via Ollama

The architecture already uses a bridge pattern (`claudeCodeBridge.ts`), making this extensible. Each backend would implement the same interface.

### Cost-Aware Routing

Automatically route messages to the appropriate model based on complexity:

- Simple questions → smaller, cheaper model
- Complex refactoring → larger model
- User override always available

---

## Tier 7: Collaboration & Sharing

These features make Drode useful for teams.

### Conversation Export

Export conversations in multiple formats:

- Markdown (for documentation)
- JSON (for reimporting)
- HTML (for sharing)
- PDF (for reports)

### Shared Conversation Library

A team-shared repository of useful conversations:

- "How we set up the authentication system"
- "Debugging the WebSocket reconnection issue"
- Searchable, taggable, linkable

### Real-Time Pair Programming

Two people using Drode on the same project, seeing each other's conversations and edits in real-time. Think Google Docs for AI-assisted coding.

---

## Tier 8: Plugin & Extension System

Make Drode extensible by third parties.

### Plugin API

A documented API for creating Drode plugins:

- **Panel plugins:** Add custom panels (database viewer, API tester, log viewer)
- **Chat plugins:** Custom slash commands (`/diagram`, `/sql`, `/deploy`)
- **Theme plugins:** Custom color schemes and UI modifications
- **Tool plugins:** New tool types that Claude can use through the permission system

### Theme Engine

Full theme customization:

- Light mode
- Custom color schemes
- Font choices
- Layout presets (minimal, full, focus mode)
- Import/export themes

### Marketplace

A community marketplace for plugins and themes. Browse, install, and update from within the app.

---

## Tier 9: Advanced Intelligence

Longer-term features that push what's possible.

### Project-Wide Understanding

Build a persistent understanding of the codebase:

- Automatically index project structure, dependencies, and patterns
- Feed this context to Claude silently so it understands your project without being told
- Update the index incrementally on file changes
- Understand framework conventions (Next.js, Rails, Django, etc.)

### Predictive Actions

Based on conversation patterns, predict what you'll want to do next:

- After writing a component → suggest writing tests
- After fixing a bug → suggest adding error handling
- After a refactor → suggest updating documentation
- Present these as non-intrusive suggestions in the status bar

### Voice Input

Speak your prompts instead of typing:

- Push-to-talk with a keyboard shortcut
- Real-time transcription displayed in the input
- Works alongside typed input (start typing, finish speaking, or vice versa)

### Diagram Generation

Ask Claude to generate diagrams and see them rendered inline:

- Architecture diagrams (Mermaid)
- Sequence diagrams
- ER diagrams
- Flow charts
- Component dependency graphs

### Notebook Mode

A Jupyter-like mode for exploratory coding:

- Code cells that execute inline
- Markdown cells for notes
- Output displayed below each cell
- Mix AI conversations with executable code
- Export as a runnable script

---

## Contributing to the Roadmap

If something here excites you, open an issue to discuss the approach. If you have an idea that isn't listed, propose it -- the best features often come from unexpected places.

When proposing a new feature:
1. Describe the problem it solves
2. Sketch the user experience (what does interacting with it feel like?)
3. Consider the implementation complexity
4. Think about how it interacts with existing features
