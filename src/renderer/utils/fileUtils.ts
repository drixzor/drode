export function getFileExtension(filename: string): string {
  const parts = filename.split('.')
  return parts.length > 1 ? parts.pop()!.toLowerCase() : ''
}

export function getLanguageFromExtension(extension: string): string {
  const languageMap: Record<string, string> = {
    // JavaScript/TypeScript
    js: 'javascript',
    jsx: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    mjs: 'javascript',
    cjs: 'javascript',

    // Web
    html: 'html',
    htm: 'html',
    css: 'css',
    scss: 'scss',
    sass: 'sass',
    less: 'less',

    // Data formats
    json: 'json',
    xml: 'xml',
    yaml: 'yaml',
    yml: 'yaml',
    toml: 'toml',

    // Programming languages
    py: 'python',
    rb: 'ruby',
    go: 'go',
    rs: 'rust',
    java: 'java',
    kt: 'kotlin',
    scala: 'scala',
    swift: 'swift',
    c: 'c',
    cpp: 'cpp',
    h: 'c',
    hpp: 'cpp',
    cs: 'csharp',
    php: 'php',
    lua: 'lua',
    r: 'r',
    pl: 'perl',
    ex: 'elixir',
    exs: 'elixir',
    erl: 'erlang',
    clj: 'clojure',
    hs: 'haskell',
    ml: 'ocaml',
    fs: 'fsharp',
    vb: 'vb',

    // Shell
    sh: 'shell',
    bash: 'shell',
    zsh: 'shell',
    fish: 'shell',
    ps1: 'powershell',
    bat: 'bat',
    cmd: 'bat',

    // Config
    dockerfile: 'dockerfile',
    makefile: 'makefile',
    cmake: 'cmake',
    gradle: 'groovy',

    // Markup
    md: 'markdown',
    mdx: 'markdown',
    tex: 'latex',
    rst: 'restructuredtext',

    // Database
    sql: 'sql',
    graphql: 'graphql',
    gql: 'graphql',

    // Other
    vue: 'vue',
    svelte: 'svelte',
    astro: 'astro',
  }

  return languageMap[extension] || 'plaintext'
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'

  const units = ['B', 'KB', 'MB', 'GB']
  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${units[i]}`
}

export function formatRelativeTime(timestamp: string): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`

  return date.toLocaleDateString()
}

export function getFileIcon(filename: string, isDirectory: boolean): string {
  if (isDirectory) {
    // Special folder icons
    const folderIcons: Record<string, string> = {
      src: '📦',
      lib: '📚',
      dist: '📤',
      build: '🔨',
      node_modules: '📦',
      test: '🧪',
      tests: '🧪',
      __tests__: '🧪',
      docs: '📖',
      public: '🌐',
      assets: '🎨',
      images: '🖼️',
      components: '🧩',
      hooks: '🪝',
      utils: '🔧',
      services: '⚙️',
      types: '📝',
      config: '⚙️',
    }
    return folderIcons[filename.toLowerCase()] || '📁'
  }

  const ext = getFileExtension(filename)
  const fileIcons: Record<string, string> = {
    // JavaScript/TypeScript
    js: '📜',
    jsx: '⚛️',
    ts: '📘',
    tsx: '⚛️',

    // Config
    json: '📋',
    yaml: '📋',
    yml: '📋',
    toml: '📋',

    // Docs
    md: '📝',
    mdx: '📝',
    txt: '📄',

    // Web
    html: '🌐',
    css: '🎨',
    scss: '🎨',

    // Images
    png: '🖼️',
    jpg: '🖼️',
    jpeg: '🖼️',
    gif: '🖼️',
    svg: '🖼️',
    ico: '🖼️',

    // Other
    gitignore: '🙈',
    env: '🔐',
    lock: '🔒',
  }

  // Check for special filenames
  const specialFiles: Record<string, string> = {
    'package.json': '📦',
    'tsconfig.json': '📘',
    'readme.md': '📖',
    '.gitignore': '🙈',
    '.env': '🔐',
    '.env.local': '🔐',
    dockerfile: '🐳',
    'docker-compose.yml': '🐳',
    makefile: '🔨',
  }

  const lowerFilename = filename.toLowerCase()
  if (specialFiles[lowerFilename]) {
    return specialFiles[lowerFilename]
  }

  return fileIcons[ext] || '📄'
}

export function isTextFile(filename: string): boolean {
  const textExtensions = new Set([
    'txt', 'md', 'mdx', 'json', 'yaml', 'yml', 'toml', 'xml',
    'js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs',
    'html', 'htm', 'css', 'scss', 'sass', 'less',
    'py', 'rb', 'go', 'rs', 'java', 'kt', 'scala', 'swift',
    'c', 'cpp', 'h', 'hpp', 'cs', 'php', 'lua', 'r', 'pl',
    'sh', 'bash', 'zsh', 'fish', 'ps1', 'bat', 'cmd',
    'sql', 'graphql', 'gql',
    'vue', 'svelte', 'astro',
    'gitignore', 'env', 'editorconfig', 'prettierrc', 'eslintrc',
    'dockerfile', 'makefile',
  ])

  const ext = getFileExtension(filename)
  return textExtensions.has(ext) || filename.startsWith('.')
}

export function getParentPath(filePath: string): string {
  const parts = filePath.split('/')
  parts.pop()
  return parts.join('/') || '/'
}

export function getFilename(filePath: string): string {
  const parts = filePath.split('/')
  return parts.pop() || filePath
}

export function joinPath(...parts: string[]): string {
  return parts.join('/').replace(/\/+/g, '/')
}
