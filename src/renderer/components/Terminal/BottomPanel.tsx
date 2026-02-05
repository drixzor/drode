import React, { useState, useRef, useEffect, useCallback, useImperativeHandle, forwardRef, memo } from 'react'
import {
  VscTerminal,
  VscPlay,
  VscClearAll,
  VscChevronUp,
  VscChevronDown,
  VscDebugStop,
  VscServerProcess
} from 'react-icons/vsc'
import { v4 as uuidv4 } from 'uuid'
import { TerminalOutput } from '../../types'
import { PortsPanel } from './PortsPanel'

interface TerminalLine {
  id: string
  type: 'input' | 'stdout' | 'stderr' | 'exit'
  content: string
  timestamp: number
}

type BottomPanelTab = 'terminal' | 'ports'

interface BottomPanelProps {
  projectPath: string | null
  height: number
  minHeight: number
  maxHeight: number
  onResize: (height: number) => void
  isCollapsed?: boolean
  onToggleCollapse?: () => void
  onResetHeight?: () => void
}

export interface BottomPanelHandle {
  runCommand: (command: string) => void
}

export const BottomPanel = memo(forwardRef<BottomPanelHandle, BottomPanelProps>(function BottomPanel({
  projectPath,
  height,
  minHeight,
  maxHeight,
  onResize,
  isCollapsed = false,
  onToggleCollapse,
  onResetHeight
}, ref) {
  const [activeTab, setActiveTab] = useState<BottomPanelTab>('terminal')
  const [lines, setLines] = useState<TerminalLine[]>([])
  const [input, setInput] = useState('')
  const [isRunning, setIsRunning] = useState(false)
  const [history, setHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [isResizing, setIsResizing] = useState(false)

  const panelRef = useRef<HTMLDivElement>(null)
  const outputRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const currentTerminalId = useRef<string | null>(null)
  const startYRef = useRef(0)
  const startHeightRef = useRef(0)
  const currentHeightRef = useRef(height)
  const rafRef = useRef<number | null>(null)

  // Keep ref in sync
  useEffect(() => {
    currentHeightRef.current = height
  }, [height])

  // Listen for terminal output
  useEffect(() => {
    const cleanup = window.electronAPI.onTerminalOutput((data: TerminalOutput) => {
      if (data.terminalId !== currentTerminalId.current) return

      if (data.type === 'exit') {
        setIsRunning(false)
        setLines(prev => [...prev, {
          id: uuidv4(),
          type: 'exit',
          content: `Process exited with code ${data.code}`,
          timestamp: Date.now()
        }])
      } else if (data.data) {
        setLines(prev => [...prev, {
          id: uuidv4(),
          type: data.type as 'stdout' | 'stderr',
          content: data.data!,
          timestamp: Date.now()
        }])
      }
    })

    return cleanup
  }, [])

  // Auto-scroll to bottom
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [lines])

  // Resize handling with RAF
  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
    startYRef.current = e.clientY
    startHeightRef.current = currentHeightRef.current
    document.body.classList.add('is-resizing')
  }, [])

  useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
      }

      rafRef.current = requestAnimationFrame(() => {
        const delta = startYRef.current - e.clientY
        const newHeight = Math.min(maxHeight, Math.max(minHeight, startHeightRef.current + delta))

        // Direct DOM update
        if (panelRef.current) {
          panelRef.current.style.height = `${newHeight}px`
        }
        currentHeightRef.current = newHeight
      })
    }

    const handleMouseUp = () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
      }
      onResize(currentHeightRef.current)
      setIsResizing(false)
      document.body.classList.remove('is-resizing')
    }

    document.addEventListener('mousemove', handleMouseMove, { passive: true })
    document.addEventListener('mouseup', handleMouseUp)
    document.body.style.cursor = 'row-resize'
    document.body.style.userSelect = 'none'

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isResizing, minHeight, maxHeight, onResize])

  const runCommand = useCallback(async (command: string) => {
    if (!command.trim() || !projectPath || isRunning) return

    const terminalId = uuidv4()
    currentTerminalId.current = terminalId

    setLines(prev => [...prev, {
      id: uuidv4(),
      type: 'input',
      content: `$ ${command}`,
      timestamp: Date.now()
    }])

    setHistory(prev => [command, ...prev.filter(c => c !== command)].slice(0, 50))
    setHistoryIndex(-1)
    setInput('')
    setIsRunning(true)

    await window.electronAPI.runTerminalCommand(command, terminalId)
  }, [projectPath, isRunning])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      runCommand(input)
    } else if (e.key === 'c' && e.ctrlKey && isRunning) {
      e.preventDefault()
      killProcess()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (history.length > 0 && historyIndex < history.length - 1) {
        const newIndex = historyIndex + 1
        setHistoryIndex(newIndex)
        setInput(history[newIndex])
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1
        setHistoryIndex(newIndex)
        setInput(history[newIndex])
      } else if (historyIndex === 0) {
        setHistoryIndex(-1)
        setInput('')
      }
    }
  }

  const clearTerminal = () => {
    setLines([])
  }

  const killProcess = useCallback(async () => {
    if (!currentTerminalId.current) return
    await window.electronAPI.killTerminalProcess(currentTerminalId.current)
  }, [])

  // Expose runCommand to parent via ref
  useImperativeHandle(ref, () => ({
    runCommand: (command: string) => {
      runCommand(command)
    }
  }), [runCommand])

  // Collapsed state
  if (isCollapsed) {
    return (
      <div className="h-9 bg-claude-surface border-t border-claude-border flex items-center px-3 flex-shrink-0">
        <button
          onClick={onToggleCollapse}
          className="flex items-center gap-2 text-sm text-claude-text-secondary hover:text-claude-text transition-colors"
        >
          <VscTerminal className="text-claude-accent" />
          <span>Terminal</span>
          {isRunning && (
            <span className="w-2 h-2 rounded-full bg-claude-success animate-pulse" />
          )}
          <VscChevronUp className="ml-1" />
        </button>

        <div className="flex-1" />

        <div className="flex items-center gap-1 text-xs text-claude-text-secondary">
          <span className="opacity-60">⌘`</span>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={panelRef}
      className="bg-claude-bg border-t border-claude-border flex flex-col flex-shrink-0"
      style={{
        height: `${height}px`,
        willChange: isResizing ? 'height' : 'auto',
        contain: 'layout style',
      }}
    >
      {/* Resize Handle */}
      <div
        className={`h-1.5 cursor-row-resize group relative -mt-0.5 ${isResizing ? 'bg-claude-accent' : ''}`}
        onMouseDown={handleResizeMouseDown}
        onDoubleClick={onResetHeight}
      >
        <div className={`absolute inset-x-0 h-0.5 top-1/2 -translate-y-1/2 bg-transparent group-hover:bg-claude-accent/60 ${isResizing ? 'bg-claude-accent' : ''}`} />
      </div>

      {/* Tab Header */}
      <div className="h-9 bg-claude-surface border-b border-claude-border flex items-center justify-between px-2 flex-shrink-0">
        <div className="flex items-center">
          {/* Tabs */}
          <button
            onClick={() => setActiveTab('terminal')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded transition-colors ${
              activeTab === 'terminal'
                ? 'bg-claude-bg text-claude-text'
                : 'text-claude-text-secondary hover:text-claude-text hover:bg-claude-surface-hover'
            }`}
          >
            <VscTerminal className="w-4 h-4" />
            <span>Terminal</span>
            {isRunning && (
              <span className="w-2 h-2 rounded-full bg-claude-success animate-pulse" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('ports')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded transition-colors ${
              activeTab === 'ports'
                ? 'bg-claude-bg text-claude-text'
                : 'text-claude-text-secondary hover:text-claude-text hover:bg-claude-surface-hover'
            }`}
          >
            <VscServerProcess className="w-4 h-4" />
            <span>Ports</span>
          </button>
        </div>

        <div className="flex items-center gap-1">
          {activeTab === 'terminal' && isRunning && (
            <button
              onClick={killProcess}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-claude-error/20 text-claude-error rounded hover:bg-claude-error/30 transition-colors"
              title="Stop process (Ctrl+C)"
            >
              <VscDebugStop className="w-3 h-3" />
              <span>Stop</span>
            </button>
          )}
          {activeTab === 'terminal' && (
            <button
              onClick={clearTerminal}
              className="p-1.5 hover:bg-claude-surface-hover rounded transition-colors"
              title="Clear terminal"
            >
              <VscClearAll className="text-claude-text-secondary" />
            </button>
          )}
          <button
            onClick={onToggleCollapse}
            className="p-1.5 hover:bg-claude-surface-hover rounded transition-colors"
            title="Collapse panel (⌘`)"
          >
            <VscChevronDown className="text-claude-text-secondary" />
          </button>
        </div>
      </div>

      {/* Content */}
      {activeTab === 'terminal' ? (
        <>
          {/* Terminal Output */}
          <div
            ref={outputRef}
            className="flex-1 overflow-y-auto p-3 font-mono text-sm"
            onClick={() => inputRef.current?.focus()}
          >
            {lines.length === 0 && (
              <div className="text-claude-text-secondary text-xs flex flex-col gap-1">
                <span>Type a command and press Enter to run it</span>
                <span className="text-claude-text-secondary/50">Working directory: {projectPath || 'none'}</span>
              </div>
            )}
            {lines.map(line => (
              <div
                key={line.id}
                className={`whitespace-pre-wrap break-all ${
                  line.type === 'input'
                    ? 'text-claude-accent font-semibold mt-2 first:mt-0'
                    : line.type === 'stderr'
                    ? 'text-claude-error'
                    : line.type === 'exit'
                    ? 'text-claude-text-secondary italic mt-1'
                    : 'text-claude-text'
                }`}
              >
                {line.content}
              </div>
            ))}
          </div>

          {/* Terminal Input */}
          <div className="h-10 border-t border-claude-border flex items-center px-3 gap-2 flex-shrink-0 bg-claude-surface/30">
            <span className="text-claude-accent font-mono text-sm">$</span>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isRunning || !projectPath}
              placeholder={projectPath ? "Enter command..." : "Select a project first"}
              className="flex-1 bg-transparent text-claude-text font-mono text-sm outline-none placeholder:text-claude-text-secondary/50 disabled:opacity-50"
            />
            <button
              onClick={() => runCommand(input)}
              disabled={isRunning || !input.trim() || !projectPath}
              className="p-1.5 hover:bg-claude-surface-hover rounded transition-colors disabled:opacity-50"
              title="Run command"
            >
              <VscPlay className="text-claude-accent" />
            </button>
          </div>
        </>
      ) : (
        <PortsPanel isVisible={activeTab === 'ports'} />
      )}
    </div>
  )
}))
