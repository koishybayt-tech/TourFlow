import { expect, type Page } from '@playwright/test'

/** Opens a page and waits until Nuxt has hydrated (forms have handlers). */
export async function open(page: Page, url: string) {
  await page.goto(url)
  await page.waitForFunction(() => (window as unknown as { useNuxtApp?: unknown }).useNuxtApp !== undefined || document.querySelector('#__nuxt')?.hasAttribute('data-v-app'))
  await page.waitForLoadState('networkidle')
}

export async function login(page: Page, email: string, password = 'demo1234') {
  await open(page, '/login')
  await page.getByLabel('Email или телефон').fill(email)
  await page.getByLabel('Пароль').fill(password)
  await page.getByRole('button', { name: 'Войти' }).click()
  await expect(page).toHaveURL(/\/$/, { timeout: 20_000 })
}
