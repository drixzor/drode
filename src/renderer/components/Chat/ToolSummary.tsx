import React, { useState, useMemo } from 'react'
import {
  VscFile,
  VscEdit,
  VscTerminal,
  VscSearch,
  VscGlobe,
  VscChevronDown,
  VscChevronRight,
  VscCheck,
  VscClose,
  VscDiff,
  VscFolderOpened
} from 'react-icons/vsc'
import { ToolUseRequest, ToolResult } from '../../types'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'

interface ToolSummaryProps {
  toolUses: ToolUseRequest[]
  toolResults?: Record<string, ToolResult>
}

interface FileChange {
  filePath: string
  toolName: 'Write' | 'Edit'
  oldContent?: string
  newContent?: string
  input: Record<string, unknown>
  result?: ToolResult
}

interface ToolGroup {
  type: string
  icon: React.ReactNode
  color: string
  tools: ToolUseRequest[]
  results: Record<string, ToolResult>
}

function detectLanguage(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'ts':
    case 'tsx':
      return 'typescript'
    case 'js':
    case 'jsx':
      return 'javascript'
    case 'py':
      return 'python'
    case 'rs':
      return 'rust'
    case 'go':
      return 'go'
    case 'sql':
      return 'sql'
    case 'json':
      return 'json'
    case 'yaml':
    case 'yml':
      return 'yaml'
    case 'md':
      return 'markdown'
    case 'css':
      return 'css'
    case 'html':
      return 'html'
    case 'sh':
    case 'bash':
      return 'bash'
    default:
      return 'text'
  }
}

function FileChangeCard({ change }: { change: FileChange }) {
  const [isExpanded, setIsExpanded] = useState(true)
  const fileName = change.filePath.split('/').pop() || change.filePath
  const dirPath = change.filePath.split('/').slice(0, -1).join('/')
  const language = detectLanguage(change.filePath)

  return (
    <div className="border border-claude-border rounded-lg overflow-hidden bg-claude-surface/30">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-claude-surface-hover transition-colors"
      >
        {isExpanded ? (
          <VscChevronDown className="text-claude-text-secondary flex-shrink-0" />
        ) : (
          <VscChevronRight className="text-claude-text-secondary flex-shrink-0" />
        )}
        {change.toolName === 'Edit' ? (
          <VscDiff className="text-yellow-400 flex-shrink-0" />
        ) : (
          <VscFile className="text-green-400 flex-shrink-0" />
        )}
        <span className="text-sm font-medium text-claude-text">{fileName}</span>
        <span className="text-xs text-claude-text-secondary truncate flex-1 text-left">
          {dirPath}
        </span>
        <span className={`text-xs px-2 py-0.5 rounded ${
          change.toolName === 'Edit'
            ? 'bg-yellow-500/20 text-yellow-400'
            : 'bg-green-500/20 text-green-400'
        }`}>
          {change.toolName === 'Edit' ? 'Modified' : 'Created'}
        </span>
      </button>

      {isExpanded && (
        <div className="border-t border-claude-border">
          {change.toolName === 'Edit' && change.input.old_string !== undefined && change.input.new_string !== undefined && (
            <div className="grid grid-cols-2 divide-x divide-claude-border">
              <div>
                <div className="px-3 py-1 bg-red-500/10 text-xs text-red-400 font-medium">
                  Removed
                </div>
                <SyntaxHighlighter
                  language={language}
                  style={oneDark as any}
                  customStyle={{
                    margin: 0,
                    padding: '0.75rem',
                    background: 'rgba(239, 68, 68, 0.05)',
                    fontSize: '0.7rem',
                    maxHeight: '200px',
                    overflow: 'auto'
                  }}
                >
                  {String(change.input.old_string)}
                </SyntaxHighlighter>
              </div>
              <div>
                <div className="px-3 py-1 bg-green-500/10 text-xs text-green-400 font-medium">
                  Added
                </div>
                <SyntaxHighlighter
                  language={language}
                  style={oneDark as any}
                  customStyle={{
                    margin: 0,
                    padding: '0.75rem',
                    background: 'rgba(34, 197, 94, 0.05)',
                    fontSize: '0.7rem',
                    maxHeight: '200px',
                    overflow: 'auto'
                  }}
                >
                  {String(change.input.new_string)}
                </SyntaxHighlighter>
              </div>
            </div>
          )}

          {change.toolName === 'Write' && change.input.content !== undefined && (
            <div>
              <div className="px-3 py-1 bg-green-500/10 text-xs text-green-400 font-medium">
                New File Content
              </div>
              <SyntaxHighlighter
                language={language}
                style={oneDark as any}
                customStyle={{
                  margin: 0,
                  padding: '0.75rem',
                  background: 'transparent',
                  fontSize: '0.7rem',
                  maxHeight: '300px',
                  overflow: 'auto'
                }}
                showLineNumbers
              >
                {String(change.input.content).substring(0, 3000)}
                {String(change.input.content).length > 3000 ? '\n... (truncated)' : ''}
              </SyntaxHighlighter>
            </div>
          )}

          {change.result?.isError && (
            <div className="px-3 py-2 bg-red-500/10 border-t border-red-500/30">
              <div className="text-xs text-red-400 font-medium mb-1">Error</div>
              <pre className="text-xs text-red-300 whitespace-pre-wrap">
                {change.result.content}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ToolGroupSection({ group, isExpanded, onToggle }: {
  group: ToolGroup
  isExpanded: boolean
  onToggle: () => void
}) {
  const completedCount = group.tools.filter(t => {
    const result = group.results[t.id]
    return result && !result.isError
  }).length
  const errorCount = group.tools.filter(t => {
    const result = group.results[t.id]
    return result?.isError
  }).length

  return (
    <div className="border border-claude-border rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className={`w-full flex items-center gap-2 px-3 py-2 hover:bg-claude-surface-hover transition-colors ${group.color}`}
      >
        {isExpanded ? (
          <VscChevronDown className="text-claude-text-secondary" />
        ) : (
          <VscChevronRight className="text-claude-text-secondary" />
        )}
        {group.icon}
        <span className="text-sm font-medium text-claude-text">{group.type}</span>
        <span className="text-xs text-claude-text-secondary">
          {group.tools.length} {group.tools.length === 1 ? 'call' : 'calls'}
        </span>
        <span className="flex-1" />
        {completedCount > 0 && (
          <span className="flex items-center gap-1 text-xs text-claude-success">
            <VscCheck className="w-3 h-3" />
            {completedCount}
          </span>
        )}
        {errorCount > 0 && (
          <span className="flex items-center gap-1 text-xs text-claude-error ml-2">
            <VscClose className="w-3 h-3" />
            {errorCount}
          </span>
        )}
      </button>

      {isExpanded && (
        <div className="border-t border-claude-border bg-claude-bg/50 max-h-60 overflow-y-auto">
          {group.tools.map((tool, idx) => {
            const result = group.results[tool.id]
            const summary = getToolSummary(tool.name, tool.input)
            return (
              <div
                key={tool.id}
                className={`px-3 py-1.5 text-xs flex items-center gap-2 ${
                  idx !== group.tools.length - 1 ? 'border-b border-claude-border/50' : ''
                }`}
              >
                {result ? (
                  result.isError ? (
                    <VscClose className="text-claude-error flex-shrink-0" />
                  ) : (
                    <VscCheck className="text-claude-success flex-shrink-0" />
                  )
                ) : (
                  <span className="w-3 h-3 rounded-full border border-claude-text-secondary flex-shrink-0" />
                )}
                <span className="text-claude-text-secondary truncate" title={summary}>
                  {summary}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function getToolSummary(toolName: string, input: Record<string, unknown>): string {
  switch (toolName) {
    case 'Read':
      return String(input.file_path || input.path || 'file')
    case 'Write':
    case 'Edit':
      return String(input.file_path || input.path || 'file')
    case 'Bash':
      const cmd = String(input.command || '')
      return cmd.length > 60 ? cmd.substring(0, 60) + '...' : cmd
    case 'Glob':
      return String(input.pattern || 'pattern')
    case 'Grep':
      return String(input.pattern || 'pattern')
    case 'WebFetch':
      return String(input.url || 'URL')
    case 'WebSearch':
      return String(input.query || 'query')
    case 'Task':
      return String(input.description || 'task')
    default:
      return toolName
  }
}

export function ToolSummary({ toolUses, toolResults = {} }: ToolSummaryProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  // Extract file changes (Edit and Write operations)
  const fileChanges = useMemo<FileChange[]>(() => {
    return toolUses
      .filter(t => t.name === 'Edit' || t.name === 'Write')
      .map(t => ({
        filePath: String(t.input.file_path || t.input.path || ''),
        toolName: t.name as 'Edit' | 'Write',
        oldContent: t.input.old_string as string | undefined,
        newContent: t.input.new_string as string | undefined,
        input: t.input,
        result: toolResults[t.id]
      }))
  }, [toolUses, toolResults])

  // Group tools by type (excluding Edit/Write which are shown separately)
  const toolGroups = useMemo<ToolGroup[]>(() => {
    const groups: Record<string, ToolGroup> = {}

    const otherTools = toolUses.filter(t => t.name !== 'Edit' && t.name !== 'Write')

    for (const tool of otherTools) {
      if (!groups[tool.name]) {
        groups[tool.name] = {
          type: tool.name,
          icon: getToolIcon(tool.name),
          color: getToolColor(tool.name),
          tools: [],
          results: {}
        }
      }
      groups[tool.name].tools.push(tool)
      if (toolResults[tool.id]) {
        groups[tool.name].results[tool.id] = toolResults[tool.id]
      }
    }

    // Sort: most used first
    return Object.values(groups).sort((a, b) => b.tools.length - a.tools.length)
  }, [toolUses, toolResults])

  const toggleGroup = (type: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(type)) {
        next.delete(type)
      } else {
        next.add(type)
      }
      return next
    })
  }

  const totalTools = toolUses.length
  const completedTools = toolUses.filter(t => {
    const result = toolResults[t.id]
    return result && !result.isError
  }).length

  if (toolUses.length === 0) return null

  return (
    <div className="mt-3 space-y-3">
      {/* Summary bar */}
      <div className="flex items-center gap-3 text-xs text-claude-text-secondary">
        <span className="flex items-center gap-1">
          <VscCheck className="text-claude-success" />
          {completedTools}/{totalTools} tools completed
        </span>
        {fileChanges.length > 0 && (
          <span className="flex items-center gap-1">
            <VscDiff className="text-yellow-400" />
            {fileChanges.length} file{fileChanges.length !== 1 ? 's' : ''} changed
          </span>
        )}
      </div>

      {/* File changes section - shown prominently */}
      {fileChanges.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <VscFolderOpened className="text-claude-accent" />
            <span className="text-sm font-medium text-claude-text">File Changes</span>
          </div>
          <div className="space-y-2">
            {fileChanges.map((change, idx) => (
              <FileChangeCard key={idx} change={change} />
            ))}
          </div>
        </div>
      )}

      {/* Other tools - collapsed by default */}
      {toolGroups.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <VscTerminal className="text-claude-text-secondary" />
            <span className="text-sm font-medium text-claude-text">Tool Executions</span>
          </div>
          <div className="space-y-1">
            {toolGroups.map(group => (
              <ToolGroupSection
                key={group.type}
                group={group}
                isExpanded={expandedGroups.has(group.type)}
                onToggle={() => toggleGroup(group.type)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function getToolIcon(toolName: string): React.ReactNode {
  switch (toolName) {
    case 'Read':
      return <VscFile className="text-blue-400" />
    case 'Bash':
      return <VscTerminal className="text-orange-400" />
    case 'Glob':
    case 'Grep':
      return <VscSearch className="text-purple-400" />
    case 'WebFetch':
    case 'WebSearch':
      return <VscGlobe className="text-cyan-400" />
    case 'Task':
      return <VscFolderOpened className="text-teal-400" />
    default:
      return <VscFile className="text-claude-text-secondary" />
  }
}

function getToolColor(toolName: string): string {
  switch (toolName) {
    case 'Read':
      return 'bg-blue-500/5'
    case 'Bash':
      return 'bg-orange-500/5'
    case 'Glob':
    case 'Grep':
      return 'bg-purple-500/5'
    case 'WebFetch':
    case 'WebSearch':
      return 'bg-cyan-500/5'
    case 'Task':
      return 'bg-teal-500/5'
    default:
      return 'bg-claude-surface'
  }
}
