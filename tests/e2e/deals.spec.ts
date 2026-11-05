import { expect, test } from '@playwright/test'
import { login, open } from './helpers'

// Needs fresh demo data (pnpm db:seed): deal №7 «Жанна Ким» on stage «Договор».
test('Жанна Ким: «Договор» → «Предоплата» only by filling in the data', async ({ page }) => {
  await login(page, 'ayagoz@demo.travel')
  const list = await (await page.request.get('/api/deals?pipeline=GROUP')).json() as { deals: { id: string, number: number }[] }
  const deal = list.deals.find(d => d.number === 7)!
  await open(page, `/deals/${deal.id}`)
  await expect(page.getByRole('combobox', { name: 'Этап заявки' })).toContainText('Договор')

  // 1. Client data for the contract
  await page.locator('#sec-client').getByRole('button', { name: 'Изменить', exact: true }).click()
  const panel = page.getByRole('dialog')
  await panel.getByLabel('ФИО полностью').fill('Ким Жанна Викторовна')
  await panel.getByLabel('ИИН').fill('920511450331')
  await panel.getByLabel('Адрес').fill('г. Алматы, ул. Тимирязева, 42, кв. 7')
  await panel.getByRole('button', { name: 'Сохранить' }).click()
  await expect(page.getByText('Данные клиента сохранены')).toBeVisible()
  // Still «Договор»: the contract is not signed yet.
  await expect(page.getByRole('combobox', { name: 'Этап заявки' })).toContainText('Договор')

  // 2. Signed contract scan
  await page.locator('#sec-contract').getByRole('button', { name: 'Загрузить скан подписанного' }).click()
  const modal = page.getByRole('dialog')
  await modal.getByLabel('Файл').setInputFiles({ name: 'Договор — Жанна Ким.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n%%EOF\n') })
  await modal.getByRole('button', { name: 'Загрузить' }).click()

  await expect(page.getByText('Статус обновлён автоматически')).toBeVisible()
  await expect(page.getByRole('combobox', { name: 'Этап заявки' })).toContainText('Предоплата')
})

test('task buttons: take → complete with result → reopen', async ({ page }) => {
  await login(page, 'erlan@demo.travel')
  const r = await page.request.post('/api/tasks', { data: { title: 'E2E: позвонить поставщику', priority: 'LOW' } })
  const { id } = await r.json()
  await open(page, `/tasks?task=${id}`)
  const panel = page.getByRole('dialog')
  await panel.getByRole('button', { name: 'Взять в работу' }).click()
  await panel.getByPlaceholder('Результат выполнения (обязательно)').fill('Договорились на пятницу')
  await panel.getByRole('button', { name: 'Завершить задачу' }).click()
  await expect(panel.getByText('Договорились на пятницу').first()).toBeVisible()
  await panel.getByRole('button', { name: 'Вернуть в работу' }).click()
  await expect(panel.getByRole('button', { name: 'Завершить задачу' })).toBeVisible()
})
