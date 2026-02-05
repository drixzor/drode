import { create } from 'zustand'
import { FileEntry, FileChange } from '../types'
import { useProjectStore } from './projectStore'

const FILE_CACHE_TTL = 5 * 60 * 1000 // 5 minutes
const DIR_CACHE_TTL = 30 * 1000 // 30 seconds
const DEBOUNCE_MS = 100

// Module-level caches (not reactive state)
const fileCache = new Map<string, { content: string; timestamp: number }>()
const dirCache = new Map<string, { entries: FileEntry[]; timestamp: number }>()
const pendingPreloads = new Set<string>()
let cleanupFn: (() => void) | null = null
let refreshTimeout: ReturnType<typeof setTimeout> | null = null

interface FileSystemState {
  files: FileEntry[]
  isLoading: boolean
  error: string | null
  changedFiles: Set<string>
}

interface FileSystemActions {
  init: () => () => void
  loadDirectory: (dirPath: string) => Promise<void>
  loadSubdirectory: (dirPath: string) => Promise<FileEntry[]>
  readFile: (filePath: string) => Promise<string | null>
  writeFile: (filePath: string, content: string) => Promise<boolean>
  createFile: (filePath: string) => Promise<boolean>
  createDirectory: (dirPath: string) => Promise<boolean>
  deleteFile: (filePath: string) => Promise<boolean>
  renameFile: (oldPath: string, newPath: string) => Promise<boolean>
  isFileChanged: (filePath: string) => boolean
  isFileCached: (filePath: string) => boolean
  preloadFile: (filePath: string) => Promise<void>
  refresh: () => void
  clearCache: () => void
}

export const useFileSystemStore = create<FileSystemState & FileSystemActions>((set, get) => ({
  files: [],
  isLoading: false,
  error: null,
  changedFiles: new Set(),

  init: () => {
    const handleFileChange = (change: FileChange) => {
      fileCache.delete(change.path)

      set((s) => {
        const next = new Set(s.changedFiles)
        if (change.type === 'add' || change.type === 'change') {
          next.add(change.path)
        } else if (change.type === 'unlink') {
          next.delete(change.path)
        }
        return { changedFiles: next }
      })

      if (refreshTimeout) clearTimeout(refreshTimeout)
      refreshTimeout = setTimeout(() => {
        const projectPath = useProjectStore.getState().currentProject
        if (projectPath) {
          dirCache.delete(projectPath)
          get().loadDirectory(projectPath)
        }
      }, DEBOUNCE_MS)
    }

    // Setup file watcher
    if (cleanupFn) cleanupFn()
    cleanupFn = window.electronAPI.onFileChange(handleFileChange)

    // Subscribe to project changes
    const unsubProject = useProjectStore.subscribe(
      (state) => state.currentProject,
      (currentProject) => {
        if (currentProject) {
          get().loadDirectory(currentProject)
        } else {
          set({ files: [], isLoading: false, error: null })
        }
      }
    )

    // Load initial directory if project is set
    const currentProject = useProjectStore.getState().currentProject
    if (currentProject) {
      get().loadDirectory(currentProject)
    }

    return () => {
      unsubProject()
      if (cleanupFn) { cleanupFn(); cleanupFn = null }
      if (refreshTimeout) { clearTimeout(refreshTimeout); refreshTimeout = null }
    }
  },

  loadDirectory: async (dirPath) => {
    const cached = dirCache.get(dirPath)
    if (cached && Date.now() - cached.timestamp < DIR_CACHE_TTL) {
      set({ files: cached.entries })
      return
    }

    set({ isLoading: true, error: null })
    try {
      const entries = await window.electronAPI.readDirectory(dirPath)
      const mappedEntries = entries.map((entry) => ({ ...entry, isExpanded: false }))
      dirCache.set(dirPath, { entries: mappedEntries, timestamp: Date.now() })
      set({ files: mappedEntries, isLoading: false })
    } catch (err) {
      set({ error: String(err), isLoading: false })
    }
  },

  loadSubdirectory: async (dirPath) => {
    const cached = dirCache.get(dirPath)
    if (cached && Date.now() - cached.timestamp < DIR_CACHE_TTL) {
      return cached.entries
    }
    try {
      const entries = await window.electronAPI.readDirectory(dirPath)
      dirCache.set(dirPath, { entries, timestamp: Date.now() })
      return entries
    } catch (err) {
      console.error('Failed to load subdirectory:', err)
      return []
    }
  },

  readFile: async (filePath) => {
    const cached = fileCache.get(filePath)
    if (cached && Date.now() - cached.timestamp < FILE_CACHE_TTL) {
      set((s) => {
        const next = new Set(s.changedFiles)
        next.delete(filePath)
        return { changedFiles: next }
      })
      return cached.content
    }

    try {
      const result = await window.electronAPI.readFile(filePath)
      if (result.success) {
        const content = result.content || ''
        if (content.length < 5 * 1024 * 1024) {
          fileCache.set(filePath, { content, timestamp: Date.now() })
        }
        set((s) => {
          const next = new Set(s.changedFiles)
          next.delete(filePath)
          return { changedFiles: next }
        })
        return content
      }
      return null
    } catch {
      return null
    }
  },

  writeFile: async (filePath, content) => {
    const result = await window.electronAPI.writeFile(filePath, content)
    if (result.success) {
      fileCache.set(filePath, { content, timestamp: Date.now() })
    }
    return result.success
  },

  createFile: async (filePath) => {
    const result = await window.electronAPI.createFile(filePath)
    if (result.success) {
      const projectPath = useProjectStore.getState().currentProject
      if (projectPath) {
        dirCache.delete(projectPath)
        await get().loadDirectory(projectPath)
      }
    }
    return result.success
  },

  createDirectory: async (dirPath) => {
    const result = await window.electronAPI.createDirectory(dirPath)
    if (result.success) {
      const projectPath = useProjectStore.getState().currentProject
      if (projectPath) {
        dirCache.delete(projectPath)
        await get().loadDirectory(projectPath)
      }
    }
    return result.success
  },

  deleteFile: async (filePath) => {
    const result = await window.electronAPI.deleteFile(filePath)
    if (result.success) {
      fileCache.delete(filePath)
      const projectPath = useProjectStore.getState().currentProject
      if (projectPath) {
        dirCache.delete(projectPath)
        await get().loadDirectory(projectPath)
      }
    }
    return result.success
  },

  renameFile: async (oldPath, newPath) => {
    const result = await window.electronAPI.renameFile(oldPath, newPath)
    if (result.success) {
      const cached = fileCache.get(oldPath)
      if (cached) {
        fileCache.delete(oldPath)
        fileCache.set(newPath, cached)
      }
      const projectPath = useProjectStore.getState().currentProject
      if (projectPath) {
        dirCache.delete(projectPath)
        await get().loadDirectory(projectPath)
      }
    }
    return result.success
  },

  isFileChanged: (filePath) => get().changedFiles.has(filePath),

  isFileCached: (filePath) => {
    const cached = fileCache.get(filePath)
    return cached !== undefined && Date.now() - cached.timestamp < FILE_CACHE_TTL
  },

  preloadFile: async (filePath) => {
    if (fileCache.has(filePath)) return
    if (pendingPreloads.has(filePath)) return
    pendingPreloads.add(filePath)
    try {
      const result = await window.electronAPI.readFile(filePath)
      if (result.success && result.content) {
        if (result.content.length < 5 * 1024 * 1024) {
          fileCache.set(filePath, { content: result.content, timestamp: Date.now() })
        }
      }
    } catch {
      // Ignore preload errors
    } finally {
      pendingPreloads.delete(filePath)
    }
  },

  refresh: () => {
    const projectPath = useProjectStore.getState().currentProject
    if (projectPath) {
      dirCache.delete(projectPath)
      get().loadDirectory(projectPath)
    }
  },

  clearCache: () => {
    fileCache.clear()
    dirCache.clear()
  },
}))
