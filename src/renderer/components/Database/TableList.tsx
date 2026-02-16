import React from 'react'
import { VscTable, VscDatabase } from 'react-icons/vsc'
import { useSupabaseStore } from '../../stores/supabaseStore'

export function TableList() {
  const tables = useSupabaseStore((s) => s.tables)
  const selectedTable = useSupabaseStore((s) => s.selectedTable)
  const selectTable = useSupabaseStore((s) => s.selectTable)

  return (
    <div className="w-48 border-r border-claude-border flex flex-col flex-shrink-0">
      <div className="px-3 py-2 border-b border-claude-border">
        <div className="flex items-center gap-1.5 text-xs font-medium text-claude-text-secondary uppercase tracking-wider">
          <VscDatabase className="w-3.5 h-3.5" />
          Tables
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {tables.map((table) => (
          <button
            key={table.name}
            onClick={() => selectTable(table.name)}
            className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-claude-surface-hover text-left ${
              selectedTable === table.name
                ? 'bg-claude-surface-hover text-claude-accent'
                : 'text-claude-text'
            }`}
          >
            <VscTable className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">{table.name}</span>
            <span className="ml-auto text-xs text-claude-text-secondary/50">
              {table.columns.length}col
            </span>
          </button>
        ))}
        {tables.length === 0 && (
          <div className="px-3 py-4 text-xs text-claude-text-secondary text-center">
            No tables found
          </div>
        )}
      </div>
    </div>
  )
}
