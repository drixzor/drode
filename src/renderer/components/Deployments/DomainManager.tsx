import React, { useState } from 'react'
import { VscGlobe, VscCheck, VscClose, VscAdd, VscTrash } from 'react-icons/vsc'
import { useVercelStore } from '../../stores/vercelStore'

export function DomainManager() {
  const domains = useVercelStore((s) => s.domains)
  const addDomain = useVercelStore((s) => s.addDomain)
  const removeDomain = useVercelStore((s) => s.removeDomain)
  const [newDomain, setNewDomain] = useState('')
  const [isAdding, setIsAdding] = useState(false)

  const handleAdd = async () => {
    if (!newDomain.trim()) return
    setIsAdding(true)
    await addDomain(newDomain.trim())
    setNewDomain('')
    setIsAdding(false)
  }

  return (
    <div className="p-4 space-y-3">
      <h3 className="flex items-center gap-2 text-sm font-medium text-claude-text">
        <VscGlobe className="w-4 h-4 text-claude-accent" />
        Domains
      </h3>

      {/* Add domain */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={newDomain}
          onChange={(e) => setNewDomain(e.target.value)}
          placeholder="example.com"
          className="flex-1 px-2 py-1 text-sm bg-claude-bg border border-claude-border rounded text-claude-text placeholder:text-claude-text-secondary/50 outline-none focus:border-claude-accent"
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        />
        <button
          onClick={handleAdd}
          disabled={!newDomain.trim() || isAdding}
          className="flex items-center gap-1 px-2 py-1 text-xs bg-claude-accent text-white rounded hover:bg-claude-accent-hover transition-colors disabled:opacity-50"
        >
          <VscAdd className="w-3 h-3" />
          Add
        </button>
      </div>

      {/* Domain list */}
      <div className="space-y-1">
        {domains.map((domain) => (
          <div
            key={domain.name}
            className="flex items-center gap-2 px-2 py-1.5 bg-claude-bg rounded border border-claude-border/50 group"
          >
            <VscGlobe className="w-3.5 h-3.5 text-claude-text-secondary flex-shrink-0" />
            <span className="text-sm text-claude-text flex-1">{domain.name}</span>
            {domain.verified ? (
              <VscCheck className="w-3.5 h-3.5 text-claude-success flex-shrink-0" />
            ) : (
              <span className="text-xs text-claude-warning">Pending</span>
            )}
            <button
              onClick={() => removeDomain(domain.name)}
              className="p-0.5 hover:bg-claude-error/20 rounded opacity-0 group-hover:opacity-100 transition-opacity"
              title="Remove domain"
            >
              <VscTrash className="w-3 h-3 text-claude-error" />
            </button>
          </div>
        ))}
        {domains.length === 0 && (
          <div className="text-xs text-claude-text-secondary text-center py-2">
            No domains configured
          </div>
        )}
      </div>
    </div>
  )
}
