import { useState, useCallback } from 'react'

export interface EditorTab {
  id: string
  filePath: string
  content: string
  isLoading: boolean
  isModified: boolean
}

export function useEditorTabs() {
  const [tabs, setTabs] = useState<EditorTab[]>([])
  const [activeTabId, setActiveTabId] = useState<string | null>(null)

  const openTab = useCallback((filePath: string, content: string = '') => {
    setTabs(prev => {
      // Check if tab already exists
      const existing = prev.find(t => t.filePath === filePath)
      if (existing) {
        setActiveTabId(existing.id)
        return prev.map(t => t.id === existing.id ? { ...t, content, isLoading: false } : t)
      }

      // Create new tab
      const newTab: EditorTab = {
        id: `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        filePath,
        content,
        isLoading: false,
        isModified: false,
      }
      setActiveTabId(newTab.id)
      return [...prev, newTab]
    })
  }, [])

  const closeTab = useCallback((tabId: string) => {
    setTabs(prev => {
      const index = prev.findIndex(t => t.id === tabId)
      const newTabs = prev.filter(t => t.id !== tabId)

      // Update active tab if we closed the active one
      if (activeTabId === tabId && newTabs.length > 0) {
        const newIndex = Math.min(index, newTabs.length - 1)
        setActiveTabId(newTabs[newIndex]?.id ?? null)
      } else if (newTabs.length === 0) {
        setActiveTabId(null)
      }

      return newTabs
    })
  }, [activeTabId])

  const closeOtherTabs = useCallback((tabId: string) => {
    setTabs(prev => prev.filter(t => t.id === tabId))
    setActiveTabId(tabId)
  }, [])

  const closeAllTabs = useCallback(() => {
    setTabs([])
    setActiveTabId(null)
  }, [])

  const closeTabsToRight = useCallback((tabId: string) => {
    setTabs(prev => {
      const index = prev.findIndex(t => t.id === tabId)
      return prev.slice(0, index + 1)
    })
  }, [])

  const updateTabContent = useCallback((tabId: string, content: string) => {
    setTabs(prev => prev.map(t =>
      t.id === tabId ? { ...t, content, isModified: true } : t
    ))
  }, [])

  const setTabLoading = useCallback((tabId: string, isLoading: boolean) => {
    setTabs(prev => prev.map(t =>
      t.id === tabId ? { ...t, isLoading } : t
    ))
  }, [])

  const reorderTabs = useCallback((fromIndex: number, toIndex: number) => {
    setTabs(prev => {
      const newTabs = [...prev]
      const [removed] = newTabs.splice(fromIndex, 1)
      newTabs.splice(toIndex, 0, removed)
      return newTabs
    })
  }, [])

  const activeTab = tabs.find(t => t.id === activeTabId) ?? null

  return {
    tabs,
    activeTab,
    activeTabId,
    setActiveTabId,
    openTab,
    closeTab,
    closeOtherTabs,
    closeAllTabs,
    closeTabsToRight,
    updateTabContent,
    setTabLoading,
    reorderTabs,
  }
}
