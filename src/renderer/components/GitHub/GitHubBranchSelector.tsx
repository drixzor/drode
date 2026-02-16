import React, { useState, useRef, useEffect } from 'react'
import { VscRepoForked, VscChevronDown } from 'react-icons/vsc'
import { useGithubStore } from '../../stores/githubStore'

export function GitHubBranchSelector() {
  const branches = useGithubStore((s) => s.branches)
  const currentBranch = useGithubStore((s) => s.currentBranch)
  const switchBranch = useGithubStore((s) => s.switchBranch)
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2 py-1 text-xs bg-claude-bg border border-claude-border rounded hover:border-claude-accent/50 transition-colors"
      >
        <VscRepoForked className="w-3.5 h-3.5 text-claude-accent" />
        <span className="text-claude-text truncate max-w-[120px]">{currentBranch}</span>
        <VscChevronDown className={`w-3 h-3 text-claude-text-secondary transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-48 bg-claude-surface border border-claude-border rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto">
          {branches.map((branch) => (
            <button
              key={branch.name}
              onClick={() => {
                switchBranch(branch.name)
                setIsOpen(false)
              }}
              className={`w-full flex items-center gap-1.5 px-2 py-1.5 text-xs hover:bg-claude-surface-hover text-left ${
                branch.name === currentBranch ? 'bg-claude-surface-hover text-claude-accent' : 'text-claude-text'
              }`}
            >
              <VscRepoForked className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{branch.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
