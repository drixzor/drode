import React, { memo } from 'react'
import {
  VscLayoutSidebarLeft,
  VscLayoutSidebarRight,
  VscTerminal,
  VscSourceControl,
  VscLayout
} from 'react-icons/vsc'

interface StatusBarProps {
  isLeftPanelCollapsed: boolean
  isRightPanelCollapsed: boolean
  isBottomPanelCollapsed: boolean
  onToggleLeftPanel: () => void
  onToggleRightPanel: () => void
  onToggleBottomPanel: () => void
  claudeStatus: 'running' | 'stopped' | 'error' | 'starting'
  projectPath: string | null
  onResetLayout: () => void
}

export const StatusBar = memo(function StatusBar({
  isLeftPanelCollapsed,
  isRightPanelCollapsed,
  isBottomPanelCollapsed,
  onToggleLeftPanel,
  onToggleRightPanel,
  onToggleBottomPanel,
  claudeStatus,
  projectPath,
  onResetLayout
}: StatusBarProps) {
  const getProjectName = (path: string | null) => {
    if (!path) return 'No project'
    const parts = path.split('/')
    return parts[parts.length - 1] || path
  }

  const statusColor = {
    running: 'bg-claude-success',
    stopped: 'bg-claude-text-secondary',
    error: 'bg-claude-error',
    starting: 'bg-claude-warning animate-pulse'
  }

  return (
    <div className="h-6 bg-claude-surface border-t border-claude-border flex items-center justify-between px-2 text-xs select-none">
      {/* Left side - Project info */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 text-claude-text-secondary">
          <VscSourceControl className="text-claude-accent" />
          <span>{getProjectName(projectPath)}</span>
        </div>

        <div className="flex items-center gap-1.5 text-claude-text-secondary">
          <span className={`w-2 h-2 rounded-full ${statusColor[claudeStatus]}`} />
          <span>Claude {claudeStatus === 'running' ? 'Connected' : claudeStatus === 'starting' ? 'Connecting...' : 'Disconnected'}</span>
        </div>
      </div>

      {/* Right side - Panel toggles */}
      <div className="flex items-center gap-1">
        <button
          onClick={onResetLayout}
          className="p-1 hover:bg-claude-surface-hover rounded transition-colors"
          title="Reset layout"
        >
          <VscLayout className="text-claude-text-secondary" />
        </button>

        <div className="w-px h-4 bg-claude-border mx-1" />

        <button
          onClick={onToggleLeftPanel}
          className={`p-1 rounded transition-colors ${
            isLeftPanelCollapsed
              ? 'text-claude-text-secondary hover:bg-claude-surface-hover'
              : 'text-claude-accent bg-claude-bg'
          }`}
          title={`${isLeftPanelCollapsed ? 'Show' : 'Hide'} sidebar (⌘B)`}
        >
          <VscLayoutSidebarLeft />
        </button>

        <button
          onClick={onToggleBottomPanel}
          className={`p-1 rounded transition-colors ${
            isBottomPanelCollapsed
              ? 'text-claude-text-secondary hover:bg-claude-surface-hover'
              : 'text-claude-accent bg-claude-bg'
          }`}
          title={`${isBottomPanelCollapsed ? 'Show' : 'Hide'} terminal (⌘\`)`}
        >
          <VscTerminal />
        </button>

        <button
          onClick={onToggleRightPanel}
          className={`p-1 rounded transition-colors ${
            isRightPanelCollapsed
              ? 'text-claude-text-secondary hover:bg-claude-surface-hover'
              : 'text-claude-accent bg-claude-bg'
          }`}
          title={`${isRightPanelCollapsed ? 'Show' : 'Hide'} editor (⌘E)`}
        >
          <VscLayoutSidebarRight />
        </button>
      </div>
    </div>
  )
})
