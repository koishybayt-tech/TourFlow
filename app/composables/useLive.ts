export type LiveMessage
  = | { type: 'message', conversationId: string }
    | { type: 'notification', memberId: string, id: string, title: string, body: string, link?: string }
    | { type: 'deal', dealId: string }
    | { type: 'task', taskId: string }

/** Shared bus for server-sent events. Pages subscribe with useLiveListener(). */
const bus = useEventBus<LiveMessage>('live')

/** Opens the SSE connection once (called from AppShell). */
export function useLiveConnection() {
  if (import.meta.server) return
  const toast = useNotify()
  let source: EventSource | null = null
  let retry: ReturnType<typeof setTimeout> | null = null

  function connect() {
    source = new EventSource('/api/stream')
    for (const type of ['message', 'notification', 'deal', 'task'] as const) {
      source.addEventListener(type, (e) => {
        const data = JSON.parse((e as MessageEvent).data) as LiveMessage
        bus.emit(data)
        if (data.type === 'notification') {
          toast.info(data.title, data.body)
          refreshNuxtData('badges')
        }
        if (data.type === 'message') refreshNuxtData('badges')
      })
    }
    source.onerror = () => {
      source?.close()
      retry = setTimeout(connect, 5000)
    }
  }
  onMounted(connect)
  onBeforeUnmount(() => {
    source?.close()
    if (retry) clearTimeout(retry)
  })
}

export function useLiveListener(fn: (e: LiveMessage) => void) {
  onMounted(() => bus.on(fn))
  onBeforeUnmount(() => bus.off(fn))
}
