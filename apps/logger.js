import { recordIncoming } from '../model/chatlog.js'

export class DeepSeekLogger extends plugin {
  constructor() {
    super({
      name: 'deepseek-logger',
      dsc: '记录群聊',
      event: 'message',
      priority: 100,
      rule: [{
        reg: '.*',
        fnc: 'note',
        log: false
      }]
    })
  }

  async note(e) {
    try {
      recordIncoming(e)
    } catch (err) {
      logger.error('deepseek 记录失败: ' + (err?.message || err))
    }
    return false
  }
}
