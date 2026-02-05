import { useState, useCallback, useEffect, useRef } from 'react'

export interface LayoutState {
  leftPanelWidth: number
  rightPanelWidth: number
  bottomPanelHeight: number
  isLeftPanelCollapsed: boolean
  isRightPanelCollapsed: boolean
  isBottomPanelCollapsed: boolean
}

const STORAGE_KEY = 'drode-layout'
const DEBOUNCE_MS = 500 // Only save to localStorage after 500ms of no changes

const DEFAULT_LAYOUT: LayoutState = {
  leftPanelWidth: 280,
  rightPanelWidth: 400,
  bottomPanelHeight: 250,
  isLeftPanelCollapsed: false,
  isRightPanelCollapsed: false,
  isBottomPanelCollapsed: false,
}

// Panel constraints
export const PANEL_CONSTRAINTS = {
  left: { min: 180, max: 500, default: 280 },
  right: { min: 250, max: 800, default: 400 },
  bottom: { min: 120, max: 500, default: 250 },
}

function loadLayout(): LayoutState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      return { ...DEFAULT_LAYOUT, ...parsed }
    }
  } catch {
    // Ignore errors
  }
  return DEFAULT_LAYOUT
}

function saveLayout(layout: LayoutState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout))
  } catch {
    // Ignore errors
  }
}

export function useLayout() {
  const [layout, setLayout] = useState<LayoutState>(loadLayout)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const layoutRef = useRef(layout)

  // Keep ref in sync for debounced save
  useEffect(() => {
    layoutRef.current = layout
  }, [layout])

  // Debounced save to localStorage
  useEffect(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveLayout(layoutRef.current)
    }, DEBOUNCE_MS)

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [layout])

  // Cleanup on unmount - save immediately
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
      saveLayout(layoutRef.current)
    }
  }, [])

  const setLeftPanelWidth = useCallback((width: number) => {
    setLayout(prev => ({ ...prev, leftPanelWidth: width }))
  }, [])

  const setRightPanelWidth = useCallback((width: number) => {
    setLayout(prev => ({ ...prev, rightPanelWidth: width }))
  }, [])

  const setBottomPanelHeight = useCallback((height: number) => {
    setLayout(prev => ({ ...prev, bottomPanelHeight: height }))
  }, [])

  const toggleLeftPanel = useCallback(() => {
    setLayout(prev => ({ ...prev, isLeftPanelCollapsed: !prev.isLeftPanelCollapsed }))
  }, [])

  const toggleRightPanel = useCallback(() => {
    setLayout(prev => ({ ...prev, isRightPanelCollapsed: !prev.isRightPanelCollapsed }))
  }, [])

  const toggleBottomPanel = useCallback(() => {
    setLayout(prev => ({ ...prev, isBottomPanelCollapsed: !prev.isBottomPanelCollapsed }))
  }, [])

  const resetLeftPanel = useCallback(() => {
    setLayout(prev => ({ ...prev, leftPanelWidth: PANEL_CONSTRAINTS.left.default }))
  }, [])

  const resetRightPanel = useCallback(() => {
    setLayout(prev => ({ ...prev, rightPanelWidth: PANEL_CONSTRAINTS.right.default }))
  }, [])

  const resetBottomPanel = useCallback(() => {
    setLayout(prev => ({ ...prev, bottomPanelHeight: PANEL_CONSTRAINTS.bottom.default }))
  }, [])

  const resetLayout = useCallback(() => {
    setLayout(DEFAULT_LAYOUT)
  }, [])

  return {
    ...layout,
    setLeftPanelWidth,
    setRightPanelWidth,
    setBottomPanelHeight,
    toggleLeftPanel,
    toggleRightPanel,
    toggleBottomPanel,
    resetLeftPanel,
    resetRightPanel,
    resetBottomPanel,
    resetLayout,
  }
}
