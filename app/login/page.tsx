"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase-browser";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const callbackError = searchParams.get("error") ?? "";

  function getRedirectTarget() {
    return `${window.location.origin}/auth/callback?next=%2Fdashboard`;
  }

  async function handleGoogleLogin() {
    setError("");
    setOauthLoading(true);

    let supabase;
    try {
      supabase = getBrowserSupabase();
    } catch {
      setError("Auth is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
      setOauthLoading(false);
      return;
    }

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: getRedirectTarget(),
      },
    });

    if (oauthError) {
      setError(oauthError.message);
      setOauthLoading(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    let supabase;
    try {
      supabase = getBrowserSupabase();
    } catch {
      setError("Auth is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
      setLoading(false);
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 items-center px-5 py-10 sm:px-8">
      <section className="card w-full p-6 sm:p-8">
        <h1 className="text-2xl font-semibold">Log in</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">Access your dashboard and API key.</p>

        <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm text-[var(--muted)]" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2.5 text-sm outline-none ring-[var(--brand)] focus:ring-2"
            />
          </div>

          <div>
            <label className="block text-sm text-[var(--muted)]" htmlFor="password">
              Password
            </label>
            <div className="relative mt-1">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2.5 pr-16 text-sm outline-none ring-[var(--brand)] focus:ring-2"
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-xs text-[var(--muted)] hover:bg-[var(--surface-alt)]"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          {error || callbackError ? <p className="text-sm text-red-700">{error || callbackError}</p> : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-[var(--brand)] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[var(--brand-strong)] disabled:opacity-70"
          >
            {loading ? "Logging in..." : "Log in"}
          </button>
        </form>

        <div className="my-4 flex items-center gap-2 text-xs text-[var(--muted)]">
          <span className="h-px flex-1 bg-[var(--border)]" />
          <span>or</span>
          <span className="h-px flex-1 bg-[var(--border)]" />
        </div>

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={oauthLoading}
          className="w-full rounded-lg border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-medium text-[var(--foreground)] transition hover:bg-[var(--surface-alt)] disabled:opacity-70"
        >
          {oauthLoading ? "Redirecting..." : "Continue with Google"}
        </button>

        <p className="mt-4 text-sm text-[var(--muted)]">
          No account yet? <Link className="text-[var(--brand-strong)] underline" href="/signup">Create one</Link>
        </p>
      </section>
    </div>
  );
}
