import { randomUUID } from 'node:crypto'
import type { TemplateVariable } from '#shared/domain/templates'
import type { AuthContext } from '../utils/auth'
import { prisma } from '../utils/prisma'
import { randomToken } from '../utils/crypto'
import { putFile } from '../utils/storage'
import { dealFieldValues, documentHtml, renderDoc, toPdf } from './documents'
import { logDeal } from './deals'

export async function nextContractNumber(organizationId: string, kind: string): Promise<string> {
  const org = await prisma.organization.update({ where: { id: organizationId }, data: { contractCounter: { increment: 1 } }, select: { contractCounter: true } })
  return `${kind === 'receipt' ? 'Р' : 'ДТ'}-${new Date().getFullYear()}-${String(org.contractCounter).padStart(3, '0')}`
}

/** Preview: field table with deal values and manual overrides, rendered text and empty fields. */
export async function previewContract(ctx: AuthContext, dealId: string, templateId: string, overrides: Record<string, string> = {}) {
  const tpl = await ctx.db.documentTemplate.findFirst({ where: { id: templateId } })
  if (!tpl) throw createError({ statusCode: 404, statusMessage: 'Шаблон не найден' })
  const { values } = await dealFieldValues(ctx.db, ctx.organizationId, dealId)
  const merged = { ...values, ...Object.fromEntries(Object.entries(overrides).filter(([, v]) => v !== undefined)) }
  const r = await renderDoc(tpl, merged)
  const vars = (tpl.variables ?? []) as unknown as TemplateVariable[]
  return { template: tpl, values: merged, dealValues: values, text: r.text, empty: r.empty, variables: vars }
}

/** Creates a document for signing: number, DOCX/PDF in storage, document row, two signature links. */
export async function createContract(ctx: AuthContext, dealId: string, templateId: string, overrides: Record<string, string>, opts: { bundle?: string } = {}) {
  const tpl = await ctx.db.documentTemplate.findFirstOrThrow({ where: { id: templateId } })
  const number = await nextContractNumber(ctx.organizationId, tpl.kind)
  const { values } = await dealFieldValues(ctx.db, ctx.organizationId, dealId, number)
  const merged = { ...values, ...overrides, 'contract.number': number }
  const r = await renderDoc(tpl, merged)
  const client = await ctx.db.deal.findFirstOrThrow({ where: { id: dealId }, include: { client: { select: { name: true, fullName: true } } } })
  const base = `org/${ctx.organizationId}/deals/${dealId}/${randomUUID()}`
  let pdfKey: string | null = null
  let docxKey: string | null = null
  if (r.docx) {
    docxKey = `${base}.docx`
    await putFile(docxKey, r.docx, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
  }
  const pdf = await toPdf(r.docx ? { docx: r.docx } : { html: documentHtml(tpl.name, r.text) })
  if (pdf) {
    pdfKey = `${base}.pdf`
    await putFile(pdfKey, pdf, 'application/pdf')
  }
  const signer = await ctx.db.member.findFirst({ where: { signRight: true, active: true }, orderBy: { role: 'asc' } })
  const contract = await ctx.db.contract.create({
    data: {
      organizationId: ctx.organizationId, dealId, templateId, number, kind: tpl.kind, fileKey: docxKey, pdfKey, text: r.text,
      values: overrides, emptyFields: r.empty, status: 'SENT', bundle: opts.bundle ?? null, createdById: ctx.memberId,
      signatures: { create: [
        { side: 'client', token: randomToken(32), expiresAt: new Date(Date.now() + 14 * 86_400_000), signerName: client.client.fullName || client.client.name },
        { side: 'agency', token: randomToken(32), expiresAt: new Date(Date.now() + 14 * 86_400_000), memberId: signer?.id ?? null },
      ] },
    },
    include: { signatures: true },
  })
  if (pdfKey) {
    await ctx.db.document.create({ data: { organizationId: ctx.organizationId, dealId, type: tpl.kind === 'receipt' ? 'Расписка' : 'Договор', name: `${tpl.kind === 'receipt' ? 'Расписка' : 'Договор'} № ${number} — ${tpl.name}.pdf`, fileKey: pdfKey, size: pdf!.length, createdById: ctx.memberId } })
  }
  await logDeal(ctx, dealId, 'doc', `${tpl.kind === 'receipt' ? 'Расписка' : 'Договор'} № ${number} отправлен на подпись (${tpl.name})${r.empty.length ? ` · пустых полей: ${r.empty.length}` : ''}`)
  return contract
}

export function signLinks(contract: { signatures: { side: string, token: string }[] }) {
  const base = useRuntimeConfig().public.baseUrl
  return {
    client: `${base}/s/${contract.signatures.find(s => s.side === 'client')!.token}`,
    agency: `${base}/s/${contract.signatures.find(s => s.side === 'agency')!.token}`,
  }
}
