import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(fileURLToPath(import.meta.url))
const appsDir = path.join(root, 'apps')

const files = fs.readdirSync(appsDir).filter(file => file.endsWith('.js'))
const ret = await Promise.allSettled(files.map(file => import(`./apps/${file}`)))

const apps = {}
for (let i = 0; i < files.length; i++) {
  const name = files[i].replace('.js', '')
  if (ret[i].status !== 'fulfilled') {
    logger.error(`载入插件错误：${logger.red(name)}`)
    logger.error(ret[i].reason)
    continue
  }
  const mod = ret[i].value
  apps[name] = mod.default || mod[Object.keys(mod)[0]]
}

export { apps }
