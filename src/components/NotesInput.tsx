"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function NotesInput({ leadId, initialNotes }: { leadId: number; initialNotes: string | null }) {
  const router = useRouter();
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [savedNotes, setSavedNotes] = useState(initialNotes ?? "");
  const [pending, setPending] = useState(false);

  async function save() {
    if (notes === savedNotes || pending) return;
    setPending(true);
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: notes.trim() === "" ? null : notes }),
      });
      if (!res.ok) throw new Error("update failed");
      setSavedNotes(notes);
      router.refresh();
    } catch {
      setNotes(savedNotes);
    } finally {
      setPending(false);
    }
  }

  return (
    <textarea
      className="notes-input"
      value={notes}
      placeholder="Pastaba..."
      disabled={pending}
      onChange={(e) => setNotes(e.target.value)}
      onBlur={save}
      rows={2}
    />
  );
}
