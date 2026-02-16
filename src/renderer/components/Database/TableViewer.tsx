import React from 'react'
import { VscChevronLeft, VscChevronRight, VscTrash, VscLoading } from 'react-icons/vsc'
import { useSupabaseStore } from '../../stores/supabaseStore'

export function TableViewer() {
  const tableData = useSupabaseStore((s) => s.tableData)
  const selectedTable = useSupabaseStore((s) => s.selectedTable)
  const page = useSupabaseStore((s) => s.page)
  const pageSize = useSupabaseStore((s) => s.pageSize)
  const isLoading = useSupabaseStore((s) => s.isLoading)
  const loadTableData = useSupabaseStore((s) => s.loadTableData)
  const deleteRow = useSupabaseStore((s) => s.deleteRow)

  if (!selectedTable) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-claude-text-secondary">
        Select a table to view data
      </div>
    )
  }

  if (isLoading && !tableData) {
    return (
      <div className="flex items-center justify-center h-full">
        <VscLoading className="w-5 h-5 text-claude-accent animate-spin" />
      </div>
    )
  }

  if (!tableData || tableData.rows.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-claude-text-secondary">
        No data in {selectedTable}
      </div>
    )
  }

  const totalPages = tableData.total_count
    ? Math.ceil(tableData.total_count / pageSize)
    : 1

  return (
    <div className="h-full flex flex-col">
      {/* Data Grid */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 z-10">
            <tr className="bg-claude-surface">
              {tableData.columns.map((col) => (
                <th
                  key={col}
                  className="px-3 py-1.5 text-left text-xs font-medium text-claude-text-secondary border-b border-r border-claude-border whitespace-nowrap"
                >
                  {col}
                </th>
              ))}
              <th className="px-2 py-1.5 text-left text-xs font-medium text-claude-text-secondary border-b border-claude-border w-8" />
            </tr>
          </thead>
          <tbody>
            {tableData.rows.map((row, i) => (
              <tr key={i} className="hover:bg-claude-surface-hover/50 group">
                {tableData.columns.map((col) => (
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
                <td className="px-1 py-1 border-b border-claude-border/50 w-8">
                  <button
                    onClick={() => {
                      const id = row.id ?? row.uid ?? row._id
                      if (id != null) deleteRow(String(id))
                    }}
                    className="p-0.5 hover:bg-claude-error/20 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Delete row"
                  >
                    <VscTrash className="w-3 h-3 text-claude-error" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-3 py-1.5 border-t border-claude-border bg-claude-surface flex-shrink-0">
        <span className="text-xs text-claude-text-secondary">
          {tableData.total_count != null
            ? `${page * pageSize + 1}-${Math.min((page + 1) * pageSize, tableData.total_count)} of ${tableData.total_count}`
            : `Page ${page + 1}`}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => loadTableData(page - 1)}
            disabled={page === 0}
            className="p-1 hover:bg-claude-surface-hover rounded disabled:opacity-30"
          >
            <VscChevronLeft className="w-4 h-4 text-claude-text-secondary" />
          </button>
          <button
            onClick={() => loadTableData(page + 1)}
            disabled={page >= totalPages - 1}
            className="p-1 hover:bg-claude-surface-hover rounded disabled:opacity-30"
          >
            <VscChevronRight className="w-4 h-4 text-claude-text-secondary" />
          </button>
        </div>
      </div>
    </div>
  )
}
