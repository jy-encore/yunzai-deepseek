import fs from 'node:fs'
import path from 'node:path'
import { configFile } from './path.js'
import { clamp } from '../utils/text.js'

const DEFAULTS = {
  model: 'deepseek-flash',
  baseURL: 'https://api.deepseek.com',
  apiKeys: [],
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

function normalize(raw) {
  const cfg = { ...DEFAULTS, ...(raw || {}) }
  cfg.probability = clamp(cfg.probability, 0, 1)
  cfg.nameProbability = clamp(cfg.nameProbability, 0, 1)
  cfg.historyCount = clamp(parseInt(cfg.historyCount), 1, 30)
  cfg.logKeep = clamp(parseInt(cfg.logKeep), 20, 500)
  cfg.maxTokens = clamp(parseInt(cfg.maxTokens), 32, 2048)
  cfg.temperature = clamp(parseFloat(cfg.temperature), 0, 2)
  if (!Array.isArray(cfg.apiKeys)) cfg.apiKeys = cfg.apiKey ? [String(cfg.apiKey)] : []
  cfg.apiKeys = cfg.apiKeys.map(k => String(k || '').trim()).filter(Boolean)
  const off = Array.isArray(cfg.disabledGroups) ? cfg.disabledGroups : []
  cfg.disabledGroups = [...new Set(off.map(id => String(id)).filter(Boolean))]
  return cfg
}

export function getConfig() {
  if (cache) return cache
  try {
    cache = normalize(JSON.parse(fs.readFileSync(configFile, 'utf8')))
  } catch (err) {
    logger.error('deepseek 读取 config.json 失败，使用默认配置: ' + (err?.message || err))
    cache = normalize({})
  }
  return cache
}

export function saveConfig(partial) {
  const cfg = normalize({ ...getConfig(), ...partial })
  cache = cfg
  fs.mkdirSync(path.dirname(configFile), { recursive: true })
  fs.writeFileSync(configFile, JSON.stringify(cfg, null, 2))
  return cfg
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
