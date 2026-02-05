import React, { useState } from 'react'
import {
  VscFile,
  VscEdit,
  VscTerminal,
  VscSearch,
  VscGlobe,
  VscWarning,
  VscChevronDown,
  VscChevronRight,
  VscCheck,
  VscClose,
  VscLoading,
  VscWatch,
  VscFileCode
} from 'react-icons/vsc'
import { ToolUseRequest, ToolResult } from '../../types'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'

interface ToolExecutionCardProps {
  toolUse: ToolUseRequest
  result?: ToolResult
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
    default:
      return <VscWarning className="text-claude-text-secondary" />
  }
}

function getStatusIcon(status: ToolUseRequest['status']) {
  switch (status) {
    case 'pending':
      return <VscWatch className="text-claude-text-secondary" />
    case 'approved':
    case 'executing':
      return <VscLoading className="text-claude-accent animate-spin" />
    case 'completed':
      return <VscCheck className="text-claude-success" />
    case 'denied':
    case 'error':
      return <VscClose className="text-claude-error" />
    default:
      return null
  }
}

function getStatusText(status: ToolUseRequest['status']): string {
  switch (status) {
    case 'pending':
      return 'Pending approval'
    case 'approved':
      return 'Approved'
    case 'executing':
      return 'Executing...'
    case 'completed':
      return 'Completed'
    case 'denied':
      return 'Denied'
    case 'error':
      return 'Error'
    default:
      return status
  }
}

function getToolSummary(toolName: string, input: Record<string, unknown>): string {
  switch (toolName) {
    case 'Read':
      return String(input.file_path || input.path || 'file')
    case 'Write':
      return String(input.file_path || input.path || 'file')
    case 'Edit':
      return String(input.file_path || input.path || 'file')
    case 'Bash':
      const cmd = String(input.command || '')
      return cmd.length > 40 ? cmd.substring(0, 40) + '...' : cmd
    case 'Glob':
      return String(input.pattern || 'pattern')
    case 'Grep':
      return String(input.pattern || 'pattern')
    case 'WebFetch':
      return String(input.url || 'URL')
    case 'WebSearch':
      return String(input.query || 'query')
    default:
      return toolName
  }
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
    case 'java':
      return 'java'
    case 'cpp':
    case 'cc':
    case 'cxx':
      return 'cpp'
    case 'c':
    case 'h':
      return 'c'
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

const MAX_RESULT_LINES = 20
const MAX_RESULT_LENGTH = 2000

export function ToolExecutionCard({ toolUse, result }: ToolExecutionCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [showFullResult, setShowFullResult] = useState(false)

  // Derive effective status from result presence (fixes stale status issue)
  const effectiveStatus: ToolUseRequest['status'] = result
    ? (result.isError ? 'error' : 'completed')
    : toolUse.status

  const borderColor = effectiveStatus === 'error' || effectiveStatus === 'denied'
    ? 'border-claude-error/30'
    : effectiveStatus === 'completed'
    ? 'border-claude-success/30'
    : 'border-claude-border'

  return (
    <div className={`my-2 rounded-lg border ${borderColor} bg-claude-surface/50 overflow-hidden`}>
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-claude-surface-hover transition-colors"
      >
        {isExpanded ? (
          <VscChevronDown className="text-claude-text-secondary flex-shrink-0" />
        ) : (
          <VscChevronRight className="text-claude-text-secondary flex-shrink-0" />
        )}
        <span className="flex-shrink-0">{getToolIcon(toolUse.name)}</span>
        <span className="text-sm font-medium text-claude-text flex-shrink-0">
          {toolUse.name}
        </span>
        <span className="text-xs text-claude-text-secondary truncate flex-1 text-left">
          {getToolSummary(toolUse.name, toolUse.input)}
        </span>
        <span className="flex items-center gap-1 flex-shrink-0">
          {getStatusIcon(effectiveStatus)}
          <span className="text-xs text-claude-text-secondary">
            {getStatusText(effectiveStatus)}
          </span>
        </span>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-3 pb-3 border-t border-claude-border/50">
          {/* Input */}
          <div className="mt-3">
            <div className="text-xs text-claude-text-secondary mb-1 uppercase tracking-wider">
              Input
            </div>
            <div className="bg-claude-bg rounded-lg overflow-hidden border border-claude-border">
              {toolUse.name === 'Bash' ? (
                <SyntaxHighlighter
                  language="bash"
                  style={oneDark as any}
                  customStyle={{
                    margin: 0,
                    padding: '0.75rem',
                    background: 'transparent',
                    fontSize: '0.75rem'
                  }}
                >
                  {String(toolUse.input.command || '')}
                </SyntaxHighlighter>
              ) : (
                <pre className="text-xs text-claude-text font-mono p-3 overflow-x-auto">
                  {JSON.stringify(toolUse.input, null, 2)}
                </pre>
              )}
            </div>
          </div>

          {/* Result */}
          {result && (
            <div className="mt-3">
              <div className={`text-xs mb-1 uppercase tracking-wider ${result.isError ? 'text-claude-error' : 'text-claude-text-secondary'}`}>
                {result.isError ? 'Error' : 'Result'}
              </div>
              {(() => {
                const content = result.content
                const lines = content.split('\n')
                const isTruncated = !showFullResult && (lines.length > MAX_RESULT_LINES || content.length > MAX_RESULT_LENGTH)
                const displayContent = isTruncated
                  ? lines.slice(0, MAX_RESULT_LINES).join('\n').substring(0, MAX_RESULT_LENGTH)
                  : content

                // Parse Glob/Grep results as file lists
                const isFileList = (toolUse.name === 'Glob' || toolUse.name === 'Grep') && !result.isError
                const fileListContent = isFileList ? displayContent.split('\n').filter(Boolean) : []

                return (
                  <>
                    <div className={`rounded-lg overflow-hidden border ${result.isError ? 'border-claude-error/30 bg-claude-error/5' : 'border-claude-border bg-claude-bg'}`}>
                      {isFileList ? (
                        <div className="p-2 max-h-72 overflow-y-auto">
                          {fileListContent.map((file, idx) => (
                            <div key={idx} className="flex items-center gap-2 py-0.5 px-1 text-xs font-mono text-claude-text hover:bg-claude-surface-hover rounded">
                              <VscFile className="text-claude-text-secondary flex-shrink-0" />
                              <span className="truncate" title={file}>{file}</span>
                            </div>
                          ))}
                          {isTruncated && (
                            <div className="text-claude-text-secondary text-xs italic mt-1 px-1">
                              ... and more files
                            </div>
                          )}
                        </div>
                      ) : toolUse.name === 'Read' && !result.isError ? (
                        <SyntaxHighlighter
                          language={detectLanguage(String(toolUse.input.file_path || toolUse.input.path || ''))}
                          style={oneDark as any}
                          customStyle={{
                            margin: 0,
                            padding: '0.75rem',
                            background: 'transparent',
                            fontSize: '0.75rem',
                            maxHeight: '300px',
                            overflow: 'auto'
                          }}
                          showLineNumbers
                        >
                          {displayContent}
                        </SyntaxHighlighter>
                      ) : toolUse.name === 'Bash' && !result.isError ? (
                        <SyntaxHighlighter
                          language="bash"
                          style={oneDark as any}
                          customStyle={{
                            margin: 0,
                            padding: '0.75rem',
                            background: 'transparent',
                            fontSize: '0.75rem',
                            maxHeight: '300px',
                            overflow: 'auto'
                          }}
                        >
                          {displayContent}
                        </SyntaxHighlighter>
                      ) : (
                        <pre className={`text-xs font-mono p-3 overflow-x-auto max-h-72 whitespace-pre-wrap ${result.isError ? 'text-claude-error' : 'text-claude-text'}`}>
                          {displayContent}
                        </pre>
                      )}
                    </div>
                    {isTruncated && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setShowFullResult(true)
                        }}
                        className="mt-1 text-xs text-claude-accent hover:underline"
                      >
                        Show full result ({lines.length} lines, {(content.length / 1024).toFixed(1)}KB)
                      </button>
                    )}
                    {showFullResult && lines.length > MAX_RESULT_LINES && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setShowFullResult(false)
                        }}
                        className="mt-1 text-xs text-claude-text-secondary hover:underline"
                      >
                        Show less
                      </button>
                    )}
                  </>
                )
              })()}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
