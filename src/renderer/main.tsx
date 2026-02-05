import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/index.css'
// Initialize Tauri API (exposes as window.electronAPI for compatibility)
import './services/tauri-api'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
