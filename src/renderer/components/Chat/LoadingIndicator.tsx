import React, { useRef, useEffect, useState } from 'react'
import { VscRobot, VscFile, VscEdit, VscTerminal, VscSearch, VscGlobe, VscLoading } from 'react-icons/vsc'
import { getClaudeBridge } from '../../services/claudeCodeBridge'
import { ToolUseRequest } from '../../types'

interface LoadingIndicatorProps {
  streamingContent?: string
}

function getToolIcon(toolName: string) {
  switch (toolName) {
    case 'Read':
      return <VscFile className="text-blue-400" />
    case 'Write':
      return <VscFile className="text-green-400" />
    case 'Edit':
      return <VscEdit className="text-yellow-400" />
    case 'Bash':
      return <VscTerminal className="text-orange-400" />
    case 'Glob':
    case 'Grep':
      return <VscSearch className="text-purple-400" />
    case 'WebFetch':
    case 'WebSearch':
      return <VscGlobe className="text-cyan-400" />
    case 'Task':
      return <VscLoading className="text-teal-400 animate-spin" />
    default:
      return <VscLoading className="text-claude-text-secondary animate-spin" />
  }
}

function getToolSummary(name: string, input: Record<string, unknown>): string {
  switch (name) {
    case 'Read':
    case 'Write':
    case 'Edit':
      const path = String(input.file_path || input.path || '')
      return path.split('/').pop() || path
    case 'Bash':
      const cmd = String(input.command || '')
      return cmd.length > 30 ? cmd.substring(0, 30) + '...' : cmd
    case 'Glob':
    case 'Grep':
      return String(input.pattern || '')
    case 'Task':
      return String(input.description || 'Running task...')
    default:
      return name
  }
}

export function LoadingIndicator({ streamingContent }: LoadingIndicatorProps) {
  const contentRef = useRef<HTMLDivElement>(null)
  const [activeTools, setActiveTools] = useState<ToolUseRequest[]>([])

  // Subscribe to permission requests to track active tools
  useEffect(() => {
    const bridge = getClaudeBridge()

    const cleanup = bridge.onPermissionRequest((request) => {
      setActiveTools(prev => {
        // Add if not already in list
        if (prev.find(t => t.id === request.toolUseId)) return prev
        return [...prev, {
          id: request.toolUseId,
          name: request.toolName,
          input: request.toolInput,
          status: 'executing' as const
        }]
      })
    })

    const cleanupResult = bridge.onToolResult((result) => {
      setActiveTools(prev => prev.filter(t => t.id !== result.toolUseId))
    })

    return () => {
      cleanup()
      cleanupResult()
      setActiveTools([])
    }
  }, [])

  // Clear tools when content finishes streaming
  useEffect(() => {
    if (!streamingContent) {
      setActiveTools([])
    }
  }, [streamingContent])

  // Auto-scroll to bottom when content updates
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight
    }
  }, [streamingContent])

  const cleanContent = streamingContent?.trim() || ''

  return (
    <div className="rounded-lg p-4 animate-fade-in">
      <div className="flex items-center gap-2 mb-2">
        <span className="w-6 h-6 flex items-center justify-center rounded-full bg-claude-surface-hover">
          <VscRobot className="text-claude-success" />
        </span>
        <span className="text-sm font-medium">Claude</span>
        <span className="flex items-center gap-1 text-claude-accent text-sm">
          <div className="w-3 h-3 border-2 border-claude-accent border-t-transparent rounded-full animate-spin" />
          Processing...
        </span>
      </div>

      <div className="pl-8 space-y-2">
        {/* Active tools indicator */}
        {activeTools.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {activeTools.slice(0, 5).map(tool => (
              <div
                key={tool.id}
                className="flex items-center gap-1.5 px-2 py-1 bg-claude-surface rounded-full text-xs"
              >
                {getToolIcon(tool.name)}
                <span className="text-claude-text-secondary">
                  {getToolSummary(tool.name, tool.input)}
                </span>
              </div>
            ))}
            {activeTools.length > 5 && (
              <span className="px-2 py-1 text-xs text-claude-text-secondary">
                +{activeTools.length - 5} more
              </span>
            )}
          </div>
        )}

        {/* Streaming content */}
        {cleanContent ? (
          <div
            ref={contentRef}
            className="text-sm text-claude-text whitespace-pre-wrap break-words max-h-96 overflow-y-auto"
          >
            {cleanContent}
          </div>
        ) : activeTools.length === 0 ? (
          <div className="text-claude-text-secondary text-sm flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-claude-accent border-t-transparent rounded-full animate-spin" />
            Thinking...
          </div>
        ) : null}
      </div>
    </div>
  )
}
