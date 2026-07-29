import { query } from "@/lib/db";
import { ReimportButton } from "@/components/ReimportButton";
import { CallStatusControl, type CallStatus } from "@/components/CallStatusControl";
import { TrainerAssignSelect, type TrainerOption } from "@/components/TrainerAssignSelect";
import { TrainingTypeSelect, type TrainingType } from "@/components/TrainingTypeSelect";
import { NotesInput } from "@/components/NotesInput";

export const dynamic = "force-dynamic";

interface Lead {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  message: string | null;
  interest: string | null;
  call_status: CallStatus;
  trainer_id: number | null;
  training_type: TrainingType | null;
  notes: string | null;
  source: "website" | "meta_email" | "meta_api" | null;
  campaign_name: string | null;
  adset_name: string | null;
  ad_name: string | null;
  created_at: string;
}

const SOURCE_LABELS: Record<string, string> = {
  website: "Svetainė",
  meta_email: "Meta (el. paštas)",
  meta_api: "Meta (API)",
};

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

async function loadData(): Promise<{
  leads: Lead[];
  logs: ImportLogRow[];
  trainers: TrainerOption[];
  dbError: string | null;
}> {
  if (!process.env.DATABASE_URL) {
    return {
      leads: [],
      logs: [],
      trainers: [],
      dbError: "DATABASE_URL nenustatytas — sukonfigūruok .env ir paleisk npm run migrate.",
    };
  }
  try {
    const [leads, logs, trainers] = await Promise.all([
      query<Lead>(
        `SELECT id, name, email, phone, message, interest, call_status, trainer_id, training_type, notes,
                source, campaign_name, adset_name, ad_name, created_at
         FROM leads ORDER BY created_at DESC LIMIT 100`
      ),
      query<ImportLogRow>(
        "SELECT id, message_id, status, email, phone, parsed_via, error_message, created_at FROM import_log ORDER BY created_at DESC LIMIT 20"
      ),
      query<TrainerOption>("SELECT id, name FROM trainers ORDER BY name"),
    ]);
    return { leads, logs, trainers, dbError: null };
  } catch (err) {
    return { leads: [], logs: [], trainers: [], dbError: err instanceof Error ? err.message : "Nepavyko prisijungti prie DB" };
  }
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString("lt-LT");
}

export default async function HomePage() {
  const { leads, logs, trainers, dbError } = await loadData();

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
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Vardas</th>
                    <th>El. paštas</th>
                    <th>Telefonas</th>
                    <th>Dominasi</th>
                    <th>Žinutė</th>
                    <th>Sukurta</th>
                    <th>Skambutis</th>
                    <th>Priskirtas treneris</th>
                    <th>Treniruotė</th>
                    <th>Pastabos</th>
                    <th>Šaltinis</th>
                    <th>Reklama</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead) => (
                    <tr key={lead.id}>
                      <td>{lead.name}</td>
                      <td className="muted">{lead.email || "—"}</td>
                      <td className="muted">{lead.phone || "—"}</td>
                      <td className="muted">{lead.interest || "—"}</td>
                      <td className="muted" style={{ maxWidth: 260, whiteSpace: "pre-wrap" }}>
                        {lead.message || "—"}
                      </td>
                      <td className="muted">{formatDate(lead.created_at)}</td>
                      <td>
                        <CallStatusControl leadId={lead.id} initialStatus={lead.call_status} />
                      </td>
                      <td>
                        <TrainerAssignSelect leadId={lead.id} trainers={trainers} initialTrainerId={lead.trainer_id} />
                      </td>
                      <td>
                        <TrainingTypeSelect leadId={lead.id} initialType={lead.training_type} />
                      </td>
                      <td>
                        <NotesInput leadId={lead.id} initialNotes={lead.notes} />
                      </td>
                      <td className="muted">{(lead.source && SOURCE_LABELS[lead.source]) || "—"}</td>
                      <td className="muted">
                        {lead.ad_name || lead.campaign_name ? (
                          <span title={[lead.campaign_name, lead.adset_name, lead.ad_name].filter(Boolean).join(" / ")}>
                            {lead.ad_name || lead.campaign_name}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {!dbError && (
        <div className="card">
          <h2>Paskutiniai importo bandymai</h2>
          {logs.length === 0 ? (
            <p className="empty-state">Kol kas nieko nebuvo bandyta importuoti.</p>
          ) : (
            <div className="table-wrap">
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
            </div>
          )}
        </div>
      )}
    </main>
  );
}
