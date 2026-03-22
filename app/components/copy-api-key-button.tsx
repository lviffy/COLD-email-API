"use client";

import { useState } from "react";

export function CopyApiKeyButton({ apiKey }: { apiKey: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="rounded-lg border border-[var(--border)] bg-[var(--surface-alt)] px-3 py-2 text-sm font-medium text-[var(--foreground)] transition hover:bg-white"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
