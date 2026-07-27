import { NextResponse } from "next/server";
import { runEmailImport } from "@/lib/emailImport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const result = await runEmailImport();
    return NextResponse.json(result);
  } catch (err) {
    console.error("Rankinio pašto importo klaida:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Importo klaida" }, { status: 500 });
  }
}
