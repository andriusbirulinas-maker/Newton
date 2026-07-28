import { NextRequest, NextResponse } from "next/server";
import { queryOne } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_STATUSES = new Set(["not_called", "answered", "no_answer"]);

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const leadId = Number(id);
  if (!Number.isInteger(leadId)) {
    return NextResponse.json({ error: "Neteisingas lead ID" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const callStatus = body?.callStatus;
  if (typeof callStatus !== "string" || !VALID_STATUSES.has(callStatus)) {
    return NextResponse.json({ error: "Neteisinga skambučio būsena" }, { status: 400 });
  }

  const updated = await queryOne(
    "UPDATE leads SET call_status = $1 WHERE id = $2 RETURNING id, call_status",
    [callStatus, leadId]
  );

  if (!updated) {
    return NextResponse.json({ error: "Lead'as nerastas" }, { status: 404 });
  }

  return NextResponse.json(updated);
}
