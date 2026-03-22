"use client";

import { useState } from "react";

type ApiResponse = {
  prospect: {
    name: string;
    role: string;
    company: string;
  };
  lines: Array<{
    tone: "curious" | "direct" | "compliment";
    text: string;
  }>;
  usage: {
    requests_used: number;
    requests_limit: number;
  };
};

export function LiveTester() {
  const [mode, setMode] = useState<"linkedin" | "company">("company");
  const [linkedinUrl, setLinkedinUrl] = useState("https://www.linkedin.com/in/johndoe");
  const [company, setCompany] = useState("Notion");
  const [role, setRole] = useState("Head of Sales");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [responseText, setResponseText] = useState<string>("");

  async function onTest() {
    setLoading(true);
    setStatus("");
    setResponseText("");

    try {
      const payload =
        mode === "linkedin"
          ? { linkedinUrl, role }
          : {
              company,
              role,
            };

      const response = await fetch("/api/playground/personalize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as ApiResponse | { error?: { code?: string; message?: string } };

      if (!response.ok) {
        const code = "error" in data ? data.error?.code ?? "UNKNOWN" : "UNKNOWN";
        setStatus(`${response.status} ${code}`);
        setResponseText(JSON.stringify(data, null, 2));
        return;
      }

      const okData = data as ApiResponse;
      setStatus(`200 OK - ${okData.usage.requests_used}/${okData.usage.requests_limit} used`);
      setResponseText(JSON.stringify(okData, null, 2));
    } catch {
      setStatus("NETWORK_ERROR");
      setResponseText("Could not reach the API route.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="card p-5 sm:p-6">
      <h2 className="text-lg font-semibold">Try it live</h2>
      <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
        Submit a LinkedIn URL or company name to preview generated opening lines.
      </p>

      <div className="mt-4 space-y-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setMode("company")}
            className={`rounded-lg border px-3 py-2 text-sm ${mode === "company" ? "border-[var(--brand)] bg-[var(--surface-alt)]" : "border-[var(--border)] bg-white"}`}
          >
            Company + role
          </button>
          <button
            type="button"
            onClick={() => setMode("linkedin")}
            className={`rounded-lg border px-3 py-2 text-sm ${mode === "linkedin" ? "border-[var(--brand)] bg-[var(--surface-alt)]" : "border-[var(--border)] bg-white"}`}
          >
            LinkedIn URL
          </button>
        </div>

        {mode === "linkedin" ? (
          <>
            <label className="block text-sm text-[var(--muted)]" htmlFor="linkedin-url">
              LinkedIn URL
            </label>
            <input
              id="linkedin-url"
              type="url"
              value={linkedinUrl}
              onChange={(event) => setLinkedinUrl(event.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2.5 text-sm outline-none ring-[var(--brand)] transition focus:ring-2"
              placeholder="https://www.linkedin.com/in/johndoe"
            />
          </>
        ) : (
          <>
            <label className="block text-sm text-[var(--muted)]" htmlFor="company-name">
              Company
            </label>
            <input
              id="company-name"
              type="text"
              value={company}
              onChange={(event) => setCompany(event.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2.5 text-sm outline-none ring-[var(--brand)] transition focus:ring-2"
              placeholder="Notion"
            />
          </>
        )}

        <label className="block text-sm text-[var(--muted)]" htmlFor="role-name">
          Role
        </label>
        <input
          id="role-name"
          type="text"
          value={role}
          onChange={(event) => setRole(event.target.value)}
          className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2.5 text-sm outline-none ring-[var(--brand)] transition focus:ring-2"
          placeholder="Head of Sales"
        />

        <button
          type="button"
          onClick={onTest}
          disabled={loading}
          className="w-full rounded-lg bg-[var(--brand)] px-4 py-3 text-sm font-medium text-white transition hover:bg-[var(--brand-strong)] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loading ? "Generating..." : "Generate Opening Lines"}
        </button>
      </div>

      <div className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--surface-alt)] p-3 text-sm">
        <p className="font-medium text-[var(--foreground)]">{status || "No request yet"}</p>
        <pre className="mt-2 max-h-[320px] overflow-auto whitespace-pre-wrap rounded-md border border-[var(--border)] bg-white p-3 text-xs leading-5 text-[var(--foreground)]">
          {responseText || "Live JSON response will appear here."}
        </pre>
      </div>
    </section>
  );
}
