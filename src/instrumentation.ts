// 20 min (not 5) to stay within Vercel Hobby's compute quota — this only drives the local
// dev/`npm start` scheduler; on Vercel the real trigger is the external cron-job.org schedule.
const INTERVAL_MS = 20 * 60 * 1000;

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const globalForScheduler = globalThis as unknown as { __emailImportScheduled?: boolean };
  if (globalForScheduler.__emailImportScheduled) return;
  globalForScheduler.__emailImportScheduled = true;

  const { runEmailImport } = await import("./lib/emailImport");
  const { runMetaAdsImport } = await import("./lib/metaAdsImport");

  async function tick() {
    if (process.env.IMAP_HOST && process.env.IMAP_USER && process.env.IMAP_PASSWORD && process.env.DATABASE_URL) {
      try {
        const result = await runEmailImport();
        if (result.processed > 0) {
          console.log(
            `[email-import] patikrinta ${result.processed}, importuota ${result.imported}, praleista ${result.skipped}, klaidų ${result.errors}`
          );
        }
      } catch (err) {
        console.error("[email-import] periodinio tikrinimo klaida:", err instanceof Error ? err.message : err);
      }
    }

    if (process.env.META_PAGE_ID && process.env.META_ACCESS_TOKEN && process.env.DATABASE_URL) {
      try {
        const result = await runMetaAdsImport();
        if (result.processed > 0) {
          console.log(
            `[meta-ads-import] patikrinta ${result.processed}, importuota ${result.imported}, praleista ${result.skipped}, klaidų ${result.errors}`
          );
        }
      } catch (err) {
        console.error("[meta-ads-import] periodinio tikrinimo klaida:", err instanceof Error ? err.message : err);
      }
    }
  }

  setInterval(tick, INTERVAL_MS);
  void tick();
  console.log(`[email-import] automatinis tikrinimas įjungtas (kas ${INTERVAL_MS / 60000} min)`);
}
