import React, { useState } from 'react'
import { VscClose, VscCheck } from 'react-icons/vsc'

interface Props {
  filePath: string
  onCommit: (message: string) => void
  onCancel: () => void
}

export function GitHubCommitDialog({ filePath, onCommit, onCancel }: Props) {
  const [message, setMessage] = useState(`Update ${filePath.split('/').pop()}`)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-claude-surface border border-claude-border rounded-lg shadow-xl w-96 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-claude-text">Commit Changes</h3>
          <button onClick={onCancel} className="p-1 hover:bg-claude-surface-hover rounded">
            <VscClose className="w-4 h-4 text-claude-text-secondary" />
          </button>
        </div>

        <div className="text-xs text-claude-text-secondary mb-2">
          File: <span className="text-claude-text">{filePath}</span>
        </div>

        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="w-full px-3 py-2 text-sm bg-claude-bg border border-claude-border rounded resize-none h-20 text-claude-text placeholder:text-claude-text-secondary/50 outline-none focus:border-claude-accent"
          placeholder="Commit message..."
          autoFocus
        />

        <div className="flex justify-end gap-2 mt-3">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-sm text-claude-text-secondary hover:text-claude-text rounded border border-claude-border hover:bg-claude-surface-hover transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => message.trim() && onCommit(message.trim())}
            disabled={!message.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-claude-accent text-white rounded hover:bg-claude-accent-hover transition-colors disabled:opacity-50"
          >
            <VscCheck className="w-3.5 h-3.5" />
            Commit
          </button>
        </div>
      </div>
    </div>
  )
}
