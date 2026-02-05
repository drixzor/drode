import { ClaudeOutput, ConversationMessage, MessageMetadata, ToolUseRequest, PermissionRequest, ToolResult } from '../types'
import { v4 as uuidv4 } from 'uuid'

export class ClaudeCodeBridge {
  private projectPath: string | null = null
  private outputBuffer: string = ''  // Raw JSON line buffer
  private textContent: string = ''    // Extracted text content (clean, displayable)
  private isProcessing: boolean = false
  private outputListeners: ((data: ClaudeOutput) => void)[] = []
  private messageListeners: ((message: ConversationMessage) => void)[] = []
  private statusListeners: ((status: 'running' | 'stopped' | 'error') => void)[] = []
  private permissionListeners: ((request: PermissionRequest) => void)[] = []
  private toolResultListeners: ((result: ToolResult) => void)[] = []
  private textContentListeners: ((text: string) => void)[] = []  // Clean text for display
  private cleanupFns: (() => void)[] = []
  private responseTimeout: ReturnType<typeof setTimeout> | null = null
  private readonly RESPONSE_TIMEOUT_MS = 1500 // Emit response if no output for 1.5s
  private currentMetadata: MessageMetadata | null = null
  private currentToolUses: ToolUseRequest[] = []
  private currentToolResults: Record<string, ToolResult> = {}
  private sessionId: string | null = null  // For session continuity

  constructor() {
    this.setupListeners()
  }

  private setupListeners() {
    // Listen for Claude CLI output
    const cleanupOutput = window.electronAPI.onClaudeOutput((data) => {
      this.handleOutput(data)
    })
    this.cleanupFns.push(cleanupOutput)

    // Listen for Claude CLI exit
    const cleanupExit = window.electronAPI.onClaudeExit((data) => {
      this.isProcessing = false
      this.notifyStatusListeners('stopped')
      console.log('Claude CLI exited with code:', data.code)
    })
    this.cleanupFns.push(cleanupExit)

    // Listen for Claude CLI errors
    const cleanupError = window.electronAPI.onClaudeError((data) => {
      this.isProcessing = false
      this.notifyStatusListeners('error')
      console.error('Claude CLI error:', data.error)
    })
    this.cleanupFns.push(cleanupError)
  }

  private handleOutput(data: ClaudeOutput) {
    // Notify raw output listeners
    this.outputListeners.forEach(listener => listener(data))

    // Handle completion signal
    if (data.type === 'done') {
      this.emitBufferedMessage()
      return
    }

    // Buffer the output - add newline since BufReader::lines() strips them
    this.outputBuffer += data.data + '\n'

    // Try to parse stream-json format (each line is a JSON object)
    this.parseStreamJson()
  }

  private getToolDescription(name: string, input: Record<string, unknown>): string {
    switch (name) {
      case 'Read':
        return `Read file: ${input.file_path || input.path || 'unknown'}`
      case 'Write':
        return `Write file: ${input.file_path || input.path || 'unknown'}`
      case 'Edit':
        return `Edit file: ${input.file_path || input.path || 'unknown'}`
      case 'Bash':
        const cmd = String(input.command || '').substring(0, 50)
        return `Run command: ${cmd}${String(input.command || '').length > 50 ? '...' : ''}`
      case 'Glob':
        return `Find files: ${input.pattern || 'unknown'}`
      case 'Grep':
        return `Search: ${input.pattern || 'unknown'}`
      case 'WebFetch':
        return `Fetch URL: ${input.url || 'unknown'}`
      case 'WebSearch':
        return `Web search: ${input.query || 'unknown'}`
      default:
        return `${name} tool`
    }
  }

  private handleToolUse(block: { id: string; name: string; input: Record<string, unknown> }) {
    const toolUse: ToolUseRequest = {
      id: block.id,
      name: block.name,
      input: block.input,
      status: 'pending'
    }
    this.currentToolUses.push(toolUse)

    const request: PermissionRequest = {
      toolUseId: block.id,
      toolName: block.name,
      toolInput: block.input,
      description: this.getToolDescription(block.name, block.input)
    }
    this.permissionListeners.forEach(l => l(request))
  }

  private handleToolResult(toolUseId: string, content: string, isError?: boolean) {
    const result: ToolResult = {
      toolUseId,
      content,
      isError
    }
    this.currentToolResults[toolUseId] = result
    this.toolResultListeners.forEach(l => l(result))

    // Update the corresponding tool use status
    const toolUse = this.currentToolUses.find(t => t.id === toolUseId)
    if (toolUse) {
      toolUse.status = isError ? 'error' : 'completed'
    }
  }

  private parseStreamJson() {
    // stream-json format: each line is a complete JSON object
    // We need to parse each line and extract text content from assistant messages

    const lines = this.outputBuffer.split('\n')
    // Keep incomplete line in buffer
    this.outputBuffer = lines.pop() || ''

    let newTextContent = ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue

      // Try to parse as JSON
      if (trimmed.startsWith('{')) {
        try {
          const json = JSON.parse(trimmed)

          // Handle different message types from Claude's stream-json format
          switch (json.type) {
            case 'system':
              // System init message - capture session ID if present
              if (json.session_id) {
                this.sessionId = json.session_id
              }
              break

            case 'user':
              // User messages may contain tool_results - extract them
              if (json.message?.content && Array.isArray(json.message.content)) {
                for (const block of json.message.content) {
                  if (block.type === 'tool_result' && block.tool_use_id) {
                    const content = typeof block.content === 'string'
                      ? block.content
                      : Array.isArray(block.content)
                        ? block.content.map((c: any) => c.text || JSON.stringify(c)).join('\n')
                        : JSON.stringify(block.content)
                    this.handleToolResult(block.tool_use_id, content, block.is_error)
                  }
                }
              }
              break

            case 'assistant':
              // Assistant message - extract text content
              if (json.message?.content && Array.isArray(json.message.content)) {
                for (const block of json.message.content) {
                  if (block.type === 'text' && block.text) {
                    newTextContent += block.text
                  } else if (block.type === 'tool_use') {
                    this.handleToolUse(block)
                  }
                }
              }
              break

            case 'tool_use':
              // Standalone tool_use event
              this.handleToolUse(json)
              break

            case 'tool_result':
              // Tool execution result
              if (json.tool_use_id) {
                const content = typeof json.content === 'string'
                  ? json.content
                  : JSON.stringify(json.content)
                this.handleToolResult(json.tool_use_id, content, json.is_error)
              }
              break

            case 'content_block_start':
              if (json.content_block?.type === 'tool_use') {
                this.handleToolUse(json.content_block)
              }
              break

            case 'content_block_delta':
              if (json.delta?.text) {
                newTextContent += json.delta.text
              }
              break

            case 'message_delta':
              if (json.delta?.text) {
                newTextContent += json.delta.text
              }
              break

            case 'result':
              // Final result message - extract metadata and session ID
              if (json.result && !this.textContent && !newTextContent) {
                newTextContent = json.result
              }
              if (json.session_id) {
                this.sessionId = json.session_id
              }
              this.currentMetadata = {
                durationMs: json.duration_ms,
                durationApiMs: json.duration_api_ms,
                totalCostUsd: json.total_cost_usd,
                inputTokens: json.usage?.input_tokens,
                outputTokens: json.usage?.output_tokens,
                cacheReadTokens: json.usage?.cache_read_input_tokens,
                cacheCreationTokens: json.usage?.cache_creation_input_tokens,
              }
              if (json.modelUsage) {
                const models = Object.keys(json.modelUsage)
                if (models.length > 0) {
                  this.currentMetadata.model = models[0]
                }
              }
              break

            default:
              // Unknown type - ignore
              break
          }
        } catch {
          // Invalid JSON - this shouldn't happen in stream-json mode
          // but if it does, ignore it
        }
      }
      // Non-JSON lines are ignored in stream-json mode
    }

    // Accumulate clean text content (separate from raw buffer)
    if (newTextContent) {
      this.textContent += newTextContent
      // Notify text content listeners with clean text for display
      this.textContentListeners.forEach(listener => listener(this.textContent))
    }
  }

  private emitBufferedMessage() {
    if (this.responseTimeout) {
      clearTimeout(this.responseTimeout)
      this.responseTimeout = null
    }

    // Use the accumulated clean text content
    let content = this.textContent
      .replace(/\x1B\[[0-9;]*[mGKH]/g, '') // Remove ANSI codes
      .replace(/\x1B\].*?\x07/g, '') // Remove OSC sequences
      .replace(/\r/g, '')
      .trim()

    // Emit message if there's content OR tool uses
    if (content || this.currentToolUses.length > 0) {
      const message: ConversationMessage = {
        id: uuidv4(),
        role: 'assistant',
        content,
        timestamp: Date.now(),
        metadata: this.currentMetadata || undefined,
        toolUses: this.currentToolUses.length > 0 ? [...this.currentToolUses] : undefined,
        toolResults: Object.keys(this.currentToolResults).length > 0
          ? { ...this.currentToolResults }
          : undefined
      }
      this.messageListeners.forEach(listener => listener(message))
    }

    this.outputBuffer = ''
    this.textContent = ''
    this.isProcessing = false
    this.currentMetadata = null
    this.currentToolUses = []
    this.currentToolResults = {}
  }


  async start(projectPath: string): Promise<boolean> {
    this.projectPath = projectPath
    const result = await window.electronAPI.startClaudeCli(projectPath)

    if (result.success) {
      this.notifyStatusListeners('running')
      return true
    }

    this.notifyStatusListeners('error')
    return false
  }

  async stop(): Promise<void> {
    if (this.responseTimeout) {
      clearTimeout(this.responseTimeout)
      this.responseTimeout = null
    }
    await window.electronAPI.stopClaudeCli()
    this.isProcessing = false
    this.outputBuffer = ''
    this.textContent = ''
    this.notifyStatusListeners('stopped')
  }

  async sendMessage(message: string): Promise<boolean> {
    if (!this.projectPath) {
      return false
    }

    this.isProcessing = true
    this.outputBuffer = ''
    this.textContent = ''
    this.currentToolUses = []
    this.currentToolResults = {}

    // Use session ID for continuity if available
    const result = await window.electronAPI.sendToClaude(message, this.sessionId || undefined)

    if (!result.success) {
      this.isProcessing = false
      return false
    }

    return true
  }

  // Clear session (e.g., when starting a new conversation)
  clearSession() {
    this.sessionId = null
  }

  async isRunning(): Promise<boolean> {
    return window.electronAPI.isClaudeRunning()
  }

  // Subscribe to raw output
  onOutput(callback: (data: ClaudeOutput) => void): () => void {
    this.outputListeners.push(callback)
    return () => {
      this.outputListeners = this.outputListeners.filter(l => l !== callback)
    }
  }

  // Subscribe to parsed messages
  onMessage(callback: (message: ConversationMessage) => void): () => void {
    this.messageListeners.push(callback)
    return () => {
      this.messageListeners = this.messageListeners.filter(l => l !== callback)
    }
  }

  // Subscribe to status changes
  onStatusChange(callback: (status: 'running' | 'stopped' | 'error') => void): () => void {
    this.statusListeners.push(callback)
    return () => {
      this.statusListeners = this.statusListeners.filter(l => l !== callback)
    }
  }

  // Subscribe to permission requests
  onPermissionRequest(callback: (request: PermissionRequest) => void): () => void {
    this.permissionListeners.push(callback)
    return () => {
      this.permissionListeners = this.permissionListeners.filter(l => l !== callback)
    }
  }

  // Subscribe to tool results
  onToolResult(callback: (result: ToolResult) => void): () => void {
    this.toolResultListeners.push(callback)
    return () => {
      this.toolResultListeners = this.toolResultListeners.filter(l => l !== callback)
    }
  }

  // Subscribe to clean text content updates (for streaming display)
  onTextContent(callback: (text: string) => void): () => void {
    this.textContentListeners.push(callback)
    return () => {
      this.textContentListeners = this.textContentListeners.filter(l => l !== callback)
    }
  }

  // Get current session ID for continuity
  getSessionId(): string | null {
    return this.sessionId
  }

  // Respond to a permission request
  async respondToPermission(toolUseId: string, approved: boolean): Promise<boolean> {
    // Update tool status
    const toolUse = this.currentToolUses.find(t => t.id === toolUseId)
    if (toolUse) {
      toolUse.status = approved ? 'executing' : 'denied'
    }

    // Send response to backend
    const result = approved ? 'approved' : 'Permission denied by user'
    const response = await window.electronAPI.respondToTool(toolUseId, result, !approved)
    return response.success
  }

  private notifyStatusListeners(status: 'running' | 'stopped' | 'error') {
    this.statusListeners.forEach(listener => listener(status))
  }

  destroy() {
    if (this.responseTimeout) {
      clearTimeout(this.responseTimeout)
      this.responseTimeout = null
    }
    this.cleanupFns.forEach(fn => fn())
    this.cleanupFns = []
    this.outputListeners = []
    this.messageListeners = []
    this.statusListeners = []
    this.permissionListeners = []
    this.toolResultListeners = []
    this.textContentListeners = []
    this.currentToolUses = []
    this.currentToolResults = {}
    this.textContent = ''
  }
}

// Singleton instance
let bridgeInstance: ClaudeCodeBridge | null = null

export function getClaudeBridge(): ClaudeCodeBridge {
  if (!bridgeInstance) {
    bridgeInstance = new ClaudeCodeBridge()
  }
  return bridgeInstance
}
