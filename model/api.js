/**
 * OpenAI 兼容的聊天补全。当前用哪套接口由 config.active 决定。
 * 同一接口的多把密钥失败后轮换。客户端按「接口名 + 序号 + 地址 + 密钥」缓存。
 * MiMo 必须在请求最外层关思考，并用 max_completion_tokens；Node SDK 不会展开 extra_body。
 * DeepSeek 才带 thinking / reasoning_effort。余额接口也只有 DeepSeek 有。
 */
import OpenAI from 'openai'
import { activeEndpoint, getConfig } from './config.js'
import { pickContent } from '../utils/text.js'

const clients = new Map()
let keyIndex = 0

function clientFor(ep, i) {
  const id = `${ep.name}:${i}:${ep.baseURL}:${ep.apiKeys[i]}`
  if (!clients.has(id)) {
    clients.set(id, new OpenAI({
      baseURL: ep.baseURL,
      apiKey: ep.apiKeys[i],
      timeout: 90000
    }))
  }
  return clients.get(id)
}

/** 换接口、换模型、改密钥后调用，避免继续用旧地址。 */
export function resetClients() {
  clients.clear()
  keyIndex = 0
}

function deepseekHost(ep) {
  return /deepseek/i.test(ep?.name || '') || /deepseek\.com/i.test(ep?.baseURL || '')
}

function mimoHost(ep) {
  return /mimo/i.test(ep?.name || '') || /mimo/i.test(ep?.model || '') || /xiaomimimo\.com/i.test(ep?.baseURL || '')
}

export async function complete(messages, { think = false, maxTokens = 120, temperature = 0.9 } = {}) {
  const ep = activeEndpoint()
  if (!ep?.apiKeys?.length) throw new Error(`接口 ${ep?.name || ''} 没有 apiKeys`)
  const body = {
    model: ep.model,
    messages
  }
  if (mimoHost(ep)) {
    body.max_completion_tokens = maxTokens
    body.temperature = Math.min(1.5, Math.max(0, Number(temperature) || 0.9))
    body.thinking = { type: 'disabled' }
  } else if (deepseekHost(ep)) {
    body.max_tokens = maxTokens
    body.thinking = { type: think ? 'enabled' : 'disabled' }
    body.reasoning_effort = think ? 'low' : 'none'
    if (!think) body.temperature = temperature
  } else {
    body.max_tokens = maxTokens
    if (!think) body.temperature = temperature
  }
  let tried = 0
  let lastErr
  while (tried < ep.apiKeys.length) {
    const i = keyIndex % ep.apiKeys.length
    try {
      return await clientFor(ep, i).chat.completions.create(body, { timeout: think ? 90000 : 28000 })
    } catch (err) {
      lastErr = err
      tried++
      keyIndex = (i + 1) % ep.apiKeys.length
      clients.delete(`${ep.name}:${i}:${ep.baseURL}:${ep.apiKeys[i]}`)
    }
  }
  throw lastErr
}

export async function completeText(messages, opt = {}) {
  let res = await complete(messages, opt)
  let text = pickContent(res?.choices?.[0]?.message)
  // 开了思考却没拿到正文时，再请求一次且关掉思考
  if (!text && opt.think) {
    res = await complete(messages, { ...opt, think: false, maxTokens: opt.fallbackTokens || 800 })
    text = pickContent(res?.choices?.[0]?.message)
  }
  if (!text) {
    const msg = res?.choices?.[0]?.message
    const reason = res?.choices?.[0]?.finish_reason || ''
    logger.error(`接口返回空内容 finish=${reason} fields=${msg ? Object.keys(msg).join(',') : 'none'}`)
  }
  return text
}

export async function getBalance() {
  const ep = activeEndpoint()
  const key = ep?.apiKeys?.[0]
  if (!key) return '未配置密钥'
  if (!deepseekHost(ep)) return '当前接口不支持'
  const base = String(ep.baseURL || '').replace(/\/$/, '')
  try {
    const res = await fetch(`${base}/user/balance`, {
      headers: {
        Authorization: `Bearer ${key}`,
        Accept: 'application/json'
      }
    })
    if (!res.ok) {
      logger.error(`查询余额失败: HTTP ${res.status}`)
      return '查询失败'
    }
    const data = await res.json()
    const infos = Array.isArray(data.balance_infos) ? data.balance_infos : []
    if (!infos.length) return data.is_available ? '可用' : '不足'
    return infos.map(b => `${b.total_balance} ${b.currency || ''}`.trim()).join(' / ')
  } catch (err) {
    logger.error('查询余额失败: ' + (err?.message || err))
    return '查询失败'
  }
}