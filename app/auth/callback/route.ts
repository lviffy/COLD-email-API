import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { type Database, getRequiredEnv } from "@/lib/supabase";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/dashboard";
  const oauthError = url.searchParams.get("error_description") ?? url.searchParams.get("error");

  const safeNext = next.startsWith("/") ? next : "/dashboard";
  const redirectUrl = new URL(safeNext, url.origin);
  const response = NextResponse.redirect(redirectUrl);

  if (oauthError) {
    const loginUrl = new URL("/login", url.origin);
    loginUrl.searchParams.set("error", oauthError);
    return NextResponse.redirect(loginUrl);
  }

  if (code) {
    const supabase = createServerClient<Database>(
      getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
      getRequiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
      {
        cookies: {
          getAll() {
            return request.headers
              .get("cookie")
              ?.split(";")
              .map((cookie) => cookie.trim())
              .filter(Boolean)
              .map((cookie) => {
                const idx = cookie.indexOf("=");
                if (idx === -1) {
                  return { name: cookie, value: "" };
                }

                return {
                  name: cookie.slice(0, idx),
                  value: decodeURIComponent(cookie.slice(idx + 1)),
                };
              }) ?? [];
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, options);
            });
          },
        },
      },
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      const loginUrl = new URL("/login", url.origin);
      loginUrl.searchParams.set("error", error.message);
      return NextResponse.redirect(loginUrl);
    }
  } else {
    const loginUrl = new URL("/login", url.origin);
    loginUrl.searchParams.set("error", "Missing OAuth code in callback URL.");
    return NextResponse.redirect(loginUrl);
  }

  return response;
}
