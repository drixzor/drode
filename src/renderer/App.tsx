import React, { useState, useCallback, useEffect, useRef } from 'react'
import { TopBar } from './components/TopBar/TopBar'
import { FileExplorer } from './components/FileExplorer/FileExplorer'
import { Chat } from './components/Chat/Chat'
import { CodeEditor } from './components/CodeEditor/CodeEditor'
import { ResizablePanel } from './components/ResizablePanel/ResizablePanel'
import { PermissionDialog } from './components/Permissions/PermissionDialog'
import { BottomPanel, BottomPanelHandle } from './components/Terminal/BottomPanel'
import { QuickActions } from './components/Terminal/QuickActions'
import { ConversationList } from './components/ConversationList/ConversationList'
import { StatusBar } from './components/StatusBar/StatusBar'
import { GitHubExplorer } from './components/GitHub/GitHubExplorer'
import { DatabasePanel } from './components/Database/DatabasePanel'
import { DeploymentsPanel } from './components/Deployments/DeploymentsPanel'
import { useProjectStore } from './stores/projectStore'
import { useFileSystemStore } from './stores/fileSystemStore'
import { useConversationStore } from './stores/conversationStore'
import { usePermissionStore } from './stores/permissionStore'
import { useLayoutStore, PANEL_CONSTRAINTS } from './stores/layoutStore'
import { useEditorStore } from './stores/editorStore'
import { useActivityStore } from './stores/activityStore'
import { useAuthStore } from './stores/authStore'
import {
  VscComment,
  VscDatabase,
  VscRocket,
  VscFiles,
  VscGithub,
} from 'react-icons/vsc'

function App() {
  const [isFileLoading, setIsFileLoading] = useState(false)
  const [terminalRunning, setTerminalRunning] = useState(false)
  const [pendingCommand, setPendingCommand] = useState<string | null>(null)

  const bottomPanelRef = useRef<BottomPanelHandle>(null)

  // Store init
  useEffect(() => {
    useProjectStore.getState().loadInitialState()
  }, [])

  useEffect(() => {
    const cleanupFs = useFileSystemStore.getState().init()
    const cleanupConv = useConversationStore.getState().init()
    const cleanupPerm = usePermissionStore.getState().init()
    const cleanupActivity = useActivityStore.getState().init()
    const cleanupAuth = useAuthStore.getState().init()
    return () => {
      cleanupFs()
      cleanupConv()
      cleanupPerm()
      cleanupActivity()
      cleanupAuth()
    }
  }, [])

  // Auto-start Claude when project is selected
  useEffect(() => {
    const unsub = useProjectStore.subscribe(
      (state) => state.currentProject,
      (currentProject) => {
        if (currentProject && useConversationStore.getState().status === 'stopped') {
          useConversationStore.getState().startClaude()
        }
      }
    )
    // Also handle initial load
    const currentProject = useProjectStore.getState().currentProject
    if (currentProject && useConversationStore.getState().status === 'stopped') {
      useConversationStore.getState().startClaude()
    }
    return unsub
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        const chatInput = document.querySelector('[data-chat-input]') as HTMLTextAreaElement
        if (chatInput) chatInput.focus()
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '`') {
        e.preventDefault()
        useLayoutStore.getState().toggleBottomPanel()
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault()
        useLayoutStore.getState().toggleLeftPanel()
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'e') {
        e.preventDefault()
        useLayoutStore.getState().toggleRightPanel()
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'w') {
        const activeTabId = useEditorStore.getState().activeTabId
        if (activeTabId) {
          e.preventDefault()
          useEditorStore.getState().closeTab(activeTabId)
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'Tab') {
        e.preventDefault()
        const { tabs, activeTabId } = useEditorStore.getState()
        if (tabs.length > 1) {
          const currentIndex = tabs.findIndex((t) => t.id === activeTabId)
          const nextIndex = e.shiftKey
            ? (currentIndex - 1 + tabs.length) % tabs.length
            : (currentIndex + 1) % tabs.length
          useEditorStore.getState().setActiveTabId(tabs[nextIndex].id)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Cross-store: file select orchestration
  const handleFileSelect = useCallback(async (filePath: string) => {
    if (useLayoutStore.getState().isRightPanelCollapsed) {
      useLayoutStore.getState().toggleRightPanel()
    }

    const fs = useFileSystemStore.getState()
    if (fs.isFileCached(filePath)) {
      const content = await fs.readFile(filePath)
      useEditorStore.getState().openTab(filePath, content ?? '')
      return
    }

    useEditorStore.getState().openTab(filePath, '')
    setIsFileLoading(true)

    try {
      const content = await fs.readFile(filePath)
      useEditorStore.getState().openTab(filePath, content ?? '')
    } catch {
      // Tab already open, just leave it empty
    } finally {
      setIsFileLoading(false)
    }
  }, [])

  // Cross-store: project change clears tabs
  const handleProjectChange = useCallback(async (projectPath: string) => {
    await useProjectStore.getState().setCurrentProject(projectPath)
    useEditorStore.getState().closeAllTabs()
  }, [])

  const handleOpenProject = useCallback(async () => {
    const folderPath = await useProjectStore.getState().selectFolder()
    if (folderPath) {
      useEditorStore.getState().closeAllTabs()
    }
  }, [])

  // Run pending command when terminal expands
  const isBottomPanelCollapsed = useLayoutStore((s) => s.isBottomPanelCollapsed)
  useEffect(() => {
    if (!isBottomPanelCollapsed && pendingCommand && bottomPanelRef.current) {
      bottomPanelRef.current.runCommand(pendingCommand)
      setPendingCommand(null)
    }
  }, [isBottomPanelCollapsed, pendingCommand])

  const handleRunTerminalCommand = useCallback((command: string) => {
    if (useLayoutStore.getState().isBottomPanelCollapsed) {
      useLayoutStore.getState().toggleBottomPanel()
      setPendingCommand(command)
    } else {
      if (bottomPanelRef.current) {
        bottomPanelRef.current.runCommand(command)
      }
    }
  }, [])

  // Select minimal state needed for rendering
  const isLoading = useProjectStore((s) => s.isLoading)
  const currentProject = useProjectStore((s) => s.currentProject)
  const leftPanelWidth = useLayoutStore((s) => s.leftPanelWidth)
  const isLeftPanelCollapsed = useLayoutStore((s) => s.isLeftPanelCollapsed)
  const rightPanelWidth = useLayoutStore((s) => s.rightPanelWidth)
  const isRightPanelCollapsed = useLayoutStore((s) => s.isRightPanelCollapsed)
  const bottomPanelHeight = useLayoutStore((s) => s.bottomPanelHeight)
  const setLeftPanelWidth = useLayoutStore((s) => s.setLeftPanelWidth)
  const setRightPanelWidth = useLayoutStore((s) => s.setRightPanelWidth)
  const setBottomPanelHeight = useLayoutStore((s) => s.setBottomPanelHeight)
  const resetLeftPanel = useLayoutStore((s) => s.resetLeftPanel)
  const resetRightPanel = useLayoutStore((s) => s.resetRightPanel)
  const resetBottomPanel = useLayoutStore((s) => s.resetBottomPanel)
  const toggleBottomPanel = useLayoutStore((s) => s.toggleBottomPanel)
  const centerView = useLayoutStore((s) => s.centerView)
  const setCenterView = useLayoutStore((s) => s.setCenterView)
  const leftPanelTab = useLayoutStore((s) => s.leftPanelTab)
  const setLeftPanelTab = useLayoutStore((s) => s.setLeftPanelTab)

  if (isLoading) {
    return (
      <div className="h-screen bg-claude-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-claude-accent border-t-transparent rounded-full animate-spin" />
          <span className="text-claude-text-secondary">Loading...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen bg-claude-bg flex flex-col overflow-hidden">
      {/* Top Bar */}
      <TopBar
        onProjectChange={handleProjectChange}
        onOpenProject={handleOpenProject}
      />

      {/* Quick Actions Bar */}
      <QuickActions
        projectPath={currentProject}
        onRunCommand={handleRunTerminalCommand}
        isRunning={terminalRunning}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Left Panel - File Explorer / GitHub + Conversations */}
        <ResizablePanel
          size={leftPanelWidth}
          minSize={PANEL_CONSTRAINTS.left.min}
          maxSize={PANEL_CONSTRAINTS.left.max}
          onResize={setLeftPanelWidth}
          direction="horizontal"
          side="right"
          isCollapsed={isLeftPanelCollapsed}
          onDoubleClick={resetLeftPanel}
          collapsedSize={0}
        >
          <div className="h-full flex flex-col bg-claude-bg border-r border-claude-border">
            {/* Conversation List */}
            <ConversationList />

            {/* Left Panel Tab Switcher */}
            <div className="flex items-center border-b border-claude-border px-1 py-0.5 bg-claude-surface flex-shrink-0">
              <button
                onClick={() => setLeftPanelTab('files')}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded transition-colors ${
                  leftPanelTab === 'files'
                    ? 'bg-claude-bg text-claude-text'
                    : 'text-claude-text-secondary hover:text-claude-text hover:bg-claude-surface-hover'
                }`}
              >
                <VscFiles className="w-3.5 h-3.5" />
                Files
              </button>
              <button
                onClick={() => setLeftPanelTab('github')}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded transition-colors ${
                  leftPanelTab === 'github'
                    ? 'bg-claude-bg text-claude-text'
                    : 'text-claude-text-secondary hover:text-claude-text hover:bg-claude-surface-hover'
                }`}
              >
                <VscGithub className="w-3.5 h-3.5" />
                GitHub
              </button>
            </div>

            {/* Left Panel Content */}
            <div className="flex-1 overflow-hidden">
              {leftPanelTab === 'files' ? (
                <FileExplorer onFileSelect={handleFileSelect} />
              ) : (
                <GitHubExplorer onFileSelect={handleFileSelect} />
              )}
            </div>
          </div>
        </ResizablePanel>

        {/* Center Panel - Chat / Database / Deployments + Bottom */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Center View Tab Bar */}
          <div className="flex items-center bg-claude-surface border-b border-claude-border px-2 py-0.5 flex-shrink-0">
            <button
              onClick={() => setCenterView('chat')}
              className={`flex items-center gap-1.5 px-3 py-1 text-sm rounded transition-colors ${
                centerView === 'chat'
                  ? 'bg-claude-bg text-claude-text'
                  : 'text-claude-text-secondary hover:text-claude-text hover:bg-claude-surface-hover'
              }`}
            >
              <VscComment className="w-4 h-4" />
              Chat
            </button>
            <button
              onClick={() => setCenterView('database')}
              className={`flex items-center gap-1.5 px-3 py-1 text-sm rounded transition-colors ${
                centerView === 'database'
                  ? 'bg-claude-bg text-claude-text'
                  : 'text-claude-text-secondary hover:text-claude-text hover:bg-claude-surface-hover'
              }`}
            >
              <VscDatabase className="w-4 h-4" />
              Database
            </button>
            <button
              onClick={() => setCenterView('deployments')}
              className={`flex items-center gap-1.5 px-3 py-1 text-sm rounded transition-colors ${
                centerView === 'deployments'
                  ? 'bg-claude-bg text-claude-text'
                  : 'text-claude-text-secondary hover:text-claude-text hover:bg-claude-surface-hover'
              }`}
            >
              <VscRocket className="w-4 h-4" />
              Deployments
            </button>
          </div>

          {/* Center Content */}
          <div className="flex-1 overflow-hidden min-h-0">
            {centerView === 'chat' && <Chat />}
            {centerView === 'database' && <DatabasePanel />}
            {centerView === 'deployments' && <DeploymentsPanel />}
          </div>

          {/* Terminal & Ports Panel - Resizable */}
          <BottomPanel
            ref={bottomPanelRef}
            projectPath={currentProject}
            height={bottomPanelHeight}
            minHeight={PANEL_CONSTRAINTS.bottom.min}
            maxHeight={PANEL_CONSTRAINTS.bottom.max}
            onResize={setBottomPanelHeight}
            isCollapsed={isBottomPanelCollapsed}
            onToggleCollapse={toggleBottomPanel}
            onResetHeight={resetBottomPanel}
          />
        </div>

        {/* Right Panel - Code Editor with Tabs */}
        <ResizablePanel
          size={rightPanelWidth}
          minSize={PANEL_CONSTRAINTS.right.min}
          maxSize={PANEL_CONSTRAINTS.right.max}
          onResize={setRightPanelWidth}
          direction="horizontal"
          side="left"
          isCollapsed={isRightPanelCollapsed}
          onDoubleClick={resetRightPanel}
          collapsedSize={0}
        >
          <div className="h-full border-l border-claude-border">
            <CodeEditor isLoading={isFileLoading} />
          </div>
        </ResizablePanel>
      </div>

      {/* Status Bar */}
      <StatusBar />

      {/* Permission Dialog */}
      <PermissionDialog />
    </div>
  )
}

export default App
