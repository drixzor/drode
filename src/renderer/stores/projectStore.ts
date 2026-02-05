import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'

interface ProjectState {
  currentProject: string | null
  recentProjects: string[]
  isLoading: boolean
}

interface ProjectActions {
  loadInitialState: () => Promise<void>
  selectFolder: () => Promise<string | null>
  setCurrentProject: (projectPath: string) => Promise<void>
  removeRecentProject: (projectPath: string) => Promise<void>
  getProjectName: (projectPath: string) => string
}

export const useProjectStore = create<ProjectState & ProjectActions>()(
  subscribeWithSelector((set, get) => ({
  currentProject: null,
  recentProjects: [],
  isLoading: true,

  loadInitialState: async () => {
    try {
      const [currentProject, recentProjects] = await Promise.all([
        window.electronAPI.getCurrentProject(),
        window.electronAPI.getRecentProjects(),
      ])
      set({ currentProject, recentProjects, isLoading: false })
    } catch (error) {
      console.error('Failed to load project state:', error)
      set({ isLoading: false })
    }
  },

  selectFolder: async () => {
    const folderPath = await window.electronAPI.selectFolder()
    if (folderPath) {
      await get().setCurrentProject(folderPath)
    }
    return folderPath
  },

  setCurrentProject: async (projectPath) => {
    await window.electronAPI.setCurrentProject(projectPath)
    const { recentProjects } = get()
    let updated = recentProjects.filter((p) => p !== projectPath)
    updated.unshift(projectPath)
    updated = updated.slice(0, 10)
    set({ currentProject: projectPath, recentProjects: updated })
  },

  removeRecentProject: async (projectPath) => {
    const updatedProjects = await window.electronAPI.removeRecentProject(projectPath)
    set({ recentProjects: updatedProjects })
  },

  getProjectName: (projectPath) => {
    const parts = projectPath.split('/')
    return parts[parts.length - 1] || projectPath
  },
}))
)
