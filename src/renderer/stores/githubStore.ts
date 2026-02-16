import { create } from 'zustand'
import { invoke } from '@tauri-apps/api/core'
import { logActivity } from '../services/activityBus'

export interface GithubRepo {
  id: number
  name: string
  full_name: string
  description: string | null
  private: boolean
  default_branch: string
  html_url: string
  updated_at: string
}

export interface GithubTreeEntry {
  name: string
  path: string
  type: string
  size: number | null
  sha: string
}

export interface GithubFileContent {
  content: string
  sha: string
  size: number
  path: string
  encoding: string
}

export interface GithubBranch {
  name: string
  sha: string
  protected: boolean | null
}

export interface GithubPullRequest {
  number: number
  title: string
  state: string
  html_url: string
  head_ref: string
  base_ref: string
  created_at: string
  user_login: string
}

interface GithubState {
  repos: GithubRepo[]
  selectedRepo: GithubRepo | null
  branches: GithubBranch[]
  currentBranch: string
  tree: GithubTreeEntry[]
  treePath: string
  pullRequests: GithubPullRequest[]
  isLoading: boolean
}

interface GithubActions {
  loadRepos: (page?: number) => Promise<void>
  selectRepo: (repo: GithubRepo) => Promise<void>
  loadTree: (path?: string) => Promise<void>
  loadBranches: () => Promise<void>
  switchBranch: (branch: string) => Promise<void>
  readFile: (path: string) => Promise<GithubFileContent | null>
  updateFile: (path: string, content: string, message: string, sha: string) => Promise<boolean>
  createBranch: (branchName: string, fromBranch: string) => Promise<boolean>
  loadPullRequests: () => Promise<void>
  createPullRequest: (title: string, body: string, head: string, base: string) => Promise<GithubPullRequest | null>
}

export const useGithubStore = create<GithubState & GithubActions>((set, get) => ({
  repos: [],
  selectedRepo: null,
  branches: [],
  currentBranch: 'main',
  tree: [],
  treePath: '',
  pullRequests: [],
  isLoading: false,

  loadRepos: async (page = 1) => {
    set({ isLoading: true })
    try {
      const repos = await invoke<GithubRepo[]>('github_list_repos', { page })
      set({ repos, isLoading: false })
    } catch (e) {
      console.error('loadRepos error:', e)
      set({ isLoading: false })
    }
  },

  selectRepo: async (repo) => {
    set({
      selectedRepo: repo,
      currentBranch: repo.default_branch,
      tree: [],
      treePath: '',
    })
    logActivity('github', 'repo_browsed', `Opened repo ${repo.full_name}`)
    await get().loadBranches()
    await get().loadTree()
  },

  loadTree: async (path = '') => {
    const { selectedRepo, currentBranch } = get()
    if (!selectedRepo) return

    set({ isLoading: true, treePath: path })
    try {
      const tree = await invoke<GithubTreeEntry[]>('github_get_repo_tree', {
        owner: selectedRepo.full_name.split('/')[0],
        repo: selectedRepo.name,
        branch: currentBranch,
        path: path || null,
      })
      set({ tree, isLoading: false })
    } catch (e) {
      console.error('loadTree error:', e)
      set({ isLoading: false })
    }
  },

  loadBranches: async () => {
    const { selectedRepo } = get()
    if (!selectedRepo) return

    try {
      const branches = await invoke<GithubBranch[]>('github_list_branches', {
        owner: selectedRepo.full_name.split('/')[0],
        repo: selectedRepo.name,
      })
      set({ branches })
    } catch (e) {
      console.error('loadBranches error:', e)
    }
  },

  switchBranch: async (branch) => {
    set({ currentBranch: branch, tree: [], treePath: '' })
    await get().loadTree()
  },

  readFile: async (path) => {
    const { selectedRepo, currentBranch } = get()
    if (!selectedRepo) return null

    try {
      return await invoke<GithubFileContent>('github_read_file', {
        owner: selectedRepo.full_name.split('/')[0],
        repo: selectedRepo.name,
        branch: currentBranch,
        path,
      })
    } catch (e) {
      console.error('readFile error:', e)
      return null
    }
  },

  updateFile: async (path, content, message, sha) => {
    const { selectedRepo, currentBranch } = get()
    if (!selectedRepo) return false

    try {
      await invoke('github_update_file', {
        owner: selectedRepo.full_name.split('/')[0],
        repo: selectedRepo.name,
        branch: currentBranch,
        path,
        content,
        message,
        sha,
      })
      logActivity('github', 'file_committed', `Committed changes to ${path} on ${currentBranch}`)
      return true
    } catch (e) {
      console.error('updateFile error:', e)
      return false
    }
  },

  createBranch: async (branchName, fromBranch) => {
    const { selectedRepo } = get()
    if (!selectedRepo) return false

    try {
      await invoke('github_create_branch', {
        owner: selectedRepo.full_name.split('/')[0],
        repo: selectedRepo.name,
        branchName,
        fromBranch,
      })
      logActivity('github', 'branch_created', `Created branch ${branchName} from ${fromBranch}`)
      await get().loadBranches()
      return true
    } catch (e) {
      console.error('createBranch error:', e)
      return false
    }
  },

  loadPullRequests: async () => {
    const { selectedRepo } = get()
    if (!selectedRepo) return

    try {
      const pullRequests = await invoke<GithubPullRequest[]>('github_list_pull_requests', {
        owner: selectedRepo.full_name.split('/')[0],
        repo: selectedRepo.name,
        stateFilter: null,
      })
      set({ pullRequests })
    } catch (e) {
      console.error('loadPullRequests error:', e)
    }
  },

  createPullRequest: async (title, body, head, base) => {
    const { selectedRepo } = get()
    if (!selectedRepo) return null

    try {
      const pr = await invoke<GithubPullRequest>('github_create_pull_request', {
        owner: selectedRepo.full_name.split('/')[0],
        repo: selectedRepo.name,
        title,
        body,
        head,
        base,
      })
      logActivity('github', 'pr_created', `Opened PR #${pr.number}: ${title}`)
      await get().loadPullRequests()
      return pr
    } catch (e) {
      console.error('createPullRequest error:', e)
      return null
    }
  },
}))
