import Docxtemplater from 'docxtemplater'
import PizZip from 'pizzip'
import { BLANK, extractPlaceholders, renderTemplate, type TemplateVariable } from '#shared/domain/templates'
import { formatMoney } from '#shared/utils/money'
import { formatDate, formatRange } from '#shared/utils/dates'
import { formatPhone } from '#shared/utils/phone'
import type { AuthContext } from '../utils/auth'
import { decryptPii } from '../utils/crypto'
import { prisma } from '../utils/prisma'
import { getFile } from '../utils/storage'

/** Values of all template fields for a deal (docs/02_FEATURES.md §7.1). Missing values are empty strings. */
export async function dealFieldValues(db: AuthContext['db'], organizationId: string, dealId: string, contractNumber?: string) {
  const [deal, org] = await Promise.all([
    db.deal.findFirstOrThrow({
      where: { id: dealId },
      include: {
        client: true,
        travelers: { orderBy: { order: 'asc' } },
        payments: true,
        manager: { include: { user: { select: { name: true } } } },
        departure: { include: { guide: { select: { fullName: true } } } },
        offers: { where: { status: 'CHOSEN' }, include: { operator: { select: { name: true } } } },
      },
    }),
    prisma.organization.findUniqueOrThrow({ where: { id: organizationId } }),
  ])
  const offer = deal.offers[0]
  const paid = deal.payments.reduce((s, p) => s + p.amount, 0)
  const prepay = deal.payments.filter(p => p.type === 'Предоплата').reduce((s, p) => s + p.amount, 0)
  const tripDates = deal.departure
    ? formatRange(deal.departure.startDate, deal.departure.endDate, { dateOnly: true, withYear: true })
    : offer ? formatRange(offer.fromDate, offer.toDate, { dateOnly: true, withYear: true }) : deal.dates ?? ''
  const deadline = deal.fullPayDeadline ?? deal.departure?.payDeadline ?? null
  const v: Record<string, string> = {
    'client.fullName': deal.client.fullName ?? '',
    'client.iin': decryptPii(deal.client.iinEnc) ?? '',
    'client.birthDate': deal.client.birthDate ? formatDate(deal.client.birthDate, { dateOnly: true }) : '',
    'client.address': deal.client.address ?? '',
    'client.phone': formatPhone(deal.client.phone),
    'client.email': deal.client.email ?? '',
    'trip.name': deal.departure?.name ?? (offer ? `${offer.hotel}, ${offer.resort}` : deal.title),
    'trip.dates': tripDates,
    'trip.people': String(deal.people),
    'trip.travelers': deal.travelers.map((t) => {
      const no = decryptPii(t.passportNoEnc)
      return `${t.fullNameLatin}${no ? ` (паспорт ${no}${t.passportExpiry ? `, до ${formatDate(t.passportExpiry, { dateOnly: true })}` : ''})` : ''}`
    }).join('; '),
    'trip.guide': deal.departure?.guide?.fullName ?? '',
    'trip.hotel': offer ? `${offer.hotel} ${offer.stars}★` : '',
    'trip.operator': offer?.operator.name ?? '',
    'pay.total': deal.price ? formatMoney(deal.price) : '',
    'pay.prepay': prepay ? formatMoney(prepay) : formatMoney(100_000 * deal.people),
    'pay.paid': formatMoney(paid),
    'pay.deadline': deadline ? formatDate(deadline, { dateOnly: true }) : '',
    'pay.refundRule': org.refundRule,
    'contract.number': contractNumber ?? 'будет присвоен при отправке',
    'contract.date': formatDate(new Date()),
    'contract.manager': deal.manager?.user.name ?? '',
    'company.name': org.name,
    'company.bin': org.bin,
    'company.director': org.director,
    'company.address': org.legalAddress,
    'company.bank': org.bank,
    'company.iik': org.iik,
    'company.bik': org.bik,
    'company.license': org.license ?? '',
    'company.phone': org.phone,
  }
  return { values: v, deal, org }
}

export interface RenderResult {
  text: string
  empty: string[]
  docx: Buffer | null
}

/** Renders a template: plain-text body, or an uploaded DOCX with docxtemplater (single braces). */
export async function renderDoc(tpl: { body: string | null, fileKey: string | null, variables: unknown }, values: Record<string, string>): Promise<RenderResult> {
  const variables = (tpl.variables ?? []) as TemplateVariable[]
  if (tpl.fileKey && tpl.fileKey.endsWith('.docx')) {
    const file = await getFile(tpl.fileKey)
    const zip = new PizZip(Buffer.from(file.body))
    const doc = new Docxtemplater(zip, { delimiters: { start: '{', end: '}' }, paragraphLoop: true, linebreaks: true, nullGetter: () => BLANK })
    const byPh = new Map(variables.map(x => [x.placeholder, x.field]))
    const data: Record<string, string> = {}
    const empty = new Set<string>()
    for (const { placeholder } of extractPlaceholders(doc.getFullText())) {
      const field = byPh.get(placeholder)
      const val = field ? values[field] : ''
      if (!val) empty.add(field ?? placeholder)
      data[placeholder] = val || BLANK
    }
    doc.render(data)
    return { text: doc.getFullText(), empty: [...empty], docx: doc.getZip().generate({ type: 'nodebuffer' }) }
  }
  const r = renderTemplate(tpl.body ?? '', variables, values)
  return { text: r.text, empty: r.empty, docx: null }
}

/** Extracts the text of an uploaded DOCX (for parsing placeholders). */
export function docxText(buf: Buffer): string {
  const doc = new Docxtemplater(new PizZip(buf), { delimiters: { start: '{', end: '}' }, paragraphLoop: true, linebreaks: true })
  return doc.getFullText()
}

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** A4 HTML page for a plain-text document (used for the PDF). */
export function documentHtml(title: string, text: string, signatures?: { side: string, name: string | null, at: Date | null }[]): string {
  const paras = text.split('\n').map((l, i) => (i === 0 ? `<h1>${escapeHtml(l)}</h1>` : l.trim() ? `<p>${escapeHtml(l)}</p>` : '<br>')).join('\n')
  const sigs = signatures?.length
    ? `<div class="sigs"><h2>Лист подписей</h2>${signatures.map(s => `<p>${s.side === 'client' ? 'Клиент' : 'Турагентство'}: ${escapeHtml(s.name ?? '—')} — ${s.at ? `подписано ЭЦП ${formatDate(s.at)}` : 'не подписано'}</p>`).join('')}</div>`
    : ''
  return `<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>
@page { size: A4; margin: 20mm 18mm; }
body { font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.45; color: #111; }
h1 { font-size: 14pt; text-align: center; margin: 0 0 8pt; }
p { margin: 0 0 6pt; text-align: justify; }
.sigs { margin-top: 24pt; border-top: 1px solid #999; padding-top: 8pt; }
h2 { font-size: 12pt; }
</style></head><body>${paras}${sigs}</body></html>`
}

/** Converts HTML or DOCX to PDF with Gotenberg. Returns null when Gotenberg is unavailable. */
export async function toPdf(input: { html?: string, docx?: Buffer }): Promise<Buffer | null> {
  const base = process.env.GOTENBERG_URL
  if (!base) return null
  try {
    const form = new FormData()
    let url: string
    if (input.docx) {
      form.append('files', new Blob([new Uint8Array(input.docx)]), 'document.docx')
      url = `${base}/forms/libreoffice/convert`
    }
    else {
      form.append('files', new Blob([input.html ?? '']), 'index.html')
      url = `${base}/forms/chromium/convert/html`
    }
    const res = await fetch(url, { method: 'POST', body: form, signal: AbortSignal.timeout(30_000) })
    if (!res.ok) throw new Error(`Gotenberg ${res.status}`)
    return Buffer.from(await res.arrayBuffer())
  }
  catch (e) {
    console.error('PDF conversion failed:', (e as Error).message)
    return null
  }
}
