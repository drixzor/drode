import React from 'react'
import { useSupabaseStore } from '../../stores/supabaseStore'

export function QueryResults() {
  const sqlResult = useSupabaseStore((s) => s.sqlResult)

  if (!sqlResult) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-claude-text-secondary">
        Run a query to see results
      </div>
    )
  }

  if (sqlResult.rows.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-claude-text-secondary">
        Query returned no results ({sqlResult.row_count} rows affected)
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-3 py-1 border-b border-claude-border bg-claude-surface text-xs text-claude-text-secondary">
        {sqlResult.row_count} row{sqlResult.row_count !== 1 ? 's' : ''}
      </div>
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 z-10">
            <tr className="bg-claude-surface">
              {sqlResult.columns.map((col) => (
                <th
                  key={col}
                  className="px-3 py-1.5 text-left text-xs font-medium text-claude-text-secondary border-b border-r border-claude-border whitespace-nowrap"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sqlResult.rows.map((row, i) => (
              <tr key={i} className="hover:bg-claude-surface-hover/50">
                {sqlResult.columns.map((col) => (
                  <td
                    key={col}
                    className="px-3 py-1 text-claude-text border-b border-r border-claude-border/50 max-w-[200px] truncate font-mono text-xs"
                    title={String(row[col] ?? '')}
                  >
                    {row[col] === null ? (
                      <span className="text-claude-text-secondary/40 italic">null</span>
                    ) : typeof row[col] === 'object' ? (
                      JSON.stringify(row[col])
                    ) : (
                      String(row[col])
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
