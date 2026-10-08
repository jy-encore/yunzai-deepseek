import { addEndpoint, addKey, getConfig, isGroupEnabled, saveConfig, setGroupEnabled, switchEndpoint, switchModel } from '../model/config.js'
import { logCount } from '../model/chatlog.js'
import { renderCard } from '../model/render.js'
import { clamp, parseProb } from '../utils/text.js'
import { getBalance, resetClients } from '../model/api.js'

const HELP = [
  { cmd: '#deepseek帮助', desc: '打开这张帮助卡' },
  { cmd: '#deepseek状态', desc: '查看当前配置和本群记录' },
  { cmd: '#deepseek开启', desc: '打开当前群的回复' },
  { cmd: '#deepseek关闭', desc: '关掉当前群的回复' },
  { cmd: '#总结群聊', desc: '用本群 chatlog 做一次复盘' },
  { cmd: '#deepseek设置回复概率 5', desc: '普通消息触发概率，5 或 0.05' },
  { cmd: '以 botName 开头', desc: '按 nameProbability，默认 100% 进入回复' },
  { cmd: '#deepseek设置历史条数 10', desc: '命中后附带的前文条数' },
  { cmd: '#deepseek设置回复上限 120', desc: '单次 max_tokens' },
  { cmd: '#deepseek设置温度 0.9', desc: '采样温度 0 到 2' },
  { cmd: '#deepseek设置提示词 ...', desc: '改角色设定，写进 config.json' },
  { cmd: '#deepseek接口', desc: '列出地址、模型和是否已填密钥' },
  { cmd: '#deepseek切换接口 qwen', desc: '按名称或序号切换当前接口' },
  { cmd: '#deepseek切换模型 qwen-plus', desc: '切换模型，未登记的名字会记到当前接口' },
  { cmd: '#deepseek添加接口 名 地址 密钥 模型', desc: '再存一套 OpenAI 兼容接口' },
  { cmd: '#deepseek添加密钥', desc: '给当前接口追加一把密钥，密钥写在指令后面' },
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
        { reg: '^#deepseek开启$', fnc: 'enable', permission: 'master' },
        { reg: '^#deepseek关闭$', fnc: 'disable', permission: 'master' },
        { reg: '^#deepseek设置回复概率(.*)$', fnc: 'setProbability', permission: 'master' },
        { reg: '^#deepseek设置历史条数(.*)$', fnc: 'setHistory', permission: 'master' },
        { reg: '^#deepseek设置回复上限(.*)$', fnc: 'setMaxTokens', permission: 'master' },
        { reg: '^#deepseek设置温度(.*)$', fnc: 'setTemperature', permission: 'master' },
        { reg: '^#deepseek接口$', fnc: 'listEndpoints', permission: 'master' },
        { reg: '^#deepseek切换接口(.*)$', fnc: 'useEndpoint', permission: 'master' },
        { reg: '^#deepseek切换模型(.*)$', fnc: 'useModel', permission: 'master' },
        { reg: '^#deepseek添加接口(.*)$', fnc: 'createEndpoint', permission: 'master' },
        { reg: '^#deepseek添加密钥(.*)$', fnc: 'createKey', permission: 'master' },
        { reg: '^#deepseek设置提示词(.*)$', fnc: 'setRole', permission: 'master' }
      ]
    })
  }

  async help(e) {
    const balance = await getBalance()
    const img = await renderCard('help', { title: 'DeepSeek', sub: `余额 ${balance}`, cmds: HELP })
    if (img) await e.reply(img)
    else await e.reply(`余额 ${balance}\n${helpText()}`)
    return true
  }

  async status(e) {
    const cfg = getConfig()
    const count = e.isGroup ? logCount(e.group_id) : 0
    const data = {
      title: cfg.botName || 'DeepSeek',
      model: `${cfg.active} / ${cfg.model}`,
      probability: `${(cfg.probability * 100).toFixed(1)}%`,
      historyCount: cfg.historyCount,
      maxTokens: cfg.maxTokens,
      temperature: cfg.temperature,
      logKeep: cfg.logKeep,
      count: e.isGroup ? `${count} / ${cfg.logKeep}` : '请在群里查看',
      groupId: e.group_id || '-',
      keys: cfg.apiKeys.length,
      reply: e.isGroup ? (isGroupEnabled(e.group_id) ? '开启' : '关闭') : '-',
      balance: await getBalance()
    }
    const img = await renderCard('status', data)
    if (img) await e.reply(img)
    else {
      await e.reply([
        `模型 ${data.model}`,
        `回复概率 ${data.probability}`,
        `前文 ${data.historyCount} 条`,
        `本群记录 ${data.count}`,
        `本群回复 ${data.reply}`,
        `回复上限 ${data.maxTokens}`,
        `温度 ${data.temperature}`,
        `密钥 ${data.keys} 个`,
        `余额 ${data.balance}`
      ].join('\n'))
    }
    return true
  }

  async enable(e) {
    if (!e.isGroup) {
      await e.reply('请在群里开关回复')
      return true
    }
    setGroupEnabled(e.group_id, true)
    await e.reply('本群回复已开启')
    return true
  }

  async disable(e) {
    if (!e.isGroup) {
      await e.reply('请在群里开关回复')
      return true
    }
    setGroupEnabled(e.group_id, false)
    await e.reply('本群回复已关闭')
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

  async listEndpoints(e) {
    const cfg = getConfig()
    const lines = cfg.endpoints.map((ep, i) => {
      const mark = ep.name === cfg.active ? ' 当前' : ''
      const keys = ep.apiKeys.length ? `${ep.apiKeys.length} 把密钥` : '未填密钥'
      return `${i + 1}. ${ep.name}${mark}\n${ep.baseURL}\n${ep.model}｜${keys}`
    })
    await e.reply(lines.join('\n\n'))
    return true
  }

  async useEndpoint(e) {
    const name = e.msg.replace(/^#deepseek切换接口/, '').trim()
    const cfg = switchEndpoint(name)
    if (!cfg) {
      await e.reply('没有这个接口。用 #deepseek接口 看名称或序号')
      return true
    }
    resetClients()
    const keys = cfg.apiKeys.length ? '' : '，还没有密钥'
    await e.reply(`已切换到 ${cfg.active} / ${cfg.model}${keys}`)
    return true
  }

  async useModel(e) {
    const name = e.msg.replace(/^#deepseek切换模型/, '').trim()
    const cfg = switchModel(name)
    if (!cfg) {
      await e.reply('格式：#deepseek切换模型 qwen-plus')
      return true
    }
    resetClients()
    await e.reply(`已切换到 ${cfg.active} / ${cfg.model}`)
    return true
  }

  async createEndpoint(e) {
    const rest = e.msg.replace(/^#deepseek添加接口/, '').trim()
    const parts = rest.split(/\s+/)
    if (parts.length < 4) {
      await e.reply('格式：#deepseek添加接口 名称 地址 密钥 模型名')
      return true
    }
    const [name, baseURL, apiKey, ...modelParts] = parts
    const cfg = addEndpoint({ name, baseURL, apiKey, model: modelParts.join(' ') })
    if (!cfg) {
      await e.reply('名称、地址、模型都不能空')
      return true
    }
    resetClients()
    await e.reply(`已保存并切换到 ${cfg.active} / ${cfg.model}`)
    return true
  }

  async createKey(e) {
    const key = e.msg.replace(/^#deepseek添加密钥/, '').trim()
    const cfg = addKey(key)
    if (!cfg) {
      await e.reply('格式：#deepseek添加密钥 后面接密钥')
      return true
    }
    resetClients()
    await e.reply(`已给 ${cfg.active} 记下密钥，当前 ${cfg.apiKeys.length} 把`)
    return true
  }
}
