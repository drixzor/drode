import { create } from 'zustand'
import { invoke } from '@tauri-apps/api/core'
import { logActivity } from '../services/activityBus'

export interface VercelProject {
  id: string
  name: string
  framework: string | null
  updated_at: number
  latest_deployment_url: string | null
}

export interface VercelDeployment {
  uid: string
  name: string
  url: string | null
  state: string
  created_at: number
  ready_at: number | null
  git_ref: string | null
  git_message: string | null
  creator_username: string | null
  meta: any
}

export interface VercelLogEntry {
  timestamp: number
  text: string
  log_type: string
}

export interface VercelDomain {
  name: string
  verified: boolean
  created_at: number | null
}

interface VercelState {
  projects: VercelProject[]
  selectedProject: VercelProject | null
  deployments: VercelDeployment[]
  selectedDeployment: VercelDeployment | null
  deploymentLogs: VercelLogEntry[]
  domains: VercelDomain[]
  isLoading: boolean
  pollingInterval: ReturnType<typeof setInterval> | null
}

interface VercelActions {
  loadProjects: () => Promise<void>
  selectProject: (project: VercelProject) => Promise<void>
  loadDeployments: () => Promise<void>
  selectDeployment: (deployment: VercelDeployment) => Promise<void>
  loadDeploymentLogs: (deploymentId: string) => Promise<void>
  triggerDeploy: (gitRef?: string) => Promise<VercelDeployment | null>
  loadDomains: () => Promise<void>
  addDomain: (domain: string) => Promise<boolean>
  removeDomain: (domain: string) => Promise<boolean>
  promoteDeploy: (deploymentId: string) => Promise<boolean>
  rollbackDeploy: (deploymentId: string) => Promise<boolean>
  startPolling: () => void
  stopPolling: () => void
}

export const useVercelStore = create<VercelState & VercelActions>((set, get) => ({
  projects: [],
  selectedProject: null,
  deployments: [],
  selectedDeployment: null,
  deploymentLogs: [],
  domains: [],
  isLoading: false,
  pollingInterval: null,

  loadProjects: async () => {
    set({ isLoading: true })
    try {
      const projects = await invoke<VercelProject[]>('vercel_list_projects')
      set({ projects, isLoading: false })
    } catch (e) {
      console.error('loadProjects error:', e)
      set({ isLoading: false })
    }
  },

  selectProject: async (project) => {
    set({
      selectedProject: project,
      deployments: [],
      selectedDeployment: null,
      deploymentLogs: [],
      domains: [],
    })
    await Promise.all([get().loadDeployments(), get().loadDomains()])
  },

  loadDeployments: async () => {
    const { selectedProject } = get()
    if (!selectedProject) return

    set({ isLoading: true })
    try {
      const deployments = await invoke<VercelDeployment[]>('vercel_list_deployments', {
        projectId: selectedProject.id,
        limit: 20,
      })
      set({ deployments, isLoading: false })

      // Start polling if any deployments are building
      if (deployments.some((d) => d.state === 'BUILDING' || d.state === 'INITIALIZING')) {
        get().startPolling()
      }
    } catch (e) {
      console.error('loadDeployments error:', e)
      set({ isLoading: false })
    }
  },

  selectDeployment: async (deployment) => {
    set({ selectedDeployment: deployment, deploymentLogs: [] })
    await get().loadDeploymentLogs(deployment.uid)
  },

  loadDeploymentLogs: async (deploymentId) => {
    try {
      const deploymentLogs = await invoke<VercelLogEntry[]>('vercel_get_deployment_logs', {
        deploymentId,
      })
      set({ deploymentLogs })
    } catch (e) {
      console.error('loadDeploymentLogs error:', e)
    }
  },

  triggerDeploy: async (gitRef) => {
    const { selectedProject } = get()
    if (!selectedProject) return null

    try {
      const deployment = await invoke<VercelDeployment>('vercel_create_deployment', {
        projectId: selectedProject.id,
        gitRef: gitRef || null,
      })
      logActivity('vercel', 'deploy_triggered', `Deployed ${selectedProject.name} to production`)
      await get().loadDeployments()
      get().startPolling()
      return deployment
    } catch (e) {
      console.error('triggerDeploy error:', e)
      return null
    }
  },

  loadDomains: async () => {
    const { selectedProject } = get()
    if (!selectedProject) return

    try {
      const domains = await invoke<VercelDomain[]>('vercel_list_domains', {
        projectId: selectedProject.id,
      })
      set({ domains })
    } catch (e) {
      console.error('loadDomains error:', e)
    }
  },

  addDomain: async (domain) => {
    const { selectedProject } = get()
    if (!selectedProject) return false

    try {
      await invoke('vercel_add_domain', {
        projectId: selectedProject.id,
        domain,
      })
      logActivity('vercel', 'domain_added', `Added domain ${domain}`)
      await get().loadDomains()
      return true
    } catch (e) {
      console.error('addDomain error:', e)
      return false
    }
  },

  removeDomain: async (domain) => {
    const { selectedProject } = get()
    if (!selectedProject) return false

    try {
      await invoke('vercel_remove_domain', {
        projectId: selectedProject.id,
        domain,
      })
      await get().loadDomains()
      return true
    } catch (e) {
      console.error('removeDomain error:', e)
      return false
    }
  },

  promoteDeploy: async (deploymentId) => {
    try {
      await invoke('vercel_promote_deployment', { deploymentId })
      await get().loadDeployments()
      return true
    } catch (e) {
      console.error('promoteDeploy error:', e)
      return false
    }
  },

  rollbackDeploy: async (deploymentId) => {
    const { selectedProject } = get()
    if (!selectedProject) return false

    try {
      await invoke('vercel_rollback_deployment', {
        projectId: selectedProject.id,
        deploymentId,
      })
      logActivity('vercel', 'rollback', `Rolled back to deployment ${deploymentId.slice(0, 8)}`)
      await get().loadDeployments()
      return true
    } catch (e) {
      console.error('rollbackDeploy error:', e)
      return false
    }
  },

  startPolling: () => {
    const { pollingInterval } = get()
    if (pollingInterval) return

    const interval = setInterval(async () => {
      const { deployments, selectedProject } = get()
      if (!selectedProject) return

      const hasBuilding = deployments.some((d) => d.state === 'BUILDING' || d.state === 'INITIALIZING')
      if (!hasBuilding) {
        get().stopPolling()
        return
      }

      await get().loadDeployments()
    }, 5000)

    set({ pollingInterval: interval })
  },

  stopPolling: () => {
    const { pollingInterval } = get()
    if (pollingInterval) {
      clearInterval(pollingInterval)
      set({ pollingInterval: null })
    }
  },
}))
