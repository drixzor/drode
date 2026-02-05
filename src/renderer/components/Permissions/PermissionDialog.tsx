import React from 'react'
import {
  VscFile,
  VscEdit,
  VscTerminal,
  VscSearch,
  VscGlobe,
  VscClose,
  VscCheck,
  VscWarning
} from 'react-icons/vsc'
import { PermissionRequest } from '../../types'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'

interface PermissionDialogProps {
  request: PermissionRequest | null
  onApprove: () => void
  onDeny: () => void
  onAcceptAll?: () => void
  queueLength?: number
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

function getToolColor(toolName: string): string {
  switch (toolName) {
    case 'Read':
      return 'border-blue-500/30 bg-blue-500/5'
    case 'Write':
      return 'border-green-500/30 bg-green-500/5'
    case 'Edit':
      return 'border-yellow-500/30 bg-yellow-500/5'
    case 'Bash':
      return 'border-orange-500/30 bg-orange-500/5'
    case 'Glob':
    case 'Grep':
      return 'border-purple-500/30 bg-purple-500/5'
    case 'WebFetch':
    case 'WebSearch':
      return 'border-cyan-500/30 bg-cyan-500/5'
    default:
      return 'border-claude-border bg-claude-surface'
  }
}

function ToolPreview({ toolName, input }: { toolName: string; input: Record<string, unknown> }) {
  switch (toolName) {
    case 'Bash': {
      const command = String(input.command || '')
      return (
        <div className="mt-3">
          <div className="text-xs text-claude-text-secondary mb-1">Command</div>
          <div className="bg-claude-bg rounded-lg overflow-hidden border border-claude-border">
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
              {command}
            </SyntaxHighlighter>
          </div>
        </div>
      )
    }
    case 'Read':
    case 'Write': {
      const filePath = String(input.file_path || input.path || '')
      return (
        <div className="mt-3">
          <div className="text-xs text-claude-text-secondary mb-1">File Path</div>
          <div className="bg-claude-bg rounded-lg px-3 py-2 border border-claude-border">
            <code className="text-xs text-claude-text font-mono break-all">{filePath}</code>
          </div>
          {toolName === 'Write' && input.content !== undefined && (
            <div className="mt-2">
              <div className="text-xs text-claude-text-secondary mb-1">Content Preview</div>
              <div className="bg-claude-bg rounded-lg overflow-hidden border border-claude-border max-h-32 overflow-y-auto">
                <pre className="text-xs text-claude-text font-mono p-3 whitespace-pre-wrap">
                  {(() => {
                    const content = String(input.content)
                    return content.substring(0, 500) + (content.length > 500 ? '...' : '')
                  })()}
                </pre>
              </div>
            </div>
          )}
        </div>
      )
    }
    case 'Edit': {
      const filePath = String(input.file_path || input.path || '')
      const oldString = String(input.old_string || '')
      const newString = String(input.new_string || '')
      return (
        <div className="mt-3 space-y-2">
          <div>
            <div className="text-xs text-claude-text-secondary mb-1">File Path</div>
            <div className="bg-claude-bg rounded-lg px-3 py-2 border border-claude-border">
              <code className="text-xs text-claude-text font-mono break-all">{filePath}</code>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-xs text-red-400 mb-1">Remove</div>
              <div className="bg-red-500/10 rounded-lg overflow-hidden border border-red-500/30 max-h-24 overflow-y-auto">
                <pre className="text-xs text-claude-text font-mono p-2 whitespace-pre-wrap">
                  {oldString.substring(0, 200)}
                  {oldString.length > 200 ? '...' : ''}
                </pre>
              </div>
            </div>
            <div>
              <div className="text-xs text-green-400 mb-1">Add</div>
              <div className="bg-green-500/10 rounded-lg overflow-hidden border border-green-500/30 max-h-24 overflow-y-auto">
                <pre className="text-xs text-claude-text font-mono p-2 whitespace-pre-wrap">
                  {newString.substring(0, 200)}
                  {newString.length > 200 ? '...' : ''}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )
    }
    case 'Glob': {
      const pattern = String(input.pattern || '')
      const path = String(input.path || '.')
      return (
        <div className="mt-3">
          <div className="text-xs text-claude-text-secondary mb-1">Pattern</div>
          <div className="bg-claude-bg rounded-lg px-3 py-2 border border-claude-border">
            <code className="text-xs text-claude-text font-mono">{pattern}</code>
            {path !== '.' && (
              <span className="text-xs text-claude-text-secondary ml-2">in {path}</span>
            )}
          </div>
        </div>
      )
    }
    case 'Grep': {
      const pattern = String(input.pattern || '')
      const path = String(input.path || '.')
      return (
        <div className="mt-3">
          <div className="text-xs text-claude-text-secondary mb-1">Search Pattern</div>
          <div className="bg-claude-bg rounded-lg px-3 py-2 border border-claude-border">
            <code className="text-xs text-claude-text font-mono">{pattern}</code>
            {path !== '.' && (
              <span className="text-xs text-claude-text-secondary ml-2">in {path}</span>
            )}
          </div>
        </div>
      )
    }
    case 'WebFetch':
    case 'WebSearch': {
      const url = String(input.url || input.query || '')
      return (
        <div className="mt-3">
          <div className="text-xs text-claude-text-secondary mb-1">
            {toolName === 'WebSearch' ? 'Query' : 'URL'}
          </div>
          <div className="bg-claude-bg rounded-lg px-3 py-2 border border-claude-border">
            <code className="text-xs text-claude-text font-mono break-all">{url}</code>
          </div>
        </div>
      )
    }
    default:
      return (
        <div className="mt-3">
          <div className="text-xs text-claude-text-secondary mb-1">Input</div>
          <div className="bg-claude-bg rounded-lg overflow-hidden border border-claude-border max-h-32 overflow-y-auto">
            <pre className="text-xs text-claude-text font-mono p-3">
              {JSON.stringify(input, null, 2)}
            </pre>
          </div>
        </div>
      )
  }
}

export function PermissionDialog({ request, onApprove, onDeny, onAcceptAll, queueLength = 0 }: PermissionDialogProps) {
  if (!request) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onDeny}
      />

      {/* Dialog */}
      <div className={`relative w-full max-w-lg mx-4 rounded-xl border shadow-2xl ${getToolColor(request.toolName)}`}>
        {/* Header */}
        <div className="flex items-center gap-3 p-4 border-b border-claude-border/50">
          <div className="w-10 h-10 rounded-lg bg-claude-surface flex items-center justify-center text-xl">
            {getToolIcon(request.toolName)}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-claude-text">
              {request.toolName} Tool
              {queueLength > 0 && (
                <span className="ml-2 text-xs font-normal text-claude-text-secondary">
                  (+{queueLength} more)
                </span>
              )}
            </h2>
            <p className="text-sm text-claude-text-secondary truncate">
              {request.description}
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          <p className="text-sm text-claude-text">
            Claude wants to use the <strong>{request.toolName}</strong> tool.
            Review the details below and approve or deny this action.
          </p>
          <ToolPreview toolName={request.toolName} input={request.toolInput} />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 p-4 border-t border-claude-border/50 bg-claude-surface/30">
          <div>
            {onAcceptAll && (
              <button
                onClick={onAcceptAll}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-claude-success bg-claude-success/10 hover:bg-claude-success/20 border border-claude-success/30 rounded-lg transition-colors"
              >
                <VscCheck />
                Accept All
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onDeny}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-claude-text bg-claude-surface hover:bg-claude-surface-hover border border-claude-border rounded-lg transition-colors"
            >
              <VscClose />
              Deny
            </button>
            <button
              onClick={onApprove}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-claude-accent hover:bg-claude-accent-hover rounded-lg transition-colors"
            >
              <VscCheck />
              Approve
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
