"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type CallStatus = "not_called" | "answered" | "no_answer";

const OPTIONS: { value: CallStatus; label: string; className: string }[] = [
  { value: "not_called", label: "Neskambinta", className: "call-dot-not-called" },
  { value: "answered", label: "Paskambinta", className: "call-dot-answered" },
  { value: "no_answer", label: "Neprisiskambinta", className: "call-dot-no-answer" },
];

export function CallStatusControl({ leadId, initialStatus }: { leadId: number; initialStatus: CallStatus }) {
  const router = useRouter();
  const [status, setStatus] = useState<CallStatus>(initialStatus);
  const [pending, setPending] = useState(false);

  async function setCallStatus(next: CallStatus) {
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

  return (
    <div className="call-status" role="group" aria-label="Skambučio būsena">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          title={opt.label}
          aria-label={opt.label}
          aria-pressed={status === opt.value}
          disabled={pending}
          className={`call-dot ${opt.className} ${status === opt.value ? "active" : ""}`}
          onClick={() => setCallStatus(opt.value)}
        />
      ))}
    </div>
  );
}
