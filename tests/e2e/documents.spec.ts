import { expect, test } from '@playwright/test'
import { login, open } from './helpers'

test('contract wizard → client signs via eGov on the public page', async ({ page, browser }) => {
  await login(page, 'erlan@demo.travel')
  const list = await (await page.request.get('/api/deals?pipeline=GROUP')).json() as { deals: { id: string, number: number }[] }
  const deal = list.deals.find(d => d.number === 2)!
  await open(page, `/deals/${deal.id}`)

  await page.locator('#sec-contract').getByRole('button', { name: /Сформировать/ }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText('Рекомендуемый')).toBeVisible()
  await dialog.getByRole('button', { name: 'Далее: предпросмотр' }).click()
  await expect(dialog.getByText('ДОГОВОР №')).toBeVisible()
  await dialog.getByRole('button', { name: /Заполнить поля|Далее: проверка полей/ }).click()
  await dialog.getByRole('button', { name: 'Далее: подписание' }).click()
  await dialog.getByRole('button', { name: /Отправить/ }).click()
  await expect(dialog.getByText(/отправлен на подпись/)).toBeVisible({ timeout: 30_000 })
  const link = (await dialog.locator('code').first().textContent())!.trim()

  // The client opens the link without signing in.
  const ctx = await browser.newContext()
  const client = await ctx.newPage()
  await open(client, new URL(link).pathname)
  await expect(client.getByText('Ожидает подписания').first()).toBeVisible()
  await client.getByRole('button', { name: /Подписать документ/ }).click()
  await client.getByRole('button', { name: /eGov Mobile/ }).click()
  await expect(client.getByAltText('QR-код для eGov Mobile')).toBeVisible()
  await client.getByRole('button', { name: 'Я подписал в eGov Mobile' }).click()
  await expect(client.getByText('Документ подписан')).toBeVisible()
  await ctx.close()
})
