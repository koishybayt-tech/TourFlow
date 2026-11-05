/**
 * NCALayer client (Kazakhstan EDS). NCALayer runs on the user's computer and listens on wss://127.0.0.1:13579.
 * Uses the «kz.gov.pki.knca.basics» module: the key never leaves the computer, we receive a CMS.
 */
const NCALAYER_URL = 'wss://127.0.0.1:13579'

export async function ncaLayerAvailable(timeoutMs = 1500): Promise<boolean> {
  return new Promise((resolve) => {
    let done = false
    try {
      const ws = new WebSocket(NCALAYER_URL)
      const t = setTimeout(() => {
        if (!done) {
          done = true
          ws.close()
          resolve(false)
        }
      }, timeoutMs)
      ws.onopen = () => {
        done = true
        clearTimeout(t)
        ws.close()
        resolve(true)
      }
      ws.onerror = () => {
        if (!done) {
          done = true
          clearTimeout(t)
          resolve(false)
        }
      }
    }
    catch {
      resolve(false)
    }
  })
}

/** Signs base64 data as an attached CMS. Resolves with the CMS (base64) or rejects with a Russian message. */
export function ncaLayerSignCms(dataBase64: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(NCALAYER_URL)
    ws.onerror = () => reject(new Error('NCALayer не запущен. Запустите NCALayer и повторите.'))
    ws.onopen = () => {
      ws.send(JSON.stringify({
        module: 'kz.gov.pki.knca.basics',
        method: 'sign',
        args: {
          allowedStorages: ['PKCS12', 'AKKaztokenStore', 'AKKZIDCardStore'],
          format: 'cms',
          data: dataBase64,
          signingParams: { decode: true, encapsulate: true, digested: false },
          signerParams: { extKeyUsageOids: ['1.3.6.1.5.5.7.3.4'] },
          locale: 'ru',
        },
      }))
    }
    ws.onmessage = (e) => {
      const r = JSON.parse(e.data as string) as { status?: boolean, body?: { result?: string[] }, message?: string }
      if (r.status === undefined) return // greeting
      ws.close()
      if (r.status && r.body?.result?.[0]) resolve(r.body.result[0])
      else reject(new Error(r.message === 'action.canceled' ? 'Подписание отменено' : 'Не удалось подписать документ'))
    }
  })
}
