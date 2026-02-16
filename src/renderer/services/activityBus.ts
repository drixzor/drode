import { invoke } from '@tauri-apps/api/core'
import { useProjectStore } from '../stores/projectStore'

export async function logActivity(
  category: string,
  eventType: string,
  title: string,
  options?: {
    detailJson?: string
    severity?: string
    sourceId?: string
  }
) {
  const projectPath = useProjectStore.getState().currentProject
  if (!projectPath) return

  try {
    await invoke('log_activity', {
      projectPath,
      category,
      eventType,
      title,
      detailJson: options?.detailJson ?? null,
      severity: options?.severity ?? null,
      sourceId: options?.sourceId ?? null,
    })
  } catch (e) {
    console.error('logActivity error:', e)
  }
}
