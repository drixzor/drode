import { useCallback, useRef } from 'react'

interface CacheEntry {
  content: string
  timestamp: number
  size: number
}

const MAX_CACHE_SIZE = 50 * 1024 * 1024 // 50MB max cache
const MAX_CACHE_AGE = 5 * 60 * 1000 // 5 minutes
const MAX_ENTRIES = 100

export function useFileCache() {
  const cacheRef = useRef<Map<string, CacheEntry>>(new Map())
  const totalSizeRef = useRef(0)

  const get = useCallback((filePath: string): string | null => {
    const entry = cacheRef.current.get(filePath)
    if (!entry) return null

    // Check if expired
    if (Date.now() - entry.timestamp > MAX_CACHE_AGE) {
      cacheRef.current.delete(filePath)
      totalSizeRef.current -= entry.size
      return null
    }

    // Update timestamp (LRU)
    entry.timestamp = Date.now()
    return entry.content
  }, [])

  const set = useCallback((filePath: string, content: string) => {
    const size = content.length * 2 // Approximate size in bytes (UTF-16)

    // Don't cache very large files (> 5MB)
    if (size > 5 * 1024 * 1024) return

    // Evict old entries if needed
    while (totalSizeRef.current + size > MAX_CACHE_SIZE || cacheRef.current.size >= MAX_ENTRIES) {
      // Find oldest entry
      let oldestKey: string | null = null
      let oldestTime = Infinity

      for (const [key, entry] of cacheRef.current.entries()) {
        if (entry.timestamp < oldestTime) {
          oldestTime = entry.timestamp
          oldestKey = key
        }
      }

      if (oldestKey) {
        const oldEntry = cacheRef.current.get(oldestKey)
        if (oldEntry) {
          totalSizeRef.current -= oldEntry.size
          cacheRef.current.delete(oldestKey)
        }
      } else {
        break
      }
    }

    // Remove existing entry if updating
    const existing = cacheRef.current.get(filePath)
    if (existing) {
      totalSizeRef.current -= existing.size
    }

    // Add new entry
    cacheRef.current.set(filePath, {
      content,
      timestamp: Date.now(),
      size
    })
    totalSizeRef.current += size
  }, [])

  const invalidate = useCallback((filePath: string) => {
    const entry = cacheRef.current.get(filePath)
    if (entry) {
      totalSizeRef.current -= entry.size
      cacheRef.current.delete(filePath)
    }
  }, [])

  const invalidateAll = useCallback(() => {
    cacheRef.current.clear()
    totalSizeRef.current = 0
  }, [])

  const has = useCallback((filePath: string): boolean => {
    const entry = cacheRef.current.get(filePath)
    if (!entry) return false
    if (Date.now() - entry.timestamp > MAX_CACHE_AGE) {
      cacheRef.current.delete(filePath)
      totalSizeRef.current -= entry.size
      return false
    }
    return true
  }, [])

  // Preload a file into cache without blocking
  const preload = useCallback(async (filePath: string) => {
    if (has(filePath)) return

    try {
      const result = await window.electronAPI.readFile(filePath)
      if (result.success && result.content) {
        set(filePath, result.content)
      }
    } catch {
      // Ignore preload errors
    }
  }, [has, set])

  return {
    get,
    set,
    invalidate,
    invalidateAll,
    has,
    preload
  }
}
