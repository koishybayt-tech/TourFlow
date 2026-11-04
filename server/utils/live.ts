/**
 * In-process pub/sub for live updates over SSE (new messages, notifications, deal changes).
 * One app instance; for several instances replace with Postgres LISTEN/NOTIFY.
 */
export type LiveEvent
  = | { type: 'message', conversationId: string }
    | { type: 'notification', memberId: string, id: string, title: string, body: string, link?: string }
    | { type: 'deal', dealId: string }
    | { type: 'task', taskId: string }

type Listener = (e: LiveEvent) => void
const listeners = new Map<string, Set<Listener>>()

export function subscribe(organizationId: string, fn: Listener): () => void {
  let set = listeners.get(organizationId)
  if (!set) listeners.set(organizationId, (set = new Set()))
  set.add(fn)
  return () => set!.delete(fn)
}

export function publish(organizationId: string, event: LiveEvent) {
  for (const fn of listeners.get(organizationId) ?? []) {
    try {
      fn(event)
    }
    catch {
      // a broken listener must not break the publisher
    }
  }
}
