import { query } from "@/lib/db";
import { ReimportButton } from "@/components/ReimportButton";

export const dynamic = "force-dynamic";

interface Lead {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  message: string | null;
  created_at: string;
}

interface ImportLogRow {
  id: number;
  message_id: string;
  status: "imported" | "skipped" | "error";
  email: string | null;
  phone: string | null;
  parsed_via: "regex" | "claude" | null;
  error_message: string | null;
  created_at: string;
}

async function loadData(): Promise<{ leads: Lead[]; logs: ImportLogRow[]; dbError: string | null }> {
  if (!process.env.DATABASE_URL) {
    return { leads: [], logs: [], dbError: "DATABASE_URL nenustatytas — sukonfigūruok .env ir paleisk npm run migrate." };
  }
  try {
    const [leads, logs] = await Promise.all([
      query<Lead>("SELECT id, name, email, phone, message, created_at FROM leads ORDER BY created_at DESC LIMIT 100"),
      query<ImportLogRow>(
        "SELECT id, message_id, status, email, phone, parsed_via, error_message, created_at FROM import_log ORDER BY created_at DESC LIMIT 20"
      ),
    ]);
    return { leads, logs, dbError: null };
  } catch (err) {
    return { leads: [], logs: [], dbError: err instanceof Error ? err.message : "Nepavyko prisijungti prie DB" };
  }
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString("lt-LT");
}

export default async function HomePage() {
  const { leads, logs, dbError } = await loadData();

  return (
    <main>
      <h1>Lead Importer</h1>
      <p className="muted">Klientų užklausų importas iš el. pašto.</p>

      <div className="card">
        <ReimportButton />
      </div>

      {dbError && (
        <div className="card">
          <p style={{ color: "var(--error)" }}>{dbError}</p>
        </div>
      )}

      {!dbError && (
        <div className="card">
          <h2>Lead&apos;ai ({leads.length})</h2>
          {leads.length === 0 ? (
            <p className="empty-state">Kol kas nėra importuotų lead&apos;ų.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Vardas</th>
                  <th>El. paštas</th>
                  <th>Telefonas</th>
                  <th>Žinutė</th>
                  <th>Sukurta</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.id}>
                    <td>{lead.name}</td>
                    <td className="muted">{lead.email || "—"}</td>
                    <td className="muted">{lead.phone || "—"}</td>
                    <td className="muted" style={{ maxWidth: 260, whiteSpace: "pre-wrap" }}>
                      {lead.message || "—"}
                    </td>
                    <td className="muted">{formatDate(lead.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {!dbError && (
        <div className="card">
          <h2>Paskutiniai importo bandymai</h2>
          {logs.length === 0 ? (
            <p className="empty-state">Kol kas nieko nebuvo bandyta importuoti.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Būsena</th>
                  <th>Kontaktas</th>
                  <th>Būdas</th>
                  <th>Klaida</th>
                  <th>Kada</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td>
                      <span className={`status-badge status-${log.status}`}>{log.status}</span>
                    </td>
                    <td className="muted">{log.email || log.phone || "—"}</td>
                    <td className="muted">{log.parsed_via || "—"}</td>
                    <td className="muted">{log.error_message || "—"}</td>
                    <td className="muted">{formatDate(log.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </main>
  );
}
