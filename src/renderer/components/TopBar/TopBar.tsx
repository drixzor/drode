import React, { useState, useRef, useEffect } from 'react'
import { VscFolderOpened, VscChevronDown, VscSettingsGear, VscClose, VscCircleFilled, VscShield, VscGithub } from 'react-icons/vsc'
import DrodeLogo from '../../assets/drode-logo.svg'
import { useProjectStore } from '../../stores/projectStore'
import { useConversationStore } from '../../stores/conversationStore'
import { useAuthStore } from '../../stores/authStore'

interface TopBarProps {
  onProjectChange: (projectPath: string) => void
  onOpenProject: () => void
}

export function TopBar({ onProjectChange, onOpenProject }: TopBarProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [dangerousMode, setDangerousMode] = useState(false)
  const [showDangerousTooltip, setShowDangerousTooltip] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const currentProject = useProjectStore((s) => s.currentProject)
  const recentProjects = useProjectStore((s) => s.recentProjects)
  const getProjectName = useProjectStore((s) => s.getProjectName)
  const removeRecentProject = useProjectStore((s) => s.removeRecentProject)
  const claudeStatus = useConversationStore((s) => s.status)
  const startClaude = useConversationStore((s) => s.startClaude)
  const stopClaude = useConversationStore((s) => s.stopClaude)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Load dangerous mode setting on mount
  useEffect(() => {
    window.electronAPI.getDangerousMode().then(setDangerousMode)
  }, [])

  const toggleDangerousMode = async () => {
    const newValue = !dangerousMode
    const result = await window.electronAPI.setDangerousMode(newValue)
    if (result.success) {
      setDangerousMode(newValue)
    }
  }

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
      {/* App Logo */}
      <div className="flex items-center no-drag">
        <img src={DrodeLogo} alt="Drode" className="h-6" />
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
                        removeRecentProject(projectPath)
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

      {/* Auth Status Indicators */}
      <AuthIndicators />

      {/* Claude Status */}
      <div className="flex items-center gap-4 no-drag">
        <div className="flex items-center gap-2">
          <VscCircleFilled className={`text-xs ${getStatusColor()}`} />
          <span className="text-sm text-claude-text-secondary">{getStatusText()}</span>
        </div>

        {claudeStatus === 'stopped' || claudeStatus === 'error' ? (
          <button
            className="px-3 py-1 text-sm bg-claude-accent hover:bg-claude-accent-hover text-white rounded-lg transition-colors"
            onClick={startClaude}
            disabled={!currentProject}
          >
            Connect
          </button>
        ) : claudeStatus === 'running' ? (
          <button
            className="px-3 py-1 text-sm bg-claude-bg hover:bg-claude-surface-hover text-claude-text rounded-lg border border-claude-border transition-colors"
            onClick={stopClaude}
          >
            Disconnect
          </button>
        ) : null}

        {/* Dangerous Mode Toggle */}
        <div className="relative">
          <button
            className={`p-2 rounded-lg transition-colors ${
              dangerousMode
                ? 'bg-claude-error/20 hover:bg-claude-error/30'
                : 'hover:bg-claude-surface-hover'
            }`}
            onClick={toggleDangerousMode}
            onMouseEnter={() => setShowDangerousTooltip(true)}
            onMouseLeave={() => setShowDangerousTooltip(false)}
            title={dangerousMode ? 'Dangerous Mode: ON (tools auto-execute)' : 'Safe Mode: ON (tools need approval)'}
          >
            <VscShield className={dangerousMode ? 'text-claude-error' : 'text-claude-success'} />
          </button>
          {showDangerousTooltip && (
            <div className="absolute top-full right-0 mt-2 w-64 p-3 bg-claude-surface border border-claude-border rounded-lg shadow-xl z-50 text-xs">
              <div className={`font-semibold mb-1 ${dangerousMode ? 'text-claude-error' : 'text-claude-success'}`}>
                {dangerousMode ? 'Dangerous Mode' : 'Safe Mode'}
              </div>
              <div className="text-claude-text-secondary">
                {dangerousMode
                  ? 'Tools execute automatically without approval. Claude can read/write files and run commands freely.'
                  : 'Claude Code will prompt for approval before executing tools. Recommended for untrusted projects.'}
              </div>
              <div className="mt-2 text-claude-text-secondary opacity-70">
                Click to toggle
              </div>
            </div>
          )}
        </div>

        {/* Settings */}
        <button className="p-2 hover:bg-claude-surface-hover rounded-lg transition-colors">
          <VscSettingsGear className="text-claude-text-secondary" />
        </button>
      </div>
    </div>
  )
}

function AuthIndicators() {
  const github = useAuthStore((s) => s.github)
  const supabase = useAuthStore((s) => s.supabase)
  const vercel = useAuthStore((s) => s.vercel)

  return (
    <div className="flex items-center gap-1.5 mr-3 no-drag">
      <div
        className={`w-2 h-2 rounded-full ${github.connected ? 'bg-claude-success' : 'bg-claude-text-secondary/30'}`}
        title={`GitHub: ${github.connected ? github.username || 'Connected' : 'Not connected'}`}
      />
      <div
        className={`w-2 h-2 rounded-full ${supabase.connected ? 'bg-claude-success' : 'bg-claude-text-secondary/30'}`}
        title={`Supabase: ${supabase.connected ? 'Connected' : 'Not connected'}`}
      />
      <div
        className={`w-2 h-2 rounded-full ${vercel.connected ? 'bg-claude-success' : 'bg-claude-text-secondary/30'}`}
        title={`Vercel: ${vercel.connected ? vercel.username || 'Connected' : 'Not connected'}`}
      />
    </div>
  )
}
