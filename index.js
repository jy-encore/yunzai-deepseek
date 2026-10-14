/**
 * Yunzai 入口。扫描 apps 目录，把每个文件里的插件类交给 Yunzai。
 * 数字越小越先跑：logger 100 记账，panel 2000 指令，summary 2100 总结，chat 8000 概率回复。
 * 某个文件载入失败只打错误，不影响其余插件。
 */
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
