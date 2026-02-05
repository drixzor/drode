import React, { useState, useCallback, useEffect, useRef, memo } from 'react'

export type ResizeDirection = 'horizontal' | 'vertical'
export type ResizeSide = 'left' | 'right' | 'top' | 'bottom'

interface ResizablePanelProps {
  children: React.ReactNode
  size: number
  minSize: number
  maxSize: number
  onResize: (size: number) => void
  direction?: ResizeDirection
  side: ResizeSide
  isCollapsed?: boolean
  onDoubleClick?: () => void
  className?: string
  collapsedSize?: number
}

export const ResizablePanel = memo(function ResizablePanel({
  children,
  size,
  minSize,
  maxSize,
  onResize,
  direction = 'horizontal',
  side,
  isCollapsed = false,
  onDoubleClick,
  className = '',
  collapsedSize = 0
}: ResizablePanelProps) {
  const [isResizing, setIsResizing] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const startPosRef = useRef(0)
  const startSizeRef = useRef(0)
  const rafRef = useRef<number | null>(null)
  const currentSizeRef = useRef(size)

  const isHorizontal = direction === 'horizontal'
  const effectiveSize = isCollapsed ? collapsedSize : size

  // Keep currentSizeRef in sync
  useEffect(() => {
    currentSizeRef.current = size
  }, [size])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (isCollapsed) return
    e.preventDefault()
    e.stopPropagation()

    setIsResizing(true)
    startPosRef.current = isHorizontal ? e.clientX : e.clientY
    startSizeRef.current = currentSizeRef.current

    // Add resizing class to body for global cursor and disable transitions
    document.body.classList.add('is-resizing')
  }, [isHorizontal, isCollapsed])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
    }

    rafRef.current = requestAnimationFrame(() => {
      const currentPos = isHorizontal ? e.clientX : e.clientY
      const delta = currentPos - startPosRef.current
      const adjustedDelta = (side === 'right' || side === 'bottom') ? delta : -delta
      const newSize = Math.min(maxSize, Math.max(minSize, startSizeRef.current + adjustedDelta))

      // Direct DOM update for immediate feedback
      if (panelRef.current) {
        panelRef.current.style[isHorizontal ? 'width' : 'height'] = `${newSize}px`
      }

      currentSizeRef.current = newSize
    })
  }, [isHorizontal, side, minSize, maxSize])

  const handleMouseUp = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
    }

    // Commit the final size to React state
    onResize(currentSizeRef.current)
    setIsResizing(false)
    document.body.classList.remove('is-resizing')
  }, [onResize])

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onDoubleClick?.()
  }, [onDoubleClick])

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove, { passive: true })
      document.addEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = isHorizontal ? 'col-resize' : 'row-resize'
      document.body.style.userSelect = 'none'

      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        if (rafRef.current) {
          cancelAnimationFrame(rafRef.current)
        }
      }
    }
  }, [isResizing, handleMouseMove, handleMouseUp, isHorizontal])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [])

  const handleClasses = isHorizontal
    ? `w-2 cursor-col-resize ${side === 'right' ? '-right-1' : '-left-1'}`
    : `h-2 cursor-row-resize ${side === 'bottom' ? '-bottom-1' : '-top-1'}`

  const handlePosition = isHorizontal
    ? 'top-0 bottom-0'
    : 'left-0 right-0'

  return (
    <div
      ref={panelRef}
      className={`relative flex-shrink-0 ${className}`}
      style={{
        [isHorizontal ? 'width' : 'height']: `${effectiveSize}px`,
        willChange: isResizing ? (isHorizontal ? 'width' : 'height') : 'auto',
        contain: 'layout style',
      }}
    >
      {children}

      {/* Resize Handle */}
      {!isCollapsed && (
        <div
          className={`absolute ${handlePosition} ${handleClasses} z-30 group`}
          onMouseDown={handleMouseDown}
          onDoubleClick={handleDoubleClick}
        >
          {/* Visual handle indicator */}
          <div className={`
            absolute ${isHorizontal ? 'inset-y-0 w-0.5 left-1/2 -translate-x-1/2' : 'inset-x-0 h-0.5 top-1/2 -translate-y-1/2'}
            bg-transparent group-hover:bg-claude-accent/60
            ${isResizing ? 'bg-claude-accent' : ''}
          `} />
        </div>
      )}
    </div>
  )
})

// Horizontal splitter for dividing panels
interface SplitterProps {
  onMouseDown: (e: React.MouseEvent) => void
  onDoubleClick?: () => void
  direction?: 'horizontal' | 'vertical'
  isResizing?: boolean
}

export const Splitter = memo(function Splitter({
  onMouseDown,
  onDoubleClick,
  direction = 'vertical',
  isResizing
}: SplitterProps) {
  const isVertical = direction === 'vertical'

  return (
    <div
      className={`
        relative flex-shrink-0 bg-claude-border
        ${isVertical ? 'w-px cursor-col-resize' : 'h-px cursor-row-resize'}
        group
      `}
      onMouseDown={onMouseDown}
      onDoubleClick={onDoubleClick}
    >
      {/* Visual indicator */}
      <div className={`
        absolute ${isVertical ? 'inset-y-0 w-1 -translate-x-0.5' : 'inset-x-0 h-1 -translate-y-0.5'}
        bg-transparent group-hover:bg-claude-accent/50
        ${isResizing ? 'bg-claude-accent' : ''}
      `} />

      {/* Wider invisible hit area */}
      <div className={`
        absolute ${isVertical ? 'inset-y-0 w-4 -translate-x-2' : 'inset-x-0 h-4 -translate-y-2'}
      `} />
    </div>
  )
})
