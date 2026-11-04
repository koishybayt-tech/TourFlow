import { forgotSchema } from '#shared/schemas/auth'

export default defineEventHandler(async (event) => {
  rateLimit(event, 'forgot', 5, 60_000)
  const { email } = await body(event, forgotSchema)
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } })
  // Same answer whether the user exists or not.
  if (user) {
    const token = randomToken()
    await prisma.passwordReset.create({ data: { userId: user.id, token, expiresAt: new Date(Date.now() + 60 * 60 * 1000) } })
    const url = `${useRuntimeConfig().public.baseUrl}/reset?token=${token}`
    await sendMail(user.email, 'Восстановление пароля Tourflow', `Здравствуйте, ${user.name}!\n\nЧтобы задать новый пароль, откройте ссылку (действует 1 час):\n${url}\n\nЕсли вы не запрашивали восстановление — просто проигнорируйте письмо.`)
      .catch(e => console.error('mail failed', e))
  }
  return { ok: true }
})
