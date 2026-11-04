import type { FetchError } from 'ofetch'

/** Toast with the server's Russian message. */
export function errorMessage(e: unknown): string {
  const err = e as FetchError<{ statusMessage?: string, message?: string }>
  return err?.data?.statusMessage || err?.data?.message || err?.statusMessage || 'Не получилось. Попробуйте ещё раз'
}

export function useNotify() {
  const toast = useToast()
  return {
    ok: (title: string, description?: string) => toast.add({ title, description, color: 'success', icon: 'i-lucide-check-circle-2' }),
    info: (title: string, description?: string) => toast.add({ title, description, color: 'primary', icon: 'i-lucide-info' }),
    fail: (e: unknown) => toast.add({ title: errorMessage(e), color: 'error', icon: 'i-lucide-alert-circle' }),
  }
}

/** Runs a mutation, shows an error toast on failure, returns the result or undefined. */
export async function mutate<T>(fn: () => Promise<T>, success?: string): Promise<T | undefined> {
  const notify = useNotify()
  try {
    const r = await fn()
    if (success) notify.ok(success)
    return r
  }
  catch (e) {
    notify.fail(e)
    return undefined
  }
}

/** $fetch without Nitro's typed-route inference (which can exceed TS depth limits). */
export function api<T = unknown>(url: string, opts?: { method?: string, body?: unknown, query?: Record<string, unknown> }): Promise<T> {
  return ($fetch as unknown as (u: string, o?: object) => Promise<T>)(url, opts as object)
}
