import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { ConversationMessage, ConversationSummary } from '../types'
import { getClaudeBridge, ClaudeCodeBridge } from '../services/claudeCodeBridge'
import { useProjectStore } from './projectStore'
import { v4 as uuidv4 } from 'uuid'

type ClaudeStatus = 'running' | 'stopped' | 'error' | 'starting'

const MAX_LOADING_TIMEOUT_MS = 120000

interface ConversationState {
  messages: ConversationMessage[]
  isLoading: boolean
  status: ClaudeStatus
  rawOutput: string
  conversations: ConversationSummary[]
  activeConversationId: string | null
}

interface ConversationActions {
  init: () => () => void
  startClaude: () => Promise<boolean>
  stopClaude: () => Promise<void>
  sendMessage: (content: string) => Promise<void>
  clearConversation: () => Promise<void>
  newConversation: () => Promise<void>
  selectConversation: (conversationId: string) => Promise<void>
  deleteConversation: (conversationId: string) => Promise<void>
  renameConversation: (conversationId: string, newName: string) => Promise<void>
  addSystemMessage: (content: string) => void
}

// Module-level refs (not reactive state)
let bridge: ClaudeCodeBridge | null = null
let saveTimeout: ReturnType<typeof setTimeout> | null = null
let loadingTimeout: ReturnType<typeof setTimeout> | null = null

async function loadConversationsList() {
  const projectPath = useProjectStore.getState().currentProject
  if (!projectPath) return

  const list = await window.electronAPI.listConversations(projectPath)
  const sorted = list.sort((a, b) => b.updatedAt - a.updatedAt)

  const store = useConversationStore.getState()

  const activeId = await window.electronAPI.getActiveConversation(projectPath)
  if (activeId && sorted.find((c) => c.id === activeId)) {
    useConversationStore.setState({
      conversations: sorted,
      activeConversationId: activeId,
    })
  } else if (sorted.length > 0) {
    useConversationStore.setState({
      conversations: sorted,
      activeConversationId: sorted[0].id,
    })
    await window.electronAPI.setActiveConversation(projectPath, sorted[0].id)
  } else {
    const newConv = await createNewConversation('New Conversation')
    if (newConv) {
      useConversationStore.setState({
        conversations: [newConv],
        activeConversationId: newConv.id,
      })
    }
  }
}

async function loadConversationMessages(conversationId: string) {
  const projectPath = useProjectStore.getState().currentProject
  if (!projectPath) return

  const conv = await window.electronAPI.getConversation(projectPath, conversationId)
  if (conv) {
    useConversationStore.setState({ messages: conv.messages })
  } else {
    useConversationStore.setState({ messages: [] })
  }
}

async function createNewConversation(name: string): Promise<ConversationSummary | null> {
  const projectPath = useProjectStore.getState().currentProject
  if (!projectPath) return null

  const newConv = await window.electronAPI.createConversation(projectPath, name)
  if (newConv) {
    useConversationStore.setState((s) => ({
      conversations: [newConv, ...s.conversations],
    }))
    return newConv
  }
  return null
}

function scheduleSave() {
  if (saveTimeout) clearTimeout(saveTimeout)
  saveTimeout = setTimeout(() => {
    const { messages, activeConversationId } = useConversationStore.getState()
    const projectPath = useProjectStore.getState().currentProject
    if (projectPath && activeConversationId && messages.length > 0) {
      window.electronAPI.saveConversationMessages(projectPath, activeConversationId, messages)
    }
  }, 1000)
}

export const useConversationStore = create<ConversationState & ConversationActions>()(
  subscribeWithSelector((set, get) => ({
  messages: [],
  isLoading: false,
  status: 'stopped',
  rawOutput: '',
  conversations: [],
  activeConversationId: null,

  init: () => {
    bridge = getClaudeBridge()

    // Bridge listeners
    const cleanupTextContent = bridge.onTextContent((text) => {
      set({ rawOutput: text })
    })

    const cleanupMessage = bridge.onMessage((message) => {
      if (loadingTimeout) {
        clearTimeout(loadingTimeout)
        loadingTimeout = null
      }
      set((s) => ({
        messages: [...s.messages, message],
        isLoading: false,
        rawOutput: '',
      }))
      scheduleSave()
    })

    const cleanupStatus = bridge.onStatusChange((newStatus) => {
      set({ status: newStatus })
      if (newStatus === 'stopped' || newStatus === 'error') {
        if (loadingTimeout) {
          clearTimeout(loadingTimeout)
          loadingTimeout = null
        }
        set({ isLoading: false })
      }
    })

    // Subscribe to project changes
    const unsubProject = useProjectStore.subscribe(
      (state) => state.currentProject,
      (currentProject) => {
        if (currentProject) {
          loadConversationsList()
        } else {
          set({
            conversations: [],
            activeConversationId: null,
            messages: [],
            rawOutput: '',
          })
        }
      }
    )

    // Subscribe to activeConversationId changes to load messages
    const unsubConversation = useConversationStore.subscribe(
      (state) => state.activeConversationId,
      (activeConversationId) => {
        set({ rawOutput: '' })
        if (activeConversationId) {
          loadConversationMessages(activeConversationId)
        } else {
          set({ messages: [] })
        }
      }
    )

    // Load initial conversations if project is set
    const currentProject = useProjectStore.getState().currentProject
    if (currentProject) {
      loadConversationsList()
    }

    return () => {
      cleanupTextContent()
      cleanupMessage()
      cleanupStatus()
      unsubProject()
      unsubConversation()
      if (loadingTimeout) { clearTimeout(loadingTimeout); loadingTimeout = null }
      if (saveTimeout) { clearTimeout(saveTimeout); saveTimeout = null }
    }
  },

  startClaude: async () => {
    const projectPath = useProjectStore.getState().currentProject
    if (!projectPath || !bridge) return false

    set({ status: 'starting' })
    const success = await bridge.start(projectPath)

    if (success) {
      const systemMessage: ConversationMessage = {
        id: uuidv4(),
        role: 'system',
        content: `Connected to Claude Code in ${projectPath}`,
        timestamp: Date.now(),
      }
      set((s) => ({ messages: [...s.messages, systemMessage] }))
    }

    return success
  },

  stopClaude: async () => {
    if (!bridge) return
    await bridge.stop()

    const systemMessage: ConversationMessage = {
      id: uuidv4(),
      role: 'system',
      content: 'Disconnected from Claude Code',
      timestamp: Date.now(),
    }
    set((s) => ({ messages: [...s.messages, systemMessage] }))
  },

  sendMessage: async (content) => {
    if (!bridge || !content.trim()) return

    if (loadingTimeout) {
      clearTimeout(loadingTimeout)
      loadingTimeout = null
    }

    const userMessage: ConversationMessage = {
      id: uuidv4(),
      role: 'user',
      content: content.trim(),
      timestamp: Date.now(),
    }
    set((s) => ({
      messages: [...s.messages, userMessage],
      rawOutput: '',
      isLoading: true,
    }))

    loadingTimeout = setTimeout(() => {
      set({ isLoading: false })
    }, MAX_LOADING_TIMEOUT_MS)

    const success = await bridge.sendMessage(content)

    if (!success) {
      if (loadingTimeout) {
        clearTimeout(loadingTimeout)
        loadingTimeout = null
      }
      set({ isLoading: false })

      const errorMessage: ConversationMessage = {
        id: uuidv4(),
        role: 'system',
        content: 'Failed to send message. Make sure Claude Code is connected.',
        timestamp: Date.now(),
      }
      set((s) => ({ messages: [...s.messages, errorMessage] }))
    }

    scheduleSave()
  },

  clearConversation: async () => {
    const projectPath = useProjectStore.getState().currentProject
    const { activeConversationId } = get()

    set({ messages: [], rawOutput: '' })

    if (projectPath && activeConversationId) {
      await window.electronAPI.saveConversationMessages(projectPath, activeConversationId, [])
    }
  },

  newConversation: async () => {
    const name = `Chat ${new Date().toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })}`

    set({ messages: [], rawOutput: '' })

    if (bridge) {
      bridge.clearSession()
    }

    const conv = await createNewConversation(name)
    if (conv) {
      await get().selectConversation(conv.id)
    }
  },

  selectConversation: async (conversationId) => {
    const projectPath = useProjectStore.getState().currentProject
    if (!projectPath) return

    set({ activeConversationId: conversationId, rawOutput: '' })
    await window.electronAPI.setActiveConversation(projectPath, conversationId)

    if (bridge) {
      bridge.clearSession()
    }
  },

  deleteConversation: async (conversationId) => {
    const projectPath = useProjectStore.getState().currentProject
    if (!projectPath) return

    await window.electronAPI.deleteConversation(projectPath, conversationId)

    const { activeConversationId, conversations } = get()
    const needsNewSelection = conversationId === activeConversationId
    const remaining = conversations.filter((c) => c.id !== conversationId)

    set({ conversations: remaining })

    if (needsNewSelection) {
      set({ messages: [], rawOutput: '' })

      if (remaining.length > 0) {
        await get().selectConversation(remaining[0].id)
      } else {
        const newConv = await createNewConversation('New Conversation')
        if (newConv) {
          await get().selectConversation(newConv.id)
        }
      }
    }
  },

  renameConversation: async (conversationId, newName) => {
    const projectPath = useProjectStore.getState().currentProject
    if (!projectPath) return

    await window.electronAPI.renameConversation(projectPath, conversationId, newName)
    set((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === conversationId ? { ...c, name: newName } : c
      ),
    }))
  },

  addSystemMessage: (content) => {
    const message: ConversationMessage = {
      id: uuidv4(),
      role: 'system',
      content,
      timestamp: Date.now(),
    }
    set((s) => ({ messages: [...s.messages, message] }))
  },
}))
)
