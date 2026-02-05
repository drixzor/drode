import { create } from 'zustand'
import { PermissionRequest, ToolResult } from '../types'
import { getClaudeBridge, ClaudeCodeBridge } from '../services/claudeCodeBridge'

interface PermissionState {
  pendingRequest: PermissionRequest | null
  queueLength: number
}

interface PermissionActions {
  init: () => () => void
  approve: (alwaysAllow?: boolean) => Promise<void>
  deny: () => Promise<void>
  acceptAll: () => Promise<void>
}

// Module-level (not reactive)
let bridge: ClaudeCodeBridge | null = null
const permissionQueue: PermissionRequest[] = []
let sessionAllowedTools: string[] = []

function processNextRequest() {
  if (permissionQueue.length > 0) {
    const next = permissionQueue.shift()!
    usePermissionStore.setState({
      pendingRequest: next,
      queueLength: permissionQueue.length,
    })
  } else {
    usePermissionStore.setState({ pendingRequest: null, queueLength: 0 })
  }
}

export const usePermissionStore = create<PermissionState & PermissionActions>((set, get) => ({
  pendingRequest: null,
  queueLength: 0,

  init: () => {
    bridge = getClaudeBridge()

    const cleanupPermission = bridge.onPermissionRequest((request) => {
      if (sessionAllowedTools.includes(request.toolName)) {
        bridge?.respondToPermission(request.toolUseId, true)
        return
      }

      permissionQueue.push(request)

      if (!get().pendingRequest) {
        processNextRequest()
      } else {
        set({ queueLength: permissionQueue.length })
      }
    })

    const cleanupToolResult = bridge.onToolResult((_result: ToolResult) => {
      // Tool results are handled by the bridge and conversation
    })

    return () => {
      cleanupPermission()
      cleanupToolResult()
    }
  },

  approve: async (alwaysAllow = false) => {
    const { pendingRequest } = get()
    if (!pendingRequest || !bridge) return

    if (alwaysAllow) {
      sessionAllowedTools = [...sessionAllowedTools, pendingRequest.toolName]
    }

    await bridge.respondToPermission(pendingRequest.toolUseId, true)
    processNextRequest()
  },

  deny: async () => {
    const { pendingRequest } = get()
    if (!pendingRequest || !bridge) return

    await bridge.respondToPermission(pendingRequest.toolUseId, false)
    processNextRequest()
  },

  acceptAll: async () => {
    if (!bridge) return

    const allTools = [
      'Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep',
      'WebFetch', 'WebSearch', 'Task', 'TodoRead', 'TodoWrite',
    ]
    sessionAllowedTools = allTools

    const { pendingRequest } = get()
    if (pendingRequest) {
      await bridge.respondToPermission(pendingRequest.toolUseId, true)
    }

    while (permissionQueue.length > 0) {
      const request = permissionQueue.shift()!
      await bridge.respondToPermission(request.toolUseId, true)
    }

    set({ pendingRequest: null, queueLength: 0 })
  },
}))
