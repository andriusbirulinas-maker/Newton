"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface ImportRunResult {
  processed: number;
  imported: number;
  skipped: number;
  errors: number;
  gaveUp: number;
}

interface MetaAdsImportResult {
  processed: number;
  imported: number;
  skipped: number;
  errors: number;
}

interface CombinedImportResult {
  email: ImportRunResult;
  metaAds: MetaAdsImportResult | null;
  metaAdsError: string | null;
}

export function ReimportButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<CombinedImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setPending(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/admin/reimport", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Klaida (${res.status})`);
      setResult(data);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Importo klaida");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <div className="row-between">
        <h2 style={{ margin: 0 }}>El. pašto importas</h2>
        <button className="btn" onClick={handleClick} disabled={pending}>
          {pending ? "Tikrinama..." : "Tikrinti paštą dabar"}
        </button>
      </div>
      <p className="muted">
        Automatiškai kas kelias minutes tikrinamas paštas (ir Meta reklamos, jei sukonfigūruotos) dėl naujų klientų
        užklausų. Šis mygtukas paleidžia patikrinimą iškart, nelaukiant kito automatinio ciklo.
      </p>
      {error && <p style={{ color: "var(--error)" }}>{error}</p>}
      {result && (
        <div style={{ color: "var(--success)" }}>
          <p>
            El. paštas: patikrinta {result.email.processed} — sukurta {result.email.imported}, {result.email.skipped}{" "}
            jau buvo, {result.email.errors} su klaidomis
            {result.email.gaveUp > 0 ? `, ${result.email.gaveUp} atmesta po pakartotinių bandymų` : ""}.
          </p>
          {result.metaAds && (
            <p>
              Meta reklamos: patikrinta {result.metaAds.processed} — sukurta {result.metaAds.imported},{" "}
              {result.metaAds.skipped} jau buvo, {result.metaAds.errors} su klaidomis.
            </p>
          )}
          {result.metaAdsError && <p style={{ color: "var(--error)" }}>Meta reklamų klaida: {result.metaAdsError}</p>}
        </div>
      )}
    </div>
  );
}
