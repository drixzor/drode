import React, { useState, useRef, useEffect, useCallback, memo } from 'react'
import { VscSend, VscClearAll, VscTerminal, VscAdd } from 'react-icons/vsc'
import { ChatMessage } from './ChatMessage'
import { LoadingIndicator } from './LoadingIndicator'
import { useConversationStore } from '../../stores/conversationStore'

export const Chat = memo(function Chat() {
  const messages = useConversationStore((s) => s.messages)
  const isLoading = useConversationStore((s) => s.isLoading)
  const status = useConversationStore((s) => s.status)
  const rawOutput = useConversationStore((s) => s.rawOutput)
  const sendMessage = useConversationStore((s) => s.sendMessage)
  const clearConversation = useConversationStore((s) => s.clearConversation)
  const newConversation = useConversationStore((s) => s.newConversation)
  const [input, setInput] = useState('')
  const [showRawOutput, setShowRawOutput] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, rawOutput, isLoading])

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Focus input on Cmd/Ctrl + K
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleSubmit = useCallback((e?: React.FormEvent) => {
    e?.preventDefault()
    if (!input.trim() || status !== 'running') return

    sendMessage(input)
    setInput('')
  }, [input, status, sendMessage])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }, [handleSubmit])

  // Auto-resize textarea
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`
  }, [])

  const isConnected = status === 'running'

  return (
    <div className="h-full flex flex-col bg-claude-bg">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-claude-border">
        <div className="flex items-center gap-2">
          <VscTerminal className="text-claude-accent" />
          <span className="text-sm font-medium">Claude Code</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            className={`px-2 py-1 text-xs rounded transition-colors ${
              showRawOutput
                ? 'bg-claude-accent text-white'
                : 'bg-claude-surface text-claude-text-secondary hover:bg-claude-surface-hover'
            }`}
            onClick={() => setShowRawOutput(!showRawOutput)}
          >
            Raw Output
          </button>
          <button
            className="p-1.5 hover:bg-claude-surface-hover rounded transition-colors"
            onClick={newConversation}
            title="New conversation"
          >
            <VscAdd className="text-claude-accent" />
          </button>
          <button
            className="p-1.5 hover:bg-claude-surface-hover rounded transition-colors"
            onClick={clearConversation}
            title="Clear conversation"
          >
            <VscClearAll className="text-claude-text-secondary" />
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-auto px-4 py-4">
        {showRawOutput ? (
          <div className="font-mono text-sm text-claude-text whitespace-pre-wrap break-all bg-claude-surface rounded-lg p-4">
            {rawOutput || 'No output yet...'}
          </div>
        ) : (
          <>
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-claude-text-secondary">
                <VscTerminal className="text-4xl mb-4 text-claude-accent" />
                <p className="text-center">No messages yet</p>
                <p className="text-sm text-center mt-2">
                  {isConnected
                    ? 'Type a message below to start chatting with Claude Code'
                    : 'Connect to Claude Code to start a conversation'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message) => (
                  <ChatMessage key={message.id} message={message} />
                ))}
                {isLoading && <LoadingIndicator streamingContent={rawOutput} />}
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-claude-border p-4">
        {!isConnected && (
          <div className="mb-2 px-3 py-2 bg-claude-surface rounded-lg text-sm text-claude-warning">
            {status === 'starting'
              ? 'Connecting to Claude Code...'
              : status === 'error'
              ? 'Connection error. Try reconnecting.'
              : 'Not connected to Claude Code. Click "Connect" in the top bar to start.'}
          </div>
        )}
        <form onSubmit={handleSubmit} className="flex gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              data-chat-input
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={isConnected ? 'Type a message... (Shift+Enter for new line)' : 'Connect to start chatting...'}
              disabled={!isConnected}
              className="w-full px-4 py-3 bg-claude-surface border border-claude-border rounded-lg resize-none text-claude-text placeholder-claude-text-secondary focus:border-claude-accent disabled:opacity-50 disabled:cursor-not-allowed"
              rows={1}
              style={{ minHeight: '48px', maxHeight: '200px' }}
            />
            <div className="absolute right-2 bottom-2 text-xs text-claude-text-secondary">
              ⌘K
            </div>
          </div>
          <button
            type="submit"
            disabled={!isConnected || !input.trim() || isLoading}
            className="px-4 py-3 bg-claude-accent hover:bg-claude-accent-hover text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <VscSend />
          </button>
        </form>
      </div>
    </div>
  )
})
