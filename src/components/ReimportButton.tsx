"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface ImportRunResult {
  processed: number;
  imported: number;
  skipped: number;
  errors: number;
}

export function ReimportButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ImportRunResult | null>(null);
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
        Automatiškai kas kelias minutes tikrinamas paštas dėl naujų klientų užklausų. Šis mygtukas paleidžia
        patikrinimą iškart, nelaukiant kito automatinio ciklo.
      </p>
      {error && <p style={{ color: "var(--error)" }}>{error}</p>}
      {result && (
        <p style={{ color: "var(--success)" }}>
          Patikrinta {result.processed} laiškų — sukurta {result.imported} nauji lead&apos;ai, {result.skipped} jau
          buvo, {result.errors} su klaidomis.
        </p>
      )}
    </div>
  );
}
