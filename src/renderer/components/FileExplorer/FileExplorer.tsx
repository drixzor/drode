import React, { useState, useCallback, memo } from 'react'
import { VscRefresh, VscNewFile, VscNewFolder, VscFolderOpened, VscFolder, VscChevronRight, VscChevronDown, VscCircleFilled, VscFile } from 'react-icons/vsc'
import { FileEntry } from '../../types'
import { FileIcon } from './FileIcon'
import { ContextMenu } from './ContextMenu'
import { useProjectStore } from '../../stores/projectStore'
import { useFileSystemStore } from '../../stores/fileSystemStore'
import { useEditorStore } from '../../stores/editorStore'

interface FileExplorerProps {
  onFileSelect: (filePath: string) => void
}

interface TreeNode extends FileEntry {
  children?: TreeNode[]
  isExpanded?: boolean
  isLoading?: boolean
}

export const FileExplorer = memo(function FileExplorer({
  onFileSelect,
}: FileExplorerProps) {
  const projectPath = useProjectStore((s) => s.currentProject)
  const files = useFileSystemStore((s) => s.files)
  const isLoading = useFileSystemStore((s) => s.isLoading)
  const loadSubdirectory = useFileSystemStore((s) => s.loadSubdirectory)
  const isFileChanged = useFileSystemStore((s) => s.isFileChanged)
  const onCreateFile = useFileSystemStore((s) => s.createFile)
  const onCreateDirectory = useFileSystemStore((s) => s.createDirectory)
  const onDeleteFile = useFileSystemStore((s) => s.deleteFile)
  const onRenameFile = useFileSystemStore((s) => s.renameFile)
  const onPreloadFile = useFileSystemStore((s) => s.preloadFile)
  const onRefresh = useFileSystemStore((s) => s.refresh)
  const selectedFile = useEditorStore((s) => {
    const activeTab = s.tabs.find((t) => t.id === s.activeTabId)
    return activeTab?.filePath ?? null
  })
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set())
  const [dirContents, setDirContents] = useState<Map<string, FileEntry[]>>(new Map())
  const [loadingDirs, setLoadingDirs] = useState<Set<string>>(new Set())
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; entry: FileEntry | null } | null>(null)
  const [isCreating, setIsCreating] = useState<{ type: 'file' | 'folder'; parentPath: string } | null>(null)
  const [newItemName, setNewItemName] = useState('')
  const [renamingPath, setRenamingPath] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const handleToggleDirectory = useCallback(async (dirPath: string) => {
    const isExpanded = expandedDirs.has(dirPath)

    if (isExpanded) {
      setExpandedDirs(prev => {
        const next = new Set(prev)
        next.delete(dirPath)
        return next
      })
    } else {
      setExpandedDirs(prev => new Set(prev).add(dirPath))

      // Load contents if not already loaded
      if (!dirContents.has(dirPath)) {
        setLoadingDirs(prev => new Set(prev).add(dirPath))
        const contents = await loadSubdirectory(dirPath)
        setDirContents(prev => new Map(prev).set(dirPath, contents))
        setLoadingDirs(prev => {
          const next = new Set(prev)
          next.delete(dirPath)
          return next
        })
      }
    }
  }, [expandedDirs, dirContents, loadSubdirectory])

  const handleContextMenu = useCallback((e: React.MouseEvent, entry: FileEntry | null) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, entry })
  }, [])

  const closeContextMenu = useCallback(() => {
    setContextMenu(null)
  }, [])

  const handleCreateNew = useCallback((type: 'file' | 'folder', parentPath: string) => {
    setIsCreating({ type, parentPath })
    setNewItemName('')
    closeContextMenu()
  }, [closeContextMenu])

  const handleCreateSubmit = useCallback(async () => {
    if (!isCreating || !newItemName.trim()) return

    const newPath = `${isCreating.parentPath}/${newItemName.trim()}`

    if (isCreating.type === 'file') {
      await onCreateFile(newPath)
    } else {
      await onCreateDirectory(newPath)
    }

    setIsCreating(null)
    setNewItemName('')
  }, [isCreating, newItemName, onCreateFile, onCreateDirectory])

  const handleRename = useCallback((entry: FileEntry) => {
    setRenamingPath(entry.path)
    setRenameValue(entry.name)
    closeContextMenu()
  }, [closeContextMenu])

  const handleRenameSubmit = useCallback(async () => {
    if (!renamingPath || !renameValue.trim()) return

    const parentPath = renamingPath.substring(0, renamingPath.lastIndexOf('/'))
    const newPath = `${parentPath}/${renameValue.trim()}`

    await onRenameFile(renamingPath, newPath)

    setRenamingPath(null)
    setRenameValue('')
  }, [renamingPath, renameValue, onRenameFile])

  const handleDelete = useCallback(async (entry: FileEntry) => {
    await onDeleteFile(entry.path)
    closeContextMenu()
  }, [onDeleteFile, closeContextMenu])

  const renderFileItem = (entry: FileEntry, depth: number = 0) => {
    const isExpanded = expandedDirs.has(entry.path)
    const isLoadingDir = loadingDirs.has(entry.path)
    const children = dirContents.get(entry.path) || []
    const isSelected = entry.path === selectedFile
    const isChanged = isFileChanged(entry.path)
    const isRenaming = renamingPath === entry.path

    return (
      <div key={entry.path}>
        <div
          className={`file-tree-item ${isSelected ? 'selected' : ''}`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => entry.isDirectory ? handleToggleDirectory(entry.path) : onFileSelect(entry.path)}
          onContextMenu={(e) => handleContextMenu(e, entry)}
          onMouseEnter={() => {
            // Preload file on hover for faster opening
            if (!entry.isDirectory) {
              onPreloadFile(entry.path)
            }
          }}
        >
          {entry.isDirectory ? (
            <>
              <span className="w-4 flex items-center justify-center">
                {isLoadingDir ? (
                  <div className="w-3 h-3 border-2 border-claude-accent border-t-transparent rounded-full animate-spin" />
                ) : isExpanded ? (
                  <VscChevronDown className="text-claude-text-secondary" />
                ) : (
                  <VscChevronRight className="text-claude-text-secondary" />
                )}
              </span>
              {isExpanded ? (
                <VscFolderOpened className="text-claude-accent" />
              ) : (
                <VscFolder className="text-claude-accent" />
              )}
            </>
          ) : (
            <>
              <span className="w-4" />
              <FileIcon filename={entry.name} className="text-sm" />
            </>
          )}

          {isRenaming ? (
            <input
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={handleRenameSubmit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRenameSubmit()
                if (e.key === 'Escape') {
                  setRenamingPath(null)
                  setRenameValue('')
                }
              }}
              className="flex-1 bg-claude-bg border border-claude-accent rounded px-1 py-0.5 text-sm outline-none"
              autoFocus
            />
          ) : (
            <span className="text-sm truncate flex-1">{entry.name}</span>
          )}

          {isChanged && (
            <VscCircleFilled className="text-xs text-claude-warning" />
          )}
        </div>

        {entry.isDirectory && isExpanded && (
          <div>
            {isCreating && isCreating.parentPath === entry.path && (
              <div
                className="file-tree-item"
                style={{ paddingLeft: `${(depth + 1) * 16 + 8}px` }}
              >
                <span className="w-4" />
                {isCreating.type === 'folder' ? (
                  <VscFolder className="text-claude-accent text-sm" />
                ) : (
                  <VscFile className="text-gray-400 text-sm" />
                )}
                <input
                  type="text"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  onBlur={() => {
                    if (newItemName.trim()) {
                      handleCreateSubmit()
                    } else {
                      setIsCreating(null)
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateSubmit()
                    if (e.key === 'Escape') setIsCreating(null)
                  }}
                  className="flex-1 bg-claude-bg border border-claude-accent rounded px-1 py-0.5 text-sm outline-none"
                  placeholder={isCreating.type === 'folder' ? 'folder name' : 'filename'}
                  autoFocus
                />
              </div>
            )}
            {children.map(child => renderFileItem(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  if (!projectPath) {
    return (
      <div className="h-full bg-claude-bg flex flex-col items-center justify-center text-claude-text-secondary p-4">
        <VscFolderOpened className="text-4xl mb-4 text-claude-accent" />
        <p className="text-center">No project selected</p>
        <p className="text-sm text-center mt-2">
          Select a project from the dropdown above
        </p>
      </div>
    )
  }

  return (
    <div
      className="h-full bg-claude-bg flex flex-col"
      onContextMenu={(e) => handleContextMenu(e, null)}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-claude-border">
        <span className="text-xs text-claude-text-secondary uppercase tracking-wider">
          Explorer
        </span>
        <div className="flex items-center gap-1">
          <button
            className="p-1 hover:bg-claude-surface-hover rounded transition-colors"
            onClick={() => handleCreateNew('file', projectPath)}
            title="New File"
          >
            <VscNewFile className="text-claude-text-secondary" />
          </button>
          <button
            className="p-1 hover:bg-claude-surface-hover rounded transition-colors"
            onClick={() => handleCreateNew('folder', projectPath)}
            title="New Folder"
          >
            <VscNewFolder className="text-claude-text-secondary" />
          </button>
          <button
            className="p-1 hover:bg-claude-surface-hover rounded transition-colors"
            onClick={onRefresh}
            title="Refresh"
          >
            <VscRefresh className={`text-claude-text-secondary ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* File Tree */}
      <div className="flex-1 overflow-auto py-2">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-6 h-6 border-2 border-claude-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {isCreating && isCreating.parentPath === projectPath && (
              <div
                className="file-tree-item"
                style={{ paddingLeft: '8px' }}
              >
                <span className="w-4" />
                {isCreating.type === 'folder' ? (
                  <VscFolder className="text-claude-accent text-sm" />
                ) : (
                  <VscFile className="text-gray-400 text-sm" />
                )}
                <input
                  type="text"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  onBlur={() => {
                    if (newItemName.trim()) {
                      handleCreateSubmit()
                    } else {
                      setIsCreating(null)
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateSubmit()
                    if (e.key === 'Escape') setIsCreating(null)
                  }}
                  className="flex-1 bg-claude-bg border border-claude-accent rounded px-1 py-0.5 text-sm outline-none"
                  placeholder={isCreating.type === 'folder' ? 'folder name' : 'filename'}
                  autoFocus
                />
              </div>
            )}
            {files.map(file => renderFileItem(file))}
          </>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          entry={contextMenu.entry}
          projectPath={projectPath}
          onClose={closeContextMenu}
          onCreateFile={() => handleCreateNew('file', contextMenu.entry?.isDirectory ? contextMenu.entry.path : projectPath)}
          onCreateFolder={() => handleCreateNew('folder', contextMenu.entry?.isDirectory ? contextMenu.entry.path : projectPath)}
          onRename={contextMenu.entry ? () => handleRename(contextMenu.entry!) : undefined}
          onDelete={contextMenu.entry ? () => handleDelete(contextMenu.entry!) : undefined}
        />
      )}
    </div>
  )
})
