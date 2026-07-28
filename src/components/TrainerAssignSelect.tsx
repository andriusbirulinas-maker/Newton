"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface TrainerOption {
  id: number;
  name: string;
}

export function TrainerAssignSelect({
  leadId,
  trainers,
  initialTrainerId,
}: {
  leadId: number;
  trainers: TrainerOption[];
  initialTrainerId: number | null;
}) {
  const router = useRouter();
  const [trainerId, setTrainerId] = useState<number | null>(initialTrainerId);
  const [pending, setPending] = useState(false);

  async function handleChange(value: string) {
    const next = value === "" ? null : Number(value);
    if (next === trainerId || pending) return;
    setPending(true);
    const previous = trainerId;
    setTrainerId(next);
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trainerId: next }),
      });
      if (!res.ok) throw new Error("update failed");
      router.refresh();
    } catch {
      setTrainerId(previous);
    } finally {
      setPending(false);
    }
  }

  return (
    <select
      className="trainer-select"
      value={trainerId ?? ""}
      disabled={pending}
      onChange={(e) => handleChange(e.target.value)}
    >
      <option value="">— nepriskirta —</option>
      {trainers.map((t) => (
        <option key={t.id} value={t.id}>
          {t.name}
        </option>
      ))}
    </select>
  );
}
