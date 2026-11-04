/** Server-sent events: live inbox, notifications and deal updates for the signed-in member. */
export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event)
  const stream = createEventStream(event)
  const unsubscribe = subscribe(ctx.organizationId, (e) => {
    if (e.type === 'notification' && e.memberId !== ctx.memberId) return
    stream.push({ event: e.type, data: JSON.stringify(e) }).catch(() => {})
  })
  const ping = setInterval(() => stream.push({ event: 'ping', data: '1' }).catch(() => {}), 25_000)
  stream.onClosed(() => {
    clearInterval(ping)
    unsubscribe()
  })
  return stream.send()
})
