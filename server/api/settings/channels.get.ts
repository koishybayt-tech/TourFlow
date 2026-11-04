/** Channel connection status and webhook URLs (keys live in .env on the server). */
export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event, 'settings')
  const base = useRuntimeConfig().public.baseUrl
  const real = process.env.MESSAGING_PROVIDER === 'real'
  return {
    provider: real ? 'real' : 'mock',
    channels: [
      { key: 'waApi', title: 'WhatsApp Business API', connected: real && !!process.env.WHATSAPP_CLOUD_TOKEN, webhook: `${base}/api/webhooks/whatsapp/${ctx.organizationId}`, env: ['WHATSAPP_CLOUD_TOKEN', 'WHATSAPP_PHONE_ID', 'WHATSAPP_APP_SECRET', 'WHATSAPP_VERIFY_TOKEN'] },
      { key: 'ig', title: 'Instagram Direct', connected: real && !!process.env.INSTAGRAM_APP_SECRET, webhook: `${base}/api/webhooks/instagram/${ctx.organizationId}`, env: ['INSTAGRAM_APP_SECRET'] },
      { key: 'site', title: 'Форма на сайте', connected: true, webhook: `${base}/api/public/lead/${ctx.organizationId}`, env: [] },
      { key: 'tg', title: 'Telegram-бот для сотрудников', connected: !!process.env.TELEGRAM_BOT_TOKEN, webhook: null, env: ['TELEGRAM_BOT_TOKEN'] },
      { key: 'waQr', title: 'WhatsApp по QR', connected: false, webhook: null, env: [], warning: 'Неофициальное подключение: WhatsApp может заблокировать номер. Используйте Business API.' },
      { key: 'gcal', title: 'Google Calendar', connected: false, webhook: null, env: [], soon: true },
    ],
  }
})
