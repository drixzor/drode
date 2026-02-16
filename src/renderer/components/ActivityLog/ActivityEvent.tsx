import React from 'react'
import {
  VscGitCommit,
  VscDatabase,
  VscRocket,
  VscComment,
  VscTerminal,
  VscEdit,
  VscInfo,
  VscCheck,
  VscWarning,
  VscError,
} from 'react-icons/vsc'
import type { ActivityEvent as ActivityEventType } from '../../stores/activityStore'

const categoryIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  github: VscGitCommit,
  supabase: VscDatabase,
  vercel: VscRocket,
  claude: VscComment,
  terminal: VscTerminal,
  editor: VscEdit,
}

const severityColors: Record<string, string> = {
  info: 'text-claude-text-secondary',
  success: 'text-claude-success',
  warning: 'text-claude-warning',
  error: 'text-claude-error',
}

const severityIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  info: VscInfo,
  success: VscCheck,
  warning: VscWarning,
  error: VscError,
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - date.getTime()

  if (diff < 60000) return 'just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return date.toLocaleDateString()
}

interface Props {
  event: ActivityEventType
}

export function ActivityEventRow({ event }: Props) {
  const CategoryIcon = categoryIcons[event.category] || VscInfo
  const SeverityIcon = severityIcons[event.severity] || VscInfo
  const severityColor = severityColors[event.severity] || severityColors.info

  return (
    <div className="flex items-start gap-2 px-3 py-1.5 hover:bg-claude-surface-hover/50 text-sm">
      <CategoryIcon className="w-4 h-4 mt-0.5 text-claude-accent flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="text-claude-text">{event.title}</span>
      </div>
      <SeverityIcon className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${severityColor}`} />
      <span className="text-xs text-claude-text-secondary/60 flex-shrink-0 tabular-nums">
        {formatTime(event.created_at)}
      </span>
    </div>
  )
}
