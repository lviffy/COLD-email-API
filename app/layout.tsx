import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Space_Grotesk, IBM_Plex_Mono } from "next/font/google";
import { redirect } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase-server";
import "./globals.css";

const headingFont = Space_Grotesk({
  variable: "--font-heading",
  subsets: ["latin"],
});

const monoFont = IBM_Plex_Mono({
  variable: "--font-code",
  weight: ["400", "500"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "API Template",
  description: "Reusable API starter with key auth, quota limits, and request logging.",
  icons: {
    icon: "/icon.svg",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const hasAuthEnv = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  let userEmail: string | null = null;

  if (hasAuthEnv) {
    try {
      const supabase = await getServerSupabase();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      userEmail = user?.email ?? null;
    } catch {
      userEmail = null;
    }
  }

  async function signOutAction() {
    "use server";

    if (!hasAuthEnv) {
      redirect("/login");
    }

    const supabase = await getServerSupabase();
    await supabase.auth.signOut();
    redirect("/login");
  }

  return (
    <html lang="en" className={`${headingFont.variable} ${monoFont.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[color:rgba(246,247,245,0.9)] backdrop-blur">
          <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-3 sm:px-8">
            <Link href="/" className="inline-flex items-center">
              <Image src="/logo.svg" alt="API Template" width={210} height={32} priority />
            </Link>
            <div className="flex items-center gap-2 text-sm">
              {userEmail ? (
                <>
                  <span className="hidden rounded-md border border-[var(--border)] bg-[var(--surface-alt)] px-3 py-1.5 text-xs text-[var(--muted)] md:inline-block">
                    {userEmail}
                  </span>
                  <Link href="/dashboard" className="rounded-md px-3 py-1.5 text-[var(--muted)] hover:bg-[var(--surface-alt)] hover:text-[var(--foreground)]">
                    Dashboard
                  </Link>
                  <form action={signOutAction}>
                    <button
                      type="submit"
                      className="rounded-md bg-[var(--brand)] px-3 py-1.5 font-medium text-white transition hover:bg-[var(--brand-strong)]"
                    >
                      Log out
                    </button>
                  </form>
                </>
              ) : (
                <>
                  <Link href="/login" className="rounded-md px-3 py-1.5 text-[var(--muted)] hover:bg-[var(--surface-alt)] hover:text-[var(--foreground)]">
                    Log in
                  </Link>
                  <Link href="/signup" className="rounded-md bg-[var(--brand)] px-3 py-1.5 font-medium text-white transition hover:bg-[var(--brand-strong)]">
                    Sign up
                  </Link>
                </>
              )}
            </div>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
