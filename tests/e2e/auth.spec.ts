import { expect, test } from '@playwright/test'
import { login, open } from './helpers'

test('owner signs in and sees reports and settings', async ({ page }) => {
  await login(page, 'erlan@demo.travel')
  await expect(page.getByRole('heading', { level: 1, name: /Ерлан/ })).toBeVisible()
  const nav = page.locator('nav, aside')
  await expect(nav.getByRole('link', { name: 'Отчёты' })).toBeVisible()
  await expect(nav.getByRole('link', { name: 'Настройки' })).toBeVisible()
})

test('manager signs in without reports and settings', async ({ page }) => {
  await login(page, 'ayagoz@demo.travel')
  const nav = page.locator('nav, aside')
  await expect(nav.getByRole('link', { name: 'Заявки' })).toBeVisible()
  await expect(nav.getByRole('link', { name: 'Отчёты' })).toHaveCount(0)
  await expect(nav.getByRole('link', { name: 'Настройки' })).toHaveCount(0)
})

test('manager cannot reach settings API', async ({ page }) => {
  await login(page, 'ayagoz@demo.travel')
  const res = await page.request.get('/api/settings/members')
  expect(res.status()).toBe(403)
})

test('wrong password shows a clear message', async ({ page }) => {
  await open(page, '/login')
  await page.getByLabel('Email или телефон').fill('erlan@demo.travel')
  await page.getByLabel('Пароль').fill('wrong-password')
  await page.getByRole('button', { name: 'Войти' }).click()
  await expect(page.getByText('Неверный логин или пароль')).toBeVisible()
})

test('anonymous user is redirected to login', async ({ page }) => {
  await page.goto('/deals')
  await expect(page).toHaveURL(/\/login\?next=(%2F|\/)deals/)
})
