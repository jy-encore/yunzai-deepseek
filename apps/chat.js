import { getConfig, isGroupEnabled } from '../model/config.js'
import { contextOf, recordBot, recordIncoming } from '../model/chatlog.js'
import { buildChatPrompt } from '../model/prompt.js'
import { completeText } from '../model/api.js'
import { clip, isFilteredUser, isGroupEvent, isIgnoredPrefix, isIgnore, isSelfMsg, toSegments } from '../utils/text.js'

export class DeepSeekChat extends plugin {
  constructor() {
    super({
      name: 'deepseek-chat',
      dsc: 'DeepSeek 概率群聊',
      event: 'message',
      priority: 8000,
      rule: [{
        reg: '.*',
        fnc: 'chat',
        log: false
      }]
    })
  }

  async chat(e) {
    try {
      recordIncoming(e)
    } catch (err) {
      logger.error('deepseek 记录失败: ' + (err?.message || err))
    }
    if (!isGroupEvent(e) || isSelfMsg(e)) return false
    if (!isGroupEnabled(e.group_id)) return false
    if (isFilteredUser(e.user_id)) return false

    const raw = e.msg ? String(e.msg).trim() : ''
    if (!raw || isIgnoredPrefix(raw)) return false

    const cfg = getConfig()
    if (Math.random() >= cfg.probability) return false

    const { history, current, skip } = contextOf(e.group_id, cfg.historyCount)
    if (skip || !current) return false

    const prompt = buildChatPrompt({
      groupId: e.group_id,
      role: cfg.role,
      history,
      current
    })

    let text = ''
    try {
      text = await completeText([{ role: 'user', content: prompt }], {
        think: false,
        maxTokens: cfg.maxTokens,
        temperature: cfg.temperature
      })
    } catch (err) {
      logger.error('deepseek 对话失败: ' + (err?.message || err))
      return false
    }

    if (isIgnore(text)) return false
    text = clip(text.replace(/^["'`]+|["'`]+$/g, ''), 200)
    if (!text || isIgnore(text)) return false

    const segs = await toSegments(e, text)
    await e.reply(segs)
    recordBot(e, text, cfg.botName)
    return true
  }
}
