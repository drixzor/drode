import React from 'react'
import { VscClearAll, VscFilter } from 'react-icons/vsc'
import { useActivityStore } from '../../stores/activityStore'
import { ActivityEventRow } from './ActivityEvent'

const CATEGORIES = [
  { key: null, label: 'All' },
  { key: 'github', label: 'GitHub' },
  { key: 'supabase', label: 'Supabase' },
  { key: 'vercel', label: 'Vercel' },
  { key: 'claude', label: 'Claude' },
  { key: 'terminal', label: 'Terminal' },
] as const

export function ActivityLog() {
  const events = useActivityStore((s) => s.events)
  const filter = useActivityStore((s) => s.filter)
  const isLoading = useActivityStore((s) => s.isLoading)
  const setFilter = useActivityStore((s) => s.setFilter)
  const clearLog = useActivityStore((s) => s.clearLog)

  const filteredEvents = filter
    ? events.filter((e) => e.category === filter)
    : events

  return (
    <div className="h-full flex flex-col">
      {/* Filter Bar */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-claude-border flex-shrink-0">
        <VscFilter className="w-3.5 h-3.5 text-claude-text-secondary mr-1" />
        {CATEGORIES.map((cat) => (
          <button
            key={cat.key ?? 'all'}
            onClick={() => setFilter(cat.key)}
            className={`px-2 py-0.5 text-xs rounded transition-colors ${
              filter === cat.key
                ? 'bg-claude-accent/20 text-claude-accent'
                : 'text-claude-text-secondary hover:text-claude-text hover:bg-claude-surface-hover'
            }`}
          >
            {cat.label}
          </button>
        ))}
        <div className="flex-1" />
        <button
          onClick={clearLog}
          className="p-1 hover:bg-claude-surface-hover rounded transition-colors"
          title="Clear activity log"
        >
          <VscClearAll className="w-3.5 h-3.5 text-claude-text-secondary" />
        </button>
      </div>

      {/* Event List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading && filteredEvents.length === 0 && (
          <div className="flex items-center justify-center h-20 text-sm text-claude-text-secondary">
            Loading...
          </div>
        )}
        {!isLoading && filteredEvents.length === 0 && (
          <div className="flex items-center justify-center h-20 text-sm text-claude-text-secondary">
            No activity yet
          </div>
        )}
        {filteredEvents.map((event) => (
          <ActivityEventRow key={event.id} event={event} />
        ))}
      </div>
    </div>
  )
}
