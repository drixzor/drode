import React, { useState, useRef, useEffect, useCallback } from 'react'
import { VscTerminal, VscPlay, VscClearAll, VscChevronUp, VscChevronDown, VscDebugStop } from 'react-icons/vsc'
import { v4 as uuidv4 } from 'uuid'
import { TerminalOutput } from '../../types'

interface TerminalLine {
  id: string
  type: 'input' | 'stdout' | 'stderr' | 'exit'
  content: string
  timestamp: number
}

interface TerminalProps {
  projectPath: string | null
  isCollapsed?: boolean
  onToggleCollapse?: () => void
  onRunCommand?: (command: string) => void
}

export function Terminal({ projectPath, isCollapsed = false, onToggleCollapse }: TerminalProps) {
  const [lines, setLines] = useState<TerminalLine[]>([])
  const [input, setInput] = useState('')
  const [isRunning, setIsRunning] = useState(false)
  const [history, setHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const outputRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const currentTerminalId = useRef<string | null>(null)

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

  const runCommand = useCallback(async (command: string) => {
    if (!command.trim() || !projectPath || isRunning) return

    const terminalId = uuidv4()
    currentTerminalId.current = terminalId

    // Add input line
    setLines(prev => [...prev, {
      id: uuidv4(),
      type: 'input',
      content: `$ ${command}`,
      timestamp: Date.now()
    }])

    // Add to history
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
    // The exit event will be emitted by the backend and handled by the listener
  }, [])

  if (isCollapsed) {
    return (
      <div className="h-10 bg-claude-surface border-t border-claude-border flex items-center px-4">
        <button
          onClick={onToggleCollapse}
          className="flex items-center gap-2 text-sm text-claude-text-secondary hover:text-claude-text transition-colors"
        >
          <VscTerminal />
          <span>Terminal</span>
          <VscChevronUp className="ml-2" />
        </button>
      </div>
    )
  }

  return (
    <div className="h-64 bg-claude-bg border-t border-claude-border flex flex-col">
      {/* Header */}
      <div className="h-10 bg-claude-surface border-b border-claude-border flex items-center justify-between px-4 flex-shrink-0">
        <div className="flex items-center gap-2">
          <VscTerminal className="text-claude-text-secondary" />
          <span className="text-sm font-medium text-claude-text">Terminal</span>
          {isRunning && (
            <button
              onClick={killProcess}
              className="flex items-center gap-1 px-2 py-0.5 text-xs bg-claude-error/20 text-claude-error rounded hover:bg-claude-error/30 transition-colors"
              title="Stop process (Ctrl+C)"
            >
              <VscDebugStop className="w-3 h-3" />
              <span>Stop</span>
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={clearTerminal}
            className="p-1.5 hover:bg-claude-surface-hover rounded transition-colors"
            title="Clear terminal"
          >
            <VscClearAll className="text-claude-text-secondary" />
          </button>
          <button
            onClick={onToggleCollapse}
            className="p-1.5 hover:bg-claude-surface-hover rounded transition-colors"
            title="Collapse terminal"
          >
            <VscChevronDown className="text-claude-text-secondary" />
          </button>
        </div>
      </div>

      {/* Output area */}
      <div
        ref={outputRef}
        className="flex-1 overflow-y-auto p-3 font-mono text-sm"
        onClick={() => inputRef.current?.focus()}
      >
        {lines.length === 0 && (
          <div className="text-claude-text-secondary text-xs">
            Type a command and press Enter to run it
          </div>
        )}
        {lines.map(line => (
          <div
            key={line.id}
            className={`whitespace-pre-wrap break-all ${
              line.type === 'input'
                ? 'text-claude-accent font-semibold'
                : line.type === 'stderr'
                ? 'text-claude-error'
                : line.type === 'exit'
                ? 'text-claude-text-secondary italic'
                : 'text-claude-text'
            }`}
          >
            {line.content}
          </div>
        ))}
      </div>

      {/* Input area */}
      <div className="h-10 border-t border-claude-border flex items-center px-3 gap-2 flex-shrink-0">
        <span className="text-claude-accent font-mono">$</span>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isRunning || !projectPath}
          placeholder={projectPath ? "Enter command..." : "Select a project first"}
          className="flex-1 bg-transparent text-claude-text font-mono text-sm outline-none placeholder:text-claude-text-secondary disabled:opacity-50"
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
    </div>
  )
}
