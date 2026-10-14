/**
 * 用 Yunzai 自带的 puppeteer 把 resources/html 渲染成图片。
 * 失败返回 null，调用方改发文字。
 */
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
