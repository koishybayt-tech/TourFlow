import QRCode from 'qrcode'
import { loadSignature } from '../../../../services/signing'

/** QR for eGov Mobile. In mock mode it encodes the signing link itself. */
export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token')!
  await loadSignature(token)
  const url = `${useRuntimeConfig().public.baseUrl}/s/${token}?egov=1`
  setResponseHeader(event, 'Content-Type', 'image/svg+xml')
  return QRCode.toString(url, { type: 'svg', margin: 1, width: 220 })
})
