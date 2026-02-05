import React from 'react'
import {
  VscFile,
  VscFileCode,
  VscJson,
  VscMarkdown,
  VscSettingsGear,
  VscLock,
  VscKey,
  VscPackage,
  VscSymbolNamespace,
  VscDatabase,
  VscFileMedia,
  VscFileBinary,
  VscTerminalBash,
  VscBook,
  VscGitCommit,
  VscFileZip,
  VscSymbolClass,
  VscCode,
  VscBrowser,
  VscRuby,
} from 'react-icons/vsc'
import {
  SiTypescript,
  SiJavascript,
  SiReact,
  SiPython,
  SiRust,
  SiGo,
  SiDocker,
  SiHtml5,
  SiCss3,
  SiSass,
  SiVuedotjs,
  SiSvelte,
  SiTailwindcss,
  SiYaml,
} from 'react-icons/si'
import { getFileExtension } from '../../utils/fileUtils'

interface FileIconProps {
  filename: string
  isDirectory?: boolean
  className?: string
}

export function FileIcon({ filename, isDirectory = false, className = '' }: FileIconProps) {
  const iconClass = `flex-shrink-0 ${className}`

  if (isDirectory) {
    return null // Directories use VscFolder/VscFolderOpened directly
  }

  const ext = getFileExtension(filename)
  const lowerFilename = filename.toLowerCase()

  // Special files
  if (lowerFilename === 'package.json' || lowerFilename === 'package-lock.json') {
    return <VscPackage className={`${iconClass} text-green-500`} />
  }
  if (lowerFilename === 'tsconfig.json' || lowerFilename === 'jsconfig.json') {
    return <SiTypescript className={`${iconClass} text-blue-500`} />
  }
  if (lowerFilename === 'dockerfile' || lowerFilename.startsWith('docker-compose')) {
    return <SiDocker className={`${iconClass} text-blue-400`} />
  }
  if (lowerFilename === '.gitignore' || lowerFilename === '.gitattributes') {
    return <VscGitCommit className={`${iconClass} text-orange-500`} />
  }
  if (lowerFilename.startsWith('.env')) {
    return <VscKey className={`${iconClass} text-yellow-500`} />
  }
  if (lowerFilename === 'readme.md' || lowerFilename === 'readme') {
    return <VscBook className={`${iconClass} text-blue-400`} />
  }
  if (lowerFilename === 'license' || lowerFilename === 'license.md') {
    return <VscLaw className={`${iconClass} text-yellow-400`} />
  }
  if (lowerFilename === 'tailwind.config.js' || lowerFilename === 'tailwind.config.ts') {
    return <SiTailwindcss className={`${iconClass} text-cyan-400`} />
  }
  if (lowerFilename === 'vite.config.ts' || lowerFilename === 'vite.config.js') {
    return <VscCode className={`${iconClass} text-purple-400`} />
  }
  if (lowerFilename.includes('.config.') || lowerFilename.endsWith('rc') || lowerFilename.endsWith('rc.js') || lowerFilename.endsWith('rc.json')) {
    return <VscSettingsGear className={`${iconClass} text-gray-400`} />
  }

  // By extension
  switch (ext) {
    // TypeScript
    case 'ts':
      return <SiTypescript className={`${iconClass} text-blue-500`} />
    case 'tsx':
      return <SiReact className={`${iconClass} text-cyan-400`} />

    // JavaScript
    case 'js':
    case 'mjs':
    case 'cjs':
      return <SiJavascript className={`${iconClass} text-yellow-400`} />
    case 'jsx':
      return <SiReact className={`${iconClass} text-cyan-400`} />

    // Web
    case 'html':
    case 'htm':
      return <SiHtml5 className={`${iconClass} text-orange-500`} />
    case 'css':
      return <SiCss3 className={`${iconClass} text-blue-500`} />
    case 'scss':
    case 'sass':
      return <SiSass className={`${iconClass} text-pink-400`} />

    // Frameworks
    case 'vue':
      return <SiVuedotjs className={`${iconClass} text-green-500`} />
    case 'svelte':
      return <SiSvelte className={`${iconClass} text-orange-500`} />

    // Data
    case 'json':
      return <VscJson className={`${iconClass} text-yellow-400`} />
    case 'yaml':
    case 'yml':
      return <SiYaml className={`${iconClass} text-red-400`} />
    case 'toml':
      return <VscSettingsGear className={`${iconClass} text-gray-400`} />
    case 'xml':
      return <VscCode className={`${iconClass} text-orange-400`} />

    // Documentation
    case 'md':
    case 'mdx':
      return <VscMarkdown className={`${iconClass} text-blue-400`} />
    case 'txt':
      return <VscFile className={`${iconClass} text-gray-400`} />

    // Programming Languages
    case 'py':
      return <SiPython className={`${iconClass} text-yellow-500`} />
    case 'rs':
      return <SiRust className={`${iconClass} text-orange-400`} />
    case 'go':
      return <SiGo className={`${iconClass} text-cyan-500`} />
    case 'rb':
      return <VscRuby className={`${iconClass} text-red-500`} />
    case 'java':
    case 'kt':
    case 'scala':
      return <VscSymbolClass className={`${iconClass} text-orange-500`} />
    case 'c':
    case 'cpp':
    case 'h':
    case 'hpp':
      return <VscFileCode className={`${iconClass} text-blue-400`} />
    case 'cs':
      return <VscFileCode className={`${iconClass} text-purple-500`} />
    case 'php':
      return <VscFileCode className={`${iconClass} text-indigo-400`} />
    case 'swift':
      return <VscFileCode className={`${iconClass} text-orange-500`} />

    // Shell
    case 'sh':
    case 'bash':
    case 'zsh':
    case 'fish':
      return <VscTerminalBash className={`${iconClass} text-green-400`} />
    case 'ps1':
    case 'bat':
    case 'cmd':
      return <VscTerminalBash className={`${iconClass} text-blue-400`} />

    // Database
    case 'sql':
      return <VscDatabase className={`${iconClass} text-yellow-500`} />
    case 'graphql':
    case 'gql':
      return <VscSymbolNamespace className={`${iconClass} text-pink-500`} />

    // Images
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'webp':
    case 'ico':
    case 'bmp':
      return <VscFileMedia className={`${iconClass} text-purple-400`} />
    case 'svg':
      return <VscFileMedia className={`${iconClass} text-orange-400`} />

    // Archives
    case 'zip':
    case 'tar':
    case 'gz':
    case 'rar':
    case '7z':
      return <VscFileZip className={`${iconClass} text-yellow-500`} />

    // Binary/Lock files
    case 'lock':
      return <VscLock className={`${iconClass} text-yellow-500`} />
    case 'wasm':
    case 'exe':
    case 'dll':
    case 'so':
    case 'dylib':
      return <VscFileBinary className={`${iconClass} text-gray-500`} />

    default:
      return <VscFile className={`${iconClass} text-gray-400`} />
  }
}

// Missing icon - using VscBook as fallback
const VscLaw = VscBook
