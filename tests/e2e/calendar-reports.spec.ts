import { expect, test } from '@playwright/test'
import { login, open } from './helpers'

test('calendar shows auto events and warns about a conflict', async ({ page }) => {
  await login(page, 'erlan@demo.travel')
  await open(page, '/calendar?view=list')
  await page.getByRole('button', { name: 'Список' }).click()
  await expect(page.getByText(/Звонок: Тимур Сагинтаев/)).toBeVisible()
  // Conflict: an event overlapping «Звонок: Тимур Сагинтаев» (today 16:00) for the same person.
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Almaty' }).format(new Date())
  const res = await page.request.post('/api/events', { data: { type: 'meeting', title: 'E2E встреча', startAt: new Date(`${today}T16:30:00+05:00`).toISOString() } })
  expect(res.status()).toBe(409)
  expect((await res.json()).statusMessage).toContain('Пересечение')
})

test('owner sees reports with KPIs and can download Excel', async ({ page }) => {
  await login(page, 'erlan@demo.travel')
  await open(page, '/reports')
  await expect(page.getByText('Поступления').first()).toBeVisible()
  await expect(page.getByText('Дебиторка').first()).toBeVisible()
  const res = await page.request.get('/api/reports/export?tab=all&period=all')
  expect(res.status()).toBe(200)
  expect(res.headers()['content-type']).toContain('spreadsheetml')
  expect((await res.body()).length).toBeGreaterThan(5000)
})

test('manager cannot open reports', async ({ page }) => {
  await login(page, 'ayagoz@demo.travel')
  expect((await page.request.get('/api/reports')).status()).toBe(403)
})
