# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth.spec.ts >> owner signs in and sees reports and settings
- Location: tests/e2e/auth.spec.ts:4:1

# Error details

```
Error: expect(page).toHaveURL(expected) failed

Expected pattern: /\/$/
Received string:  "http://localhost:3000/login"
Timeout: 5000ms

Call log:
  - Expect "toHaveURL" with timeout 5000ms
    13 × locator resolved to <html lang="ru" class="light">…</html>
       - unexpected value "http://localhost:3000/login"

```

```yaml
- text: T Tourflow
- heading "Вход" [level=1]
- paragraph: Email или телефон и пароль
- text: Email или телефон
- textbox "Email или телефон" [disabled]:
  - /placeholder: erlan@demo.travel
  - text: erlan@demo.travel
- text: Пароль
- link "Забыли пароль?":
  - /url: /forgot
- textbox "Пароль" [disabled]: demo1234
- checkbox "Запомнить устройство" [checked] [disabled]
- text: Запомнить устройство
- button "Войти" [disabled]
- paragraph:
  - text: Нет аккаунта?
  - link "Зарегистрировать агентство":
    - /url: /register
- paragraph: CRM для турагентств Казахстана
- paragraph: Заявка от первого сообщения в WhatsApp до вылета — на одной странице.
- list:
  - listitem: · Статус заявки меняется сам
  - listitem: · Договоры и расписки с электронной подписью
  - listitem: · Групповые и пакетные туры в одной системе
- paragraph: Данные хранятся в Казахстане
- region "Уведомления (F8)":
  - list
- img
- button "Toggle Nuxt DevTools":
  - img
- text: 72 ms
- button "Toggle Component Inspector":
  - img
```

# Test source

```ts
  1  | import { expect, type Page } from '@playwright/test'
  2  | 
  3  | /** Opens a page and waits until Nuxt has hydrated (forms have handlers). */
  4  | export async function open(page: Page, url: string) {
  5  |   await page.goto(url)
  6  |   await page.waitForFunction(() => (window as unknown as { useNuxtApp?: unknown }).useNuxtApp !== undefined || document.querySelector('#__nuxt')?.hasAttribute('data-v-app'))
  7  |   await page.waitForLoadState('networkidle')
  8  | }
  9  | 
  10 | export async function login(page: Page, email: string, password = 'demo1234') {
  11 |   await open(page, '/login')
  12 |   await page.getByLabel('Email или телефон').fill(email)
  13 |   await page.getByLabel('Пароль').fill(password)
  14 |   await page.getByRole('button', { name: 'Войти' }).click()
> 15 |   await expect(page).toHaveURL(/\/$/)
     |                      ^ Error: expect(page).toHaveURL(expected) failed
  16 | }
  17 | 
```