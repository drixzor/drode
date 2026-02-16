import React, { useState } from 'react'
import {
  VscFile,
  VscFolder,
  VscArrowLeft,
  VscGitPullRequest,
  VscAdd,
  VscLoading,
} from 'react-icons/vsc'
import { useGithubStore } from '../../stores/githubStore'
import { useEditorStore } from '../../stores/editorStore'
import { useAuthStore } from '../../stores/authStore'
import { GitHubRepoSelector } from './GitHubRepoSelector'
import { GitHubBranchSelector } from './GitHubBranchSelector'
import { GitHubPRDialog } from './GitHubPRDialog'

interface Props {
  onFileSelect?: (filePath: string) => void
}

export function GitHubExplorer({ onFileSelect }: Props) {
  const githubConnected = useAuthStore((s) => s.github.connected)
  const connect = useAuthStore((s) => s.connect)
  const selectedRepo = useGithubStore((s) => s.selectedRepo)
  const tree = useGithubStore((s) => s.tree)
  const treePath = useGithubStore((s) => s.treePath)
  const isLoading = useGithubStore((s) => s.isLoading)
  const loadTree = useGithubStore((s) => s.loadTree)
  const readFile = useGithubStore((s) => s.readFile)
  const currentBranch = useGithubStore((s) => s.currentBranch)
  const [showPRDialog, setShowPRDialog] = useState(false)

  if (!githubConnected) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-4 text-center">
        <p className="text-sm text-claude-text-secondary mb-3">
          Connect your GitHub account to browse repositories
        </p>
        <button
          onClick={() => connect('github')}
          className="px-4 py-2 text-sm bg-claude-accent text-white rounded-lg hover:bg-claude-accent-hover transition-colors"
        >
          Connect GitHub
        </button>
      </div>
    )
  }

  const handleFileClick = async (entry: { name: string; path: string; type: string; sha: string }) => {
    if (entry.type === 'dir') {
      loadTree(entry.path)
    } else {
      // Open file in editor
      const content = await readFile(entry.path)
      if (content && selectedRepo) {
        const tabPath = `github://${selectedRepo.full_name}/${entry.path}`
        useEditorStore.getState().openTab(tabPath, content.content)

        // Store github metadata on the tab
        const tabs = useEditorStore.getState().tabs
        const tab = tabs.find((t) => t.filePath === tabPath)
        if (tab) {
          // We extend EditorTab with optional metadata
          ;(tab as any).source = 'github'
          ;(tab as any).githubMeta = {
            owner: selectedRepo.full_name.split('/')[0],
            repo: selectedRepo.name,
            branch: currentBranch,
            sha: content.sha,
          }
        }
      }
    }
  }

  const handleBack = () => {
    const parts = treePath.split('/')
    parts.pop()
    loadTree(parts.join('/'))
  }

  // Sort: dirs first, then files
  const sortedTree = [...tree].sort((a, b) => {
    if (a.type === 'dir' && b.type !== 'dir') return -1
    if (a.type !== 'dir' && b.type === 'dir') return 1
    return a.name.localeCompare(b.name)
  })

  return (
    <div className="h-full flex flex-col">
      {/* Repo Selector */}
      <div className="px-2 py-2 border-b border-claude-border flex-shrink-0 space-y-2">
        <GitHubRepoSelector />
        {selectedRepo && (
          <div className="flex items-center gap-2">
            <GitHubBranchSelector />
            <div className="flex-1" />
            <button
              onClick={() => setShowPRDialog(true)}
              className="p-1 hover:bg-claude-surface-hover rounded transition-colors"
              title="Create Pull Request"
            >
              <VscGitPullRequest className="w-3.5 h-3.5 text-claude-text-secondary" />
            </button>
          </div>
        )}
      </div>

      {/* Tree View */}
      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <VscLoading className="w-5 h-5 text-claude-accent animate-spin" />
          </div>
        )}

        {!isLoading && selectedRepo && (
          <>
            {/* Back button when in subdirectory */}
            {treePath && (
              <button
                onClick={handleBack}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-claude-surface-hover text-claude-text-secondary"
              >
                <VscArrowLeft className="w-3.5 h-3.5" />
                <span>..</span>
              </button>
            )}

            {/* Path breadcrumb */}
            {treePath && (
              <div className="px-3 py-1 text-xs text-claude-text-secondary border-b border-claude-border/50">
                {selectedRepo.name}/{treePath}
              </div>
            )}

            {sortedTree.map((entry) => (
              <button
                key={entry.sha}
                onClick={() => handleFileClick(entry)}
                className="w-full flex items-center gap-2 px-3 py-1 text-sm hover:bg-claude-surface-hover text-left"
              >
                {entry.type === 'dir' ? (
                  <VscFolder className="w-4 h-4 text-claude-accent flex-shrink-0" />
                ) : (
                  <VscFile className="w-4 h-4 text-claude-text-secondary flex-shrink-0" />
                )}
                <span className="text-claude-text truncate">{entry.name}</span>
                {entry.size != null && entry.type !== 'dir' && (
                  <span className="ml-auto text-xs text-claude-text-secondary/50">
                    {entry.size > 1024
                      ? `${(entry.size / 1024).toFixed(1)}KB`
                      : `${entry.size}B`}
                  </span>
                )}
              </button>
            ))}

            {sortedTree.length === 0 && !isLoading && (
              <div className="px-3 py-4 text-sm text-claude-text-secondary text-center">
                Empty directory
              </div>
            )}
          </>
        )}

        {!selectedRepo && !isLoading && (
          <div className="px-3 py-8 text-sm text-claude-text-secondary text-center">
            Select a repository to browse
          </div>
        )}
      </div>

      {showPRDialog && <GitHubPRDialog onClose={() => setShowPRDialog(false)} />}
    </div>
  )
}
