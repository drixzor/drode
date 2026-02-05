import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const PANEL_CONSTRAINTS = {
  left: { min: 180, max: 500, default: 280 },
  right: { min: 250, max: 800, default: 400 },
  bottom: { min: 120, max: 500, default: 250 },
}

interface LayoutState {
  leftPanelWidth: number
  rightPanelWidth: number
  bottomPanelHeight: number
  isLeftPanelCollapsed: boolean
  isRightPanelCollapsed: boolean
  isBottomPanelCollapsed: boolean
}

interface LayoutActions {
  setLeftPanelWidth: (width: number) => void
  setRightPanelWidth: (width: number) => void
  setBottomPanelHeight: (height: number) => void
  toggleLeftPanel: () => void
  toggleRightPanel: () => void
  toggleBottomPanel: () => void
  resetLeftPanel: () => void
  resetRightPanel: () => void
  resetBottomPanel: () => void
  resetLayout: () => void
}

const DEFAULT_LAYOUT: LayoutState = {
  leftPanelWidth: PANEL_CONSTRAINTS.left.default,
  rightPanelWidth: PANEL_CONSTRAINTS.right.default,
  bottomPanelHeight: PANEL_CONSTRAINTS.bottom.default,
  isLeftPanelCollapsed: false,
  isRightPanelCollapsed: false,
  isBottomPanelCollapsed: false,
}

export const useLayoutStore = create<LayoutState & LayoutActions>()(
  persist(
    (set) => ({
      ...DEFAULT_LAYOUT,

      setLeftPanelWidth: (width) => set({ leftPanelWidth: width }),
      setRightPanelWidth: (width) => set({ rightPanelWidth: width }),
      setBottomPanelHeight: (height) => set({ bottomPanelHeight: height }),

      toggleLeftPanel: () => set((s) => ({ isLeftPanelCollapsed: !s.isLeftPanelCollapsed })),
      toggleRightPanel: () => set((s) => ({ isRightPanelCollapsed: !s.isRightPanelCollapsed })),
      toggleBottomPanel: () => set((s) => ({ isBottomPanelCollapsed: !s.isBottomPanelCollapsed })),

      resetLeftPanel: () => set({ leftPanelWidth: PANEL_CONSTRAINTS.left.default }),
      resetRightPanel: () => set({ rightPanelWidth: PANEL_CONSTRAINTS.right.default }),
      resetBottomPanel: () => set({ bottomPanelHeight: PANEL_CONSTRAINTS.bottom.default }),

      resetLayout: () => set(DEFAULT_LAYOUT),
    }),
    { name: 'drode-layout' }
  )
)
