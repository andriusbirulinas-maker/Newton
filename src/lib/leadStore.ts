import { query, queryOne } from "./db";

export interface NewLead {
  name: string;
  email: string | null;
  phone: string | null;
  message?: string | null;
  interest?: string | null;
  source: "website" | "meta_email" | "meta_api";
  campaignName?: string | null;
  adsetName?: string | null;
  adName?: string | null;
}

export async function alreadyHandled(messageId: string): Promise<boolean> {
  const row = await queryOne(
    "SELECT 1 FROM import_log WHERE message_id = $1 AND status IN ('imported','skipped')",
    [messageId]
  );
  return Boolean(row);
}

export async function countErrorAttempts(messageId: string): Promise<number> {
  const row = await queryOne<{ count: string }>(
    "SELECT count(*) FROM import_log WHERE message_id = $1 AND status = 'error'",
    [messageId]
  );
  return row ? Number(row.count) : 0;
}

export async function logImportResult(entry: {
  messageId: string;
  status: "imported" | "skipped" | "error";
  leadId?: number | null;
  email?: string | null;
  phone?: string | null;
  parsedVia?: "regex" | "claude" | "meta_api" | null;
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

export async function findExistingLead(email: string | null, phone: string | null): Promise<{ id: number } | undefined> {
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

export async function insertLead(lead: NewLead): Promise<number> {
  const row = await queryOne<{ id: number }>(
    `INSERT INTO leads (name, email, phone, message, interest, source, campaign_name, adset_name, ad_name)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
    [
      lead.name,
      lead.email,
      lead.phone,
      lead.message ?? null,
      lead.interest ?? null,
      lead.source,
      lead.campaignName ?? null,
      lead.adsetName ?? null,
      lead.adName ?? null,
    ]
  );
  return row!.id;
}
