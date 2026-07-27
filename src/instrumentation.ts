const INTERVAL_MS = 5 * 60 * 1000;

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const globalForScheduler = globalThis as unknown as { __emailImportScheduled?: boolean };
  if (globalForScheduler.__emailImportScheduled) return;
  globalForScheduler.__emailImportScheduled = true;

  const { runEmailImport } = await import("./lib/emailImport");

  async function tick() {
    if (!process.env.IMAP_HOST || !process.env.IMAP_USER || !process.env.IMAP_PASSWORD || !process.env.DATABASE_URL) {
      return;
    }
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

  setInterval(tick, INTERVAL_MS);
  void tick();
  console.log(`[email-import] automatinis tikrinimas įjungtas (kas ${INTERVAL_MS / 60000} min)`);
}
