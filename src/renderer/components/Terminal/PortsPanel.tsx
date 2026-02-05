import React, { useState, useEffect, useCallback } from 'react'
import { VscRefresh, VscClose, VscServerProcess } from 'react-icons/vsc'
import { PortInfo } from '../../types'

interface PortsPanelProps {
  isVisible: boolean
}

export function PortsPanel({ isVisible }: PortsPanelProps) {
  const [ports, setPorts] = useState<PortInfo[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [killingPort, setKillingPort] = useState<number | null>(null)

  const refreshPorts = useCallback(async () => {
    setIsLoading(true)
    try {
      const portList = await window.electronAPI.listPorts()
      setPorts(portList)
    } catch (error) {
      console.error('Failed to list ports:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const killPort = useCallback(async (port: number) => {
    setKillingPort(port)
    try {
      await window.electronAPI.killPort(port)
      // Wait a moment then refresh
      setTimeout(refreshPorts, 500)
    } catch (error) {
      console.error('Failed to kill port:', error)
    } finally {
      setKillingPort(null)
    }
  }, [refreshPorts])

  // Initial load
  useEffect(() => {
    if (isVisible) {
      refreshPorts()
    }
  }, [isVisible, refreshPorts])

  // Auto-refresh
  useEffect(() => {
    if (!isVisible || !autoRefresh) return

    const interval = setInterval(refreshPorts, 5000)
    return () => clearInterval(interval)
  }, [isVisible, autoRefresh, refreshPorts])

  if (!isVisible) return null

  return (
    <div className="h-full flex flex-col bg-claude-bg">
      {/* Header */}
      <div className="h-10 bg-claude-surface border-b border-claude-border flex items-center justify-between px-4 flex-shrink-0">
        <div className="flex items-center gap-2">
          <VscServerProcess className="text-claude-text-secondary" />
          <span className="text-sm font-medium text-claude-text">Active Ports</span>
          <span className="text-xs text-claude-text-secondary">({ports.length})</span>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-claude-text-secondary cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="w-3 h-3 rounded border-claude-border bg-claude-surface accent-claude-accent"
            />
            Auto
          </label>
          <button
            onClick={refreshPorts}
            disabled={isLoading}
            className="p-1.5 hover:bg-claude-surface-hover rounded transition-colors disabled:opacity-50"
            title="Refresh ports"
          >
            <VscRefresh className={`text-claude-text-secondary ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {ports.length === 0 ? (
          <div className="p-4 text-sm text-claude-text-secondary text-center">
            {isLoading ? 'Loading...' : 'No listening ports found'}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-claude-surface/50 sticky top-0">
              <tr className="text-left text-xs text-claude-text-secondary">
                <th className="px-4 py-2 font-medium">Port</th>
                <th className="px-4 py-2 font-medium">Process</th>
                <th className="px-4 py-2 font-medium">PID</th>
                <th className="px-4 py-2 font-medium">Protocol</th>
                <th className="px-4 py-2 font-medium w-16"></th>
              </tr>
            </thead>
            <tbody>
              {ports.map((port) => (
                <tr
                  key={`${port.port}-${port.pid}`}
                  className="border-t border-claude-border/50 hover:bg-claude-surface-hover transition-colors"
                >
                  <td className="px-4 py-2 font-mono text-claude-accent">{port.port}</td>
                  <td className="px-4 py-2 text-claude-text truncate max-w-32" title={port.process_name}>
                    {port.process_name}
                  </td>
                  <td className="px-4 py-2 text-claude-text-secondary font-mono">{port.pid}</td>
                  <td className="px-4 py-2 text-claude-text-secondary">{port.protocol}</td>
                  <td className="px-4 py-2">
                    <button
                      onClick={() => killPort(port.port)}
                      disabled={killingPort === port.port}
                      className="p-1 hover:bg-claude-error/20 rounded transition-colors disabled:opacity-50"
                      title="Kill process"
                    >
                      <VscClose className={`text-claude-error ${killingPort === port.port ? 'animate-pulse' : ''}`} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
