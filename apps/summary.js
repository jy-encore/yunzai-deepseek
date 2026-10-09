import { getConfig, isGroupEnabled } from '../model/config.js'
import { clearLog, recordBot, visibleMsgs } from '../model/chatlog.js'
import { buildSummaryPrompt } from '../model/prompt.js'
import { completeText } from '../model/api.js'
import { clip, isGroupEvent, isThinkingLeak, toSegments } from '../utils/text.js'

const cooldown = new Map()

function parseSummary(msg, botName) {
  let text = String(msg || '').trim()
  const name = String(botName || '').trim()
  if (name && text.startsWith(name)) text = text.slice(name.length).trim()
  text = text.replace(/^#/, '').trim()
  const matched = text.match(/^(总结群聊|总结聊天|群聊总结|deepseek总结)(.*)$/)
  if (!matched) return null
  return matched[2].trim()
}

export class DeepSeekSummary extends plugin {
  constructor() {
    super({
      name: 'deepseek-summary',
      dsc: '总结群聊',
      event: 'message',
      priority: 2100,
      rule: [
        { reg: '.*(总结群聊|总结聊天|群聊总结|deepseek总结).*', fnc: 'summarize', log: false },
        { reg: '^#deepseek清空记录$', fnc: 'clear', permission: 'master' }
      ]
    })
  }

  async clear(e) {
    if (!e.isGroup) {
      await e.reply('请在群里清空该群记录')
      return true
    }
    clearLog(e.group_id)
    await e.reply('本群聊天记录已清空')
    return true
  }

  async summarize(e) {
    const cfg = getConfig()
    const extra = parseSummary(e.msg, cfg.botName)
    if (extra == null) return false
    if (!isGroupEvent(e)) {
      await e.reply('总结群聊只在群里用')
      return true
    }
    if (!isGroupEnabled(e.group_id)) {
      await e.reply('本群回复已关闭', true)
      return true
    }
    const now = Date.now()
    if (now - (cooldown.get(e.group_id) || 0) < 40000) {
      await e.reply('刚总结过，稍等一会儿再喊我', true)
      return true
    }
    const msgs = visibleMsgs(e.group_id)
    if (msgs.length < 5) {
      await e.reply(`这群才记下 ${msgs.length} 条，再聊一会儿再总结`, true)
      return true
    }
    cooldown.set(e.group_id, now)
    await e.reply(`我先翻一下最近 ${msgs.length} 条记录…`, true)
    try {
      const text = await completeText(
        [{ role: 'user', content: clip(buildSummaryPrompt(e.group_id, extra, msgs), 8000) }],
        { think: true, maxTokens: 4096, fallbackTokens: 900, temperature: 0.7 }
      )
      if (!text || isThinkingLeak(text)) {
        cooldown.set(e.group_id, Date.now() - 32000)
        await e.reply('翻完了但没理出头绪，稍后再试', true)
        return true
      }
      const body = clip(text, 1200)
      const segs = await toSegments(e, `群聊复盘（${msgs.length} 条）\n${body}`)
      await e.reply(segs)
      recordBot(e, body, cfg.botName)
    } catch (err) {
      cooldown.set(e.group_id, Date.now() - 32000)
      logger.error('deepseek 总结失败: ' + (err?.message || err))
      await e.reply('总结请求失败，稍后再试', true)
    }
    return true
  }
}
