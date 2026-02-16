import React, { useState } from 'react'
import { VscClose, VscGitPullRequest } from 'react-icons/vsc'
import { useGithubStore } from '../../stores/githubStore'

interface Props {
  onClose: () => void
}

export function GitHubPRDialog({ onClose }: Props) {
  const branches = useGithubStore((s) => s.branches)
  const currentBranch = useGithubStore((s) => s.currentBranch)
  const selectedRepo = useGithubStore((s) => s.selectedRepo)
  const createPullRequest = useGithubStore((s) => s.createPullRequest)

  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [head, setHead] = useState(currentBranch)
  const [base, setBase] = useState(selectedRepo?.default_branch || 'main')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!title.trim()) return
    setIsSubmitting(true)
    const pr = await createPullRequest(title.trim(), body.trim(), head, base)
    setIsSubmitting(false)
    if (pr) onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-claude-surface border border-claude-border rounded-lg shadow-xl w-[480px] p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="flex items-center gap-2 text-sm font-medium text-claude-text">
            <VscGitPullRequest className="w-4 h-4 text-claude-accent" />
            Create Pull Request
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-claude-surface-hover rounded">
            <VscClose className="w-4 h-4 text-claude-text-secondary" />
          </button>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs text-claude-text-secondary">
            <select
              value={head}
              onChange={(e) => setHead(e.target.value)}
              className="px-2 py-1 bg-claude-bg border border-claude-border rounded text-claude-text"
            >
              {branches.map((b) => (
                <option key={b.name} value={b.name}>{b.name}</option>
              ))}
            </select>
            <span>into</span>
            <select
              value={base}
              onChange={(e) => setBase(e.target.value)}
              className="px-2 py-1 bg-claude-bg border border-claude-border rounded text-claude-text"
            >
              {branches.map((b) => (
                <option key={b.name} value={b.name}>{b.name}</option>
              ))}
            </select>
          </div>

          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="PR title..."
            className="w-full px-3 py-2 text-sm bg-claude-bg border border-claude-border rounded text-claude-text placeholder:text-claude-text-secondary/50 outline-none focus:border-claude-accent"
            autoFocus
          />

          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Description (optional)..."
            className="w-full px-3 py-2 text-sm bg-claude-bg border border-claude-border rounded resize-none h-24 text-claude-text placeholder:text-claude-text-secondary/50 outline-none focus:border-claude-accent"
          />

          <div className="flex justify-end gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-sm text-claude-text-secondary hover:text-claude-text rounded border border-claude-border hover:bg-claude-surface-hover transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!title.trim() || isSubmitting}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-claude-success text-white rounded hover:bg-claude-success/80 transition-colors disabled:opacity-50"
            >
              <VscGitPullRequest className="w-3.5 h-3.5" />
              {isSubmitting ? 'Creating...' : 'Create PR'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
