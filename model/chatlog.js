import fs from 'node:fs'
import path from 'node:path'
import { chatlogDir } from './path.js'
import { getConfig } from './config.js'
import { clip, extractText, isGroupEvent, isSelfMsg } from '../utils/text.js'

const logs = new Map()
const saveTimers = new Map()
let lastStamp = ''

function fileOf(gid) {
  return path.join(chatlogDir, `${gid}.json`)
}

function touch(gid) {
  const rec = logs.get(gid)
  if (!rec) return
  logs.delete(gid)
  logs.set(gid, rec)
}

export function loadLog(gid) {
  gid = String(gid)
  if (logs.has(gid)) {
    touch(gid)
    return logs.get(gid)
  }
  let msgs = []
  try {
    const data = JSON.parse(fs.readFileSync(fileOf(gid), 'utf8'))
    msgs = Array.isArray(data) ? data : (data.msgs || [])
  } catch (err) {
    if (err?.code !== 'ENOENT') logger.error('deepseek 读取聊天记录失败: ' + (err?.message || err))
  }
  const keep = getConfig().logKeep
  if (msgs.length > keep) msgs = msgs.slice(-keep)
  const rec = { msgs }
  logs.set(gid, rec)
  while (logs.size > 40) {
    const oldest = logs.keys().next().value
    flushLog(oldest)
    logs.delete(oldest)
  }
  return rec
}

function scheduleSave(gid) {
  gid = String(gid)
  if (saveTimers.has(gid)) return
  const t = setTimeout(() => {
    saveTimers.delete(gid)
    flushLog(gid)
  }, 800)
  saveTimers.set(gid, t)
}

export function flushLog(gid) {
  gid = String(gid)
  const rec = logs.get(gid)
  if (!rec) return
  try {
    fs.mkdirSync(chatlogDir, { recursive: true })
    fs.writeFileSync(fileOf(gid), JSON.stringify({ msgs: rec.msgs }))
  } catch (err) {
    logger.error('deepseek 写聊天记录失败: ' + (err?.message || err))
  }
}

export function appendLog(gid, item) {
  if (!gid || !item?.m) return
  const rec = loadLog(gid)
  rec.msgs.push(item)
  const keep = getConfig().logKeep
  if (rec.msgs.length > keep) rec.msgs.splice(0, rec.msgs.length - keep)
  scheduleSave(gid)
}

export function clearLog(gid) {
  gid = String(gid)
  logs.set(gid, { msgs: [] })
  try {
    fs.mkdirSync(chatlogDir, { recursive: true })
    fs.writeFileSync(fileOf(gid), JSON.stringify({ msgs: [] }))
  } catch (err) {
    logger.error('deepseek 清空聊天记录失败: ' + (err?.message || err))
  }
}

export function logCount(gid) {
  if (!gid) return 0
  return loadLog(gid).msgs.length
}

export function contextOf(gid, n = 10) {
  const msgs = loadLog(gid).msgs
  if (!msgs.length) return { history: [], current: null }
  const current = msgs[msgs.length - 1]
  const start = Math.max(0, msgs.length - 1 - n)
  return { history: msgs.slice(start, msgs.length - 1), current }
}

export function recordIncoming(e) {
  if (!isGroupEvent(e) || isSelfMsg(e)) return
  const m = extractText(e)
  if (!m) return
  const stamp = `${e.group_id}:${e.user_id}:${m}:${Math.floor(Date.now() / 1000)}`
  if (stamp === lastStamp) return
  lastStamp = stamp
  appendLog(e.group_id, {
    ts: Math.floor(Number(e.time) || Date.now() / 1000),
    uid: e.user_id,
    n: clip(e.sender?.nickname || e.sender?.card || '用户', 16),
    m
  })
}

export function recordBot(e, text, name) {
  if (!isGroupEvent(e)) return
  const m = clip(String(text || '').replace(/\s+/g, ' ').trim(), 180)
  if (!m) return
  appendLog(e.group_id, {
    ts: Math.floor(Date.now() / 1000),
    uid: e.self_id || 0,
    n: name || '安可儿',
    m
  })
}
