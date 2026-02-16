import { create } from 'zustand'
import { invoke } from '@tauri-apps/api/core'
import { listen, UnlistenFn } from '@tauri-apps/api/event'

interface ProviderState {
  connected: boolean
  username?: string
  avatarUrl?: string
  email?: string
}

interface AuthState {
  github: ProviderState
  supabase: ProviderState
  vercel: ProviderState
}

interface AuthActions {
  init: () => () => void
  connect: (provider: string) => Promise<void>
  disconnect: (provider: string) => Promise<void>
  loadStatus: () => Promise<void>
}

const defaultProvider: ProviderState = { connected: false }

export const useAuthStore = create<AuthState & AuthActions>((set, get) => ({
  github: { ...defaultProvider },
  supabase: { ...defaultProvider },
  vercel: { ...defaultProvider },

  init: () => {
    let unlistenComplete: UnlistenFn | null = null
    let unlistenError: UnlistenFn | null = null

    listen<{ provider: string; account_info: any }>('oauth-complete', (event) => {
      const { provider, account_info } = event.payload
      const info = account_info || {}
      set({
        [provider]: {
          connected: true,
          username: info.username || info.name,
          avatarUrl: info.avatar_url,
          email: info.email,
        },
      } as any)
    }).then((fn) => { unlistenComplete = fn })

    listen<{ provider: string; error: string }>('oauth-error', (event) => {
      console.error(`OAuth error for ${event.payload.provider}:`, event.payload.error)
    }).then((fn) => { unlistenError = fn })

    // Load stored auth state
    get().loadStatus()

    return () => {
      if (unlistenComplete) unlistenComplete()
      if (unlistenError) unlistenError()
    }
  },

  loadStatus: async () => {
    try {
      const statuses = await invoke<Array<{
        connected: boolean
        provider: string
        account_info: any
      }>>('oauth_get_status')

      const update: Partial<AuthState> = {}
      for (const status of statuses) {
        const info = status.account_info || {}
        update[status.provider as keyof AuthState] = {
          connected: status.connected,
          username: info.username || info.name,
          avatarUrl: info.avatar_url,
          email: info.email,
        }
      }
      set(update as any)
    } catch (e) {
      console.error('loadStatus error:', e)
    }
  },

  connect: async (provider) => {
    try {
      await invoke('oauth_start', { provider })
    } catch (e) {
      console.error('connect error:', e)
    }
  },

  disconnect: async (provider) => {
    try {
      await invoke('oauth_revoke', { provider })
      set({
        [provider]: { connected: false },
      } as any)
    } catch (e) {
      console.error('disconnect error:', e)
    }
  },
}))
