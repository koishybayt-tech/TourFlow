/** Generates a one-time code to link the Telegram bot: the user sends «/start CODE» to the bot. */
export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event)
  const code = randomToken(6).replace(/[^A-Za-z0-9]/g, '').slice(0, 8).toUpperCase()
  await prisma.user.update({ where: { id: ctx.userId }, data: { telegramCode: code } })
  return { code, bot: process.env.TELEGRAM_BOT_USERNAME || null, enabled: !!process.env.TELEGRAM_BOT_TOKEN }
})
