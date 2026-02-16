import { create } from 'zustand'

export interface PreviewTab {
  id: string
  url: string
  title: string
  isLoading: boolean
}

interface PreviewState {
  tabs: PreviewTab[]
  activeTabId: string | null
}

interface PreviewActions {
  addTab: (url: string, title?: string) => void
  removeTab: (tabId: string) => void
  setActiveTab: (tabId: string) => void
  updateUrl: (tabId: string, url: string) => void
  refreshTab: (tabId: string) => void
  setTabLoading: (tabId: string, isLoading: boolean) => void
}

export const usePreviewStore = create<PreviewState & PreviewActions>((set, get) => ({
  tabs: [],
  activeTabId: null,

  addTab: (url, title) => {
    // Check if already open
    const existing = get().tabs.find((t) => t.url === url)
    if (existing) {
      set({ activeTabId: existing.id })
      return
    }

    const id = `preview-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`
    const newTab: PreviewTab = {
      id,
      url,
      title: title || url,
      isLoading: true,
    }
    set((s) => ({
      tabs: [...s.tabs, newTab],
      activeTabId: id,
    }))
  },

  removeTab: (tabId) => {
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

  setActiveTab: (tabId) => set({ activeTabId: tabId }),

  updateUrl: (tabId, url) => {
    set((s) => ({
      tabs: s.tabs.map((t) => (t.id === tabId ? { ...t, url, isLoading: true } : t)),
    }))
  },

  refreshTab: (tabId) => {
    // Trigger reload by toggling isLoading - the component uses key to force remount
    set((s) => ({
      tabs: s.tabs.map((t) => (t.id === tabId ? { ...t, isLoading: true } : t)),
    }))
  },

  setTabLoading: (tabId, isLoading) => {
    set((s) => ({
      tabs: s.tabs.map((t) => (t.id === tabId ? { ...t, isLoading } : t)),
    }))
  },
}))
