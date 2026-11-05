/** Telegram bot for staff notifications. Works when TELEGRAM_BOT_TOKEN is set; otherwise a no-op. */
export async function sendTelegram(chatId: string | null | undefined, text: string, link?: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token || !chatId) return false
  const base = process.env.PUBLIC_BASE_URL || 'http://localhost:3000'
  try {
    await $fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      body: { chat_id: chatId, text: link ? `${text}\n${base}${link}` : text, disable_web_page_preview: true },
    })
    return true
  }
  catch (e) {
    console.error('Telegram send failed:', (e as Error).message)
    return false
  }
}
