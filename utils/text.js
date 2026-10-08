const CQ_RE = /\[CQ:[^\]]+\]/g

export function clip(text, n = 180) {
  text = String(text || '')
  return text.length > n ? text.slice(0, n) + '…' : text
}

export function clamp(n, min, max) {
  n = Number(n)
  if (!Number.isFinite(n)) return min
  return Math.min(max, Math.max(min, n))
}

export function parseProb(s) {
  let n = parseFloat(String(s).trim())
  if (!Number.isFinite(n)) return null
  if (n > 1) n = n / 100
  return clamp(n, 0, 1)
}

export function cqToText(raw) {
  return String(raw || '').replace(CQ_RE, m => {
    if (/image/i.test(m)) return '[图片]'
    if (/face/i.test(m)) return '[表情]'
    if (/at/i.test(m)) return '@'
    if (/video/i.test(m)) return '[视频]'
    if (/record/i.test(m)) return '[语音]'
    return ''
  }).replace(/\s+/g, ' ').trim()
}

export function extractText(e) {
  let t = ''
  if (Array.isArray(e.message)) {
    t = e.message.map(seg => {
      if (!seg) return ''
      if (seg.type === 'text') return seg.text || ''
      if (seg.type === 'image') return '[图片]'
      if (seg.type === 'face') return '[表情]'
      if (seg.type === 'at') return `@${seg.qq || seg.data?.qq || seg.text || ''}`
      if (seg.type === 'video') return '[视频]'
      if (seg.type === 'record') return '[语音]'
      if (seg.type === 'json' || seg.type === 'xml') return '[卡片]'
      return ''
    }).join('')
  }
  if (!t) t = e.raw_message || e.msg || ''
  return clip(cqToText(t), 180)
}

function botUins(e) {
  const set = new Set()
  if (e?.self_id) set.add(String(e.self_id))
  const bot = typeof Bot !== 'undefined' ? Bot : global.Bot
  if (bot?.uin != null) {
    const list = Array.isArray(bot.uin) ? bot.uin : [bot.uin]
    for (const u of list) if (u != null && u !== '') set.add(String(u))
  }
  return set
}

export function isAtBot(e) {
  if (e?.atBot || e?.atme) return true
  const uins = botUins(e)
  if (e?.at != null && e.at !== 'all' && uins.has(String(e.at))) return true
  const segs = Array.isArray(e?.message) ? e.message : []
  for (const seg of segs) {
    if (!seg || seg.type !== 'at') continue
    const qq = seg.qq ?? seg.data?.qq ?? seg.user_id
    if (qq == null || qq === 'all') continue
    if (uins.has(String(qq))) return true
  }
  const raw = String(e?.raw_message || '')
  for (const u of uins) {
    if (raw.includes(`[CQ:at,qq=${u}]`)) return true
  }
  return false
}

export async function isReplyToBot(e) {
  const uins = botUins(e)
  const hit = (uid) => uid != null && uid !== '' && uid !== 'all' && uins.has(String(uid))
  const src = e?.source
  if (hit(src?.user_id) || hit(src?.sender?.user_id) || hit(src?.sender?.uin)) return true
  const cached = e?.reply
  if (cached && typeof cached !== 'function' && (hit(cached.sender?.user_id) || hit(cached.user_id) || hit(cached.sender?.uin))) return true
  const segs = Array.isArray(e?.message) ? e.message : []
  let hasReply = false
  for (const seg of segs) {
    if (!seg || seg.type !== 'reply') continue
    hasReply = true
    if (hit(seg.user_id ?? seg.data?.user_id ?? seg.sender?.user_id)) return true
  }
  if (!hasReply || typeof e.getReply !== 'function') return false
  try {
    const r = await e.getReply()
    return hit(r?.sender?.user_id) || hit(r?.user_id) || hit(r?.sender?.uin)
  } catch (err) {
    logger.error('deepseek 读取回复来源失败: ' + (err?.message || err))
    return false
  }
}

export function isFilteredUser(uid) {
  return String(uid ?? '').startsWith('3889')
}

export function isSelfMsg(e) {
  if (!e?.user_id) return false
  if (e.user_id == e.self_id) return true
  const bot = typeof Bot !== 'undefined' ? Bot : global.Bot
  if (!bot) return false
  if (e.user_id == bot.uin) return true
  if (Array.isArray(bot.uin) && bot.uin.some(u => u == e.user_id)) return true
  return false
}

export function isGroupEvent(e) {
  return !!(e && (e.isGroup || e.message_type === 'group' || e.group_id))
}

export function isIgnoredPrefix(raw) {
  return /^(stoken)|[*%#/]/.test(String(raw || '').trim())
}

export function pickContent(msg) {
  if (!msg) return ''
  let c = msg.content
  if (Array.isArray(c)) {
    c = c.map(p => (typeof p === 'string' ? p : (p?.text || p?.content || ''))).join('')
  }
  if (c && typeof c === 'object') c = c.text || c.content || ''
  return String(c || '').trim()
}

export function isIgnore(text) {
  const t = String(text || '').trim().replace(/^["'`]+|["'`]+$/g, '')
  if (!t) return true
  return /^\[?\s*IGNORE\s*\]?/i.test(t)
}

export async function toSegments(e, text) {
  const atRegex = /(at:|@)([a-zA-Z0-9]+)|\[CQ:at,qq=(\d+)\]/g
  const matches = []
  let match
  let lastIndex = 0
  while ((match = atRegex.exec(text)) !== null) {
    if (lastIndex !== match.index) matches.push(text.slice(lastIndex, match.index))
    const userId = match[2] || match[3]
    try {
      const member = e.group?.pickMember(parseInt(userId))
      if (member && member.nickname && typeof segment !== 'undefined') {
        matches.push(segment.at(userId, member.nickname))
      }
    } catch {}
    lastIndex = atRegex.lastIndex
  }
  if (lastIndex < text.length) matches.push(text.slice(lastIndex))
  const parts = matches.filter(x => x !== '')
  return parts.length ? parts : text
}

export function lineOf(m, i) {
  const head = i == null ? '' : `${i}. `
  return `${head}${m.n || '用户'}(userid:${m.uid}): ${m.m}`
}
