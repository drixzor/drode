import React, { useState, useCallback } from 'react'
import { VscRefresh, VscArrowLeft, VscArrowRight } from 'react-icons/vsc'

interface Props {
  url: string
  onUrlChange: (url: string) => void
  onRefresh: () => void
}

export function PreviewToolbar({ url, onUrlChange, onRefresh }: Props) {
  const [inputUrl, setInputUrl] = useState(url)

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    let finalUrl = inputUrl.trim()
    if (finalUrl && !finalUrl.startsWith('http')) {
      finalUrl = `http://${finalUrl}`
    }
    onUrlChange(finalUrl)
  }, [inputUrl, onUrlChange])

  return (
    <div className="flex items-center gap-1.5 px-2 py-1 bg-claude-surface border-b border-claude-border">
      <button
        onClick={onRefresh}
        className="p-1 hover:bg-claude-surface-hover rounded transition-colors"
        title="Refresh"
      >
        <VscRefresh className="w-3.5 h-3.5 text-claude-text-secondary" />
      </button>

      <form onSubmit={handleSubmit} className="flex-1">
        <input
          type="text"
          value={inputUrl}
          onChange={(e) => setInputUrl(e.target.value)}
          className="w-full px-2 py-1 text-xs bg-claude-bg border border-claude-border rounded text-claude-text placeholder:text-claude-text-secondary/50 outline-none focus:border-claude-accent"
          placeholder="http://localhost:3000"
        />
      </form>
    </div>
  )
}
