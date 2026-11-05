import { z } from 'zod'
import { documentHtml, toPdf } from '../../../../services/documents'
import { loadSignature } from '../../../../services/signing'

/** PDF, PDF with the signature sheet, or CMS. */
export default defineEventHandler(async (event) => {
  rateLimit(event, 'sign-download', 30, 60_000)
  const { sig, bundle } = await loadSignature(getRouterParam(event, 'token')!)
  const { doc: docId, variant } = queryOf(event, z.object({ doc: z.string().optional(), variant: z.enum(['pdf', 'signed', 'cms']).default('pdf') }))
  const doc = bundle.find(d => d.id === docId) ?? sig.contract
  const name = `${doc.kind === 'receipt' ? 'Расписка' : 'Договор'} ${doc.number}`
  if (variant === 'cms') {
    const cms = doc.signatures.map(s => s.cms).filter(Boolean).join('\n')
    setResponseHeader(event, 'Content-Type', 'application/pkcs7-signature')
    setResponseHeader(event, 'Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(name)}.cms`)
    return cms || `-----BEGIN CMS-----\n(тестовая подпись — демо-режим)\n-----END CMS-----\n`
  }
  let pdf: Uint8Array | null = null
  if (variant === 'pdf' && doc.pdfKey) pdf = (await getFile(doc.pdfKey).catch(() => null))?.body ?? null
  if (!pdf) {
    const html = documentHtml(name, doc.text ?? '', variant === 'signed' ? doc.signatures.map(s => ({ side: s.side, name: s.signerName, at: s.signedAt })) : undefined)
    pdf = await toPdf({ html }) ?? simplePdf(name)
  }
  setResponseHeader(event, 'Content-Type', 'application/pdf')
  setResponseHeader(event, 'Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(name)}.pdf`)
  return Buffer.from(pdf)
})
