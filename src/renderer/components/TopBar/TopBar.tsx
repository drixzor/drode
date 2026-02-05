import React, { useState, useRef, useEffect } from 'react'
import { VscFolderOpened, VscChevronDown, VscSettingsGear, VscClose, VscCircleFilled } from 'react-icons/vsc'

interface TopBarProps {
  currentProject: string | null
  recentProjects: string[]
  onProjectChange: (projectPath: string) => void
  onOpenProject: () => void
  onRemoveProject: (projectPath: string) => void
  getProjectName: (projectPath: string) => string
  claudeStatus: 'running' | 'stopped' | 'error' | 'starting'
  onStartClaude: () => void
  onStopClaude: () => void
}

export function TopBar({
  currentProject,
  recentProjects,
  onProjectChange,
  onOpenProject,
  onRemoveProject,
  getProjectName,
  claudeStatus,
  onStartClaude,
  onStopClaude
}: TopBarProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const getStatusColor = () => {
    switch (claudeStatus) {
      case 'running':
        return 'text-claude-success'
      case 'starting':
        return 'text-claude-warning animate-pulse'
      case 'error':
        return 'text-claude-error'
      default:
        return 'text-claude-text-secondary'
    }
  }

  const getStatusText = () => {
    switch (claudeStatus) {
      case 'running':
        return 'Connected'
      case 'starting':
        return 'Connecting...'
      case 'error':
        return 'Error'
      default:
        return 'Disconnected'
    }
  }

  return (
    <div className="h-12 bg-claude-surface border-b border-claude-border flex items-center px-4 drag-region">
      {/* App Title */}
      <div className="flex items-center gap-2 no-drag">
        <span className="text-lg font-semibold text-claude-text">Drode</span>
        <span className="text-xs text-claude-text-secondary">Claude Code GUI</span>
      </div>

      {/* Project Switcher */}
      <div className="ml-8 relative no-drag" ref={dropdownRef}>
        <button
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-claude-bg hover:bg-claude-surface-hover transition-colors"
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        >
          <VscFolderOpened className="text-claude-accent" />
          <span className="text-sm text-claude-text max-w-[200px] truncate">
            {currentProject ? getProjectName(currentProject) : 'No project selected'}
          </span>
          <VscChevronDown className={`text-claude-text-secondary transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
        </button>

        {isDropdownOpen && (
          <div className="absolute top-full left-0 mt-1 w-80 bg-claude-surface border border-claude-border rounded-lg shadow-xl z-50 py-1">
            {/* Open Project Button */}
            <button
              className="w-full px-3 py-2 text-left text-sm hover:bg-claude-surface-hover flex items-center gap-2 border-b border-claude-border"
              onClick={() => {
                onOpenProject()
                setIsDropdownOpen(false)
              }}
            >
              <VscFolderOpened className="text-claude-accent" />
              <span>Open Project...</span>
            </button>

            {/* Recent Projects */}
            {recentProjects.length > 0 && (
              <div className="py-1">
                <div className="px-3 py-1 text-xs text-claude-text-secondary uppercase tracking-wider">
                  Recent Projects
                </div>
                {recentProjects.map((projectPath) => (
                  <div
                    key={projectPath}
                    className={`flex items-center gap-2 px-3 py-1.5 hover:bg-claude-surface-hover cursor-pointer group ${
                      projectPath === currentProject ? 'bg-claude-surface-hover' : ''
                    }`}
                  >
                    <div
                      className="flex-1 min-w-0"
                      onClick={() => {
                        onProjectChange(projectPath)
                        setIsDropdownOpen(false)
                      }}
                    >
                      <div className="text-sm text-claude-text truncate">
                        {getProjectName(projectPath)}
                      </div>
                      <div className="text-xs text-claude-text-secondary truncate">
                        {projectPath}
                      </div>
                    </div>
                    <button
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-claude-bg rounded transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation()
                        onRemoveProject(projectPath)
                      }}
                    >
                      <VscClose className="text-claude-text-secondary" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {recentProjects.length === 0 && (
              <div className="px-3 py-4 text-sm text-claude-text-secondary text-center">
                No recent projects
              </div>
            )}
          </div>
        )}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Claude Status */}
      <div className="flex items-center gap-4 no-drag">
        <div className="flex items-center gap-2">
          <VscCircleFilled className={`text-xs ${getStatusColor()}`} />
          <span className="text-sm text-claude-text-secondary">{getStatusText()}</span>
        </div>

        {claudeStatus === 'stopped' || claudeStatus === 'error' ? (
          <button
            className="px-3 py-1 text-sm bg-claude-accent hover:bg-claude-accent-hover text-white rounded-lg transition-colors"
            onClick={onStartClaude}
            disabled={!currentProject}
          >
            Connect
          </button>
        ) : claudeStatus === 'running' ? (
          <button
            className="px-3 py-1 text-sm bg-claude-bg hover:bg-claude-surface-hover text-claude-text rounded-lg border border-claude-border transition-colors"
            onClick={onStopClaude}
          >
            Disconnect
          </button>
        ) : null}

        {/* Settings */}
        <button className="p-2 hover:bg-claude-surface-hover rounded-lg transition-colors">
          <VscSettingsGear className="text-claude-text-secondary" />
        </button>
      </div>
    </div>
  )
}
