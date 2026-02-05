import { useState, useEffect, useCallback, useRef } from 'react'
import { ConversationMessage, ConversationSummary } from '../types'
import { getClaudeBridge, ClaudeCodeBridge } from '../services/claudeCodeBridge'
import { v4 as uuidv4 } from 'uuid'

type ClaudeStatus = 'running' | 'stopped' | 'error' | 'starting'

const MAX_LOADING_TIMEOUT_MS = 120000 // 2 minute max loading time as safety fallback

export function useConversation(projectPath: string | null) {
  const [messages, setMessages] = useState<ConversationMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [status, setStatus] = useState<ClaudeStatus>('stopped')
  const [rawOutput, setRawOutput] = useState<string>('')
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const bridgeRef = useRef<ClaudeCodeBridge | null>(null)
  const cleanupFnsRef = useRef<(() => void)[]>([])
  const loadingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    bridgeRef.current = getClaudeBridge()

    // Setup listeners
    // Use clean text content for display instead of raw output
    const cleanupTextContent = bridgeRef.current.onTextContent((text) => {
      setRawOutput(text)
    })

    const cleanupMessage = bridgeRef.current.onMessage((message) => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current)
        loadingTimeoutRef.current = null
      }
      setMessages(prev => [...prev, message])
      setIsLoading(false)
      setRawOutput('') // Clear streaming output once message is complete
    })

    const cleanupStatus = bridgeRef.current.onStatusChange((newStatus) => {
      setStatus(newStatus)
      if (newStatus === 'stopped' || newStatus === 'error') {
        if (loadingTimeoutRef.current) {
          clearTimeout(loadingTimeoutRef.current)
          loadingTimeoutRef.current = null
        }
        setIsLoading(false)
      }
    })

    cleanupFnsRef.current = [cleanupTextContent, cleanupMessage, cleanupStatus]

    return () => {
      cleanupFnsRef.current.forEach(fn => fn())
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current)
        loadingTimeoutRef.current = null
      }
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
        saveTimeoutRef.current = null
      }
    }
  }, [])

  // Load conversations list when project changes
  useEffect(() => {
    if (projectPath) {
      loadConversationsList()
    } else {
      setConversations([])
      setActiveConversationId(null)
      setMessages([])
    }
  }, [projectPath])

  // Load active conversation when it changes
  useEffect(() => {
    // Clear rawOutput when switching conversations
    setRawOutput('')

    if (projectPath && activeConversationId) {
      loadConversationMessages(activeConversationId)
    } else {
      setMessages([])
    }
  }, [projectPath, activeConversationId])

  // Debounced save when messages change
  useEffect(() => {
    if (!projectPath || !activeConversationId || messages.length === 0) return

    // Debounce saves
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    saveTimeoutRef.current = setTimeout(() => {
      window.electronAPI.saveConversationMessages(projectPath, activeConversationId, messages)
    }, 1000)
  }, [messages, projectPath, activeConversationId])

  const loadConversationsList = async () => {
    if (!projectPath) return

    const list = await window.electronAPI.listConversations(projectPath)
    setConversations(list.sort((a, b) => b.updatedAt - a.updatedAt))

    // Get or create active conversation
    const activeId = await window.electronAPI.getActiveConversation(projectPath)
    if (activeId && list.find(c => c.id === activeId)) {
      setActiveConversationId(activeId)
    } else if (list.length > 0) {
      // Select most recent
      setActiveConversationId(list[0].id)
      await window.electronAPI.setActiveConversation(projectPath, list[0].id)
    } else {
      // Create first conversation
      const newConv = await createNewConversation('New Conversation')
      if (newConv) {
        setActiveConversationId(newConv.id)
      }
    }
  }

  const loadConversationMessages = async (conversationId: string) => {
    if (!projectPath) return

    const conv = await window.electronAPI.getConversation(projectPath, conversationId)
    if (conv) {
      setMessages(conv.messages)
    } else {
      setMessages([])
    }
  }

  const createNewConversation = async (name: string = 'New Conversation'): Promise<ConversationSummary | null> => {
    if (!projectPath) return null

    const newConv = await window.electronAPI.createConversation(projectPath, name)
    if (newConv) {
      setConversations(prev => [newConv, ...prev])
      return newConv
    }
    return null
  }

  const selectConversation = useCallback(async (conversationId: string) => {
    if (!projectPath) return

    setActiveConversationId(conversationId)
    await window.electronAPI.setActiveConversation(projectPath, conversationId)
    setRawOutput('')

    // Clear session when switching conversations to start fresh
    if (bridgeRef.current) {
      bridgeRef.current.clearSession()
    }
  }, [projectPath])

  const deleteConversation = useCallback(async (conversationId: string) => {
    if (!projectPath) return

    await window.electronAPI.deleteConversation(projectPath, conversationId)

    // Use functional state update to avoid stale closure
    let needsNewSelection = conversationId === activeConversationId
    let remaining: ConversationSummary[] = []

    setConversations(prev => {
      remaining = prev.filter(c => c.id !== conversationId)
      return remaining
    })

    // If deleted the active conversation, select another or create new
    if (needsNewSelection) {
      // Clear current state immediately
      setMessages([])
      setRawOutput('')

      // Wait a tick for state to settle then handle selection
      setTimeout(async () => {
        if (remaining.length > 0) {
          selectConversation(remaining[0].id)
        } else {
          const newConv = await createNewConversation('New Conversation')
          if (newConv) {
            selectConversation(newConv.id)
          }
        }
      }, 0)
    }
  }, [projectPath, activeConversationId, selectConversation])

  const renameConversation = useCallback(async (conversationId: string, newName: string) => {
    if (!projectPath) return

    await window.electronAPI.renameConversation(projectPath, conversationId, newName)
    setConversations(prev =>
      prev.map(c => c.id === conversationId ? { ...c, name: newName } : c)
    )
  }, [projectPath])

  const startClaude = useCallback(async (): Promise<boolean> => {
    if (!projectPath || !bridgeRef.current) return false

    setStatus('starting')
    const success = await bridgeRef.current.start(projectPath)

    if (success) {
      // Add system message
      const systemMessage: ConversationMessage = {
        id: uuidv4(),
        role: 'system',
        content: `Connected to Claude Code in ${projectPath}`,
        timestamp: Date.now()
      }
      setMessages(prev => [...prev, systemMessage])
    }

    return success
  }, [projectPath])

  const stopClaude = useCallback(async () => {
    if (bridgeRef.current) {
      await bridgeRef.current.stop()

      // Add system message
      const systemMessage: ConversationMessage = {
        id: uuidv4(),
        role: 'system',
        content: 'Disconnected from Claude Code',
        timestamp: Date.now()
      }
      setMessages(prev => [...prev, systemMessage])
    }
  }, [])

  const sendMessage = useCallback(async (content: string) => {
    if (!bridgeRef.current || !content.trim()) return

    // Clear any existing loading timeout
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current)
      loadingTimeoutRef.current = null
    }

    // Add user message
    const userMessage: ConversationMessage = {
      id: uuidv4(),
      role: 'user',
      content: content.trim(),
      timestamp: Date.now()
    }
    setMessages(prev => [...prev, userMessage])

    // Clear raw output buffer
    setRawOutput('')
    setIsLoading(true)

    // Set safety timeout to prevent infinite loading
    loadingTimeoutRef.current = setTimeout(() => {
      setIsLoading(false)
    }, MAX_LOADING_TIMEOUT_MS)

    // Send to Claude
    const success = await bridgeRef.current.sendMessage(content)

    if (!success) {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current)
        loadingTimeoutRef.current = null
      }
      setIsLoading(false)
      // Add error message
      const errorMessage: ConversationMessage = {
        id: uuidv4(),
        role: 'system',
        content: 'Failed to send message. Make sure Claude Code is connected.',
        timestamp: Date.now()
      }
      setMessages(prev => [...prev, errorMessage])
    }
  }, [])

  const clearConversation = useCallback(async () => {
    setMessages([])
    setRawOutput('')
    if (projectPath && activeConversationId) {
      await window.electronAPI.saveConversationMessages(projectPath, activeConversationId, [])
    }
  }, [projectPath, activeConversationId])

  const newConversation = useCallback(async () => {
    const name = `Chat ${new Date().toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`
    // Clear state before creating new conversation
    setMessages([])
    setRawOutput('')

    // Clear Claude session for fresh context
    if (bridgeRef.current) {
      bridgeRef.current.clearSession()
    }

    const conv = await createNewConversation(name)
    if (conv) {
      selectConversation(conv.id)
    }
  }, [createNewConversation, selectConversation])

  const addSystemMessage = useCallback((content: string) => {
    const message: ConversationMessage = {
      id: uuidv4(),
      role: 'system',
      content,
      timestamp: Date.now()
    }
    setMessages(prev => [...prev, message])
  }, [])

  return {
    messages,
    isLoading,
    status,
    rawOutput,
    conversations,
    activeConversationId,
    startClaude,
    stopClaude,
    sendMessage,
    clearConversation,
    newConversation,
    selectConversation,
    deleteConversation,
    renameConversation,
    addSystemMessage
  }
}
