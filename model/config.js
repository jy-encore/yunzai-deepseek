import fs from 'node:fs'
import path from 'node:path'
import { configFile } from './path.js'
import { clamp } from '../utils/text.js'

export const PRESETS = [
  {
    name: 'deepseek',
    baseURL: 'https://api.deepseek.com',
    apiKeys: [],
    models: ['deepseek-flash', 'deepseek-chat', 'deepseek-reasoner'],
    model: 'deepseek-flash'
  },
  {
    name: 'qwen',
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    apiKeys: [],
    models: ['qwen-plus', 'qwen-flash', 'qwen-turbo'],
    model: 'qwen-plus'
  },
  {
    name: 'mimo',
    baseURL: 'https://api.xiaomimimo.com/v1',
    apiKeys: [],
    models: ['mimo-v2.6-pro'],
    model: 'mimo-v2.6-pro'
  },
  {
    name: 'moonshot',
    baseURL: 'https://api.moonshot.cn/v1',
    apiKeys: [],
    models: ['moonshot-v1-8k'],
    model: 'moonshot-v1-8k'
  },
  {
    name: 'zhipu',
    baseURL: 'https://open.bigmodel.cn/api/paas/v4',
    apiKeys: [],
    models: ['glm-4-flash'],
    model: 'glm-4-flash'
  },
  {
    name: 'siliconflow',
    baseURL: 'https://api.siliconflow.cn/v1',
    apiKeys: [],
    models: ['Qwen/Qwen2.5-7B-Instruct'],
    model: 'Qwen/Qwen2.5-7B-Instruct'
  },
  {
    name: 'moyuu',
    baseURL: 'https://moyuu.cc/v1',
    apiKeys: [],
    models: ['gpt-4o'],
    model: 'gpt-4o'
  }
]

const DEFAULTS = {
  botName: '安可儿',
  role: '你叫安可儿，一个聪明伶俐、逻辑清晰的可爱猫娘。请用一针见血、充满智慧且言简意赅的语言回答问题，兼顾猫娘的可爱语气（适度使用喵、~等），拒绝废话，但必须保证核心逻辑的深度。',
  probability: 0.05,
  nameProbability: 1,
  historyCount: 10,
  logKeep: 100,
  maxTokens: 120,
  temperature: 0.9,
  disabledGroups: []
}

let cache = null

function keyList(v) {
  if (Array.isArray(v)) return v.map(k => String(k || '').trim()).filter(Boolean)
  if (typeof v === 'string' && v.trim()) return [v.trim()]
  return []
}

function cloneEp(e) {
  return { ...e, apiKeys: e.apiKeys.slice(), models: e.models.slice() }
}

function normEndpoint(raw, fallbackName) {
  const name = String(raw?.name || fallbackName || '').trim()
  const baseURL = String(raw?.baseURL || raw?.baseUrl || '').trim().replace(/\/$/, '')
  const models = []
  for (const m of Array.isArray(raw?.models) ? raw.models : []) {
    const s = String(m || '').trim()
    if (s && !models.includes(s)) models.push(s)
  }
  let model = String(raw?.model || '').trim()
  if (model && !models.includes(model)) models.unshift(model)
  if (!model) model = models[0] || ''
  return { name, baseURL, apiKeys: keyList(raw?.apiKeys ?? raw?.apiKey), models, model }
}

function seedEndpoints(raw) {
  const endpoints = PRESETS.map(p => normEndpoint(p))
  const legacyURL = String(raw?.baseURL || '').trim().replace(/\/$/, '')
  const legacyModel = String(raw?.model || '').trim()
  const legacyKeys = keyList(raw?.apiKeys ?? raw?.apiKey)
  let hit = endpoints.find(e => legacyURL && e.baseURL === legacyURL)
  if (!hit && (legacyURL || legacyKeys.length || legacyModel)) {
    hit = normEndpoint({
      name: 'custom',
      baseURL: legacyURL || PRESETS[0].baseURL,
      apiKeys: legacyKeys,
      model: legacyModel || PRESETS[0].model,
      models: [legacyModel || PRESETS[0].model]
    })
    endpoints.unshift(hit)
  } else if (hit) {
    if (legacyKeys.length) hit.apiKeys = legacyKeys
    if (legacyModel) {
      hit.model = legacyModel
      if (!hit.models.includes(legacyModel)) hit.models.unshift(legacyModel)
    }
  }
  return { endpoints, active: hit?.name || endpoints[0].name }
}

function normalize(raw) {
  const src = raw || {}
  const cfg = { ...DEFAULTS, ...src }
  cfg.probability = clamp(cfg.probability, 0, 1)
  cfg.nameProbability = clamp(cfg.nameProbability, 0, 1)
  cfg.historyCount = clamp(parseInt(cfg.historyCount), 1, 30)
  cfg.logKeep = clamp(parseInt(cfg.logKeep), 20, 500)
  cfg.maxTokens = clamp(parseInt(cfg.maxTokens), 32, 2048)
  cfg.temperature = clamp(parseFloat(cfg.temperature), 0, 2)
  const off = Array.isArray(cfg.disabledGroups) ? cfg.disabledGroups : []
  cfg.disabledGroups = [...new Set(off.map(id => String(id)).filter(Boolean))]

  let endpoints = Array.isArray(src.endpoints)
    ? src.endpoints.map((e, i) => normEndpoint(e, `ep${i + 1}`)).filter(e => e.name && e.baseURL)
    : []
  let seededActive = ''
  if (!endpoints.length) {
    const seeded = seedEndpoints(src)
    endpoints = seeded.endpoints
    seededActive = seeded.active
  }
  const seen = new Set()
  endpoints = endpoints.filter(e => {
    if (seen.has(e.name)) return false
    seen.add(e.name)
    return true
  })
  for (const preset of PRESETS) {
    if (!endpoints.some(e => e.name === preset.name)) endpoints.push(normEndpoint(preset))
  }

  let active = String(src.active || seededActive || '').trim()
  if (!endpoints.some(e => e.name === active)) active = endpoints[0].name
  const current = endpoints.find(e => e.name === active)
  cfg.endpoints = endpoints
  cfg.active = active
  cfg.model = current.model
  cfg.baseURL = current.baseURL
  cfg.apiKeys = current.apiKeys.slice()
  return cfg
}

function write(cfg) {
  cache = cfg
  fs.mkdirSync(path.dirname(configFile), { recursive: true })
  const out = {
    active: cfg.active,
    endpoints: cfg.endpoints,
    botName: cfg.botName,
    role: cfg.role,
    probability: cfg.probability,
    nameProbability: cfg.nameProbability,
    historyCount: cfg.historyCount,
    logKeep: cfg.logKeep,
    maxTokens: cfg.maxTokens,
    temperature: cfg.temperature,
    disabledGroups: cfg.disabledGroups
  }
  fs.writeFileSync(configFile, JSON.stringify(out, null, 2))
  return cfg
}

export function getConfig() {
  if (cache) return cache
  try {
    const raw = JSON.parse(fs.readFileSync(configFile, 'utf8'))
    cache = normalize(raw)
    const had = new Set((Array.isArray(raw.endpoints) ? raw.endpoints : []).map(e => e?.name).filter(Boolean))
    const missingPreset = PRESETS.some(p => !had.has(p.name))
    const legacy = raw.model != null || raw.baseURL != null || raw.apiKeys != null || raw.apiKey != null || !Array.isArray(raw.endpoints)
    if (legacy || missingPreset) write(cache)
  } catch (err) {
    logger.error('deepseek 读取 config.json 失败，使用默认配置: ' + (err?.message || err))
    cache = normalize({})
  }
  return cache
}

export function activeEndpoint(cfg = getConfig()) {
  return cfg.endpoints.find(e => e.name === cfg.active) || cfg.endpoints[0]
}

export function saveConfig(partial) {
  const prev = getConfig()
  const merged = { ...prev, ...(partial || {}) }
  if (partial && !partial.endpoints) {
    merged.endpoints = prev.endpoints.map(cloneEp)
    const cur = merged.endpoints.find(e => e.name === (partial.active || prev.active))
    if (cur) {
      if (partial.model) {
        cur.model = String(partial.model).trim()
        if (cur.model && !cur.models.includes(cur.model)) cur.models.unshift(cur.model)
      }
      if (partial.apiKeys) cur.apiKeys = keyList(partial.apiKeys)
      if (partial.baseURL) cur.baseURL = String(partial.baseURL).trim().replace(/\/$/, '')
    }
  }
  return write(normalize(merged))
}

export function switchEndpoint(nameOrIndex) {
  const cfg = getConfig()
  const s = String(nameOrIndex || '').trim()
  if (!s) return null
  const n = parseInt(s, 10)
  const ep = String(n) === s
    ? cfg.endpoints[n - 1]
    : cfg.endpoints.find(e => e.name === s)
  if (!ep) return null
  return saveConfig({ active: ep.name, endpoints: cfg.endpoints.map(cloneEp) })
}

export function switchModel(modelName) {
  const name = String(modelName || '').trim()
  if (!name) return null
  const cfg = getConfig()
  const endpoints = cfg.endpoints.map(cloneEp)
  const here = endpoints.find(e => e.name === cfg.active)
  const listed = endpoints.find(e => e.models.includes(name))
  const target = (here && here.models.includes(name)) ? here : (listed || here)
  if (!target) return null
  target.model = name
  if (!target.models.includes(name)) target.models.unshift(name)
  return saveConfig({ active: target.name, model: name, endpoints })
}

export function addEndpoint({ name, baseURL, apiKey, model }) {
  const title = String(name || '').trim()
  const url = String(baseURL || '').trim().replace(/\/$/, '')
  const id = String(model || '').trim()
  const key = String(apiKey || '').trim()
  if (!title || !url || !id) return null
  const cfg = getConfig()
  const endpoints = cfg.endpoints.map(cloneEp)
  let ep = endpoints.find(e => e.name === title)
  if (!ep) {
    ep = normEndpoint({ name: title, baseURL: url, apiKeys: key ? [key] : [], model: id, models: [id] })
    endpoints.push(ep)
  } else {
    ep.baseURL = url
    ep.model = id
    if (!ep.models.includes(id)) ep.models.unshift(id)
    if (key && !ep.apiKeys.includes(key)) ep.apiKeys.push(key)
  }
  return saveConfig({ endpoints, active: title, model: id })
}

export function addKey(key) {
  const k = String(key || '').trim()
  if (!k) return null
  const cfg = getConfig()
  const endpoints = cfg.endpoints.map(cloneEp)
  const cur = endpoints.find(e => e.name === cfg.active)
  if (!cur) return null
  if (!cur.apiKeys.includes(k)) cur.apiKeys.push(k)
  return saveConfig({ endpoints, apiKeys: cur.apiKeys })
}

export function isGroupEnabled(gid) {
  if (!gid) return true
  return !getConfig().disabledGroups.includes(String(gid))
}

export function setGroupEnabled(gid, on) {
  const id = String(gid)
  const cur = getConfig().disabledGroups.filter(x => x !== id)
  if (!on) cur.push(id)
  return saveConfig({ disabledGroups: cur })
}
