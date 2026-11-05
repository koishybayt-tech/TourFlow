import { describe, expect, it } from 'vitest'
import { guideFit, routeLanguages } from '../../shared/domain/guides'

const dep = { start: new Date('2026-11-14'), end: new Date('2026-11-21'), route: 'Будапешт (3 дня) → Сентендре → Вена (3 дня)', domestic: false }

describe('guide matching', () => {
  it('route languages', () => {
    expect(routeLanguages(dep.route, false)).toEqual(['Венгерский', 'Немецкий'])
  })
  it('best choice: local language and high rating', () => {
    expect(guideFit({ languages: ['Русский', 'Английский', 'Венгерский'], rating: 4.9, busy: [] }, dep).fit).toBe('Лучший выбор')
  })
  it('busy guide is unavailable', () => {
    expect(guideFit({ languages: ['Венгерский'], rating: 5, busy: [{ start: new Date('2026-11-20'), end: new Date('2026-11-25') }] }, dep).fit).toBe('Недоступен')
  })
  it('english only fits, no language is a caveat', () => {
    expect(guideFit({ languages: ['Русский', 'Английский'], rating: 4.6, busy: [] }, dep).fit).toBe('Подходит')
    expect(guideFit({ languages: ['Русский', 'Казахский'], rating: 4.7, busy: [] }, dep).fit).toBe('С оговорками')
  })
})
