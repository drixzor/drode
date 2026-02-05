import React, { useState, useCallback, useEffect, useRef } from 'react'
import { TopBar } from './components/TopBar/TopBar'
import { FileExplorer } from './components/FileExplorer/FileExplorer'
import { Chat } from './components/Chat/Chat'
import { CodeEditor } from './components/CodeEditor/CodeEditor'
import { ResizablePanel, Splitter } from './components/ResizablePanel/ResizablePanel'
import { PermissionDialog } from './components/Permissions/PermissionDialog'
import { BottomPanel, BottomPanelHandle } from './components/Terminal/BottomPanel'
import { QuickActions } from './components/Terminal/QuickActions'
import { ConversationList } from './components/ConversationList/ConversationList'
import { StatusBar } from './components/StatusBar/StatusBar'
import { useProject } from './hooks/useProject'
import { useFileSystem } from './hooks/useFileSystem'
import { useConversation } from './hooks/useConversation'
import { usePermissions } from './hooks/usePermissions'
import { useLayout, PANEL_CONSTRAINTS } from './hooks/useLayout'
import { useEditorTabs } from './hooks/useEditorTabs'

function App() {
  const project = useProject()
  const fileSystem = useFileSystem(project.currentProject)
  const conversation = useConversation(project.currentProject)
  const permissions = usePermissions()
  const layout = useLayout()
  const editorTabs = useEditorTabs()

  const [isFileLoading, setIsFileLoading] = useState(false)
  const [terminalRunning, setTerminalRunning] = useState(false)
  const [pendingCommand, setPendingCommand] = useState<string | null>(null)

  const bottomPanelRef = useRef<BottomPanelHandle>(null)

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K to focus chat input
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        const chatInput = document.querySelector('[data-chat-input]') as HTMLTextAreaElement
        if (chatInput) {
          chatInput.focus()
        }
      }
      // Cmd/Ctrl + ` to toggle terminal
      if ((e.metaKey || e.ctrlKey) && e.key === '`') {
        e.preventDefault()
        layout.toggleBottomPanel()
      }
      // Cmd/Ctrl + B to toggle left sidebar
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault()
        layout.toggleLeftPanel()
      }
      // Cmd/Ctrl + E to toggle right panel (editor)
      if ((e.metaKey || e.ctrlKey) && e.key === 'e') {
        e.preventDefault()
        layout.toggleRightPanel()
      }
      // Cmd/Ctrl + W to close current tab
      if ((e.metaKey || e.ctrlKey) && e.key === 'w') {
        if (editorTabs.activeTabId) {
          e.preventDefault()
          editorTabs.closeTab(editorTabs.activeTabId)
        }
      }
      // Cmd/Ctrl + Shift + T to reopen closed tab (could implement history)
      // Cmd/Ctrl + Tab to switch tabs
      if ((e.metaKey || e.ctrlKey) && e.key === 'Tab') {
        e.preventDefault()
        const tabs = editorTabs.tabs
        if (tabs.length > 1) {
          const currentIndex = tabs.findIndex(t => t.id === editorTabs.activeTabId)
          const nextIndex = e.shiftKey
            ? (currentIndex - 1 + tabs.length) % tabs.length
            : (currentIndex + 1) % tabs.length
          editorTabs.setActiveTabId(tabs[nextIndex].id)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [layout, editorTabs])

  // Auto-start Claude when project is selected
  useEffect(() => {
    if (project.currentProject && conversation.status === 'stopped') {
      conversation.startClaude()
    }
  }, [project.currentProject])

  const handleFileSelect = useCallback(async (filePath: string) => {
    // If right panel is collapsed, expand it first
    if (layout.isRightPanelCollapsed) {
      layout.toggleRightPanel()
    }

    // Check if file is already cached - instant load
    if (fileSystem.isFileCached(filePath)) {
      const content = await fileSystem.readFile(filePath)
      editorTabs.openTab(filePath, content ?? '')
      return
    }

    // Show tab immediately with loading state, then load content
    editorTabs.openTab(filePath, '')
    setIsFileLoading(true)

    try {
      const content = await fileSystem.readFile(filePath)
      editorTabs.openTab(filePath, content ?? '')
    } catch {
      // Tab already open, just leave it empty
    } finally {
      setIsFileLoading(false)
    }
  }, [fileSystem, editorTabs, layout])

  const handleProjectChange = useCallback(async (projectPath: string) => {
    await project.setCurrentProject(projectPath)
    editorTabs.closeAllTabs()
  }, [project, editorTabs])

  const handleOpenProject = useCallback(async () => {
    const folderPath = await project.selectFolder()
    if (folderPath) {
      editorTabs.closeAllTabs()
    }
  }, [project, editorTabs])

  // Run pending command when terminal expands
  useEffect(() => {
    if (!layout.isBottomPanelCollapsed && pendingCommand && bottomPanelRef.current) {
      bottomPanelRef.current.runCommand(pendingCommand)
      setPendingCommand(null)
    }
  }, [layout.isBottomPanelCollapsed, pendingCommand])

  const handleRunTerminalCommand = useCallback((command: string) => {
    if (layout.isBottomPanelCollapsed) {
      // Terminal is collapsed - expand it and queue the command
      layout.toggleBottomPanel()
      setPendingCommand(command)
    } else {
      // Terminal is already open - run command directly
      if (bottomPanelRef.current) {
        bottomPanelRef.current.runCommand(command)
      }
    }
  }, [layout])

  if (project.isLoading) {
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
        currentProject={project.currentProject}
        recentProjects={project.recentProjects}
        onProjectChange={handleProjectChange}
        onOpenProject={handleOpenProject}
        onRemoveProject={project.removeRecentProject}
        getProjectName={project.getProjectName}
        claudeStatus={conversation.status}
        onStartClaude={conversation.startClaude}
        onStopClaude={conversation.stopClaude}
      />

      {/* Quick Actions Bar */}
      <QuickActions
        projectPath={project.currentProject}
        onRunCommand={handleRunTerminalCommand}
        isRunning={terminalRunning}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Left Panel - File Explorer + Conversations */}
        <ResizablePanel
          size={layout.leftPanelWidth}
          minSize={PANEL_CONSTRAINTS.left.min}
          maxSize={PANEL_CONSTRAINTS.left.max}
          onResize={layout.setLeftPanelWidth}
          direction="horizontal"
          side="right"
          isCollapsed={layout.isLeftPanelCollapsed}
          onDoubleClick={layout.resetLeftPanel}
          collapsedSize={0}
        >
          <div className="h-full flex flex-col bg-claude-bg border-r border-claude-border">
            {/* Conversation List */}
            <ConversationList
              projectPath={project.currentProject}
              activeConversationId={conversation.activeConversationId}
              onSelectConversation={conversation.selectConversation}
              onCreateConversation={conversation.newConversation}
              onDeleteConversation={conversation.deleteConversation}
              onRenameConversation={conversation.renameConversation}
            />

            {/* File Explorer */}
            <div className="flex-1 overflow-hidden">
              <FileExplorer
                projectPath={project.currentProject}
                files={fileSystem.files}
                isLoading={fileSystem.isLoading}
                selectedFile={editorTabs.activeTab?.filePath ?? null}
                onFileSelect={handleFileSelect}
                onRefresh={fileSystem.refresh}
                loadSubdirectory={fileSystem.loadSubdirectory}
                isFileChanged={fileSystem.isFileChanged}
                onCreateFile={fileSystem.createFile}
                onCreateDirectory={fileSystem.createDirectory}
                onDeleteFile={fileSystem.deleteFile}
                onRenameFile={fileSystem.renameFile}
                onPreloadFile={fileSystem.preloadFile}
              />
            </div>
          </div>
        </ResizablePanel>

        {/* Center Panel - Chat + Terminal */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Chat Area */}
          <div className="flex-1 overflow-hidden min-h-0">
            <Chat
              messages={conversation.messages}
              isLoading={conversation.isLoading}
              status={conversation.status}
              onSendMessage={conversation.sendMessage}
              onClearConversation={conversation.clearConversation}
              onNewConversation={conversation.newConversation}
              rawOutput={conversation.rawOutput}
            />
          </div>

          {/* Terminal & Ports Panel - Resizable */}
          <BottomPanel
            ref={bottomPanelRef}
            projectPath={project.currentProject}
            height={layout.bottomPanelHeight}
            minHeight={PANEL_CONSTRAINTS.bottom.min}
            maxHeight={PANEL_CONSTRAINTS.bottom.max}
            onResize={layout.setBottomPanelHeight}
            isCollapsed={layout.isBottomPanelCollapsed}
            onToggleCollapse={layout.toggleBottomPanel}
            onResetHeight={layout.resetBottomPanel}
          />
        </div>

        {/* Right Panel - Code Editor with Tabs */}
        <ResizablePanel
          size={layout.rightPanelWidth}
          minSize={PANEL_CONSTRAINTS.right.min}
          maxSize={PANEL_CONSTRAINTS.right.max}
          onResize={layout.setRightPanelWidth}
          direction="horizontal"
          side="left"
          isCollapsed={layout.isRightPanelCollapsed}
          onDoubleClick={layout.resetRightPanel}
          collapsedSize={0}
        >
          <div className="h-full border-l border-claude-border">
            <CodeEditor
              tabs={editorTabs.tabs}
              activeTab={editorTabs.activeTab}
              activeTabId={editorTabs.activeTabId}
              onTabSelect={editorTabs.setActiveTabId}
              onTabClose={editorTabs.closeTab}
              onCloseOtherTabs={editorTabs.closeOtherTabs}
              onCloseAllTabs={editorTabs.closeAllTabs}
              onCloseTabsToRight={editorTabs.closeTabsToRight}
              isLoading={isFileLoading}
            />
          </div>
        </ResizablePanel>
      </div>

      {/* Status Bar */}
      <StatusBar
        isLeftPanelCollapsed={layout.isLeftPanelCollapsed}
        isRightPanelCollapsed={layout.isRightPanelCollapsed}
        isBottomPanelCollapsed={layout.isBottomPanelCollapsed}
        onToggleLeftPanel={layout.toggleLeftPanel}
        onToggleRightPanel={layout.toggleRightPanel}
        onToggleBottomPanel={layout.toggleBottomPanel}
        claudeStatus={conversation.status}
        projectPath={project.currentProject}
        onResetLayout={layout.resetLayout}
      />

      {/* Permission Dialog */}
      <PermissionDialog
        request={permissions.pendingRequest}
        onApprove={() => permissions.approve(false)}
        onDeny={permissions.deny}
        onAcceptAll={permissions.acceptAll}
        queueLength={permissions.queueLength}
      />
    </div>
  )
}

export default App
