import React, { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { VscAccount, VscRobot, VscInfo, VscDashboard, VscChevronDown, VscChevronRight } from 'react-icons/vsc'
import { ConversationMessage, MessageMetadata } from '../../types'
import { ToolSummary } from './ToolSummary'

interface ChatMessageProps {
  message: ConversationMessage
}

function MetadataDisplay({ metadata }: { metadata: MessageMetadata }) {
  const [isExpanded, setIsExpanded] = useState(false)

  const formatDuration = (ms?: number) => {
    if (!ms) return '-'
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(2)}s`
  }

  const formatCost = (usd?: number) => {
    if (!usd) return '-'
    if (usd < 0.01) return `$${usd.toFixed(6)}`
    return `$${usd.toFixed(4)}`
  }

  const formatTokens = (tokens?: number) => {
    if (!tokens) return '-'
    if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}k`
    return tokens.toString()
  }

  const formatModel = (model?: string) => {
    if (!model) return '-'
    // Shorten model name for display
    return model.replace('claude-', '').replace('-20251101', '')
  }

  const totalTokens = (metadata.inputTokens || 0) + (metadata.outputTokens || 0) +
    (metadata.cacheReadTokens || 0) + (metadata.cacheCreationTokens || 0)

  return (
    <div className="mt-3 pl-8">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-1.5 text-xs text-claude-text-secondary hover:text-claude-text transition-colors"
      >
        {isExpanded ? <VscChevronDown /> : <VscChevronRight />}
        <VscDashboard />
        <span>{formatDuration(metadata.durationMs)}</span>
        <span className="text-claude-border">•</span>
        <span>{formatTokens(totalTokens)} tokens</span>
        <span className="text-claude-border">•</span>
        <span>{formatCost(metadata.totalCostUsd)}</span>
      </button>

      {isExpanded && (
        <div className="mt-2 p-3 bg-claude-surface rounded-lg border border-claude-border">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <div className="text-claude-text-secondary mb-1">Response Time</div>
              <div className="font-mono text-claude-text">{formatDuration(metadata.durationMs)}</div>
            </div>
            <div>
              <div className="text-claude-text-secondary mb-1">API Time</div>
              <div className="font-mono text-claude-text">{formatDuration(metadata.durationApiMs)}</div>
            </div>
            <div>
              <div className="text-claude-text-secondary mb-1">Cost</div>
              <div className="font-mono text-claude-accent">{formatCost(metadata.totalCostUsd)}</div>
            </div>
            <div>
              <div className="text-claude-text-secondary mb-1">Model</div>
              <div className="font-mono text-claude-text">{formatModel(metadata.model)}</div>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-claude-border">
            <div className="text-claude-text-secondary text-xs mb-2">Token Usage</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <div className="text-claude-text-secondary mb-1">Input</div>
                <div className="font-mono text-claude-text">{formatTokens(metadata.inputTokens)}</div>
              </div>
              <div>
                <div className="text-claude-text-secondary mb-1">Output</div>
                <div className="font-mono text-claude-success">{formatTokens(metadata.outputTokens)}</div>
              </div>
              <div>
                <div className="text-claude-text-secondary mb-1">Cache Read</div>
                <div className="font-mono text-blue-400">{formatTokens(metadata.cacheReadTokens)}</div>
              </div>
              <div>
                <div className="text-claude-text-secondary mb-1">Cache Create</div>
                <div className="font-mono text-purple-400">{formatTokens(metadata.cacheCreationTokens)}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export function ChatMessage({ message }: ChatMessageProps) {
  const getIcon = () => {
    switch (message.role) {
      case 'user':
        return <VscAccount className="text-claude-accent" />
      case 'assistant':
        return <VscRobot className="text-claude-success" />
      case 'system':
        return <VscInfo className="text-claude-text-secondary" />
    }
  }

  const getRoleLabel = () => {
    switch (message.role) {
      case 'user':
        return 'You'
      case 'assistant':
        return 'Claude'
      case 'system':
        return 'System'
    }
  }

  const getBgColor = () => {
    switch (message.role) {
      case 'user':
        return 'bg-claude-surface'
      case 'assistant':
        return 'bg-transparent'
      case 'system':
        return 'bg-claude-surface/50'
    }
  }

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className={`rounded-lg p-4 animate-fade-in ${getBgColor()}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="w-6 h-6 flex items-center justify-center rounded-full bg-claude-surface-hover">
          {getIcon()}
        </span>
        <span className="text-sm font-medium">{getRoleLabel()}</span>
        <span className="text-xs text-claude-text-secondary">
          {formatTimestamp(message.timestamp)}
        </span>
      </div>

      <div className="markdown-content pl-8">
        {message.role === 'system' ? (
          <p className="text-claude-text-secondary text-sm italic">{message.content}</p>
        ) : (
          <ReactMarkdown
            children={message.content}
            components={{
              code({ className, children }) {
                const match = /language-(\w+)/.exec(className || '')
                const isInline = !match && !className
                const codeString = String(children).replace(/\n$/, '')

                if (isInline) {
                  return (
                    <code className="bg-claude-surface px-1.5 py-0.5 rounded text-sm font-mono">
                      {children}
                    </code>
                  )
                }

                return (
                  <div className="code-block my-3">
                    {match && (
                      <div className="flex items-center justify-between px-4 py-2 bg-claude-surface-hover border-b border-claude-border">
                        <span className="text-xs text-claude-text-secondary uppercase">
                          {match[1]}
                        </span>
                        <button
                          className="text-xs text-claude-text-secondary hover:text-claude-text"
                          onClick={() => navigator.clipboard.writeText(codeString)}
                        >
                          Copy
                        </button>
                      </div>
                    )}
                    <SyntaxHighlighter
                      style={oneDark as any}
                      language={match ? match[1] : 'text'}
                      PreTag="div"
                      customStyle={{
                        margin: 0,
                        padding: '1rem',
                        background: 'transparent',
                        fontSize: '0.875rem'
                      }}
                    >
                      {codeString}
                    </SyntaxHighlighter>
                  </div>
                )
              },
              p({ children }) {
                return <p className="my-2 leading-relaxed">{children}</p>
              },
              ul({ children }) {
                return <ul className="list-disc list-inside my-2 space-y-1">{children}</ul>
              },
              ol({ children }) {
                return <ol className="list-decimal list-inside my-2 space-y-1">{children}</ol>
              },
              li({ children }) {
                return <li className="leading-relaxed">{children}</li>
              },
              a({ href, children }) {
                return (
                  <a
                    href={href}
                    className="text-claude-accent hover:underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {children}
                  </a>
                )
              },
              blockquote({ children }) {
                return (
                  <blockquote className="border-l-4 border-claude-border pl-4 my-2 text-claude-text-secondary italic">
                    {children}
                  </blockquote>
                )
              },
              h1({ children }) {
                return <h1 className="text-xl font-bold mt-4 mb-2">{children}</h1>
              },
              h2({ children }) {
                return <h2 className="text-lg font-semibold mt-4 mb-2">{children}</h2>
              },
              h3({ children }) {
                return <h3 className="text-base font-semibold mt-3 mb-1">{children}</h3>
              },
              hr() {
                return <hr className="my-4 border-claude-border" />
              },
              table({ children }) {
                return (
                  <div className="overflow-x-auto my-4">
                    <table className="w-full border-collapse border border-claude-border">
                      {children}
                    </table>
                  </div>
                )
              },
              th({ children }) {
                return (
                  <th className="border border-claude-border px-4 py-2 bg-claude-surface text-left font-semibold">
                    {children}
                  </th>
                )
              },
              td({ children }) {
                return (
                  <td className="border border-claude-border px-4 py-2">
                    {children}
                  </td>
                )
              }
            }}
          />
        )}
      </div>

      {/* Tool summary for assistant messages */}
      {message.role === 'assistant' && message.toolUses && message.toolUses.length > 0 && (
        <div className="pl-8">
          <ToolSummary
            toolUses={message.toolUses}
            toolResults={message.toolResults}
          />
        </div>
      )}

      {/* Metadata display for assistant messages */}
      {message.role === 'assistant' && message.metadata && (
        <MetadataDisplay metadata={message.metadata} />
      )}
    </div>
  )
}
