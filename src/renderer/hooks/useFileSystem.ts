import { useState, useEffect, useCallback, useRef } from 'react'
import { FileEntry, FileChange } from '../types'

interface CacheEntry {
  content: string
  timestamp: number
}

const FILE_CACHE_TTL = 5 * 60 * 1000 // 5 minutes
const DIR_CACHE_TTL = 30 * 1000 // 30 seconds for directory listings
const DEBOUNCE_MS = 100 // Debounce directory refreshes

export function useFileSystem(projectPath: string | null) {
  const [files, setFiles] = useState<FileEntry[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [changedFiles, setChangedFiles] = useState<Set<string>>(new Set())

  // Caches
  const fileCache = useRef<Map<string, CacheEntry>>(new Map())
  const dirCache = useRef<Map<string, { entries: FileEntry[]; timestamp: number }>>(new Map())
  const cleanupRef = useRef<(() => void) | null>(null)
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const pendingPreloads = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (projectPath) {
      loadDirectory(projectPath)
      setupFileWatcher()
    } else {
      setFiles([])
    }

    return () => {
      if (cleanupRef.current) {
        cleanupRef.current()
      }
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current)
      }
    }
  }, [projectPath])

  const setupFileWatcher = () => {
    if (cleanupRef.current) {
      cleanupRef.current()
    }

    cleanupRef.current = window.electronAPI.onFileChange((change: FileChange) => {
      handleFileChange(change)
    })
  }

  const handleFileChange = (change: FileChange) => {
    // Invalidate file cache for changed file
    fileCache.current.delete(change.path)

    setChangedFiles(prev => {
      const next = new Set(prev)
      if (change.type === 'add' || change.type === 'change') {
        next.add(change.path)
      } else if (change.type === 'unlink') {
        next.delete(change.path)
      }
      return next
    })

    // Debounce directory refresh
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current)
    }
    refreshTimeoutRef.current = setTimeout(() => {
      if (projectPath) {
        // Invalidate dir cache and reload
        dirCache.current.delete(projectPath)
        loadDirectory(projectPath)
      }
    }, DEBOUNCE_MS)
  }

  const loadDirectory = async (dirPath: string) => {
    // Check cache first
    const cached = dirCache.current.get(dirPath)
    if (cached && Date.now() - cached.timestamp < DIR_CACHE_TTL) {
      setFiles(cached.entries)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const entries = await window.electronAPI.readDirectory(dirPath)
      const mappedEntries = entries.map(entry => ({
        ...entry,
        isExpanded: false
      }))

      // Cache the result
      dirCache.current.set(dirPath, {
        entries: mappedEntries,
        timestamp: Date.now()
      })

      setFiles(mappedEntries)
    } catch (err) {
      setError(String(err))
    } finally {
      setIsLoading(false)
    }
  }

  const loadSubdirectory = useCallback(async (dirPath: string): Promise<FileEntry[]> => {
    // Check cache first
    const cached = dirCache.current.get(dirPath)
    if (cached && Date.now() - cached.timestamp < DIR_CACHE_TTL) {
      return cached.entries
    }

    try {
      const entries = await window.electronAPI.readDirectory(dirPath)

      // Cache the result
      dirCache.current.set(dirPath, {
        entries,
        timestamp: Date.now()
      })

      return entries
    } catch (err) {
      console.error('Failed to load subdirectory:', err)
      return []
    }
  }, [])

  const readFile = useCallback(async (filePath: string): Promise<string | null> => {
    // Check cache first
    const cached = fileCache.current.get(filePath)
    if (cached && Date.now() - cached.timestamp < FILE_CACHE_TTL) {
      // Still mark as not changed
      setChangedFiles(prev => {
        const next = new Set(prev)
        next.delete(filePath)
        return next
      })
      return cached.content
    }

    try {
      const result = await window.electronAPI.readFile(filePath)
      if (result.success) {
        const content = result.content || ''

        // Cache the content (only if not too large)
        if (content.length < 5 * 1024 * 1024) { // 5MB limit
          fileCache.current.set(filePath, {
            content,
            timestamp: Date.now()
          })
        }

        setChangedFiles(prev => {
          const next = new Set(prev)
          next.delete(filePath)
          return next
        })
        return content
      }
      return null
    } catch {
      return null
    }
  }, [])

  // Preload file into cache (for hover preloading)
  const preloadFile = useCallback(async (filePath: string) => {
    // Skip if already cached or already preloading
    if (fileCache.current.has(filePath)) return
    if (pendingPreloads.current.has(filePath)) return

    pendingPreloads.current.add(filePath)

    try {
      const result = await window.electronAPI.readFile(filePath)
      if (result.success && result.content) {
        if (result.content.length < 5 * 1024 * 1024) {
          fileCache.current.set(filePath, {
            content: result.content,
            timestamp: Date.now()
          })
        }
      }
    } catch {
      // Ignore preload errors
    } finally {
      pendingPreloads.current.delete(filePath)
    }
  }, [])

  // Check if file is in cache (for instant loading indicator)
  const isFileCached = useCallback((filePath: string): boolean => {
    const cached = fileCache.current.get(filePath)
    return cached !== undefined && Date.now() - cached.timestamp < FILE_CACHE_TTL
  }, [])

  const writeFile = useCallback(async (filePath: string, content: string): Promise<boolean> => {
    const result = await window.electronAPI.writeFile(filePath, content)
    if (result.success) {
      // Update cache
      fileCache.current.set(filePath, {
        content,
        timestamp: Date.now()
      })
    }
    return result.success
  }, [])

  const createFile = useCallback(async (filePath: string): Promise<boolean> => {
    const result = await window.electronAPI.createFile(filePath)
    if (result.success && projectPath) {
      dirCache.current.delete(projectPath)
      await loadDirectory(projectPath)
    }
    return result.success
  }, [projectPath])

  const createDirectory = useCallback(async (dirPath: string): Promise<boolean> => {
    const result = await window.electronAPI.createDirectory(dirPath)
    if (result.success && projectPath) {
      dirCache.current.delete(projectPath)
      await loadDirectory(projectPath)
    }
    return result.success
  }, [projectPath])

  const deleteFile = useCallback(async (filePath: string): Promise<boolean> => {
    const result = await window.electronAPI.deleteFile(filePath)
    if (result.success) {
      fileCache.current.delete(filePath)
      if (projectPath) {
        dirCache.current.delete(projectPath)
        await loadDirectory(projectPath)
      }
    }
    return result.success
  }, [projectPath])

  const renameFile = useCallback(async (oldPath: string, newPath: string): Promise<boolean> => {
    const result = await window.electronAPI.renameFile(oldPath, newPath)
    if (result.success) {
      // Move cache entry
      const cached = fileCache.current.get(oldPath)
      if (cached) {
        fileCache.current.delete(oldPath)
        fileCache.current.set(newPath, cached)
      }
      if (projectPath) {
        dirCache.current.delete(projectPath)
        await loadDirectory(projectPath)
      }
    }
    return result.success
  }, [projectPath])

  const isFileChanged = useCallback((filePath: string): boolean => {
    return changedFiles.has(filePath)
  }, [changedFiles])

  const refresh = useCallback(() => {
    if (projectPath) {
      // Clear caches
      dirCache.current.delete(projectPath)
      loadDirectory(projectPath)
    }
  }, [projectPath])

  const clearCache = useCallback(() => {
    fileCache.current.clear()
    dirCache.current.clear()
  }, [])

  return {
    files,
    isLoading,
    error,
    readFile,
    writeFile,
    createFile,
    createDirectory,
    deleteFile,
    renameFile,
    loadSubdirectory,
    isFileChanged,
    refresh,
    changedFiles,
    preloadFile,
    isFileCached,
    clearCache
  }
}
