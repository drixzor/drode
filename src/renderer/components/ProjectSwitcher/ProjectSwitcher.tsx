import React, { useState, useRef, useEffect } from 'react'
import { VscFolderOpened, VscChevronDown, VscClose, VscAdd } from 'react-icons/vsc'

interface ProjectSwitcherProps {
  currentProject: string | null
  recentProjects: string[]
  onProjectChange: (projectPath: string) => void
  onOpenProject: () => void
  onRemoveProject: (projectPath: string) => void
  getProjectName: (projectPath: string) => string
}

export function ProjectSwitcher({
  currentProject,
  recentProjects,
  onProjectChange,
  onOpenProject,
  onRemoveProject,
  getProjectName
}: ProjectSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-claude-bg hover:bg-claude-surface-hover transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <VscFolderOpened className="text-claude-accent" />
        <span className="text-sm text-claude-text max-w-[200px] truncate">
          {currentProject ? getProjectName(currentProject) : 'No project selected'}
        </span>
        <VscChevronDown className={`text-claude-text-secondary transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-80 bg-claude-surface border border-claude-border rounded-lg shadow-xl z-50 py-1">
          {/* Open Project Button */}
          <button
            className="w-full px-3 py-2 text-left text-sm hover:bg-claude-surface-hover flex items-center gap-2 border-b border-claude-border"
            onClick={() => {
              onOpenProject()
              setIsOpen(false)
            }}
          >
            <VscAdd className="text-claude-accent" />
            <span>Open Project...</span>
          </button>

          {/* Recent Projects */}
          {recentProjects.length > 0 && (
            <div className="py-1 max-h-80 overflow-auto">
              <div className="px-3 py-1 text-xs text-claude-text-secondary uppercase tracking-wider sticky top-0 bg-claude-surface">
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
                      setIsOpen(false)
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
                    title="Remove from recent"
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
  )
}
