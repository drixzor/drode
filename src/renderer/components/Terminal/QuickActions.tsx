import React, { useState, useEffect } from 'react'
import { VscPlay, VscPackage, VscDebugStart, VscTools, VscRefresh } from 'react-icons/vsc'

interface QuickAction {
  id: string
  label: string
  command: string
  icon: React.ReactNode
  color: string
}

interface QuickActionsProps {
  projectPath: string | null
  onRunCommand: (command: string) => void
  isRunning?: boolean
}

const defaultActions: QuickAction[] = [
  { id: 'dev', label: 'Dev', command: 'npm run dev', icon: <VscDebugStart />, color: 'text-green-400' },
  { id: 'build', label: 'Build', command: 'npm run build', icon: <VscPackage />, color: 'text-blue-400' },
  { id: 'install', label: 'Install', command: 'npm install', icon: <VscRefresh />, color: 'text-purple-400' },
  { id: 'test', label: 'Test', command: 'npm test', icon: <VscPlay />, color: 'text-yellow-400' },
]

export function QuickActions({ projectPath, onRunCommand, isRunning }: QuickActionsProps) {
  const [scripts, setScripts] = useState<Record<string, string>>({})
  const [actions, setActions] = useState<QuickAction[]>(defaultActions)

  // Try to load package.json scripts
  useEffect(() => {
    if (!projectPath) return

    const loadScripts = async () => {
      try {
        const result = await window.electronAPI.readFile(`${projectPath}/package.json`)
        if (result.success && result.content) {
          const pkg = JSON.parse(result.content)
          if (pkg.scripts) {
            setScripts(pkg.scripts)

            // Build actions from available scripts
            const newActions: QuickAction[] = []

            if (pkg.scripts.dev) {
              newActions.push({ id: 'dev', label: 'Dev', command: 'npm run dev', icon: <VscDebugStart />, color: 'text-green-400' })
            } else if (pkg.scripts.start) {
              newActions.push({ id: 'start', label: 'Start', command: 'npm start', icon: <VscDebugStart />, color: 'text-green-400' })
            }

            if (pkg.scripts.build) {
              newActions.push({ id: 'build', label: 'Build', command: 'npm run build', icon: <VscPackage />, color: 'text-blue-400' })
            }

            // Always include install
            newActions.push({ id: 'install', label: 'Install', command: 'npm install', icon: <VscRefresh />, color: 'text-purple-400' })

            if (pkg.scripts.test) {
              newActions.push({ id: 'test', label: 'Test', command: 'npm test', icon: <VscPlay />, color: 'text-yellow-400' })
            }

            if (pkg.scripts.lint) {
              newActions.push({ id: 'lint', label: 'Lint', command: 'npm run lint', icon: <VscTools />, color: 'text-orange-400' })
            }

            // Add tauri-specific commands if available
            if (pkg.scripts['tauri:dev']) {
              newActions.unshift({ id: 'tauri-dev', label: 'Tauri Dev', command: 'npm run tauri:dev', icon: <VscDebugStart />, color: 'text-cyan-400' })
            }
            if (pkg.scripts['tauri:build']) {
              newActions.push({ id: 'tauri-build', label: 'Tauri Build', command: 'npm run tauri:build', icon: <VscPackage />, color: 'text-cyan-400' })
            }

            setActions(newActions.length > 0 ? newActions : defaultActions)
          }
        }
      } catch (e) {
        console.error('Failed to load package.json:', e)
        setActions(defaultActions)
      }
    }

    loadScripts()
  }, [projectPath])

  if (!projectPath) return null

  return (
    <div className="flex items-center gap-1 px-2 py-1.5 bg-claude-surface border-b border-claude-border overflow-x-auto">
      <span className="text-xs text-claude-text-secondary mr-2 flex-shrink-0">Quick:</span>
      {actions.map(action => (
        <button
          key={action.id}
          onClick={() => onRunCommand(action.command)}
          disabled={isRunning}
          className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md
            bg-claude-bg hover:bg-claude-surface-hover border border-claude-border
            transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0`}
          title={action.command}
        >
          <span className={action.color}>{action.icon}</span>
          <span className="text-claude-text">{action.label}</span>
        </button>
      ))}
    </div>
  )
}
