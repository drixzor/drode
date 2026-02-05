import React, { useState, useRef, memo, useMemo, Suspense, lazy } from 'react'
import { VscClose, VscFile, VscCircleFilled, VscEllipsis } from 'react-icons/vsc'
import { getLanguageFromExtension, getFileExtension, getFilename } from '../../utils/fileUtils'
import { useEditorStore } from '../../stores/editorStore'
import { FileIcon } from '../FileExplorer/FileIcon'

// Lazy load the syntax highlighter for better initial load
const SyntaxHighlighter = lazy(() =>
  import('react-syntax-highlighter').then(mod => ({ default: mod.Prism }))
)

// Import style separately
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'

interface CodeEditorProps {
  isLoading?: boolean
}

// Skeleton loader for code
const CodeSkeleton = memo(function CodeSkeleton() {
  return (
    <div className="p-4 space-y-2 animate-pulse">
      {Array.from({ length: 20 }).map((_, i) => (
        <div key={i} className="flex gap-4">
          <div className="w-8 h-4 bg-claude-surface rounded" />
          <div
            className="h-4 bg-claude-surface rounded"
            style={{ width: `${Math.random() * 60 + 20}%` }}
          />
        </div>
      ))}
    </div>
  )
})

// Memoized code content to prevent re-renders
const CodeContent = memo(function CodeContent({
  content,
  language
}: {
  content: string
  language: string
}) {
  // For very large files, show plain text
  if (content.length > 500000) {
    return (
      <pre className="p-4 text-sm font-mono text-claude-text whitespace-pre-wrap">
        {content}
      </pre>
    )
  }

  return (
    <Suspense fallback={<CodeSkeleton />}>
      <SyntaxHighlighter
        language={language}
        style={vscDarkPlus}
        showLineNumbers
        wrapLines
        wrapLongLines
        customStyle={{
          margin: 0,
          padding: '12px',
          fontSize: '13px',
          lineHeight: '1.6',
          background: '#1e1e1e',
          minHeight: '100%',
        }}
        lineNumberStyle={{
          minWidth: '3.5em',
          paddingRight: '1em',
          color: '#4a4a4a',
          userSelect: 'none',
          borderRight: '1px solid #2a2a2a',
          marginRight: '1em',
        }}
      >
        {content || '// Empty file'}
      </SyntaxHighlighter>
    </Suspense>
  )
})

export const CodeEditor = memo(function CodeEditor({
  isLoading = false
}: CodeEditorProps) {
  const tabs = useEditorStore((s) => s.tabs)
  const activeTabId = useEditorStore((s) => s.activeTabId)
  const activeTab = useEditorStore((s) => s.tabs.find((t) => t.id === s.activeTabId) ?? null)
  const onTabSelect = useEditorStore((s) => s.setActiveTabId)
  const onTabClose = useEditorStore((s) => s.closeTab)
  const onCloseOtherTabs = useEditorStore((s) => s.closeOtherTabs)
  const onCloseAllTabs = useEditorStore((s) => s.closeAllTabs)
  const onCloseTabsToRight = useEditorStore((s) => s.closeTabsToRight)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; tabId: string } | null>(null)
  const [draggedTabId, setDraggedTabId] = useState<string | null>(null)
  const tabsContainerRef = useRef<HTMLDivElement>(null)

  const handleTabContextMenu = (e: React.MouseEvent, tabId: string) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, tabId })
  }

  const closeContextMenu = () => setContextMenu(null)

  const handleDragStart = (e: React.DragEvent, tabId: string) => {
    setDraggedTabId(tabId)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = (e: React.DragEvent, targetTabId: string) => {
    e.preventDefault()
    if (!draggedTabId || draggedTabId === targetTabId) return
    setDraggedTabId(null)
  }

  const handleDragEnd = () => {
    setDraggedTabId(null)
  }

  // Memoize language detection
  const { filename, language } = useMemo(() => {
    if (!activeTab) return { filename: '', language: 'text' }
    const fname = getFilename(activeTab.filePath)
    const ext = getFileExtension(fname)
    return {
      filename: fname,
      language: getLanguageFromExtension(ext)
    }
  }, [activeTab?.filePath])

  if (tabs.length === 0) {
    return (
      <div className="h-full bg-claude-bg flex flex-col items-center justify-center text-claude-text-secondary p-4">
        <VscFile className="text-5xl mb-4 text-claude-accent/60" />
        <p className="text-center text-lg mb-2">No file open</p>
        <p className="text-sm text-center text-claude-text-secondary/70">
          Click on a file in the explorer to view it here
        </p>
        <div className="mt-6 text-xs text-claude-text-secondary/50 space-y-1">
          <p>Keyboard shortcuts:</p>
          <p className="font-mono">⌘K - Focus chat</p>
          <p className="font-mono">⌘` - Toggle terminal</p>
          <p className="font-mono">⌘B - Toggle sidebar</p>
        </div>
      </div>
    )
  }

  const showLoading = isLoading || (activeTab?.isLoading) || (activeTab?.content === '' && isLoading)

  return (
    <div className="h-full bg-claude-bg flex flex-col">
      {/* Tab Bar */}
      <div
        ref={tabsContainerRef}
        className="flex items-center bg-claude-surface border-b border-claude-border overflow-x-auto scrollbar-thin"
      >
        <div className="flex items-center min-w-0 flex-1">
          {tabs.map((tab) => {
            const tabFilename = getFilename(tab.filePath)
            const isActive = tab.id === activeTabId
            const isDragging = tab.id === draggedTabId

            return (
              <div
                key={tab.id}
                draggable
                onDragStart={(e) => handleDragStart(e, tab.id)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, tab.id)}
                onDragEnd={handleDragEnd}
                onClick={() => onTabSelect(tab.id)}
                onContextMenu={(e) => handleTabContextMenu(e, tab.id)}
                className={`
                  group flex items-center gap-1.5 px-3 py-2 min-w-0 max-w-[180px] cursor-pointer
                  border-r border-claude-border/50
                  ${isActive
                    ? 'bg-claude-bg text-claude-text'
                    : 'text-claude-text-secondary hover:bg-claude-surface-hover hover:text-claude-text'
                  }
                  ${isDragging ? 'opacity-50' : ''}
                `}
              >
                <FileIcon filename={tabFilename} className="text-sm flex-shrink-0" />
                <span className="text-sm truncate flex-1">{tabFilename}</span>
                {tab.isLoading && (
                  <div className="w-3 h-3 border border-claude-accent border-t-transparent rounded-full animate-spin flex-shrink-0" />
                )}
                {tab.isModified && !tab.isLoading && (
                  <VscCircleFilled className="text-[8px] text-claude-warning flex-shrink-0" />
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onTabClose(tab.id)
                  }}
                  className={`
                    p-0.5 rounded hover:bg-claude-surface-hover flex-shrink-0
                    ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}
                  `}
                >
                  <VscClose className="text-xs" />
                </button>
              </div>
            )
          })}
        </div>

        {/* Tab actions */}
        {tabs.length > 1 && (
          <button
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect()
              setContextMenu({ x: rect.left, y: rect.bottom, tabId: activeTabId || '' })
            }}
            className="p-2 hover:bg-claude-surface-hover flex-shrink-0"
            title="Tab actions"
          >
            <VscEllipsis className="text-claude-text-secondary" />
          </button>
        )}
      </div>

      {/* File Path Breadcrumb */}
      {activeTab && (
        <div className="px-3 py-1.5 text-xs text-claude-text-secondary bg-claude-surface/30 border-b border-claude-border/50 flex items-center justify-between">
          <span className="truncate flex-1" title={activeTab.filePath}>
            {activeTab.filePath}
          </span>
          <span className="ml-2 px-1.5 py-0.5 bg-claude-bg/50 rounded text-[10px] uppercase tracking-wider">
            {language}
          </span>
        </div>
      )}

      {/* Editor Content */}
      <div className="flex-1 overflow-auto bg-[#1e1e1e]">
        {showLoading ? (
          <CodeSkeleton />
        ) : activeTab ? (
          <CodeContent content={activeTab.content} language={language} />
        ) : null}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={closeContextMenu}
          />
          <div
            className="fixed z-50 bg-claude-surface border border-claude-border rounded-lg shadow-xl py-1 min-w-[160px] animate-scale-in"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button
              onClick={() => {
                onTabClose(contextMenu.tabId)
                closeContextMenu()
              }}
              className="w-full px-3 py-1.5 text-sm text-left hover:bg-claude-surface-hover"
            >
              Close
            </button>
            {tabs.length > 1 && (
              <button
                onClick={() => {
                  onCloseOtherTabs(contextMenu.tabId)
                  closeContextMenu()
                }}
                className="w-full px-3 py-1.5 text-sm text-left hover:bg-claude-surface-hover"
              >
                Close Others
              </button>
            )}
            <button
              onClick={() => {
                onCloseTabsToRight(contextMenu.tabId)
                closeContextMenu()
              }}
              className="w-full px-3 py-1.5 text-sm text-left hover:bg-claude-surface-hover"
            >
              Close to the Right
            </button>
            <div className="h-px bg-claude-border my-1" />
            <button
              onClick={() => {
                onCloseAllTabs()
                closeContextMenu()
              }}
              className="w-full px-3 py-1.5 text-sm text-left hover:bg-claude-surface-hover text-claude-error"
            >
              Close All
            </button>
          </div>
        </>
      )}
    </div>
  )
})
