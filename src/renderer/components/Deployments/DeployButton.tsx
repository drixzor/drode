import React, { useState } from 'react'
import { VscRocket } from 'react-icons/vsc'
import { useVercelStore } from '../../stores/vercelStore'

export function DeployButton() {
  const triggerDeploy = useVercelStore((s) => s.triggerDeploy)
  const [isDeploying, setIsDeploying] = useState(false)

  const handleDeploy = async () => {
    setIsDeploying(true)
    await triggerDeploy()
    setIsDeploying(false)
  }

  return (
    <button
      onClick={handleDeploy}
      disabled={isDeploying}
      className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-claude-accent text-white rounded hover:bg-claude-accent-hover transition-colors disabled:opacity-50"
    >
      <VscRocket className={`w-4 h-4 ${isDeploying ? 'animate-bounce' : ''}`} />
      {isDeploying ? 'Deploying...' : 'Deploy'}
    </button>
  )
}
