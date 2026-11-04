import { expect, test } from '@playwright/test'

test('health endpoint reports db ok', async ({ request }) => {
  const res = await request.get('/api/health')
  expect(res.ok()).toBeTruthy()
  expect(await res.json()).toMatchObject({ db: 'ok' })
})
