export interface FileEntry {
  name: string
  path: string
  isDirectory: boolean
  size: number
  modified: string
  children?: FileEntry[]
  isExpanded?: boolean
}

export interface MessageMetadata {
  durationMs?: number
  durationApiMs?: number
  inputTokens?: number
  outputTokens?: number
  cacheReadTokens?: number
  cacheCreationTokens?: number
  totalCostUsd?: number
  model?: string
}

export interface ConversationMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  metadata?: MessageMetadata
  toolUses?: ToolUseRequest[]
  toolResults?: Record<string, ToolResult>
}

export interface FileChange {
  type: 'add' | 'change' | 'unlink' | 'addDir' | 'unlinkDir'
  path: string
}

export interface ClaudeOutput {
  type: 'stdout' | 'stderr' | 'done'
  data: string
}

// Tool execution types
export type ToolStatus = 'pending' | 'approved' | 'denied' | 'executing' | 'completed' | 'error'

export interface ToolUseRequest {
  id: string
  name: string  // 'Read' | 'Write' | 'Edit' | 'Bash' | 'Glob' | 'Grep' | etc
  input: Record<string, unknown>
  status: ToolStatus
}

export interface PermissionRequest {
  toolUseId: string
  toolName: string
  toolInput: Record<string, unknown>
  description: string  // Human-readable: "Read file: /path/to/file.ts"
}

export interface ToolResult {
  toolUseId: string
  content: string
  isError?: boolean
}

export interface Project {
  path: string
  name: string
}

// Multi-conversation types
export interface Conversation {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  messages: ConversationMessage[]
}

export interface ConversationSummary {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  messageCount: number
}

// Terminal types
export interface TerminalOutput {
  terminalId: string
  type: 'stdout' | 'stderr' | 'exit'
  data?: string
  code?: number
}

// Port information types
export interface PortInfo {
  port: number
  pid: number
  process_name: string
  state: string
  protocol: string
}

declare global {
  interface Window {
    electronAPI: {
      // Project management
      selectFolder: () => Promise<string | null>
      getRecentProjects: () => Promise<string[]>
      getCurrentProject: () => Promise<string | null>
      setCurrentProject: (path: string) => Promise<boolean>
      removeRecentProject: (path: string) => Promise<string[]>

      // File system
      readDirectory: (path: string) => Promise<FileEntry[]>
      readFile: (path: string) => Promise<{ success: boolean; content?: string; error?: string }>
      writeFile: (path: string, content: string) => Promise<{ success: boolean; error?: string }>
      createFile: (path: string) => Promise<{ success: boolean; error?: string }>
      createDirectory: (path: string) => Promise<{ success: boolean; error?: string }>
      deleteFile: (path: string) => Promise<{ success: boolean; error?: string }>
      renameFile: (oldPath: string, newPath: string) => Promise<{ success: boolean; error?: string }>
      fileExists: (path: string) => Promise<boolean>

      // Claude CLI
      startClaudeCli: (projectPath: string) => Promise<{ success: boolean; error?: string }>
      sendToClaude: (message: string, sessionId?: string) => Promise<{ success: boolean; error?: string }>
      stopClaudeCli: () => Promise<{ success: boolean }>
      isClaudeRunning: () => Promise<boolean>
      getDangerousMode: () => Promise<boolean>
      setDangerousMode: (enabled: boolean) => Promise<{ success: boolean; error?: string }>

      // Tool permission
      respondToTool: (toolUseId: string, result: string, isError: boolean) => Promise<{ success: boolean; error?: string }>

      // Event listeners
      onClaudeOutput: (callback: (data: ClaudeOutput) => void) => () => void
      onClaudeExit: (callback: (data: { code: number | null }) => void) => () => void
      onClaudeError: (callback: (data: { error: string }) => void) => () => void
      onFileChange: (callback: (data: FileChange) => void) => () => void
      onPermissionRequest: (callback: (data: PermissionRequest) => void) => () => void
      onToolResult: (callback: (data: ToolResult) => void) => () => void

      // Conversation persistence (legacy)
      saveConversation: (projectPath: string, messages: ConversationMessage[]) => Promise<{ success: boolean }>
      loadConversation: (projectPath: string) => Promise<ConversationMessage[]>
      clearConversation: (projectPath: string) => Promise<{ success: boolean }>

      // Multi-conversation management
      listConversations: (projectPath: string) => Promise<ConversationSummary[]>
      createConversation: (projectPath: string, name: string) => Promise<ConversationSummary | null>
      getConversation: (projectPath: string, conversationId: string) => Promise<Conversation | null>
      saveConversationMessages: (projectPath: string, conversationId: string, messages: ConversationMessage[]) => Promise<{ success: boolean; error?: string }>
      deleteConversation: (projectPath: string, conversationId: string) => Promise<{ success: boolean; error?: string }>
      renameConversation: (projectPath: string, conversationId: string, newName: string) => Promise<{ success: boolean; error?: string }>
      getActiveConversation: (projectPath: string) => Promise<string | null>
      setActiveConversation: (projectPath: string, conversationId: string) => Promise<{ success: boolean; error?: string }>

      // Terminal
      runTerminalCommand: (command: string, terminalId: string) => Promise<{ success: boolean; content?: string; error?: string }>
      killTerminalProcess: (terminalId: string) => Promise<{ success: boolean; error?: string }>
      onTerminalOutput: (callback: (data: TerminalOutput) => void) => () => void

      // Ports
      listPorts: () => Promise<PortInfo[]>
      killPort: (port: number) => Promise<{ success: boolean; error?: string }>
    }
  }
}

export {}
