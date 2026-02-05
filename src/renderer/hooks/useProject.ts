import { useState, useEffect, useCallback } from 'react'

export interface ProjectState {
  currentProject: string | null
  recentProjects: string[]
  isLoading: boolean
}

export function useProject() {
  const [state, setState] = useState<ProjectState>({
    currentProject: null,
    recentProjects: [],
    isLoading: true
  })

  useEffect(() => {
    loadInitialState()
  }, [])

  const loadInitialState = async () => {
    try {
      const [currentProject, recentProjects] = await Promise.all([
        window.electronAPI.getCurrentProject(),
        window.electronAPI.getRecentProjects()
      ])

      setState({
        currentProject,
        recentProjects,
        isLoading: false
      })
    } catch (error) {
      console.error('Failed to load project state:', error)
      setState(prev => ({ ...prev, isLoading: false }))
    }
  }

  const selectFolder = useCallback(async (): Promise<string | null> => {
    const folderPath = await window.electronAPI.selectFolder()
    if (folderPath) {
      await setCurrentProject(folderPath)
    }
    return folderPath
  }, [])

  const setCurrentProject = useCallback(async (projectPath: string) => {
    await window.electronAPI.setCurrentProject(projectPath)

    // Update recent projects
    let recentProjects = [...state.recentProjects]
    recentProjects = recentProjects.filter(p => p !== projectPath)
    recentProjects.unshift(projectPath)
    recentProjects = recentProjects.slice(0, 10)

    setState(prev => ({
      ...prev,
      currentProject: projectPath,
      recentProjects
    }))
  }, [state.recentProjects])

  const removeRecentProject = useCallback(async (projectPath: string) => {
    const updatedProjects = await window.electronAPI.removeRecentProject(projectPath)
    setState(prev => ({
      ...prev,
      recentProjects: updatedProjects
    }))
  }, [])

  const getProjectName = useCallback((projectPath: string): string => {
    const parts = projectPath.split('/')
    return parts[parts.length - 1] || projectPath
  }, [])

  return {
    ...state,
    selectFolder,
    setCurrentProject,
    removeRecentProject,
    getProjectName
  }
}
