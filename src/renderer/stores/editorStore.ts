import { create } from 'zustand'

export interface EditorTab {
  id: string
  filePath: string
  content: string
  isLoading: boolean
  isModified: boolean
}

interface EditorState {
  tabs: EditorTab[]
  activeTabId: string | null
}

interface EditorActions {
  openTab: (filePath: string, content?: string) => void
  closeTab: (tabId: string) => void
  closeOtherTabs: (tabId: string) => void
  closeAllTabs: () => void
  closeTabsToRight: (tabId: string) => void
  updateTabContent: (tabId: string, content: string) => void
  setTabLoading: (tabId: string, isLoading: boolean) => void
  reorderTabs: (fromIndex: number, toIndex: number) => void
  setActiveTabId: (tabId: string | null) => void
}

export const useEditorStore = create<EditorState & EditorActions>((set, get) => ({
  tabs: [],
  activeTabId: null,

  openTab: (filePath, content = '') => {
    const { tabs } = get()
    const existing = tabs.find((t) => t.filePath === filePath)

    if (existing) {
      set({
        activeTabId: existing.id,
        tabs: tabs.map((t) =>
          t.id === existing.id ? { ...t, content, isLoading: false } : t
        ),
      })
      return
    }

    const newTab: EditorTab = {
      id: `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      filePath,
      content,
      isLoading: false,
      isModified: false,
    }
    set({ tabs: [...tabs, newTab], activeTabId: newTab.id })
  },

  closeTab: (tabId) => {
    const { tabs, activeTabId } = get()
    const index = tabs.findIndex((t) => t.id === tabId)
    const newTabs = tabs.filter((t) => t.id !== tabId)

    let newActiveTabId = activeTabId
    if (activeTabId === tabId) {
      if (newTabs.length > 0) {
        const newIndex = Math.min(index, newTabs.length - 1)
        newActiveTabId = newTabs[newIndex]?.id ?? null
      } else {
        newActiveTabId = null
      }
    }

    set({ tabs: newTabs, activeTabId: newActiveTabId })
  },

  closeOtherTabs: (tabId) => {
    set((s) => ({
      tabs: s.tabs.filter((t) => t.id === tabId),
      activeTabId: tabId,
    }))
  },

  closeAllTabs: () => set({ tabs: [], activeTabId: null }),

  closeTabsToRight: (tabId) => {
    set((s) => {
      const index = s.tabs.findIndex((t) => t.id === tabId)
      return { tabs: s.tabs.slice(0, index + 1) }
    })
  },

  updateTabContent: (tabId, content) => {
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.id === tabId ? { ...t, content, isModified: true } : t
      ),
    }))
  },

  setTabLoading: (tabId, isLoading) => {
    set((s) => ({
      tabs: s.tabs.map((t) => (t.id === tabId ? { ...t, isLoading } : t)),
    }))
  },

  reorderTabs: (fromIndex, toIndex) => {
    set((s) => {
      const newTabs = [...s.tabs]
      const [removed] = newTabs.splice(fromIndex, 1)
      newTabs.splice(toIndex, 0, removed)
      return { tabs: newTabs }
    })
  },

  setActiveTabId: (tabId) => set({ activeTabId: tabId }),
}))
