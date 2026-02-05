import { useState, useEffect, useCallback, useRef } from 'react'
import { PermissionRequest, ToolResult } from '../types'
import { getClaudeBridge, ClaudeCodeBridge } from '../services/claudeCodeBridge'

interface PermissionState {
  pendingRequest: PermissionRequest | null
  sessionAllowedTools: string[]
  permissionQueue: PermissionRequest[]
}

export function usePermissions() {
  const [pendingRequest, setPendingRequest] = useState<PermissionRequest | null>(null)
  const [sessionAllowedTools, setSessionAllowedTools] = useState<string[]>([])
  const permissionQueueRef = useRef<PermissionRequest[]>([])
  const bridgeRef = useRef<ClaudeCodeBridge | null>(null)
  const cleanupFnsRef = useRef<(() => void)[]>([])

  useEffect(() => {
    bridgeRef.current = getClaudeBridge()

    // Listen for permission requests
    const cleanupPermission = bridgeRef.current.onPermissionRequest((request) => {
      // Check if this tool is auto-approved for the session
      if (sessionAllowedTools.includes(request.toolName)) {
        // Auto-approve
        bridgeRef.current?.respondToPermission(request.toolUseId, true)
        return
      }

      // Queue the request
      permissionQueueRef.current.push(request)

      // Show the first request if none is pending
      if (!pendingRequest) {
        processNextRequest()
      }
    })

    // Listen for tool results (to update UI)
    const cleanupToolResult = bridgeRef.current.onToolResult((_result: ToolResult) => {
      // Tool results are handled by the bridge and conversation
    })

    cleanupFnsRef.current = [cleanupPermission, cleanupToolResult]

    return () => {
      cleanupFnsRef.current.forEach(fn => fn())
    }
  }, [sessionAllowedTools])

  const processNextRequest = useCallback(() => {
    if (permissionQueueRef.current.length > 0) {
      const next = permissionQueueRef.current.shift()!
      setPendingRequest(next)
    } else {
      setPendingRequest(null)
    }
  }, [])

  const approve = useCallback(async (alwaysAllow: boolean = false) => {
    if (!pendingRequest || !bridgeRef.current) return

    // If always allow is checked, add to session allowed tools
    if (alwaysAllow) {
      setSessionAllowedTools(prev => [...prev, pendingRequest.toolName])
    }

    // Send approval to backend
    await bridgeRef.current.respondToPermission(pendingRequest.toolUseId, true)

    // Process next request
    processNextRequest()
  }, [pendingRequest, processNextRequest])

  const deny = useCallback(async () => {
    if (!pendingRequest || !bridgeRef.current) return

    // Send denial to backend
    await bridgeRef.current.respondToPermission(pendingRequest.toolUseId, false)

    // Process next request
    processNextRequest()
  }, [pendingRequest, processNextRequest])

  const allowToolForSession = useCallback((toolName: string) => {
    setSessionAllowedTools(prev =>
      prev.includes(toolName) ? prev : [...prev, toolName]
    )
  }, [])

  const revokeToolPermission = useCallback((toolName: string) => {
    setSessionAllowedTools(prev => prev.filter(t => t !== toolName))
  }, [])

  const clearSessionPermissions = useCallback(() => {
    setSessionAllowedTools([])
  }, [])

  // Accept all pending and future tool requests for this session
  const acceptAll = useCallback(async () => {
    if (!bridgeRef.current) return

    // Auto-approve all known tool types
    const allTools = ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep', 'WebFetch', 'WebSearch', 'Task', 'TodoRead', 'TodoWrite']
    setSessionAllowedTools(allTools)

    // Approve current request
    if (pendingRequest) {
      await bridgeRef.current.respondToPermission(pendingRequest.toolUseId, true)
    }

    // Approve all queued requests
    while (permissionQueueRef.current.length > 0) {
      const request = permissionQueueRef.current.shift()!
      await bridgeRef.current.respondToPermission(request.toolUseId, true)
    }

    setPendingRequest(null)
  }, [pendingRequest])

  return {
    pendingRequest,
    sessionAllowedTools,
    queueLength: permissionQueueRef.current.length,
    approve,
    deny,
    acceptAll,
    allowToolForSession,
    revokeToolPermission,
    clearSessionPermissions
  }
}
