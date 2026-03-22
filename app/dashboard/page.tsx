import { redirect } from "next/navigation";
import { CopyApiKeyButton } from "@/app/components/copy-api-key-button";
import { ensureUserApiKey } from "@/lib/generate-api-key";
import { getServerSupabase } from "@/lib/supabase-server";
import { getMonthlyUsageStats } from "@/lib/validate-key";

export default async function DashboardPage() {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const keyRow = await ensureUserApiKey(user.id);
  const usage = await getMonthlyUsageStats(keyRow.id, keyRow.requests_limit);
  const contactHref = `mailto:support@rohan.email.now@gmail.com?subject=${encodeURIComponent("Request API limit increase")}&body=${encodeURIComponent(`Hi team,\n\nPlease review and increase my monthly API limit.\n\nAccount: ${user.email ?? "unknown"}\nCurrent plan limit: ${usage.limit}/month\nCurrent usage this month: ${usage.used}\n\nThanks.`)}`;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 px-5 py-10 sm:px-8">
      <section className="card w-full p-6 sm:p-8">
        <h1 className="text-2xl font-semibold">Dashboard</h1>

        <p className="mt-3 text-sm text-[var(--muted)]">Signed in as {user.email}</p>

        <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--surface-alt)] p-4">
          <p className="text-sm font-medium text-[var(--foreground)]">Your API key</p>
          <div className="mt-2 flex items-center gap-2">
            <code className="block flex-1 overflow-x-auto rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm">
              {keyRow.key}
            </code>
            <CopyApiKeyButton apiKey={keyRow.key} />
          </div>
          <p className="mt-2 text-xs text-[var(--muted)]">Use this key in the x-api-key header when calling protected /api/v1 routes.</p>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-alt)] p-4">
            <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Month</p>
            <p className="mt-1 text-sm font-medium text-[var(--foreground)]">{usage.monthLabel}</p>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-alt)] p-4">
            <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Requests left</p>
            <p className="mt-1 text-sm font-medium text-[var(--foreground)]">{usage.remaining} / {usage.limit}</p>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-alt)] p-4">
            <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Used this month</p>
            <p className="mt-1 text-sm font-medium text-[var(--foreground)]">{usage.used}</p>
          </div>
        </div>

        <div className="mt-4">
          <a
            href={contactHref}
            className="inline-flex rounded-lg border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-medium text-[var(--foreground)] transition hover:bg-[var(--surface-alt)]"
          >
            Contact to increase limit
          </a>
        </div>
      </section>
    </div>
  );
}
