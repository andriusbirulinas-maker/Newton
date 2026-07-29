import { runEmailImport, type ImportRunResult } from "./emailImport";
import { runMetaAdsImport, type MetaAdsImportResult } from "./metaAdsImport";

export interface CombinedImportResult {
  email: ImportRunResult;
  metaAds: MetaAdsImportResult | null;
  metaAdsError: string | null;
}

export async function runAllImports(): Promise<CombinedImportResult> {
  const email = await runEmailImport();

  let metaAds: MetaAdsImportResult | null = null;
  let metaAdsError: string | null = null;

  if (process.env.META_PAGE_ID && process.env.META_ACCESS_TOKEN) {
    try {
      metaAds = await runMetaAdsImport();
    } catch (err) {
      metaAdsError = err instanceof Error ? err.message : String(err);
      console.error("Meta Ads importo klaida:", metaAdsError);
    }
  }

  return { email, metaAds, metaAdsError };
}
