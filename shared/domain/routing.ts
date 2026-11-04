import type { Channel, Pipeline } from './types'

/**
 * Pipeline and direction detection for incoming messages (docs/02_FEATURES.md §3, §12).
 * Rules in order: link tag → channel rule → keywords → fallback.
 * Keyword matching is "start of word": «анталь» matches «Анталью».
 */

export interface RoutingLink {
  tag: string
  label: string
  pipeline: Pipeline
  departureId?: string | null
}

export interface RoutingSettings {
  /** 'auto' = use keywords; otherwise a fixed pipeline. */
  channels: Partial<Record<Channel, 'auto' | Pipeline>>
  keywords: Record<Pipeline, string[]>
  links: RoutingLink[]
  /** 'queue' = leave without pipeline; otherwise a pipeline. */
  fallback: 'queue' | Pipeline
}

export interface PipelineSuggestion {
  pipeline: Pipeline | null
  confidence: number
  rule: 'link' | 'channel' | 'keywords' | 'fallback'
  matched: string[]
  departureId?: string | null
  tag?: string
}

const WORD_START = '(?:^|[^\\p{L}\\p{N}])'

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Returns keywords that occur at the start of a word in text (case-insensitive, ё=е). */
export function matchKeywords(text: string, keywords: string[]): string[] {
  const norm = (s: string) => s.toLowerCase().replace(/ё/g, 'е')
  const t = norm(text)
  const out: string[] = []
  const seen = new Set<string>()
  for (const raw of keywords) {
    const kw = norm(raw.trim())
    // «всё включено» and «все включено» are the same keyword after ё→е.
    if (!kw || seen.has(kw)) continue
    const re = new RegExp(WORD_START + escapeRe(kw), 'u')
    if (re.test(t)) {
      out.push(raw.trim())
      seen.add(kw)
    }
  }
  return out
}

export function parseKeywordList(s: string): string[] {
  return s.split(',').map(x => x.trim()).filter(Boolean)
}

export function detectPipeline(text: string, channel: Channel, settings: RoutingSettings): PipelineSuggestion {
  // 1. Link tag like [GT-p1]
  const tagMatch = text.match(/\[([A-Za-z0-9_-]+)\]/)
  if (tagMatch) {
    const link = settings.links.find(l => l.tag.toLowerCase() === tagMatch[1]!.toLowerCase())
    if (link) {
      return { pipeline: link.pipeline, confidence: 100, rule: 'link', matched: [`[${link.tag}]`], departureId: link.departureId ?? null, tag: link.tag }
    }
  }
  // 2. Channel rule
  const ch = settings.channels[channel]
  if (ch && ch !== 'auto') {
    return { pipeline: ch, confidence: 95, rule: 'channel', matched: [] }
  }
  // 3. Keywords: the pipeline with most matches wins
  let best: { pipeline: Pipeline, matched: string[] } | null = null
  for (const p of Object.keys(settings.keywords) as Pipeline[]) {
    const matched = matchKeywords(text, settings.keywords[p] ?? [])
    if (matched.length && (!best || matched.length > best.matched.length)) best = { pipeline: p, matched }
  }
  if (best) {
    return { pipeline: best.pipeline, confidence: Math.min(92, 55 + 15 * best.matched.length), rule: 'keywords', matched: best.matched }
  }
  // 4. Fallback
  return { pipeline: settings.fallback === 'queue' ? null : settings.fallback, confidence: 0, rule: 'fallback', matched: [] }
}

export interface DirectionDef {
  id: string
  name: string
  keywords: string[]
  managerIds: string[]
  mode: 'single' | 'round'
  backupId?: string | null
  rrIndex: number
}

export interface DirectionMatch {
  direction: DirectionDef
  matched: string[]
}

export function detectDirection(text: string, directions: DirectionDef[]): DirectionMatch | null {
  let best: DirectionMatch | null = null
  for (const d of directions) {
    const matched = matchKeywords(text, d.keywords)
    if (matched.length && (!best || matched.length > best.matched.length)) best = { direction: d, matched }
  }
  return best
}

export interface ManagerPick {
  managerId: string | null
  /** New rrIndex to persist for round-robin directions. */
  rrIndex: number
  reason: 'direction' | 'round' | 'backup' | 'default' | 'none'
}

/**
 * Picks the responsible manager: direction managers (single = first available,
 * round = next available after rrIndex) → backup → organization default.
 */
export function pickManager(direction: DirectionDef | null, onVacation: (id: string) => boolean, defaultId: string | null): ManagerPick {
  if (!direction) {
    return { managerId: defaultId, rrIndex: 0, reason: defaultId ? 'default' : 'none' }
  }
  const ids = direction.managerIds
  if (direction.mode === 'round' && ids.length) {
    for (let i = 0; i < ids.length; i++) {
      const idx = (direction.rrIndex + i) % ids.length
      const id = ids[idx]!
      if (!onVacation(id)) return { managerId: id, rrIndex: (idx + 1) % ids.length, reason: 'round' }
    }
  }
  else {
    const id = ids.find(x => !onVacation(x))
    if (id) return { managerId: id, rrIndex: direction.rrIndex, reason: 'direction' }
  }
  if (direction.backupId && !onVacation(direction.backupId)) {
    return { managerId: direction.backupId, rrIndex: direction.rrIndex, reason: 'backup' }
  }
  return { managerId: defaultId, rrIndex: direction.rrIndex, reason: defaultId ? 'default' : 'none' }
}

/** wa.me link with a tag so the first message is routed by rule 1. */
export function waLink(phone: string, text: string, tag: string): string {
  const digits = phone.replace(/\D/g, '')
  return `https://wa.me/${digits}?text=${encodeURIComponent(`${text} [${tag}]`)}`
}
