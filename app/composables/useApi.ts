import type { FetchError } from 'ofetch'

/** Toast with the server's Russian message. */
export function errorMessage(e: unknown): string {
  const err = e as FetchError<{ statusMessage?: string, message?: string }>
  return err?.data?.statusMessage || err?.data?.message || err?.statusMessage || 'Не получилось. Попробуйте ещё раз'
}

let sharedToast: ReturnType<typeof useToast> | null = null

/** Called once from app.vue setup so toasts can be shown from event handlers after await. */
export function initToast() {
  sharedToast = useToast()
}

export function useNotify() {
  const toast = sharedToast ?? useToast()
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

/**
 * Deletion with «Отменить»: the action runs after the toast closes (5 s) unless the user undoes it.
 * `hide` removes the item from the UI immediately; `restore` puts it back on undo.
 */
export function undoable(title: string, run: () => Promise<unknown>, opts: { hide?: () => void, restore?: () => void, done?: () => void } = {}) {
  const toast = sharedToast ?? useToast()
  let undone = false
  opts.hide?.()
  const id = `undo-${Date.now()}`
  toast.add({
    id,
    title,
    icon: 'i-lucide-trash-2',
    duration: 5000,
    actions: [{ label: 'Отменить', color: 'neutral', variant: 'outline', onClick: () => {
      undone = true
      opts.restore?.()
    } }],
  })
  setTimeout(async () => {
    if (undone) return
    try {
      await run()
      opts.done?.()
    }
    catch (e) {
      opts.restore?.()
      useNotify().fail(e)
    }
  }, 5200)
}
