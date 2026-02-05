import { invoke } from '@tauri-apps/api/core'
import { listen, UnlistenFn } from '@tauri-apps/api/event'
import { open } from '@tauri-apps/plugin-dialog'
import { FileEntry, ConversationMessage, ClaudeOutput, FileChange, PermissionRequest, ToolResult, Conversation, ConversationSummary, TerminalOutput } from '../types'

interface OperationResult {
  success: boolean
  error?: string
  content?: string
}

// Project management
async function selectFolder(): Promise<string | null> {
  console.log('selectFolder called')
  try {
    console.log('Opening dialog...')
    const result = await open({
      directory: true,
      multiple: false,
    })
    console.log('Dialog result:', result)
    if (result) {
      // After selecting folder, set it as current project
      await invoke('set_current_project', { projectPath: result })
    }
    return result as string | null
  } catch (e) {
    console.error('selectFolder error:', e)
    return null
  }
}

async function getRecentProjects(): Promise<string[]> {
  try {
    return await invoke('get_recent_projects')
  } catch (e) {
    console.error('getRecentProjects error:', e)
    return []
  }
}

async function getCurrentProject(): Promise<string | null> {
  try {
    return await invoke('get_current_project')
  } catch (e) {
    console.error('getCurrentProject error:', e)
    return null
  }
}

async function setCurrentProject(path: string): Promise<boolean> {
  try {
    return await invoke('set_current_project', { projectPath: path })
  } catch (e) {
    console.error('setCurrentProject error:', e)
    return false
  }
}

async function removeRecentProject(path: string): Promise<string[]> {
  try {
    return await invoke('remove_recent_project', { projectPath: path })
  } catch (e) {
    console.error('removeRecentProject error:', e)
    return []
  }
}

// File system
async function readDirectory(path: string): Promise<FileEntry[]> {
  try {
    return await invoke('read_directory', { dirPath: path })
  } catch (e) {
    console.error('readDirectory error:', e)
    return []
  }
}

async function readFile(path: string): Promise<OperationResult> {
  try {
    return await invoke('read_file', { filePath: path })
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

async function writeFile(path: string, content: string): Promise<OperationResult> {
  try {
    return await invoke('write_file', { filePath: path, content })
  } catch (e) {
    console.error('writeFile error:', e)
    return { success: false, error: String(e) }
  }
}

async function createFile(path: string): Promise<OperationResult> {
  try {
    return await invoke('create_file', { filePath: path })
  } catch (e) {
    console.error('createFile error:', e)
    return { success: false, error: String(e) }
  }
}

async function createDirectory(path: string): Promise<OperationResult> {
  try {
    return await invoke('create_directory', { dirPath: path })
  } catch (e) {
    console.error('createDirectory error:', e)
    return { success: false, error: String(e) }
  }
}

async function deleteFile(path: string): Promise<OperationResult> {
  try {
    return await invoke('delete_file', { filePath: path })
  } catch (e) {
    console.error('deleteFile error:', e)
    return { success: false, error: String(e) }
  }
}

async function renameFile(oldPath: string, newPath: string): Promise<OperationResult> {
  try {
    return await invoke('rename_file', { oldPath, newPath })
  } catch (e) {
    console.error('renameFile error:', e)
    return { success: false, error: String(e) }
  }
}

async function fileExists(path: string): Promise<boolean> {
  try {
    return await invoke('file_exists', { filePath: path })
  } catch (e) {
    console.error('fileExists error:', e)
    return false
  }
}

// Claude CLI
async function startClaudeCli(projectPath: string): Promise<OperationResult> {
  try {
    return await invoke('start_claude_cli', { projectPath })
  } catch (e) {
    console.error('startClaudeCli error:', e)
    return { success: false, error: String(e) }
  }
}

async function sendToClaude(message: string, sessionId?: string): Promise<OperationResult> {
  try {
    return await invoke('send_to_claude', { message, sessionId: sessionId || null })
  } catch (e) {
    console.error('sendToClaude error:', e)
    return { success: false, error: String(e) }
  }
}

async function stopClaudeCli(): Promise<OperationResult> {
  try {
    return await invoke('stop_claude_cli')
  } catch (e) {
    console.error('stopClaudeCli error:', e)
    return { success: false, error: String(e) }
  }
}

async function isClaudeRunning(): Promise<boolean> {
  try {
    return await invoke('is_claude_running')
  } catch (e) {
    console.error('isClaudeRunning error:', e)
    return false
  }
}

async function respondToTool(toolUseId: string, result: string, isError: boolean): Promise<OperationResult> {
  try {
    return await invoke('respond_to_tool', { toolUseId, result, isError })
  } catch (e) {
    console.error('respondToTool error:', e)
    return { success: false, error: String(e) }
  }
}

// Event listeners
function onClaudeOutput(callback: (data: ClaudeOutput) => void): () => void {
  let unlisten: UnlistenFn | null = null

  listen<ClaudeOutput>('claude-output', (event) => {
    callback(event.payload)
  }).then((fn) => {
    unlisten = fn
  }).catch(console.error)

  return () => {
    if (unlisten) unlisten()
  }
}

function onClaudeExit(callback: (data: { code: number | null }) => void): () => void {
  let unlisten: UnlistenFn | null = null

  listen<{ code: number | null }>('claude-exit', (event) => {
    callback(event.payload)
  }).then((fn) => {
    unlisten = fn
  }).catch((e) => {
    console.error('onClaudeExit listen error:', e)
  })

  return () => {
    if (unlisten) unlisten()
  }
}

function onClaudeError(callback: (data: { error: string }) => void): () => void {
  let unlisten: UnlistenFn | null = null

  listen<{ error: string }>('claude-error', (event) => {
    callback(event.payload)
  }).then((fn) => {
    unlisten = fn
  }).catch((e) => {
    console.error('onClaudeError listen error:', e)
  })

  return () => {
    if (unlisten) unlisten()
  }
}

function onFileChange(callback: (data: FileChange) => void): () => void {
  let unlisten: UnlistenFn | null = null

  listen<FileChange>('file-change', (event) => {
    callback(event.payload)
  }).then((fn) => {
    unlisten = fn
  }).catch((e) => {
    console.error('onFileChange listen error:', e)
  })

  return () => {
    if (unlisten) unlisten()
  }
}

function onPermissionRequest(callback: (data: PermissionRequest) => void): () => void {
  let unlisten: UnlistenFn | null = null

  listen<PermissionRequest>('permission-request', (event) => {
    callback(event.payload)
  }).then((fn) => {
    unlisten = fn
  }).catch((e) => {
    console.error('onPermissionRequest listen error:', e)
  })

  return () => {
    if (unlisten) unlisten()
  }
}

function onToolResult(callback: (data: ToolResult) => void): () => void {
  let unlisten: UnlistenFn | null = null

  listen<ToolResult>('tool-result', (event) => {
    callback(event.payload)
  }).then((fn) => {
    unlisten = fn
  }).catch((e) => {
    console.error('onToolResult listen error:', e)
  })

  return () => {
    if (unlisten) unlisten()
  }
}

// Conversation persistence
async function saveConversation(projectPath: string, messages: ConversationMessage[]): Promise<OperationResult> {
  try {
    return await invoke('save_conversation', { projectPath, messages })
  } catch (e) {
    console.error('saveConversation error:', e)
    return { success: false, error: String(e) }
  }
}

async function loadConversation(projectPath: string): Promise<ConversationMessage[]> {
  try {
    return await invoke('load_conversation', { projectPath })
  } catch (e) {
    console.error('loadConversation error:', e)
    return []
  }
}

async function clearConversation(projectPath: string): Promise<OperationResult> {
  try {
    return await invoke('clear_conversation', { projectPath })
  } catch (e) {
    console.error('clearConversation error:', e)
    return { success: false, error: String(e) }
  }
}

// Multi-conversation APIs
async function listConversations(projectPath: string): Promise<ConversationSummary[]> {
  try {
    return await invoke('list_conversations', { projectPath })
  } catch (e) {
    console.error('listConversations error:', e)
    return []
  }
}

async function createConversation(projectPath: string, name: string): Promise<ConversationSummary | null> {
  try {
    return await invoke('create_conversation', { projectPath, name })
  } catch (e) {
    console.error('createConversation error:', e)
    return null
  }
}

async function getConversation(projectPath: string, conversationId: string): Promise<Conversation | null> {
  try {
    return await invoke('get_conversation', { projectPath, conversationId })
  } catch (e) {
    console.error('getConversation error:', e)
    return null
  }
}

async function saveConversationMessages(
  projectPath: string,
  conversationId: string,
  messages: ConversationMessage[]
): Promise<OperationResult> {
  try {
    return await invoke('save_conversation_messages', { projectPath, conversationId, messages })
  } catch (e) {
    console.error('saveConversationMessages error:', e)
    return { success: false, error: String(e) }
  }
}

async function deleteConversation(projectPath: string, conversationId: string): Promise<OperationResult> {
  try {
    return await invoke('delete_conversation', { projectPath, conversationId })
  } catch (e) {
    console.error('deleteConversation error:', e)
    return { success: false, error: String(e) }
  }
}

async function renameConversation(
  projectPath: string,
  conversationId: string,
  newName: string
): Promise<OperationResult> {
  try {
    return await invoke('rename_conversation', { projectPath, conversationId, newName })
  } catch (e) {
    console.error('renameConversation error:', e)
    return { success: false, error: String(e) }
  }
}

async function getActiveConversation(projectPath: string): Promise<string | null> {
  try {
    return await invoke('get_active_conversation', { projectPath })
  } catch (e) {
    console.error('getActiveConversation error:', e)
    return null
  }
}

async function setActiveConversation(projectPath: string, conversationId: string): Promise<OperationResult> {
  try {
    return await invoke('set_active_conversation', { projectPath, conversationId })
  } catch (e) {
    console.error('setActiveConversation error:', e)
    return { success: false, error: String(e) }
  }
}

// Terminal APIs
async function runTerminalCommand(command: string, terminalId: string): Promise<OperationResult> {
  try {
    return await invoke('run_terminal_command', { command, terminalId })
  } catch (e) {
    console.error('runTerminalCommand error:', e)
    return { success: false, error: String(e) }
  }
}

async function killTerminalProcess(terminalId: string): Promise<OperationResult> {
  try {
    return await invoke('kill_terminal_process', { terminalId })
  } catch (e) {
    console.error('killTerminalProcess error:', e)
    return { success: false, error: String(e) }
  }
}

function onTerminalOutput(callback: (data: TerminalOutput) => void): () => void {
  let unlisten: UnlistenFn | null = null

  listen<TerminalOutput>('terminal-output', (event) => {
    callback(event.payload)
  }).then((fn) => {
    unlisten = fn
  }).catch((e) => {
    console.error('onTerminalOutput listen error:', e)
  })

  return () => {
    if (unlisten) unlisten()
  }
}

// Port management APIs
interface PortInfo {
  port: number
  pid: number
  process_name: string
  state: string
  protocol: string
}

async function listPorts(): Promise<PortInfo[]> {
  try {
    return await invoke('list_ports')
  } catch (e) {
    console.error('listPorts error:', e)
    return []
  }
}

async function killPort(port: number): Promise<OperationResult> {
  try {
    return await invoke('kill_port', { port })
  } catch (e) {
    console.error('killPort error:', e)
    return { success: false, error: String(e) }
  }
}

// Create the API object that matches the Electron API interface
export const tauriAPI = {
  selectFolder,
  getRecentProjects,
  getCurrentProject,
  setCurrentProject,
  removeRecentProject,
  readDirectory,
  readFile,
  writeFile,
  createFile,
  createDirectory,
  deleteFile,
  renameFile,
  fileExists,
  startClaudeCli,
  sendToClaude,
  respondToTool,
  stopClaudeCli,
  isClaudeRunning,
  onClaudeOutput,
  onClaudeExit,
  onClaudeError,
  onFileChange,
  onPermissionRequest,
  onToolResult,
  saveConversation,
  loadConversation,
  clearConversation,
  // Multi-conversation
  listConversations,
  createConversation,
  getConversation,
  saveConversationMessages,
  deleteConversation,
  renameConversation,
  getActiveConversation,
  setActiveConversation,
  // Terminal
  runTerminalCommand,
  killTerminalProcess,
  onTerminalOutput,
  // Ports
  listPorts,
  killPort,
}

// Expose on window for compatibility
;(window as any).electronAPI = tauriAPI

console.log('Tauri API initialized')

export default tauriAPI
