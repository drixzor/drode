import React, { useState, useEffect } from 'react'
import { VscRocket, VscChevronDown, VscLoading, VscGlobe } from 'react-icons/vsc'
import { useVercelStore } from '../../stores/vercelStore'
import { useAuthStore } from '../../stores/authStore'
import { DeploymentList } from './DeploymentList'
import { DeploymentDetail } from './DeploymentDetail'
import { DomainManager } from './DomainManager'
import { DeployButton } from './DeployButton'

type DeployView = 'list' | 'domains'

export function DeploymentsPanel() {
  const vercelConnected = useAuthStore((s) => s.vercel.connected)
  const connect = useAuthStore((s) => s.connect)
  const projects = useVercelStore((s) => s.projects)
  const selectedProject = useVercelStore((s) => s.selectedProject)
  const selectedDeployment = useVercelStore((s) => s.selectedDeployment)
  const loadProjects = useVercelStore((s) => s.loadProjects)
  const selectProject = useVercelStore((s) => s.selectProject)
  const isLoading = useVercelStore((s) => s.isLoading)
  const stopPolling = useVercelStore((s) => s.stopPolling)
  const [view, setView] = useState<DeployView>('list')

  useEffect(() => {
    if (vercelConnected && projects.length === 0) {
      loadProjects()
    }
    return () => stopPolling()
  }, [vercelConnected, projects.length, loadProjects, stopPolling])

  if (!vercelConnected) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3">
        <VscRocket className="w-10 h-10 text-claude-text-secondary/30" />
        <p className="text-sm text-claude-text-secondary">
          Connect Vercel to manage deployments
        </p>
        <button
          onClick={() => connect('vercel')}
          className="px-4 py-2 text-sm bg-claude-accent text-white rounded-lg hover:bg-claude-accent-hover transition-colors"
        >
          Connect Vercel
        </button>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-claude-border bg-claude-surface flex-shrink-0">
        {/* Project Selector */}
        <div className="relative">
          <select
            value={selectedProject?.id || ''}
            onChange={(e) => {
              const project = projects.find((p) => p.id === e.target.value)
              if (project) selectProject(project)
            }}
            className="px-2 py-1 text-sm bg-claude-bg border border-claude-border rounded text-claude-text appearance-none pr-6"
          >
            <option value="">Select project...</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <VscChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-claude-text-secondary pointer-events-none" />
        </div>

        {isLoading && <VscLoading className="w-4 h-4 text-claude-accent animate-spin" />}

        <div className="flex-1" />

        {/* View Toggle */}
        <div className="flex items-center bg-claude-bg border border-claude-border rounded overflow-hidden">
          <button
            onClick={() => setView('list')}
            className={`px-3 py-1 text-xs transition-colors ${
              view === 'list'
                ? 'bg-claude-accent/20 text-claude-accent'
                : 'text-claude-text-secondary hover:text-claude-text'
            }`}
          >
            Deployments
          </button>
          <button
            onClick={() => setView('domains')}
            className={`px-3 py-1 text-xs transition-colors ${
              view === 'domains'
                ? 'bg-claude-accent/20 text-claude-accent'
                : 'text-claude-text-secondary hover:text-claude-text'
            }`}
          >
            Domains
          </button>
        </div>

        {selectedProject && <DeployButton />}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden min-h-0">
        {selectedDeployment && view === 'list' ? (
          <DeploymentDetail />
        ) : view === 'list' ? (
          <DeploymentList />
        ) : (
          <DomainManager />
        )}
      </div>
    </div>
  )
}
