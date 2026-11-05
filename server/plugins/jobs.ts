import { PgBoss } from 'pg-boss'
import { runPriceWatch } from '../jobs/priceWatch'
import { runReminders } from '../jobs/reminders'
import { runWeeklyReport } from '../jobs/weeklyReport'

/**
 * Background jobs on PostgreSQL (pg-boss, no Redis): price watch hourly, reminders, weekly report.
 * Disabled in tests/dev with JOBS_DISABLED=1.
 */
export const JOBS: Record<string, { cron: string, run: () => Promise<unknown> }> = {
  'price-watch': { cron: '0 * * * *', run: runPriceWatch },
  'reminders': { cron: '*/5 * * * *', run: () => runReminders() },
  'weekly-report': { cron: '0 9 * * 1', run: runWeeklyReport },
}

export default defineNitroPlugin(async (nitro) => {
  if (process.env.JOBS_DISABLED === '1' || !process.env.DATABASE_URL || import.meta.prerender) return
  const boss = new PgBoss({ connectionString: process.env.DATABASE_URL, schema: 'pgboss' })
  boss.on('error', e => console.error('pg-boss:', e.message))
  try {
    await boss.start()
    for (const [name, job] of Object.entries(JOBS)) {
      await boss.createQueue(name)
      await boss.schedule(name, job.cron, {}, { tz: 'Asia/Almaty' })
      await boss.work(name, async () => {
        await job.run()
      })
    }
  }
  catch (e) {
    console.error('Background jobs did not start:', (e as Error).message)
    return
  }
  nitro.hooks.hook('close', () => boss.stop({ graceful: true }))
})
