import { expect, test } from '@playwright/test'
import { login, open } from './helpers'

test('public tour page: no finances, WhatsApp booking with a routing tag', async ({ page }) => {
  await open(page, '/t/grand-tour-2027')
  await expect(page.getByRole('heading', { level: 1, name: 'GRAND TOUR' })).toBeVisible()
  const wa = page.getByRole('link', { name: 'Забронировать в WhatsApp' }).first()
  await expect(wa).toHaveAttribute('href', /wa\.me\/.*%5BT-grand-tour-2027%5D/)
  await expect(page.getByText('Себестоимость')).toHaveCount(0)
})

test('draft cannot be published until days are checked; GRAND TOUR economics', async ({ page }) => {
  await login(page, 'erlan@demo.travel')
  const tours = await (await page.request.get('/api/tours')).json() as { id: string, name: string, costPer: number, breakEven: number }[]
  const grand = tours.find(t => t.name === 'GRAND TOUR')!
  expect(grand.costPer).toBe(998_025)
  expect(grand.breakEven).toBe(10)
  const swiss = tours.find(t => t.name.startsWith('Швейцария'))!
  const res = await page.request.post(`/api/tours/${swiss.id}/publish`)
  expect(res.status()).toBe(422)
  expect((await res.json()).statusMessage).toContain('доступность всех дней')
})

test('manager does not see tour finance', async ({ page }) => {
  await login(page, 'ayagoz@demo.travel')
  const tours = await (await page.request.get('/api/tours')).json() as { name: string, costPer: number | null }[]
  expect(tours.find(t => t.name === 'GRAND TOUR')!.costPer).toBeNull()
})
