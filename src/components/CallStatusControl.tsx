"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type CallStatus = "not_called" | "answered" | "no_answer";

const OPTIONS: { value: CallStatus; label: string; className: string }[] = [
  { value: "not_called", label: "Neskambinta", className: "call-select-not-called" },
  { value: "answered", label: "Paskambinta", className: "call-select-answered" },
  { value: "no_answer", label: "Neprisiskambinta", className: "call-select-no-answer" },
];

export function CallStatusControl({ leadId, initialStatus }: { leadId: number; initialStatus: CallStatus }) {
  const router = useRouter();
  const [status, setStatus] = useState<CallStatus>(initialStatus);
  const [pending, setPending] = useState(false);

  async function handleChange(value: string) {
    const next = value as CallStatus;
    if (next === status || pending) return;
    setPending(true);
    const previous = status;
    setStatus(next);
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callStatus: next }),
      });
      if (!res.ok) throw new Error("update failed");
      router.refresh();
    } catch {
      setStatus(previous);
    } finally {
      setPending(false);
    }
  }

  const activeClassName = OPTIONS.find((opt) => opt.value === status)?.className ?? "";

  return (
    <select
      className={`trainer-select ${activeClassName}`}
      value={status}
      disabled={pending}
      onChange={(e) => handleChange(e.target.value)}
      aria-label="Skambučio būsena"
    >
      {OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
