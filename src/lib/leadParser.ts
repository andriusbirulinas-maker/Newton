import Anthropic from "@anthropic-ai/sdk";

export interface ParsedLead {
  name: string;
  email: string | null;
  phone: string | null;
  message: string | null;
  interest: string | null;
  source: "website" | "meta_email";
}

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const URL_RE = /^https?:\/\//i;
const NO_NAME_PLACEHOLDER = "(užklausa)";

export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[^\d+]/g, "");

  if (digits.startsWith("+370") && digits.length === 12) return digits;
  if (digits.startsWith("370") && digits.length === 11) return `+${digits}`;
  if (digits.startsWith("8") && digits.length === 9) return `+370${digits.slice(1)}`;
  if (digits.startsWith("+8") && digits.length === 10) return `+370${digits.slice(2)}`;

  return null;
}

// newtongym.lt sends three distinct plain-text shapes:
//
// 1) Registration form ("Išbandyk pirmą treniruotę" etc.) — the line right after
//    the phone number names the training category the lead registered for
//    (e.g. "Cross Training", "Kainos", "Grupinės treniruotės"), followed by its URL:
//      Brigita
//      El. pašto adresas: brigita.biliunaite@gmail.com
//      Telefono numeris: +37065576321
//      Cross Training
//      https://newtongym.lt/grupines/cross-training/
//
// 2) Forwarded Meta/Facebook ad leads (from Miglė Vyšedvorskytė):
//      Vardas Pavardė: Miglė Vyšedvorskytė
//      Telefonas: +37064586478
//      El. paštas: vysedvorskyte.migle@gmail.com
//
// 3) "Užklausos forma iš NEWTON GYM" — general inquiries with NO name field,
//    just contact info + free text (membership questions, cancellations, complaints):
//      El. pašto adresas: ...
//      Telefono numeris: ...
//      Tekstas: <free text>
const LABELS = {
  name: ["vardas pavardė", "vardas, pavardė"],
  email: ["el. pašto adresas", "el. paštas", "el paštas", "el pastas", "email", "e-mail"],
  phone: ["telefono numeris", "telefonas", "tel", "phone", "mob", "mobile"],
  message: ["tekstas"],
};

function findLabeledValue(text: string, labels: string[]): string | null {
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`^\\s*${escaped}\\s*[:\\-]\\s*(.+?)\\s*$`, "im");
    const match = text.match(re);
    if (match?.[1]) return match[1].trim();
  }
  return null;
}

function findMessage(text: string): string | null {
  for (const label of LABELS.message) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`^\\s*${escaped}\\s*[:\\-]\\s*([\\s\\S]+)$`, "im");
    const match = text.match(re);
    if (match?.[1]) return match[1].trim();
  }
  return null;
}

const SKIP_LABELS_FOR_NAME = [...LABELS.name, ...LABELS.email, ...LABELS.phone, ...LABELS.message];

function isLabeledLine(line: string): boolean {
  const lower = line.toLowerCase();
  return SKIP_LABELS_FOR_NAME.some((label) => lower.startsWith(label));
}

function extractName(text: string): string | null {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  for (const line of lines) {
    if (URL_RE.test(line)) continue;
    if (EMAIL_RE.test(line)) continue;
    if (isLabeledLine(line)) continue;
    return line;
  }
  return null;
}

// The training category a lead registered for sits on the first substantive line
// after the phone number, right before that category's URL.
function extractInterest(text: string): string | null {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  const phoneLineIndex = lines.findIndex((l) => LABELS.phone.some((label) => l.toLowerCase().startsWith(label)));
  if (phoneLineIndex === -1) return null;

  for (let i = phoneLineIndex + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    if (URL_RE.test(line)) continue;
    if (EMAIL_RE.test(line)) continue;
    if (isLabeledLine(line)) continue;
    return line;
  }
  return null;
}

export function regexParseLead(text: string): ParsedLead | null {
  const message = findMessage(text);
  const nameFromLabel = findLabeledValue(text, LABELS.name);
  const name = nameFromLabel ?? extractName(text) ?? (message ? NO_NAME_PLACEHOLDER : null);

  const emailRaw = findLabeledValue(text, LABELS.email) ?? text.match(EMAIL_RE)?.[0] ?? null;
  const email = emailRaw && EMAIL_RE.test(emailRaw) ? emailRaw.match(EMAIL_RE)![0] : null;

  const phoneRaw = findLabeledValue(text, LABELS.phone);
  const phone = normalizePhone(phoneRaw);

  const interest = message ? null : extractInterest(text);

  if (!name || (!email && !phone)) return null;

  // The "Vardas Pavardė:" label only appears in forwarded Meta ad lead emails.
  const source: ParsedLead["source"] = nameFromLabel ? "meta_email" : "website";

  return { name, email, phone, message, interest, source };
}

let anthropicClient: Anthropic | null = null;
function getClient(): Anthropic {
  if (!anthropicClient) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY nenustatytas");
    anthropicClient = new Anthropic({ apiKey });
  }
  return anthropicClient;
}

const EXTRACT_TOOL: Anthropic.Tool = {
  name: "extract_lead",
  description: "Extract a lead's contact details, the service/category they registered for, and any free-text message from an email body",
  input_schema: {
    type: "object",
    properties: {
      name: { type: "string" },
      email: { type: ["string", "null"] },
      phone: { type: ["string", "null"] },
      message: { type: ["string", "null"] },
      interest: {
        type: ["string", "null"],
        description: "The training service/category the lead registered for, e.g. 'Cross Training', 'Grupinės treniruotės', 'Kainos'",
      },
    },
    required: ["name", "email", "phone", "message", "interest"],
  },
};

export async function claudeParseLead(text: string): Promise<ParsedLead | null> {
  const client = getClient();
  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

  const response = await client.messages.create({
    model,
    max_tokens: 512,
    tools: [EXTRACT_TOOL],
    tool_choice: { type: "tool", name: "extract_lead" },
    messages: [
      {
        role: "user",
        content: `Ištrauk potencialaus kliento vardą, el. paštą, telefono numerį, treniruočių paslaugos/kategorijos pavadinimą (jei registravosi į konkrečią treniruotę) ir laisvo teksto žinutę (jei yra) iš šio laiško teksto. Jei tai bendra užklausa be vardo (pvz. klausimas ar skundas), naudok name="${NO_NAME_PLACEHOLDER}". Jei kurio nors lauko rasti nepavyksta, naudok null.\n\n---\n${text.slice(0, 6000)}\n---`,
      },
    ],
  });

  const toolUse = response.content.find((block): block is Anthropic.ToolUseBlock => block.type === "tool_use");
  if (!toolUse) return null;

  const input = toolUse.input as {
    name?: string;
    email?: string | null;
    phone?: string | null;
    message?: string | null;
    interest?: string | null;
  };
  if (!input.name) return null;

  const email = input.email && EMAIL_RE.test(input.email) ? input.email.match(EMAIL_RE)![0] : null;
  const phone = normalizePhone(input.phone ?? null);
  if (!email && !phone) return null;

  return { name: input.name, email, phone, message: input.message ?? null, interest: input.interest ?? null, source: "website" };
}
