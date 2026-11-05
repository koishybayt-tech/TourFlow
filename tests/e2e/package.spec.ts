import { expect, test } from '@playwright/test'
import { login, open } from './helpers'

// Needs fresh demo data: deal №9 «Гульнара Сейткали», package, stage «Предложение отправлено».
test('package deal: client chooses an offer → booking with number → stage advances', async ({ page }) => {
  await login(page, 'ayagoz@demo.travel')
  const list = await (await page.request.get('/api/deals?pipeline=PACKAGE')).json() as { deals: { id: string, number: number }[] }
  const deal = list.deals.find(d => d.number === 9)!
  await open(page, `/deals/${deal.id}`)
  await expect(page.getByRole('combobox', { name: 'Этап заявки' })).toContainText('Предложение отправлено')

  const card = page.locator('#sec-tour').locator('div.rounded-xl', { hasText: 'Пляжный отель «Марина»' })
  await card.getByRole('button', { name: 'Клиент выбрал' }).click()
  await expect(page.getByText('Статус обновлён автоматически').first()).toBeVisible()
  await expect(page.getByRole('combobox', { name: 'Этап заявки' })).toContainText('Бронь у оператора')

  await page.getByRole('button', { name: 'Создать бронь у оператора' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Номер брони').fill('AN-2611777')
  await dialog.getByRole('button', { name: 'Создать бронь' }).click()
  await expect(page.locator('#sec-tour').getByText('AN-2611777')).toBeVisible()
  await expect(page.locator('#sec-tour').getByText('Подтверждена')).toBeVisible()
})

test('tour search shows room allocation and results from operators', async ({ page }) => {
  await login(page, 'erlan@demo.travel')
  await open(page, '/package/search')
  await expect(page.getByText('1 номер: 2 взр.')).toBeVisible()
  await page.getByRole('button', { name: 'Найти туры' }).click()
  await expect(page.getByText(/Готово · \d+ отелей/)).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText('Rixos Premium Belek')).toBeVisible()
})

test('offer import parses pasted text', async ({ page }) => {
  await login(page, 'erlan@demo.travel')
  const list = await (await page.request.get('/api/deals?pipeline=PACKAGE')).json() as { deals: { id: string, number: number }[] }
  const deal = list.deals.find(d => d.number === 10)!
  const r = await page.request.post(`/api/deals/${deal.id}/offers-import`, { data: { text: 'Anex Tour\nDelphin Imperial 5*\nТурция, Лара\n10.01.2027 – 17.01.2027, 7 ночей\nUltra All Inclusive\n1 450 000 ₸' } })
  const { draft } = await r.json()
  expect(draft).toMatchObject({ operator: 'Anex Tour', hotel: 'Delphin Imperial', stars: 5, nights: 7, meal: 'Ультра всё включено', price: 1450000 })
})
