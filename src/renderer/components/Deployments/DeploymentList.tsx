import React from 'react'
import {
  VscCheck,
  VscError,
  VscLoading,
  VscCircleFilled,
} from 'react-icons/vsc'
import { useVercelStore, VercelDeployment } from '../../stores/vercelStore'

const stateConfig: Record<string, { icon: React.ComponentType<any>; color: string; label: string }> = {
  READY: { icon: VscCheck, color: 'text-claude-success', label: 'Ready' },
  ERROR: { icon: VscError, color: 'text-claude-error', label: 'Error' },
  BUILDING: { icon: VscLoading, color: 'text-claude-warning', label: 'Building' },
  INITIALIZING: { icon: VscLoading, color: 'text-claude-warning', label: 'Initializing' },
  QUEUED: { icon: VscCircleFilled, color: 'text-claude-text-secondary', label: 'Queued' },
  CANCELED: { icon: VscCircleFilled, color: 'text-claude-text-secondary', label: 'Canceled' },
}

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp
  if (diff < 60000) return 'just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return `${Math.floor(diff / 86400000)}d ago`
}

export function DeploymentList() {
  const deployments = useVercelStore((s) => s.deployments)
  const selectedDeployment = useVercelStore((s) => s.selectedDeployment)
  const selectDeployment = useVercelStore((s) => s.selectDeployment)

  if (deployments.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-claude-text-secondary">
        No deployments
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {deployments.map((deploy) => {
        const config = stateConfig[deploy.state] || stateConfig.QUEUED
        const Icon = config.icon
        const isActive = deploy.state === 'BUILDING' || deploy.state === 'INITIALIZING'

        return (
          <button
            key={deploy.uid}
            onClick={() => selectDeployment(deploy)}
            className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-claude-surface-hover border-b border-claude-border/50 ${
              selectedDeployment?.uid === deploy.uid ? 'bg-claude-surface-hover' : ''
            }`}
          >
            <Icon className={`w-4 h-4 flex-shrink-0 ${config.color} ${isActive ? 'animate-spin' : ''}`} />

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm text-claude-text truncate">
                  {deploy.url || deploy.uid.slice(0, 10)}
                </span>
                <span className={`text-xs px-1.5 py-0.5 rounded ${config.color} bg-current/10`}>
                  {config.label}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                {deploy.git_ref && (
                  <span className="text-xs text-claude-text-secondary">{deploy.git_ref}</span>
                )}
                {deploy.git_message && (
                  <span className="text-xs text-claude-text-secondary/60 truncate">
                    {deploy.git_message}
                  </span>
                )}
              </div>
            </div>

            <span className="text-xs text-claude-text-secondary/60 flex-shrink-0 tabular-nums">
              {formatRelativeTime(deploy.created_at)}
            </span>
          </button>
        )
      })}
    </div>
  )
}
