export default defineEventHandler(async (event) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    return { status: 'ok', db: 'ok' }
  }
  catch {
    setResponseStatus(event, 503)
    return { status: 'error', db: 'down' }
  }
})
