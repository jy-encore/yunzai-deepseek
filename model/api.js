import OpenAI from 'openai'
import { getConfig } from './config.js'
import { pickContent } from '../utils/text.js'

const clients = []
let keyIndex = 0

function clientAt(i, cfg) {
  if (!clients[i]) {
    clients[i] = new OpenAI({
      baseURL: cfg.baseURL || 'https://api.deepseek.com',
      apiKey: cfg.apiKeys[i],
      timeout: 90000
    })
  }
  return clients[i]
}

export function resetClients() {
  clients.length = 0
  keyIndex = 0
}

export async function complete(messages, { think = false, maxTokens = 120, temperature = 0.9 } = {}) {
  const cfg = getConfig()
  if (!cfg.apiKeys.length) throw new Error('config.json 里没有 apiKeys')
  const extra = think
    ? { thinking: { type: 'enabled' }, reasoning_effort: 'low' }
    : { thinking: { type: 'disabled' }, reasoning_effort: 'none' }
  const body = {
    model: cfg.model,
    messages,
    max_tokens: maxTokens,
    reasoning_effort: extra.reasoning_effort,
    extra_body: extra
  }
  if (!think) body.temperature = temperature
  let tried = 0
  let lastErr
  while (tried < cfg.apiKeys.length) {
    try {
      return await clientAt(keyIndex, cfg).chat.completions.create(body, { timeout: think ? 90000 : 28000 })
    } catch (err) {
      lastErr = err
      tried++
      keyIndex = (keyIndex + 1) % cfg.apiKeys.length
      clients.length = 0
    }
  }
  throw lastErr
}

export async function completeText(messages, opt = {}) {
  let res = await complete(messages, opt)
  let text = pickContent(res?.choices?.[0]?.message)
  if (!text && opt.think) {
    res = await complete(messages, { ...opt, think: false, maxTokens: opt.fallbackTokens || 800 })
    text = pickContent(res?.choices?.[0]?.message)
  }
  return text
}
