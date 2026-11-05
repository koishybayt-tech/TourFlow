import { sendTelegram } from '../../providers/notify/telegram'

/** Telegram bot webhook: «/start CODE» links the chat to a user. Secret token header is checked. */
export default defineEventHandler(async (event) => {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET
  if (secret && getRequestHeader(event, 'x-telegram-bot-api-secret-token') !== secret) throw createError({ statusCode: 401 })
  const update = await readBody<{ message?: { chat: { id: number }, text?: string } }>(event)
  const text = update.message?.text ?? ''
  const chatId = update.message?.chat.id
  const m = text.match(/^\/start\s+([A-Z0-9]{4,12})/i)
  if (!chatId || !m) return { ok: true }
  const user = await prisma.user.findUnique({ where: { telegramCode: m[1]!.toUpperCase() } })
  if (!user) {
    await sendTelegram(String(chatId), 'Код не найден. Получите новый код в профиле Tourflow.')
    return { ok: true }
  }
  await prisma.user.update({ where: { id: user.id }, data: { telegramChatId: String(chatId), telegramCode: null } })
  await sendTelegram(String(chatId), `Готово, ${user.name}! Уведомления Tourflow будут приходить сюда.`)
  return { ok: true }
})
