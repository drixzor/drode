import { create } from 'zustand'
import { invoke } from '@tauri-apps/api/core'
import { listen, UnlistenFn } from '@tauri-apps/api/event'
import { useProjectStore } from './projectStore'

export interface ActivityEvent {
  id: number
  event_id: string
  project_path: string
  category: string
  event_type: string
  title: string
  detail_json: string | null
  severity: string
  source_id: string | null
  created_at: number
}

interface ActivityState {
  events: ActivityEvent[]
  filter: string | null
  isLoading: boolean
}

interface ActivityActions {
  init: () => () => void
  loadEvents: () => Promise<void>
  setFilter: (category: string | null) => void
  clearLog: () => Promise<void>
}

export const useActivityStore = create<ActivityState & ActivityActions>((set, get) => ({
  events: [],
  filter: null,
  isLoading: false,

  init: () => {
    let unlistenEvent: UnlistenFn | null = null
    let unsubProject: (() => void) | null = null

    // Listen for real-time activity events
    listen<ActivityEvent>('activity-event', (event) => {
      const currentProject = useProjectStore.getState().currentProject
      if (event.payload.project_path === currentProject) {
        set((s) => ({ events: [event.payload, ...s.events].slice(0, 500) }))
      }
    }).then((fn) => {
      unlistenEvent = fn
    })

    // Reload events when project changes
    unsubProject = useProjectStore.subscribe(
      (state) => state.currentProject,
      () => {
        get().loadEvents()
      }
    )

    // Initial load
    get().loadEvents()

    return () => {
      if (unlistenEvent) unlistenEvent()
      if (unsubProject) unsubProject()
    }
  },

  loadEvents: async () => {
    const projectPath = useProjectStore.getState().currentProject
    if (!projectPath) {
      set({ events: [], isLoading: false })
      return
    }

    set({ isLoading: true })
    try {
      const events = await invoke<ActivityEvent[]>('get_activity_log', {
        projectPath,
        category: null,
        limit: 200,
        beforeId: null,
      })
      set({ events, isLoading: false })
    } catch (e) {
      console.error('loadEvents error:', e)
      set({ isLoading: false })
    }
  },

  setFilter: (category) => set({ filter: category }),

  clearLog: async () => {
    const projectPath = useProjectStore.getState().currentProject
    if (!projectPath) return

    try {
      await invoke('clear_activity_log', { projectPath })
      set({ events: [] })
    } catch (e) {
      console.error('clearLog error:', e)
    }
  },
}))
