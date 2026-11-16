import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

export function deploymentBuild(env) {
  const target = env.RKMED_DEPLOY_ENV || 'sandbox'
  if (target === 'sandbox') return 'build:hosted'
  if (target !== 'production' || env.VERCEL_ENV !== 'production') throw new Error('Publicação comercial exige target production explícito; previews usam homologação.')
  return 'build:prod'
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  execFileSync('npm', ['run', deploymentBuild(process.env)], { stdio: 'inherit' })
}
