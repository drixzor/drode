import { contextBridge, ipcRenderer } from 'electron'

export interface FileEntry {
  name: string
  path: string
  isDirectory: boolean
  size: number
  modified: string
}

export interface ConversationMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
}

const api = {
  // Project management
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  getRecentProjects: () => ipcRenderer.invoke('get-recent-projects'),
  getCurrentProject: () => ipcRenderer.invoke('get-current-project'),
  setCurrentProject: (path: string) => ipcRenderer.invoke('set-current-project', path),
  removeRecentProject: (path: string) => ipcRenderer.invoke('remove-recent-project', path),

  // File system
  readDirectory: (path: string): Promise<FileEntry[]> => ipcRenderer.invoke('read-directory', path),
  readFile: (path: string) => ipcRenderer.invoke('read-file', path),
  writeFile: (path: string, content: string) => ipcRenderer.invoke('write-file', path, content),
  createFile: (path: string) => ipcRenderer.invoke('create-file', path),
  createDirectory: (path: string) => ipcRenderer.invoke('create-directory', path),
  deleteFile: (path: string) => ipcRenderer.invoke('delete-file', path),
  renameFile: (oldPath: string, newPath: string) => ipcRenderer.invoke('rename-file', oldPath, newPath),
  fileExists: (path: string) => ipcRenderer.invoke('file-exists', path),

  // Claude CLI
  startClaudeCli: (projectPath: string) => ipcRenderer.invoke('start-claude-cli', projectPath),
  sendToClaude: (message: string, sessionId?: string) => ipcRenderer.invoke('send-to-claude', message, sessionId),
  stopClaudeCli: () => ipcRenderer.invoke('stop-claude-cli'),
  isClaudeRunning: () => ipcRenderer.invoke('is-claude-running'),

  // Claude CLI events
  onClaudeOutput: (callback: (data: { type: string; data: string }) => void) => {
    const handler = (_event: any, data: { type: string; data: string }) => callback(data)
    ipcRenderer.on('claude-output', handler)
    return () => ipcRenderer.removeListener('claude-output', handler)
  },
  onClaudeExit: (callback: (data: { code: number | null }) => void) => {
    const handler = (_event: any, data: { code: number | null }) => callback(data)
    ipcRenderer.on('claude-exit', handler)
    return () => ipcRenderer.removeListener('claude-exit', handler)
  },
  onClaudeError: (callback: (data: { error: string }) => void) => {
    const handler = (_event: any, data: { error: string }) => callback(data)
    ipcRenderer.on('claude-error', handler)
    return () => ipcRenderer.removeListener('claude-error', handler)
  },

  // File watcher events
  onFileChange: (callback: (data: { type: string; path: string }) => void) => {
    const handler = (_event: any, data: { type: string; path: string }) => callback(data)
    ipcRenderer.on('file-change', handler)
    return () => ipcRenderer.removeListener('file-change', handler)
  },

  // Conversation persistence
  saveConversation: (projectPath: string, messages: ConversationMessage[]) =>
    ipcRenderer.invoke('save-conversation', projectPath, messages),
  loadConversation: (projectPath: string): Promise<ConversationMessage[]> =>
    ipcRenderer.invoke('load-conversation', projectPath),
  clearConversation: (projectPath: string) =>
    ipcRenderer.invoke('clear-conversation', projectPath),

  // Terminal
  runTerminalCommand: (command: string, terminalId: string) =>
    ipcRenderer.invoke('run-terminal-command', command, terminalId),
  killTerminalProcess: (terminalId: string) =>
    ipcRenderer.invoke('kill-terminal-process', terminalId),
  onTerminalOutput: (callback: (data: { terminalId: string; type: string; data?: string; code?: number }) => void) => {
    const handler = (_event: any, data: { terminalId: string; type: string; data?: string; code?: number }) => callback(data)
    ipcRenderer.on('terminal-output', handler)
    return () => ipcRenderer.removeListener('terminal-output', handler)
  },

  // Ports
  listPorts: () => ipcRenderer.invoke('list-ports'),
  killPort: (port: number) => ipcRenderer.invoke('kill-port', port),
}

contextBridge.exposeInMainWorld('electronAPI', api)

export type ElectronAPI = typeof api
