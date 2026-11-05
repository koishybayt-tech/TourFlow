// Captures README screenshots from a running demo (fresh seed). Usage: node tests/screenshots.mjs [baseUrl]
import { chromium } from '@playwright/test'

const base = process.argv[2] || 'http://localhost:3000'
const out = new URL('../docs/screenshots/', import.meta.url).pathname
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, locale: 'ru-RU', timezoneId: 'Asia/Almaty', colorScheme: 'light' })
const settle = async () => {
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(800)
}
await page.goto(`${base}/login`)
await settle()
await page.getByLabel('Email или телефон').fill('erlan@demo.travel')
await page.getByLabel('Пароль').fill('demo1234')
await page.getByRole('button', { name: 'Войти' }).click()
await page.waitForURL(`${base}/`)
await settle()
await page.screenshot({ path: `${out}dashboard.png` })

await page.goto(`${base}/deals`)
await settle()
await page.screenshot({ path: `${out}deals.png` })

const deals = await (await page.request.get(`${base}/api/deals?pipeline=GROUP`)).json()
const d1 = deals.deals.find(d => d.number === 1)
await page.goto(`${base}/deals/${d1.id}`)
await settle()
await page.screenshot({ path: `${out}deal.png` })

const tours = await (await page.request.get(`${base}/api/tours`)).json()
const grand = tours.find(t => t.name === 'GRAND TOUR')
await page.goto(`${base}/tours/${grand.id}?tab=finance`)
await settle()
await page.screenshot({ path: `${out}tour.png` })

await page.goto(`${base}/t/grand-tour-2027`)
await settle()
await page.screenshot({ path: `${out}public-tour.png` })
await browser.close()
console.log('screenshots saved to', out)
