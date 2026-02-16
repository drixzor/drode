import React from 'react'
import { VscPlay } from 'react-icons/vsc'
import { useSupabaseStore } from '../../stores/supabaseStore'

export function QueryEditor() {
  const sqlQuery = useSupabaseStore((s) => s.sqlQuery)
  const setSqlQuery = useSupabaseStore((s) => s.setSqlQuery)
  const runSql = useSupabaseStore((s) => s.runSql)
  const isLoading = useSupabaseStore((s) => s.isLoading)

  const handleRun = () => {
    if (sqlQuery.trim()) {
      runSql(sqlQuery.trim())
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      handleRun()
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-claude-border bg-claude-surface">
        <span className="text-xs font-medium text-claude-text-secondary">SQL Query</span>
        <button
          onClick={handleRun}
          disabled={!sqlQuery.trim() || isLoading}
          className="flex items-center gap-1 px-2 py-1 text-xs bg-claude-accent text-white rounded hover:bg-claude-accent-hover transition-colors disabled:opacity-50"
        >
          <VscPlay className="w-3 h-3" />
          Run
        </button>
      </div>
      <textarea
        value={sqlQuery}
        onChange={(e) => setSqlQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        className="flex-1 px-3 py-2 bg-claude-bg text-claude-text font-mono text-sm resize-none outline-none placeholder:text-claude-text-secondary/50"
        placeholder="SELECT * FROM users LIMIT 10;"
        spellCheck={false}
      />
    </div>
  )
}
