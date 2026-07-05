"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Mail } from "lucide-react";
import { sendDigestAction } from "@/app/actions/digest";

export default function DigestButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() =>
          start(async () => {
            const r = await sendDigestAction();
            setMsg(`${r.status} → ${r.to}`);
            router.refresh();
          })
        }
        disabled={pending}
        className="inline-flex items-center gap-2 text-sm font-medium bg-accent/20 hover:bg-accent/30 border border-accent/30 rounded-xl px-4 py-2 transition-colors disabled:opacity-50"
      >
        <Mail className={`w-4 h-4 ${pending ? "animate-pulse" : ""}`} />
        {pending ? "Sending…" : "Send digest now"}
      </button>
      {msg && <span className="text-xs text-muted">Digest {msg}</span>}
    </div>
  );
}
