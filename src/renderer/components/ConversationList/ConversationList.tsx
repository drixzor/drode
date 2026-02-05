import React, { useState, useEffect, useRef, memo } from 'react'
import {
  VscComment,
  VscAdd,
  VscTrash,
  VscEdit,
  VscCheck,
  VscClose,
  VscChevronDown,
  VscChevronRight
} from 'react-icons/vsc'
import { ConversationSummary } from '../../types'
import { useProjectStore } from '../../stores/projectStore'
import { useConversationStore } from '../../stores/conversationStore'

export const ConversationList = memo(function ConversationList() {
  const projectPath = useProjectStore((s) => s.currentProject)
  const conversations = useConversationStore((s) => s.conversations)
  const activeConversationId = useConversationStore((s) => s.activeConversationId)
  const selectConversation = useConversationStore((s) => s.selectConversation)
  const newConversation = useConversationStore((s) => s.newConversation)
  const deleteConversation = useConversationStore((s) => s.deleteConversation)
  const renameConversation = useConversationStore((s) => s.renameConversation)

  const [isExpanded, setIsExpanded] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus input when editing starts
  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editingId])

  const handleStartRename = (conv: ConversationSummary, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingId(conv.id)
    setEditName(conv.name)
  }

  const handleSaveRename = (id: string) => {
    if (editName.trim()) {
      renameConversation(id, editName.trim())
    }
    setEditingId(null)
    setEditName('')
  }

  const handleCancelRename = () => {
    setEditingId(null)
    setEditName('')
  }

  const handleKeyDown = (e: React.KeyboardEvent, id: string) => {
    if (e.key === 'Enter') {
      handleSaveRename(id)
    } else if (e.key === 'Escape') {
      handleCancelRename()
    }
  }

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (days === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } else if (days === 1) {
      return 'Yesterday'
    } else if (days < 7) {
      return date.toLocaleDateString([], { weekday: 'short' })
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
    }
  }

  if (!projectPath) return null

  return (
    <div className="border-b border-claude-border">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-2 hover:bg-claude-surface-hover transition-colors"
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <VscChevronDown className="text-claude-text-secondary" />
          ) : (
            <VscChevronRight className="text-claude-text-secondary" />
          )}
          <VscComment className="text-claude-text-secondary" />
          <span className="text-sm font-medium text-claude-text">Conversations</span>
          <span className="text-xs text-claude-text-secondary">({conversations.length})</span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation()
            newConversation()
          }}
          className="p-1 hover:bg-claude-surface rounded transition-colors"
          title="New conversation"
        >
          <VscAdd className="text-claude-accent" />
        </button>
      </button>

      {/* List */}
      {isExpanded && (
        <div className="max-h-48 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="px-4 py-3 text-xs text-claude-text-secondary text-center">
              No conversations yet.
              <button
                onClick={newConversation}
                className="block mx-auto mt-1 text-claude-accent hover:underline"
              >
                Start a new conversation
              </button>
            </div>
          ) : (
            conversations.map(conv => (
              <div
                key={conv.id}
                onClick={() => selectConversation(conv.id)}
                className={`group flex items-center gap-2 px-4 py-2 cursor-pointer transition-colors ${
                  conv.id === activeConversationId
                    ? 'bg-claude-accent/10 border-l-2 border-claude-accent'
                    : 'hover:bg-claude-surface-hover border-l-2 border-transparent'
                }`}
              >
                {editingId === conv.id ? (
                  <div className="flex-1 flex items-center gap-1">
                    <input
                      ref={inputRef}
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, conv.id)}
                      onBlur={() => handleSaveRename(conv.id)}
                      className="flex-1 bg-claude-surface px-2 py-0.5 text-sm text-claude-text rounded border border-claude-border focus:border-claude-accent outline-none"
                    />
                    <button
                      onClick={(e) => { e.stopPropagation(); handleSaveRename(conv.id) }}
                      className="p-0.5 hover:bg-claude-surface-hover rounded"
                    >
                      <VscCheck className="text-claude-success text-xs" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleCancelRename() }}
                      className="p-0.5 hover:bg-claude-surface-hover rounded"
                    >
                      <VscClose className="text-claude-error text-xs" />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-claude-text truncate">{conv.name}</div>
                      <div className="text-xs text-claude-text-secondary">
                        {conv.messageCount} messages · {formatDate(conv.updatedAt)}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => handleStartRename(conv, e)}
                        className="p-1 hover:bg-claude-surface rounded transition-colors"
                        title="Rename"
                      >
                        <VscEdit className="text-claude-text-secondary text-xs" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          if (confirm('Delete this conversation?')) {
                            deleteConversation(conv.id)
                          }
                        }}
                        className="p-1 hover:bg-claude-surface rounded transition-colors"
                        title="Delete"
                      >
                        <VscTrash className="text-claude-error text-xs" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
})
