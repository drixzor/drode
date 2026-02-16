import React, { useState } from 'react'
import { VscClose, VscCheck, VscAdd } from 'react-icons/vsc'
import { useSupabaseStore, SupabaseColumn } from '../../stores/supabaseStore'

interface Props {
  columns: SupabaseColumn[]
  onClose: () => void
  initialData?: Record<string, any>
  mode: 'insert' | 'edit'
}

export function RowEditor({ columns, onClose, initialData, mode }: Props) {
  const [data, setData] = useState<Record<string, string>>(
    initialData
      ? Object.fromEntries(
          columns.map((col) => [col.name, String(initialData[col.name] ?? '')])
        )
      : Object.fromEntries(columns.map((col) => [col.name, col.default_value ?? '']))
  )
  const insertRow = useSupabaseStore((s) => s.insertRow)
  const updateRow = useSupabaseStore((s) => s.updateRow)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async () => {
    setIsSubmitting(true)
    const cleanData: Record<string, any> = {}
    for (const [key, value] of Object.entries(data)) {
      if (value !== '') cleanData[key] = value
    }

    if (mode === 'insert') {
      await insertRow(cleanData)
    } else if (initialData?.id != null) {
      await updateRow(String(initialData.id), cleanData)
    }
    setIsSubmitting(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-claude-surface border border-claude-border rounded-lg shadow-xl w-[480px] max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-claude-border">
          <h3 className="text-sm font-medium text-claude-text">
            {mode === 'insert' ? 'Insert Row' : 'Edit Row'}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-claude-surface-hover rounded">
            <VscClose className="w-4 h-4 text-claude-text-secondary" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {columns.map((col) => (
            <div key={col.name}>
              <label className="block text-xs text-claude-text-secondary mb-1">
                {col.name}
                <span className="ml-1 text-claude-text-secondary/50">({col.data_type})</span>
                {!col.is_nullable && <span className="ml-1 text-claude-error">*</span>}
              </label>
              <input
                type="text"
                value={data[col.name] || ''}
                onChange={(e) => setData({ ...data, [col.name]: e.target.value })}
                className="w-full px-2 py-1.5 text-sm bg-claude-bg border border-claude-border rounded text-claude-text placeholder:text-claude-text-secondary/50 outline-none focus:border-claude-accent font-mono"
                placeholder={col.default_value || (col.is_nullable ? 'null' : '')}
              />
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2 px-4 py-3 border-t border-claude-border">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-claude-text-secondary hover:text-claude-text rounded border border-claude-border hover:bg-claude-surface-hover transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-claude-accent text-white rounded hover:bg-claude-accent-hover transition-colors disabled:opacity-50"
          >
            {mode === 'insert' ? <VscAdd className="w-3.5 h-3.5" /> : <VscCheck className="w-3.5 h-3.5" />}
            {isSubmitting ? 'Saving...' : mode === 'insert' ? 'Insert' : 'Update'}
          </button>
        </div>
      </div>
    </div>
  )
}
