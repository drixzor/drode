import React, { useEffect, useRef } from 'react'
import { VscNewFile, VscNewFolder, VscEdit, VscTrash } from 'react-icons/vsc'
import { FileEntry } from '../../types'

interface ContextMenuProps {
  x: number
  y: number
  entry: FileEntry | null
  projectPath: string
  onClose: () => void
  onCreateFile: () => void
  onCreateFolder: () => void
  onRename?: () => void
  onDelete?: () => void
}

export function ContextMenu({
  x,
  y,
  entry,
  onClose,
  onCreateFile,
  onCreateFolder,
  onRename,
  onDelete
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [onClose])

  // Adjust position to keep menu in viewport
  const adjustedPosition = {
    x: Math.min(x, window.innerWidth - 180),
    y: Math.min(y, window.innerHeight - 200)
  }

  return (
    <div
      ref={menuRef}
      className="context-menu"
      style={{ top: adjustedPosition.y, left: adjustedPosition.x }}
    >
      <button
        className="context-menu-item flex items-center gap-2 w-full text-left"
        onClick={onCreateFile}
      >
        <VscNewFile />
        <span>New File</span>
      </button>
      <button
        className="context-menu-item flex items-center gap-2 w-full text-left"
        onClick={onCreateFolder}
      >
        <VscNewFolder />
        <span>New Folder</span>
      </button>

      {entry && (
        <>
          <div className="border-t border-claude-border my-1" />
          <button
            className="context-menu-item flex items-center gap-2 w-full text-left"
            onClick={onRename}
          >
            <VscEdit />
            <span>Rename</span>
          </button>
          <button
            className="context-menu-item flex items-center gap-2 w-full text-left text-claude-error hover:bg-red-900/20"
            onClick={onDelete}
          >
            <VscTrash />
            <span>Delete</span>
          </button>
        </>
      )}
    </div>
  )
}
