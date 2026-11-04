import { beforeAll, describe, expect, it } from 'vitest'

beforeAll(() => {
  process.env.PII_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64')
})

describe('PII encryption', () => {
  it('round-trips and uses a fresh IV each time', async () => {
    const { decryptPii, encryptPii } = await import('../../server/utils/crypto')
    const a = encryptPii('900315400123')!
    const b = encryptPii('900315400123')!
    expect(a).not.toBe(b)
    expect(a).not.toContain('900315400123')
    expect(decryptPii(a)).toBe('900315400123')
  })

  it('rejects tampered data', async () => {
    const { decryptPii, encryptPii } = await import('../../server/utils/crypto')
    const parts = encryptPii('N12345678')!.split(':')
    parts[3] = Buffer.from('xxxxxxxxx').toString('base64')
    expect(() => decryptPii(parts.join(':'))).toThrow()
  })

  it('masks', async () => {
    const { maskIin, maskPassport } = await import('../../server/utils/crypto')
    expect(maskIin('900315400123')).toBe('9003••••0123')
    expect(maskPassport('N12345678')).toBe('N1••••678')
  })
})
