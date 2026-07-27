import { NextRequest, NextResponse } from "next/server";
import { runEmailImport } from "@/lib/emailImport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handleImport(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Neautorizuota" }, { status: 401 });
  }

  try {
    const result = await runEmailImport();
    return NextResponse.json(result);
  } catch (err) {
    console.error("El. laiškų importo klaida:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Importo klaida" }, { status: 500 });
  }
}

export const GET = handleImport;
export const POST = handleImport;
