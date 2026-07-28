import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { query, queryOne } from "./db";
import { claudeParseLead, regexParseLead, type ParsedLead } from "./leadParser";

const MAX_EMAILS = 25;
const TIME_BUDGET_MS = 50_000;
const MAX_ERROR_ATTEMPTS = 3;

export interface ImportRunResult {
  processed: number;
  imported: number;
  skipped: number;
  errors: number;
  gaveUp: number;
}

async function alreadyHandled(messageId: string): Promise<boolean> {
  const row = await queryOne(
    "SELECT 1 FROM import_log WHERE message_id = $1 AND status IN ('imported','skipped')",
    [messageId]
  );
  return Boolean(row);
}

async function countErrorAttempts(messageId: string): Promise<number> {
  const row = await queryOne<{ count: string }>(
    "SELECT count(*) FROM import_log WHERE message_id = $1 AND status = 'error'",
    [messageId]
  );
  return row ? Number(row.count) : 0;
}

async function logResult(entry: {
  messageId: string;
  status: "imported" | "skipped" | "error";
  leadId?: number | null;
  email?: string | null;
  phone?: string | null;
  parsedVia?: "regex" | "claude" | null;
  errorMessage?: string | null;
  rawBody?: string | null;
}): Promise<void> {
  await query(
    `INSERT INTO import_log (message_id, status, lead_id, email, phone, parsed_via, error_message, raw_body)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      entry.messageId,
      entry.status,
      entry.leadId ?? null,
      entry.email ?? null,
      entry.phone ?? null,
      entry.parsedVia ?? null,
      entry.errorMessage ?? null,
      entry.rawBody ?? null,
    ]
  );
}

async function findExistingLead(email: string | null, phone: string | null): Promise<{ id: number } | undefined> {
  if (email) {
    const byEmail = await queryOne<{ id: number }>("SELECT id FROM leads WHERE email = $1", [email]);
    if (byEmail) return byEmail;
  }
  if (phone) {
    const byPhone = await queryOne<{ id: number }>("SELECT id FROM leads WHERE phone = $1", [phone]);
    if (byPhone) return byPhone;
  }
  return undefined;
}

async function insertLead(lead: ParsedLead): Promise<number> {
  const row = await queryOne<{ id: number }>(
    "INSERT INTO leads (name, email, phone, message) VALUES ($1, $2, $3, $4) RETURNING id",
    [lead.name, lead.email, lead.phone, lead.message]
  );
  return row!.id;
}

async function ensureFolder(client: ImapFlow, folder: string): Promise<void> {
  const list = await client.list();
  if (!list.some((box) => box.path === folder)) {
    await client.mailboxCreate(folder);
  }
}

export async function runEmailImport(): Promise<ImportRunResult> {
  const host = process.env.IMAP_HOST;
  const port = Number(process.env.IMAP_PORT ?? 993);
  const user = process.env.IMAP_USER;
  const password = process.env.IMAP_PASSWORD;
  const folder = process.env.IMAP_FOLDER || "INBOX";
  const processedFolder = process.env.IMAP_PROCESSED_FOLDER || "Imported";
  const failedFolder = process.env.IMAP_FAILED_FOLDER || "Failed";
  const subjectFilter = process.env.EMAIL_FILTER_SUBJECT || undefined;

  if (!host || !user || !password) {
    throw new Error("IMAP_HOST, IMAP_USER arba IMAP_PASSWORD nenustatyti");
  }

  const result: ImportRunResult = { processed: 0, imported: 0, skipped: 0, errors: 0, gaveUp: 0 };
  const deadline = Date.now() + TIME_BUDGET_MS;

  const client = new ImapFlow({
    host,
    port,
    secure: true,
    auth: { user, pass: password },
    logger: false,
  });

  try {
    await client.connect();
    await ensureFolder(client, processedFolder);
    await ensureFolder(client, failedFolder);

    const lock = await client.getMailboxLock(folder);
    try {
      const uids = await client.search(
        subjectFilter ? { seen: false, subject: subjectFilter } : { seen: false },
        { uid: true }
      );
      if (!uids || uids.length === 0) return result;

      for (const uid of uids) {
        if (result.processed >= MAX_EMAILS || Date.now() > deadline) break;

        let messageId = `imap-uid-${uid}`;
        let rawBody = "";
        let counted = false;
        try {
          const message = await client.fetchOne(uid, { source: true }, { uid: true });
          if (!message || !message.source) throw new Error("Nepavyko atsisiųsti laiško turinio");

          const parsed = await simpleParser(message.source);
          messageId = parsed.messageId || messageId;
          rawBody = parsed.text || "";

          if (await alreadyHandled(messageId)) continue;

          counted = true;
          result.processed += 1;

          let lead = regexParseLead(rawBody);
          let parsedVia: "regex" | "claude" = "regex";
          if (!lead) {
            lead = await claudeParseLead(rawBody);
            parsedVia = "claude";
          }

          if (!lead) {
            await logResult({ messageId, status: "error", errorMessage: "Nepavyko išparsinti kliento duomenų", rawBody });
            result.errors += 1;

            if ((await countErrorAttempts(messageId)) >= MAX_ERROR_ATTEMPTS) {
              await client.messageFlagsAdd(uid, ["\\Seen"], { uid: true });
              await client.messageMove(uid, failedFolder, { uid: true });
              result.gaveUp += 1;
            }
            continue;
          }

          const existing = await findExistingLead(lead.email, lead.phone);
          if (existing) {
            await logResult({
              messageId,
              status: "skipped",
              leadId: existing.id,
              email: lead.email,
              phone: lead.phone,
              parsedVia,
            });
            result.skipped += 1;
          } else {
            const leadId = await insertLead(lead);
            await logResult({
              messageId,
              status: "imported",
              leadId,
              email: lead.email,
              phone: lead.phone,
              parsedVia,
            });
            result.imported += 1;
          }

          await client.messageFlagsAdd(uid, ["\\Seen"], { uid: true });
          await client.messageMove(uid, processedFolder, { uid: true });
        } catch (err) {
          if (!counted) result.processed += 1;
          result.errors += 1;
          const message = err instanceof Error ? err.message : String(err);
          await logResult({ messageId, status: "error", errorMessage: message, rawBody });
          console.error(`El. laiško importo klaida (${messageId}):`, message);

          try {
            if ((await countErrorAttempts(messageId)) >= MAX_ERROR_ATTEMPTS) {
              await client.messageFlagsAdd(uid, ["\\Seen"], { uid: true });
              await client.messageMove(uid, failedFolder, { uid: true });
              result.gaveUp += 1;
            }
          } catch (giveUpErr) {
            console.error(`Nepavyko perkelti į ${failedFolder}:`, giveUpErr instanceof Error ? giveUpErr.message : giveUpErr);
          }
        }
      }
    } finally {
      lock.release();
    }
  } finally {
    try {
      await client.logout();
    } catch {
      client.close();
    }
  }

  return result;
}
