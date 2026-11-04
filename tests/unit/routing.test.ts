import { describe, expect, it } from 'vitest'
import { detectDirection, detectPipeline, matchKeywords, pickManager, waLink, type DirectionDef, type RoutingSettings } from '../../shared/domain/routing'

const settings: RoutingSettings = {
  channels: { WHATSAPP: 'auto', INSTAGRAM: 'auto', SITE: 'auto' },
  fallback: 'queue',
  links: [
    { tag: 'GT-p1', label: 'Будапешт — Вена', pipeline: 'GROUP', departureId: 'dep1' },
    { tag: 'PK', label: 'Подобрать тур', pipeline: 'PACKAGE' },
  ],
  keywords: {
    GROUP: ['будапешт', 'вена', 'италия', 'рим', 'групп', 'авторск'],
    PACKAGE: ['турци', 'анталь', 'египет', 'всё включено', 'все включено', '5 звёзд', '5 звезд'],
    BASE: ['страховк', 'консультац'],
  },
}

describe('routing: pipeline', () => {
  it('link tag wins with 100%', () => {
    const r = detectPipeline('Здравствуйте! Хочу в тур Будапешт — Вена [GT-p1]', 'WHATSAPP', settings)
    expect(r).toMatchObject({ pipeline: 'GROUP', confidence: 100, rule: 'link', departureId: 'dep1' })
  })

  it('channel rule gives 95%', () => {
    const r = detectPipeline('привет', 'SITE', { ...settings, channels: { SITE: 'BASE' } })
    expect(r).toMatchObject({ pipeline: 'BASE', confidence: 95, rule: 'channel' })
  })

  it('keywords match word starts: «анталь» finds «Анталью»', () => {
    expect(matchKeywords('Хотим в Анталью', ['анталь'])).toEqual(['анталь'])
    expect(matchKeywords('Вентиляция', ['вена'])).toEqual([])
  })

  it('Turkey message → package, 55 + 15×matches, max 92', () => {
    const r = detectPipeline('Хотим в Турцию в январе, всё включено, отель 5 звёзд.', 'INSTAGRAM', settings)
    expect(r.pipeline).toBe('PACKAGE')
    expect(r.matched).toEqual(['турци', 'всё включено', '5 звёзд'])
    expect(r.confidence).toBe(92)
  })

  it('single keyword gives 70%', () => {
    expect(detectPipeline('Сколько стоит Италия в декабре?', 'INSTAGRAM', settings).confidence).toBe(70)
  })

  it('falls back to queue', () => {
    expect(detectPipeline('Подскажите цены?', 'INSTAGRAM', settings)).toMatchObject({ pipeline: null, rule: 'fallback' })
  })
})

const turkey: DirectionDef = { id: 'dr2', name: 'Турция', keywords: ['турци', 'анталь', 'стамбул'], managerIds: ['erlan', 'ayagoz'], mode: 'round', backupId: 'erlan', rrIndex: 0 }
const visas: DirectionDef = { id: 'dr7', name: 'Визы', keywords: ['виза', 'страховк'], managerIds: ['dana'], mode: 'single', backupId: 'ayagoz', rrIndex: 0 }

describe('routing: direction and manager', () => {
  it('detects direction by keywords', () => {
    expect(detectDirection('Хотим в Анталью', [turkey, visas])?.direction.id).toBe('dr2')
    expect(detectDirection('Подскажите цены', [turkey, visas])).toBeNull()
  })

  it('round-robin rotates among available managers', () => {
    const none = () => false
    const a = pickManager(turkey, none, null)
    expect(a).toMatchObject({ managerId: 'erlan', rrIndex: 1 })
    const b = pickManager({ ...turkey, rrIndex: a.rrIndex }, none, null)
    expect(b).toMatchObject({ managerId: 'ayagoz', rrIndex: 0 })
  })

  it('round-robin skips managers on vacation', () => {
    expect(pickManager(turkey, id => id === 'erlan', null).managerId).toBe('ayagoz')
  })

  it('uses backup when everyone is on vacation', () => {
    expect(pickManager(visas, id => id === 'dana', 'erlan')).toMatchObject({ managerId: 'ayagoz', reason: 'backup' })
  })

  it('uses default without direction', () => {
    expect(pickManager(null, () => false, 'erlan')).toMatchObject({ managerId: 'erlan', reason: 'default' })
  })

  it('builds wa.me links with a tag', () => {
    expect(waLink('+7 727 300 10 20', 'Хочу в тур', 'GT-p1')).toBe('https://wa.me/77273001020?text=%D0%A5%D0%BE%D1%87%D1%83%20%D0%B2%20%D1%82%D1%83%D1%80%20%5BGT-p1%5D')
  })
})
