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
      if (seg.type === 'at') return `@${seg.qq || seg.text || ''}`
      if (seg.type === 'video') return '[视频]'
      if (seg.type === 'record') return '[语音]'
      if (seg.type === 'json' || seg.type === 'xml') return '[卡片]'
      return ''
    }).join('')
  }
  if (!t) t = e.raw_message || e.msg || ''
  return clip(cqToText(t), 180)
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
