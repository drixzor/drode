import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import { spawn, ChildProcess } from 'child_process'
import * as path from 'path'
import * as fs from 'fs'
import { fileURLToPath } from 'url'
import { watch, FSWatcher } from 'chokidar'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

interface StoreSchema {
  recentProjects: string[]
  currentProject: string | null
  windowBounds: { width: number; height: number; x?: number; y?: number }
  conversations: Record<string, ConversationMessage[]>
}

interface ConversationMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
}

// Simple file-based store
class SimpleStore {
  private data: StoreSchema
  private filePath: string

  constructor() {
    const userDataPath = app.getPath('userData')
    this.filePath = path.join(userDataPath, 'config.json')
    this.data = this.load()
  }

  private load(): StoreSchema {
    const defaults: StoreSchema = {
      recentProjects: [],
      currentProject: null,
      windowBounds: { width: 1400, height: 900 },
      conversations: {}
    }

    try {
      if (fs.existsSync(this.filePath)) {
        const content = fs.readFileSync(this.filePath, 'utf-8')
        return { ...defaults, ...JSON.parse(content) }
      }
    } catch (error) {
      console.error('Error loading config:', error)
    }
    return defaults
  }

  private save(): void {
    try {
      const dir = path.dirname(this.filePath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2))
    } catch (error) {
      console.error('Error saving config:', error)
    }
  }

  get<K extends keyof StoreSchema>(key: K): StoreSchema[K] {
    return this.data[key]
  }

  set<K extends keyof StoreSchema>(key: K, value: StoreSchema[K]): void {
    this.data[key] = value
    this.save()
  }
}

let store: SimpleStore

let mainWindow: BrowserWindow | null = null
let claudeProcess: ChildProcess | null = null
let fileWatcher: FSWatcher | null = null
let currentProjectPath: string | null = null

function createWindow() {
  const bounds = store.get('windowBounds')

  mainWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    minWidth: 1000,
    minHeight: 600,
    backgroundColor: '#1a1a1a',
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.on('close', () => {
    if (mainWindow) {
      const bounds = mainWindow.getBounds()
      store.set('windowBounds', bounds)
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
    stopClaudeProcess()
    stopFileWatcher()
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(() => {
  store = new SimpleStore()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// IPC Handlers

ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory', 'createDirectory']
  })

  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0]
  }
  return null
})

ipcMain.handle('get-recent-projects', () => {
  return store.get('recentProjects')
})

ipcMain.handle('get-current-project', () => {
  return store.get('currentProject')
})

ipcMain.handle('set-current-project', async (_, projectPath: string) => {
  store.set('currentProject', projectPath)
  currentProjectPath = projectPath

  // Add to recent projects
  let recentProjects = store.get('recentProjects')
  recentProjects = recentProjects.filter(p => p !== projectPath)
  recentProjects.unshift(projectPath)
  recentProjects = recentProjects.slice(0, 10)
  store.set('recentProjects', recentProjects)

  // Start file watcher for the new project
  await startFileWatcher(projectPath)

  return true
})

ipcMain.handle('remove-recent-project', (_, projectPath: string) => {
  let recentProjects = store.get('recentProjects')
  recentProjects = recentProjects.filter(p => p !== projectPath)
  store.set('recentProjects', recentProjects)
  return recentProjects
})

// File system operations

ipcMain.handle('read-directory', async (_, dirPath: string) => {
  try {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true })
    const result = await Promise.all(
      entries
        .filter(entry => !entry.name.startsWith('.') || entry.name === '.gitignore')
        .map(async entry => {
          const fullPath = path.join(dirPath, entry.name)
          let stats
          try {
            stats = await fs.promises.stat(fullPath)
          } catch {
            return null
          }
          return {
            name: entry.name,
            path: fullPath,
            isDirectory: entry.isDirectory(),
            size: stats.size,
            modified: stats.mtime.toISOString()
          }
        })
    )
    return result.filter(Boolean).sort((a, b) => {
      if (a!.isDirectory && !b!.isDirectory) return -1
      if (!a!.isDirectory && b!.isDirectory) return 1
      return a!.name.localeCompare(b!.name)
    })
  } catch (error) {
    console.error('Error reading directory:', error)
    return []
  }
})

ipcMain.handle('read-file', async (_, filePath: string) => {
  try {
    const content = await fs.promises.readFile(filePath, 'utf-8')
    return { success: true, content }
  } catch (error) {
    return { success: false, error: String(error) }
  }
})

ipcMain.handle('write-file', async (_, filePath: string, content: string) => {
  try {
    await fs.promises.writeFile(filePath, content, 'utf-8')
    return { success: true }
  } catch (error) {
    return { success: false, error: String(error) }
  }
})

ipcMain.handle('create-file', async (_, filePath: string) => {
  try {
    await fs.promises.writeFile(filePath, '', 'utf-8')
    return { success: true }
  } catch (error) {
    return { success: false, error: String(error) }
  }
})

ipcMain.handle('create-directory', async (_, dirPath: string) => {
  try {
    await fs.promises.mkdir(dirPath, { recursive: true })
    return { success: true }
  } catch (error) {
    return { success: false, error: String(error) }
  }
})

ipcMain.handle('delete-file', async (_, filePath: string) => {
  try {
    await shell.trashItem(filePath)
    return { success: true }
  } catch (error) {
    return { success: false, error: String(error) }
  }
})

ipcMain.handle('rename-file', async (_, oldPath: string, newPath: string) => {
  try {
    await fs.promises.rename(oldPath, newPath)
    return { success: true }
  } catch (error) {
    return { success: false, error: String(error) }
  }
})

ipcMain.handle('file-exists', async (_, filePath: string) => {
  try {
    await fs.promises.access(filePath)
    return true
  } catch {
    return false
  }
})

// Claude Code CLI Bridge

ipcMain.handle('start-claude-cli', async (_, projectPath: string) => {
  if (claudeProcess) {
    stopClaudeProcess()
  }

  return new Promise((resolve) => {
    try {
      // Spawn claude-code CLI in interactive mode
      claudeProcess = spawn('claude', ['--dangerously-skip-permissions'], {
        cwd: projectPath,
        shell: true,
        env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' }
      })

      claudeProcess.stdout?.on('data', (data: Buffer) => {
        const text = data.toString()
        mainWindow?.webContents.send('claude-output', { type: 'stdout', data: text })
      })

      claudeProcess.stderr?.on('data', (data: Buffer) => {
        const text = data.toString()
        mainWindow?.webContents.send('claude-output', { type: 'stderr', data: text })
      })

      claudeProcess.on('close', (code: number | null) => {
        mainWindow?.webContents.send('claude-exit', { code })
        claudeProcess = null
      })

      claudeProcess.on('error', (error: Error) => {
        mainWindow?.webContents.send('claude-error', { error: error.message })
        claudeProcess = null
      })

      // Give it a moment to start
      setTimeout(() => {
        resolve({ success: true })
      }, 500)

    } catch (error) {
      resolve({ success: false, error: String(error) })
    }
  })
})

ipcMain.handle('send-to-claude', async (_, message: string) => {
  if (!claudeProcess || !claudeProcess.stdin) {
    return { success: false, error: 'Claude CLI not running' }
  }

  try {
    claudeProcess.stdin.write(message + '\n')
    return { success: true }
  } catch (error) {
    return { success: false, error: String(error) }
  }
})

ipcMain.handle('stop-claude-cli', () => {
  stopClaudeProcess()
  return { success: true }
})

ipcMain.handle('is-claude-running', () => {
  return claudeProcess !== null
})

function stopClaudeProcess() {
  if (claudeProcess) {
    try {
      claudeProcess.stdin?.write('/exit\n')
      setTimeout(() => {
        if (claudeProcess) {
          claudeProcess.kill('SIGTERM')
        }
      }, 1000)
    } catch {
      claudeProcess.kill('SIGTERM')
    }
    claudeProcess = null
  }
}

// File Watcher

async function startFileWatcher(projectPath: string) {
  stopFileWatcher()

  fileWatcher = watch(projectPath, {
    ignored: [
      /(^|[\/\\])\../, // ignore dotfiles
      /node_modules/,
      /\.git/,
      /dist/,
      /build/
    ],
    persistent: true,
    ignoreInitial: true,
    depth: 10
  })

  fileWatcher
    .on('add', (filePath: string) => {
      mainWindow?.webContents.send('file-change', { type: 'add', path: filePath })
    })
    .on('change', (filePath: string) => {
      mainWindow?.webContents.send('file-change', { type: 'change', path: filePath })
    })
    .on('unlink', (filePath: string) => {
      mainWindow?.webContents.send('file-change', { type: 'unlink', path: filePath })
    })
    .on('addDir', (dirPath: string) => {
      mainWindow?.webContents.send('file-change', { type: 'addDir', path: dirPath })
    })
    .on('unlinkDir', (dirPath: string) => {
      mainWindow?.webContents.send('file-change', { type: 'unlinkDir', path: dirPath })
    })
}

function stopFileWatcher() {
  if (fileWatcher) {
    fileWatcher.close()
    fileWatcher = null
  }
}

// Conversation persistence

ipcMain.handle('save-conversation', (_, projectPath: string, messages: ConversationMessage[]) => {
  const conversations = store.get('conversations')
  conversations[projectPath] = messages
  store.set('conversations', conversations)
  return { success: true }
})

ipcMain.handle('load-conversation', (_, projectPath: string) => {
  const conversations = store.get('conversations')
  return conversations[projectPath] || []
})

ipcMain.handle('clear-conversation', (_, projectPath: string) => {
  const conversations = store.get('conversations')
  delete conversations[projectPath]
  store.set('conversations', conversations)
  return { success: true }
})
