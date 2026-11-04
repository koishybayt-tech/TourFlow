import { describe, expect, it } from 'vitest'
import { nameKey } from '../../server/services/clients'

describe('duplicate detection', () => {
  it('first name + surname initial', () => {
    expect(nameKey('Ерболат Касымов')).toBe('ерболат к')
    expect(nameKey('Ерболат К.')).toBe('ерболат к')
    expect(nameKey('Алёна Ким')).toBe('алена к')
    expect(nameKey('Мадина')).toBeNull()
  })
})
