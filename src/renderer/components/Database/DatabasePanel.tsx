import React, { useState, useEffect } from 'react'
import { VscDatabase, VscChevronDown, VscLoading } from 'react-icons/vsc'
import { useSupabaseStore } from '../../stores/supabaseStore'
import { useAuthStore } from '../../stores/authStore'
import { TableList } from './TableList'
import { TableViewer } from './TableViewer'
import { QueryEditor } from './QueryEditor'
import { QueryResults } from './QueryResults'

type DbView = 'data' | 'query'

export function DatabasePanel() {
  const supabaseConnected = useAuthStore((s) => s.supabase.connected)
  const connect = useAuthStore((s) => s.connect)
  const projects = useSupabaseStore((s) => s.projects)
  const selectedProject = useSupabaseStore((s) => s.selectedProject)
  const loadProjects = useSupabaseStore((s) => s.loadProjects)
  const selectProject = useSupabaseStore((s) => s.selectProject)
  const isLoading = useSupabaseStore((s) => s.isLoading)
  const [view, setView] = useState<DbView>('data')

  useEffect(() => {
    if (supabaseConnected && projects.length === 0) {
      loadProjects()
    }
  }, [supabaseConnected, projects.length, loadProjects])

  if (!supabaseConnected) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3">
        <VscDatabase className="w-10 h-10 text-claude-text-secondary/30" />
        <p className="text-sm text-claude-text-secondary">
          Connect Supabase to manage your database
        </p>
        <button
          onClick={() => connect('supabase')}
          className="px-4 py-2 text-sm bg-claude-accent text-white rounded-lg hover:bg-claude-accent-hover transition-colors"
        >
          Connect Supabase
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
            onClick={() => setView('data')}
            className={`px-3 py-1 text-xs transition-colors ${
              view === 'data'
                ? 'bg-claude-accent/20 text-claude-accent'
                : 'text-claude-text-secondary hover:text-claude-text'
            }`}
          >
            Data
          </button>
          <button
            onClick={() => setView('query')}
            className={`px-3 py-1 text-xs transition-colors ${
              view === 'query'
                ? 'bg-claude-accent/20 text-claude-accent'
                : 'text-claude-text-secondary hover:text-claude-text'
            }`}
          >
            SQL
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {selectedProject && <TableList />}

        <div className="flex-1 min-w-0">
          {view === 'data' ? (
            <TableViewer />
          ) : (
            <div className="h-full flex flex-col">
              <div className="h-1/2 border-b border-claude-border">
                <QueryEditor />
              </div>
              <div className="h-1/2">
                <QueryResults />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
