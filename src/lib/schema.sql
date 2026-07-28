CREATE TABLE IF NOT EXISTS trainers (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  role TEXT
);

CREATE TABLE IF NOT EXISTS leads (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  message TEXT,
  interest TEXT,
  call_status TEXT NOT NULL DEFAULT 'not_called' CHECK (call_status IN ('not_called', 'answered', 'no_answer')),
  trainer_id INTEGER REFERENCES trainers(id) ON DELETE SET NULL,
  training_type TEXT CHECK (training_type IN ('kineziterapija', 'asmenine_treniruote', 'mini_grupine', 'grupine_treniruote')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS import_log (
  id SERIAL PRIMARY KEY,
  message_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('imported', 'skipped', 'error')),
  lead_id INTEGER REFERENCES leads(id) ON DELETE SET NULL,
  email TEXT,
  phone TEXT,
  parsed_via TEXT CHECK (parsed_via IN ('regex', 'claude')),
  error_message TEXT,
  raw_body TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads(phone);
CREATE INDEX IF NOT EXISTS idx_import_log_message_id ON import_log(message_id);
CREATE INDEX IF NOT EXISTS idx_import_log_created_at ON import_log(created_at DESC);
