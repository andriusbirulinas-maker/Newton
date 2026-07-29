import { normalizePhone } from "./leadParser";
import { alreadyHandled, findExistingLead, insertLead, logImportResult } from "./leadStore";

const GRAPH_API_VERSION = "v21.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

export interface MetaAdsImportResult {
  processed: number;
  imported: number;
  skipped: number;
  errors: number;
}

interface MetaLeadField {
  name: string;
  values: string[];
}

interface MetaLead {
  id: string;
  created_time: string;
  field_data: MetaLeadField[];
  ad_name?: string;
  adset_name?: string;
  campaign_name?: string;
}

interface GraphListResponse<T> {
  data: T[];
  paging?: { next?: string };
}

interface GraphErrorResponse {
  error?: { message?: string };
}

async function graphGet<T>(path: string, accessToken: string): Promise<T> {
  const url = `${GRAPH_BASE}${path}${path.includes("?") ? "&" : "?"}access_token=${encodeURIComponent(accessToken)}`;
  const res = await fetch(url);
  const data = (await res.json()) as T & GraphErrorResponse;
  if (!res.ok) {
    throw new Error(data?.error?.message || `Meta Graph API klaida (${res.status})`);
  }
  return data;
}

function fieldValue(fields: MetaLeadField[], name: string): string | null {
  return fields.find((f) => f.name === name)?.values?.[0] ?? null;
}

function extractName(fields: MetaLeadField[]): string | null {
  const fullName = fieldValue(fields, "full_name");
  if (fullName) return fullName;
  const first = fieldValue(fields, "first_name");
  const last = fieldValue(fields, "last_name");
  const combined = [first, last].filter(Boolean).join(" ").trim();
  return combined || null;
}

export async function runMetaAdsImport(): Promise<MetaAdsImportResult> {
  const pageId = process.env.META_PAGE_ID;
  const accessToken = process.env.META_ACCESS_TOKEN;

  if (!pageId || !accessToken) {
    throw new Error("META_PAGE_ID arba META_ACCESS_TOKEN nenustatyti");
  }

  const result: MetaAdsImportResult = { processed: 0, imported: 0, skipped: 0, errors: 0 };

  const forms = await graphGet<GraphListResponse<{ id: string; name: string }>>(
    `/${pageId}/leadgen_forms?fields=id,name`,
    accessToken
  );

  for (const form of forms.data) {
    let leadsResp: GraphListResponse<MetaLead>;
    try {
      leadsResp = await graphGet<GraphListResponse<MetaLead>>(
        `/${form.id}/leads?fields=id,created_time,field_data,ad_name,adset_name,campaign_name&limit=50`,
        accessToken
      );
    } catch (err) {
      result.errors += 1;
      console.error(`Meta forma ${form.id} klaida:`, err instanceof Error ? err.message : err);
      continue;
    }

    for (const lead of leadsResp.data) {
      const messageId = `meta:${lead.id}`;
      if (await alreadyHandled(messageId)) continue;

      result.processed += 1;

      const name = extractName(lead.field_data);
      const email = fieldValue(lead.field_data, "email");
      const phone = normalizePhone(fieldValue(lead.field_data, "phone_number"));

      if (!name || (!email && !phone)) {
        await logImportResult({
          messageId,
          status: "error",
          errorMessage: "Trūksta vardo arba kontakto Meta lead'e",
          rawBody: JSON.stringify(lead),
        });
        result.errors += 1;
        continue;
      }

      const existing = await findExistingLead(email, phone);
      if (existing) {
        await logImportResult({
          messageId,
          status: "skipped",
          leadId: existing.id,
          email,
          phone,
          parsedVia: "meta_api",
        });
        result.skipped += 1;
        continue;
      }

      const leadId = await insertLead({
        name,
        email,
        phone,
        source: "meta_api",
        campaignName: lead.campaign_name ?? null,
        adsetName: lead.adset_name ?? null,
        adName: lead.ad_name ?? null,
      });
      await logImportResult({
        messageId,
        status: "imported",
        leadId,
        email,
        phone,
        parsedVia: "meta_api",
      });
      result.imported += 1;
    }
  }

  return result;
}
