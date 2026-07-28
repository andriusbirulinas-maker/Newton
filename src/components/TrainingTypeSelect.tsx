"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type TrainingType = "kineziterapija" | "asmenine_treniruote" | "mini_grupine" | "grupine_treniruote";

const OPTIONS: { value: TrainingType; label: string }[] = [
  { value: "kineziterapija", label: "Kineziterapija" },
  { value: "asmenine_treniruote", label: "Asmeninė treniruotė" },
  { value: "mini_grupine", label: "MINI grupinė" },
  { value: "grupine_treniruote", label: "Grupinė treniruotė" },
];

export function TrainingTypeSelect({
  leadId,
  initialType,
}: {
  leadId: number;
  initialType: TrainingType | null;
}) {
  const router = useRouter();
  const [trainingType, setTrainingType] = useState<TrainingType | null>(initialType);
  const [pending, setPending] = useState(false);

  async function handleChange(value: string) {
    const next = (value === "" ? null : value) as TrainingType | null;
    if (next === trainingType || pending) return;
    setPending(true);
    const previous = trainingType;
    setTrainingType(next);
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trainingType: next }),
      });
      if (!res.ok) throw new Error("update failed");
      router.refresh();
    } catch {
      setTrainingType(previous);
    } finally {
      setPending(false);
    }
  }

  return (
    <select
      className="trainer-select"
      value={trainingType ?? ""}
      disabled={pending}
      onChange={(e) => handleChange(e.target.value)}
    >
      <option value="">— nepasirinkta —</option>
      {OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
