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
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Neteisingas užklausos turinys" }, { status: 400 });
  }

  const setClauses: string[] = [];
  const values: unknown[] = [];

  if ("callStatus" in body) {
    if (typeof body.callStatus !== "string" || !VALID_STATUSES.has(body.callStatus)) {
      return NextResponse.json({ error: "Neteisinga skambučio būsena" }, { status: 400 });
    }
    values.push(body.callStatus);
    setClauses.push(`call_status = $${values.length}`);
  }

  if ("trainerId" in body) {
    const trainerId = body.trainerId;
    if (trainerId !== null && !Number.isInteger(trainerId)) {
      return NextResponse.json({ error: "Neteisingas trenerio ID" }, { status: 400 });
    }
    values.push(trainerId);
    setClauses.push(`trainer_id = $${values.length}`);
  }

  if (setClauses.length === 0) {
    return NextResponse.json({ error: "Nėra ką atnaujinti" }, { status: 400 });
  }

  values.push(leadId);
  const updated = await queryOne(
    `UPDATE leads SET ${setClauses.join(", ")} WHERE id = $${values.length} RETURNING id, call_status, trainer_id`,
    values
  );

  if (!updated) {
    return NextResponse.json({ error: "Lead'as nerastas" }, { status: 404 });
  }

  return NextResponse.json(updated);
}
