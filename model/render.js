import path from 'node:path'
import { htmlDir } from './path.js'

export async function renderCard(name, data) {
  const tplFile = path.join(htmlDir, `${name}.html`)
  try {
    const mod = await import('../../../lib/puppeteer/puppeteer.js')
    const puppeteer = mod.default || mod
    const img = await puppeteer.screenshot(`deepseek-${name}`, {
      tplFile,
      saveId: `deepseek-${name}-${Date.now()}`,
      imgType: 'png',
      ...data
    })
    return img || null
  } catch (err) {
    logger.error('deepseek 图片渲染失败: ' + (err?.message || err))
    return null
  }
}
