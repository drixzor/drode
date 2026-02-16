import React, { useEffect, useState, useRef } from 'react'
import { VscRepo, VscLock, VscChevronDown } from 'react-icons/vsc'
import { useGithubStore, GithubRepo } from '../../stores/githubStore'

export function GitHubRepoSelector() {
  const repos = useGithubStore((s) => s.repos)
  const selectedRepo = useGithubStore((s) => s.selectedRepo)
  const loadRepos = useGithubStore((s) => s.loadRepos)
  const selectRepo = useGithubStore((s) => s.selectRepo)
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (repos.length === 0) loadRepos()
  }, [repos.length, loadRepos])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filtered = search
    ? repos.filter((r) => r.full_name.toLowerCase().includes(search.toLowerCase()))
    : repos

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 px-2 py-1.5 text-sm bg-claude-bg border border-claude-border rounded hover:border-claude-accent/50 transition-colors"
      >
        <VscRepo className="w-4 h-4 text-claude-accent flex-shrink-0" />
        <span className="truncate text-claude-text">
          {selectedRepo ? selectedRepo.full_name : 'Select repository...'}
        </span>
        <VscChevronDown className={`w-3.5 h-3.5 text-claude-text-secondary ml-auto transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-claude-surface border border-claude-border rounded-lg shadow-xl z-50 max-h-64 flex flex-col">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search repos..."
            className="px-2 py-1.5 text-sm bg-transparent border-b border-claude-border outline-none text-claude-text placeholder:text-claude-text-secondary/50"
            autoFocus
          />
          <div className="overflow-y-auto flex-1">
            {filtered.map((repo) => (
              <button
                key={repo.id}
                onClick={() => {
                  selectRepo(repo)
                  setIsOpen(false)
                  setSearch('')
                }}
                className={`w-full flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-claude-surface-hover text-left ${
                  selectedRepo?.id === repo.id ? 'bg-claude-surface-hover' : ''
                }`}
              >
                {repo.private ? (
                  <VscLock className="w-3.5 h-3.5 text-claude-warning flex-shrink-0" />
                ) : (
                  <VscRepo className="w-3.5 h-3.5 text-claude-text-secondary flex-shrink-0" />
                )}
                <div className="min-w-0">
                  <div className="text-claude-text truncate">{repo.full_name}</div>
                  {repo.description && (
                    <div className="text-xs text-claude-text-secondary truncate">{repo.description}</div>
                  )}
                </div>
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="px-2 py-3 text-sm text-claude-text-secondary text-center">
                No repositories found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
