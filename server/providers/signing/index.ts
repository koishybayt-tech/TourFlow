import { createHash } from 'node:crypto'

/**
 * Electronic signature (docs/02_FEATURES.md §7.3).
 * The real flow signs in the browser: NCALayer (local WebSocket wss://127.0.0.1:13579) or eGov Mobile (QR).
 * The server receives a CMS and verifies the certificate against НУЦ РК. Mock accepts any input.
 */
export interface CertInfo {
  subject: string
  iin: string | null
  issuer: string
  validTo: string
  serial: string
}

export interface SigningProvider {
  name: string
  /** Verifies a CMS signature over the document hash and returns certificate info. */
  verify(input: { cms: string | null, documentHash: string, signerName: string, method: 'ncalayer' | 'egov' }): Promise<CertInfo>
}

const mock: SigningProvider = {
  name: 'mock',
  async verify({ signerName, documentHash }) {
    return {
      subject: signerName,
      iin: null,
      issuer: 'НУЦ РК (тестовый сертификат)',
      validTo: new Date(Date.now() + 365 * 86_400_000).toISOString(),
      serial: documentHash.slice(0, 16).toUpperCase(),
    }
  },
}

const real: SigningProvider = {
  name: 'ncalayer',
  async verify() {
    // Verification needs the NCANode/КНП service with НУЦ РК root certificates — connected after the MVP.
    throw createError({ statusCode: 503, statusMessage: 'Проверка ЭЦП не настроена (SIGNING_PROVIDER=real требует сервис проверки сертификатов НУЦ РК)' })
  },
}

export function signing(): SigningProvider {
  return process.env.SIGNING_PROVIDER === 'real' ? real : mock
}

export function documentHash(text: string): string {
  return createHash('sha256').update(text).digest('hex')
}
