import React, { useCallback, useState } from 'react'
import { VscClose, VscAdd } from 'react-icons/vsc'
import { usePreviewStore } from '../../stores/previewStore'
import { PreviewToolbar } from './PreviewToolbar'

export function PreviewPanel() {
  const tabs = usePreviewStore((s) => s.tabs)
  const activeTabId = usePreviewStore((s) => s.activeTabId)
  const addTab = usePreviewStore((s) => s.addTab)
  const removeTab = usePreviewStore((s) => s.removeTab)
  const setActiveTab = usePreviewStore((s) => s.setActiveTab)
  const updateUrl = usePreviewStore((s) => s.updateUrl)
  const refreshTab = usePreviewStore((s) => s.refreshTab)
  const setTabLoading = usePreviewStore((s) => s.setTabLoading)

  const [refreshKeys, setRefreshKeys] = useState<Record<string, number>>({})

  const activeTab = tabs.find((t) => t.id === activeTabId)

  const handleAddTab = useCallback(() => {
    addTab('http://localhost:3000')
  }, [addTab])

  const handleRefresh = useCallback(() => {
    if (activeTabId) {
      setRefreshKeys((prev) => ({
        ...prev,
        [activeTabId]: (prev[activeTabId] || 0) + 1,
      }))
    }
  }, [activeTabId])

  const handleUrlChange = useCallback(
    (url: string) => {
      if (activeTabId) updateUrl(activeTabId, url)
    },
    [activeTabId, updateUrl]
  )

  if (tabs.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-sm text-claude-text-secondary gap-2">
        <p>No preview tabs open</p>
        <button
          onClick={handleAddTab}
          className="flex items-center gap-1 px-3 py-1.5 bg-claude-accent/20 text-claude-accent rounded hover:bg-claude-accent/30 transition-colors"
        >
          <VscAdd className="w-3.5 h-3.5" />
          <span>Open Preview</span>
        </button>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Tab Bar */}
      <div className="flex items-center bg-claude-surface border-b border-claude-border flex-shrink-0">
        <div className="flex items-center overflow-x-auto flex-1">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={`flex items-center gap-1 px-3 py-1.5 text-xs cursor-pointer border-r border-claude-border ${
                tab.id === activeTabId
                  ? 'bg-claude-bg text-claude-text'
                  : 'text-claude-text-secondary hover:text-claude-text hover:bg-claude-surface-hover'
              }`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.isLoading && (
                <span className="w-2 h-2 rounded-full bg-claude-accent animate-pulse" />
              )}
              <span className="truncate max-w-[150px]">{tab.title}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  removeTab(tab.id)
                }}
                className="ml-1 p-0.5 hover:bg-claude-surface-hover rounded"
              >
                <VscClose className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={handleAddTab}
          className="p-1.5 hover:bg-claude-surface-hover transition-colors flex-shrink-0"
          title="New preview tab"
        >
          <VscAdd className="w-3.5 h-3.5 text-claude-text-secondary" />
        </button>
      </div>

      {/* Toolbar */}
      {activeTab && (
        <PreviewToolbar
          url={activeTab.url}
          onUrlChange={handleUrlChange}
          onRefresh={handleRefresh}
        />
      )}

      {/* iframe */}
      {activeTab && (
        <div className="flex-1 bg-white">
          <iframe
            key={`${activeTab.id}-${refreshKeys[activeTab.id] || 0}`}
            src={activeTab.url}
            className="w-full h-full border-0"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
            onLoad={() => setTabLoading(activeTab.id, false)}
            title={activeTab.title}
          />
        </div>
      )}
    </div>
  )
}
