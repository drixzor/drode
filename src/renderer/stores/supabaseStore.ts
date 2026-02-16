import { create } from 'zustand'
import { invoke } from '@tauri-apps/api/core'
import { logActivity } from '../services/activityBus'

export interface SupabaseProject {
  id: string
  name: string
  organization_id: string
  region: string
  created_at: string
  database_host: string
  ref: string
}

export interface SupabaseTable {
  name: string
  schema: string
  row_count: number | null
  columns: SupabaseColumn[]
}

export interface SupabaseColumn {
  name: string
  data_type: string
  is_nullable: boolean
  is_primary: boolean
  default_value: string | null
}

export interface SupabaseQueryResult {
  columns: string[]
  rows: Record<string, any>[]
  total_count: number | null
}

interface SupabaseState {
  projects: SupabaseProject[]
  selectedProject: SupabaseProject | null
  tables: SupabaseTable[]
  selectedTable: string | null
  tableData: SupabaseQueryResult | null
  sqlResult: { columns: string[]; rows: Record<string, any>[]; row_count: number } | null
  page: number
  pageSize: number
  isLoading: boolean
  sqlQuery: string
}

interface SupabaseActions {
  loadProjects: () => Promise<void>
  selectProject: (project: SupabaseProject) => Promise<void>
  loadTables: () => Promise<void>
  selectTable: (tableName: string) => Promise<void>
  loadTableData: (page?: number) => Promise<void>
  runSql: (sql: string) => Promise<void>
  insertRow: (data: Record<string, any>) => Promise<boolean>
  updateRow: (rowId: string, data: Record<string, any>) => Promise<boolean>
  deleteRow: (rowId: string) => Promise<boolean>
  runMigration: (sql: string, name: string) => Promise<boolean>
  setSqlQuery: (query: string) => void
}

export const useSupabaseStore = create<SupabaseState & SupabaseActions>((set, get) => ({
  projects: [],
  selectedProject: null,
  tables: [],
  selectedTable: null,
  tableData: null,
  sqlResult: null,
  page: 0,
  pageSize: 50,
  isLoading: false,
  sqlQuery: '',

  loadProjects: async () => {
    set({ isLoading: true })
    try {
      const projects = await invoke<SupabaseProject[]>('supabase_list_projects')
      set({ projects, isLoading: false })
    } catch (e) {
      console.error('loadProjects error:', e)
      set({ isLoading: false })
    }
  },

  selectProject: async (project) => {
    set({
      selectedProject: project,
      tables: [],
      selectedTable: null,
      tableData: null,
      sqlResult: null,
    })
    await get().loadTables()
  },

  loadTables: async () => {
    const { selectedProject } = get()
    if (!selectedProject) return

    set({ isLoading: true })
    try {
      const tables = await invoke<SupabaseTable[]>('supabase_list_tables', {
        projectRef: selectedProject.ref,
      })
      set({ tables, isLoading: false })
    } catch (e) {
      console.error('loadTables error:', e)
      set({ isLoading: false })
    }
  },

  selectTable: async (tableName) => {
    set({ selectedTable: tableName, page: 0, tableData: null })
    await get().loadTableData(0)
  },

  loadTableData: async (page) => {
    const { selectedProject, selectedTable, pageSize } = get()
    if (!selectedProject || !selectedTable) return

    const currentPage = page ?? get().page
    set({ isLoading: true, page: currentPage })
    try {
      const tableData = await invoke<SupabaseQueryResult>('supabase_get_table_data', {
        projectRef: selectedProject.ref,
        tableName: selectedTable,
        page: currentPage,
        pageSize,
        orderBy: null,
        filters: null,
      })
      set({ tableData, isLoading: false })
    } catch (e) {
      console.error('loadTableData error:', e)
      set({ isLoading: false })
    }
  },

  runSql: async (sql) => {
    const { selectedProject } = get()
    if (!selectedProject) return

    set({ isLoading: true })
    try {
      const sqlResult = await invoke<{ columns: string[]; rows: Record<string, any>[]; row_count: number }>('supabase_run_sql', {
        projectRef: selectedProject.ref,
        sql,
      })
      set({ sqlResult, isLoading: false })
      logActivity('supabase', 'query_executed', `Ran SQL query on ${selectedProject.name}`)
    } catch (e) {
      console.error('runSql error:', e)
      set({ isLoading: false })
    }
  },

  insertRow: async (data) => {
    const { selectedProject, selectedTable } = get()
    if (!selectedProject || !selectedTable) return false

    try {
      await invoke('supabase_insert_row', {
        projectRef: selectedProject.ref,
        tableName: selectedTable,
        dataJson: JSON.stringify(data),
      })
      logActivity('supabase', 'row_inserted', `Inserted row into ${selectedTable} table`)
      await get().loadTableData()
      return true
    } catch (e) {
      console.error('insertRow error:', e)
      return false
    }
  },

  updateRow: async (rowId, data) => {
    const { selectedProject, selectedTable } = get()
    if (!selectedProject || !selectedTable) return false

    try {
      await invoke('supabase_update_row', {
        projectRef: selectedProject.ref,
        tableName: selectedTable,
        rowId,
        dataJson: JSON.stringify(data),
      })
      logActivity('supabase', 'row_updated', `Updated row in ${selectedTable} table`)
      await get().loadTableData()
      return true
    } catch (e) {
      console.error('updateRow error:', e)
      return false
    }
  },

  deleteRow: async (rowId) => {
    const { selectedProject, selectedTable } = get()
    if (!selectedProject || !selectedTable) return false

    try {
      await invoke('supabase_delete_row', {
        projectRef: selectedProject.ref,
        tableName: selectedTable,
        rowId,
      })
      logActivity('supabase', 'row_deleted', `Deleted row from ${selectedTable} table`)
      await get().loadTableData()
      return true
    } catch (e) {
      console.error('deleteRow error:', e)
      return false
    }
  },

  runMigration: async (sql, name) => {
    const { selectedProject } = get()
    if (!selectedProject) return false

    try {
      await invoke('supabase_run_migration', {
        projectRef: selectedProject.ref,
        migrationSql: sql,
        migrationName: name,
      })
      logActivity('supabase', 'migration_run', `Ran migration: ${name}`)
      await get().loadTables()
      return true
    } catch (e) {
      console.error('runMigration error:', e)
      return false
    }
  },

  setSqlQuery: (query) => set({ sqlQuery: query }),
}))
