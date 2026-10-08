import { getConfig, saveConfig } from '../model/config.js'
import { logCount } from '../model/chatlog.js'
import { renderCard } from '../model/render.js'
import { clamp, parseProb } from '../utils/text.js'

const HELP = [
  { cmd: '#deepseek帮助', desc: '打开这张帮助卡' },
  { cmd: '#deepseek状态', desc: '查看当前配置和本群记录' },
  { cmd: '#总结群聊', desc: '用本群 chatlog 做一次复盘' },
  { cmd: '#deepseek设置回复概率 5', desc: '普通消息触发概率，5 或 0.05' },
  { cmd: '#deepseek设置历史条数 10', desc: '命中后附带的前文条数' },
  { cmd: '#deepseek设置回复上限 120', desc: '单次 max_tokens' },
  { cmd: '#deepseek设置温度 0.9', desc: '采样温度 0 到 2' },
  { cmd: '#deepseek设置提示词 ...', desc: '改角色设定，写进 config.json' },
  { cmd: '#deepseek清空记录', desc: '清空本群 chatlog' }
]

function helpText() {
  return ['DeepSeek 群聊', ...HELP.map(x => `${x.cmd}  ${x.desc}`)].join('\n')
}

export class DeepSeekPanel extends plugin {
  constructor() {
    super({
      name: 'deepseek-panel',
      dsc: '帮助、状态与设置',
      event: 'message',
      priority: 2000,
      rule: [
        { reg: '^#deepseek帮助$', fnc: 'help', permission: 'master' },
        { reg: '^#deepseek状态$', fnc: 'status', permission: 'master' },
        { reg: '^#deepseek设置回复概率(.*)$', fnc: 'setProbability', permission: 'master' },
        { reg: '^#deepseek设置历史条数(.*)$', fnc: 'setHistory', permission: 'master' },
        { reg: '^#deepseek设置回复上限(.*)$', fnc: 'setMaxTokens', permission: 'master' },
        { reg: '^#deepseek设置温度(.*)$', fnc: 'setTemperature', permission: 'master' },
        { reg: '^#deepseek设置提示词(.*)$', fnc: 'setRole', permission: 'master' }
      ]
    })
  }

  async help(e) {
    const img = await renderCard('help', { title: 'DeepSeek', sub: '群聊插件', cmds: HELP })
    if (img) await e.reply(img)
    else await e.reply(helpText())
    return true
  }

  async status(e) {
    const cfg = getConfig()
    const count = e.isGroup ? logCount(e.group_id) : 0
    const data = {
      title: cfg.botName || 'DeepSeek',
      model: cfg.model,
      probability: `${(cfg.probability * 100).toFixed(1)}%`,
      historyCount: cfg.historyCount,
      maxTokens: cfg.maxTokens,
      temperature: cfg.temperature,
      logKeep: cfg.logKeep,
      count: e.isGroup ? `${count} / ${cfg.logKeep}` : '请在群里查看',
      groupId: e.group_id || '-',
      keys: cfg.apiKeys.length,
      role: cfg.role
    }
    const img = await renderCard('status', data)
    if (img) await e.reply(img)
    else {
      await e.reply([
        `模型 ${data.model}`,
        `回复概率 ${data.probability}`,
        `前文 ${data.historyCount} 条`,
        `本群记录 ${data.count}`,
        `回复上限 ${data.maxTokens}`,
        `温度 ${data.temperature}`,
        `密钥 ${data.keys} 个`
      ].join('\n'))
    }
    return true
  }

  async setProbability(e) {
    const n = parseProb(e.msg.replace('#deepseek设置回复概率', ''))
    if (n == null) {
      await e.reply('格式：#deepseek设置回复概率 5  或  0.05')
      return true
    }
    saveConfig({ probability: n })
    await e.reply(`回复概率已写入 config.json：${(n * 100).toFixed(1)}%`)
    return true
  }

  async setHistory(e) {
    const n = clamp(parseInt(e.msg.replace('#deepseek设置历史条数', '').trim()), 1, 30)
    saveConfig({ historyCount: n })
    await e.reply(`命中后读取前文 ${n} 条`)
    return true
  }

  async setMaxTokens(e) {
    const n = clamp(parseInt(e.msg.replace('#deepseek设置回复上限', '').trim()), 32, 2048)
    saveConfig({ maxTokens: n })
    await e.reply(`单次回复上限 ${n} tokens`)
    return true
  }

  async setTemperature(e) {
    const n = clamp(parseFloat(e.msg.replace('#deepseek设置温度', '').trim()), 0, 2)
    saveConfig({ temperature: n })
    await e.reply(`温度已设为 ${n}`)
    return true
  }

  async setRole(e) {
    const role = e.msg.replace('#deepseek设置提示词', '').trim()
    if (!role) {
      await e.reply('请在指令后面写上角色设定')
      return true
    }
    saveConfig({ role: role.slice(0, 400) })
    await e.reply('角色设定已写入 config.json')
    return true
  }
}
