/**
 * 普通群聊回复。先记账，再决定要不要问模型。
 * wake：点名、@ 机器人、回复机器人。走 nameProbability（默认必回），不受 replyGap 限制。
 * 其余消息走 probability，并且两次普通回复之间至少隔 replyGap 秒。
 * 模型回 [IGNORE] 或思考稿时不发言。return false 表示这条没处理。
 */
import { getConfig, isGroupEnabled } from '../model/config.js'
import { contextOf, recordBot, recordIncoming } from '../model/chatlog.js'
import { buildChatPrompt } from '../model/prompt.js'
import { completeText } from '../model/api.js'
import { clip, isAtBot, isFilteredUser, isGroupEvent, isIgnoredPrefix, isIgnore, isReplyToBot, isSelfMsg, isThinkingLeak, mentionsBotName, toSegments } from '../utils/text.js'

/** 每个群上次「普通接话」的时间。点名、@、回复机器人不写入、也不读取。 */
const lastCasual = new Map()

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
    // 私聊、自己的发言、本群关闭、3889 开头的号都不进回复
    if (!isGroupEvent(e) || isSelfMsg(e)) return false
    if (!isGroupEnabled(e.group_id)) return false
    if (isFilteredUser(e.user_id)) return false

    const raw = e.msg ? String(e.msg).trim() : ''
    // 指令和口令留给别的插件，这里不接
    if (raw && isIgnoredPrefix(raw)) return false

    const cfg = getConfig()
    const name = String(cfg.botName || '').trim()
    const named = mentionsBotName(raw, name)
    const wake = named || isAtBot(e) || await isReplyToBot(e)
    if (!wake && !raw) return false
    if (wake) {
      if (Math.random() >= cfg.nameProbability) return false
    } else {
      if (Math.random() >= cfg.probability) return false
      if (cfg.replyGap > 0) {
        const prev = lastCasual.get(String(e.group_id)) || 0
        if (Date.now() - prev < cfg.replyGap * 1000) return false
      }
    }

    const { history, current, skip } = contextOf(e.group_id, cfg.historyCount)
    if (skip || !current) return false

    const prompt = buildChatPrompt({
      groupId: e.group_id,
      role: cfg.role,
      history,
      current,
      mustReply: wake
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

    if (isIgnore(text) || isThinkingLeak(text)) return false
    text = clip(text.replace(/^["'`]+|["'`]+$/g, ''), 80)
    if (!text || isIgnore(text) || isThinkingLeak(text)) return false

    const segs = await toSegments(e, text)
    await e.reply(segs)
    recordBot(e, text, cfg.botName)
    // 只有普通接话才刷新间隔
    if (!wake) lastCasual.set(String(e.group_id), Date.now())
    return true
  }
}
