import { expect, test } from '@playwright/test'
import { login, open } from './helpers'

test('incoming message → package recommendation → deal created', async ({ page }) => {
  await login(page, 'erlan@demo.travel')
  const phone = `+7 70${Math.floor(10_000_000 + Math.random() * 89_999_999)}`
  const res = await page.request.post('/api/inbox/simulate', {
    data: { channel: 'INSTAGRAM', name: 'Тест Клиент', phone, text: 'Хотим в Анталью в мае, всё включено, отель 5 звёзд' },
  })
  expect(res.ok()).toBeTruthy()
  const { id } = await res.json()

  await open(page, `/inbox?c=${id}`)
  await expect(page.getByText('Рекомендация:')).toBeVisible()
  await expect(page.getByText('Пакетные туры').first()).toBeVisible()
  await expect(page.getByText(/Турция → (Ерлан|Аягөз)/)).toBeVisible()

  await page.getByRole('button', { name: 'Создать заявку из диалога' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Создать заявку' }).click()
  await expect(page).toHaveURL(/\/deals\/[a-z0-9]+$/)
})

test('client search finds by phone and shows a duplicate', async ({ page }) => {
  await login(page, 'erlan@demo.travel')
  await open(page, '/clients?filter=dupes')
  await expect(page.getByRole('link', { name: 'Ерболат Касымов' }).first()).toBeVisible()
  await expect(page.getByText('Возможный дубль').first()).toBeVisible()
})
