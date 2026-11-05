# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth.spec.ts >> manager cannot reach settings API
- Location: tests/e2e/auth.spec.ts:20:1

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: page.goto: net::ERR_ABORTED; maybe frame was detached?
Call log:
  - navigating to "http://localhost:3000/login", waiting until "load"

```

# Test source

```ts
  1  | import { expect, type Page } from '@playwright/test'
  2  | 
  3  | /** Opens a page and waits until Nuxt has hydrated (forms have handlers). */
  4  | export async function open(page: Page, url: string) {
> 5  |   await page.goto(url)
     |              ^ Error: page.goto: net::ERR_ABORTED; maybe frame was detached?
  6  |   await page.waitForFunction(() => (window as unknown as { useNuxtApp?: unknown }).useNuxtApp !== undefined || document.querySelector('#__nuxt')?.hasAttribute('data-v-app'))
  7  |   await page.waitForLoadState('networkidle')
  8  | }
  9  | 
  10 | export async function login(page: Page, email: string, password = 'demo1234') {
  11 |   await open(page, '/login')
  12 |   await page.getByLabel('Email или телефон').fill(email)
  13 |   await page.getByLabel('Пароль').fill(password)
  14 |   await page.getByRole('button', { name: 'Войти' }).click()
  15 |   await expect(page).toHaveURL(/\/$/, { timeout: 20_000 })
  16 | }
  17 | 
```