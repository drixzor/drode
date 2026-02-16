import React, { useEffect, useRef } from 'react'
import { VscArrowLeft, VscLinkExternal, VscDebugRestart } from 'react-icons/vsc'
import { useVercelStore } from '../../stores/vercelStore'

export function DeploymentDetail() {
  const deployment = useVercelStore((s) => s.selectedDeployment)
  const logs = useVercelStore((s) => s.deploymentLogs)
  const selectDeployment = useVercelStore((s) => s.selectDeployment)
  const promoteDeploy = useVercelStore((s) => s.promoteDeploy)
  const logsEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs])

  if (!deployment) return null

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-claude-border bg-claude-surface flex-shrink-0">
        <button
          onClick={() => useVercelStore.setState({ selectedDeployment: null })}
          className="p-1 hover:bg-claude-surface-hover rounded"
        >
          <VscArrowLeft className="w-4 h-4 text-claude-text-secondary" />
        </button>

        <div className="flex-1 min-w-0">
          <div className="text-sm text-claude-text truncate">
            {deployment.url || deployment.uid.slice(0, 12)}
          </div>
          <div className="text-xs text-claude-text-secondary">
            {deployment.state} - {new Date(deployment.created_at).toLocaleString()}
          </div>
        </div>

        {deployment.url && (
          <a
            href={`https://${deployment.url}`}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1 hover:bg-claude-surface-hover rounded"
            title="Open in browser"
          >
            <VscLinkExternal className="w-4 h-4 text-claude-text-secondary" />
          </a>
        )}

        {deployment.state === 'READY' && (
          <button
            onClick={() => promoteDeploy(deployment.uid)}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-claude-accent/20 text-claude-accent rounded hover:bg-claude-accent/30 transition-colors"
            title="Promote to production"
          >
            <VscDebugRestart className="w-3 h-3" />
            Promote
          </button>
        )}
      </div>

      {/* Build Logs */}
      <div className="flex-1 overflow-y-auto bg-claude-bg p-3 font-mono text-xs">
        {logs.length === 0 && (
          <div className="text-claude-text-secondary text-center py-4">
            No build logs available
          </div>
        )}
        {logs.map((log, i) => (
          <div
            key={i}
            className={`whitespace-pre-wrap break-all py-0.5 ${
              log.log_type === 'stderr' || log.log_type === 'error'
                ? 'text-claude-error'
                : 'text-claude-text'
            }`}
          >
            {log.text}
          </div>
        ))}
        <div ref={logsEndRef} />
      </div>
    </div>
  )
}
