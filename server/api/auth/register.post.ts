import { registerSchema } from '#shared/schemas/auth'
import { DEFAULT_MODULES } from '#shared/permissions'
import { normalizePhone } from '#shared/utils/phone'
import { createOrgDefaults } from '../../domain/defaults'

export default defineEventHandler(async (event) => {
  rateLimit(event, 'register', 5, 60_000)
  const data = await body(event, registerSchema)
  const email = data.email.toLowerCase()
  const phone = normalizePhone(data.phone)!
  const exists = await prisma.user.findFirst({ where: { OR: [{ email }, { phone }] } })
  if (exists) throw createError({ statusCode: 409, statusMessage: 'Пользователь с таким email или телефоном уже есть' })

  const passwordHash = await hashUserPassword(data.password)
  const { user, member } = await prisma.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: {
        name: data.agency, bin: data.bin, city: data.city, director: data.owner, legalAddress: '', bank: '', iik: '', bik: '',
        phone, email, refundRule: 'до покупки авиабилетов — возврат 100% предоплаты; после покупки — за вычетом фактически понесённых расходов',
        modules: { ...DEFAULT_MODULES },
        routing: { channels: { WHATSAPP: 'auto', INSTAGRAM: 'auto', SITE: 'auto' }, fallback: 'queue', keywords: { GROUP: [], PACKAGE: [], BASE: [] }, links: [] },
      },
    })
    const user = await tx.user.create({ data: { email, phone, passwordHash, name: data.owner, position: 'Владелец' } })
    const member = await tx.member.create({ data: { organizationId: org.id, userId: user.id, role: 'OWNER', signRight: true } })
    await tx.organization.update({ where: { id: org.id }, data: { defaultManagerId: member.id } })
    await createOrgDefaults(tx as never, org.id)
    return { user, member }
  })

  await setUserSession(event, { user: { id: user.id, name: user.name, email: user.email }, memberId: member.id, organizationId: member.organizationId })
  return { ok: true }
})
