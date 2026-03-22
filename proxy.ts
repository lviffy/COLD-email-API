import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { type Database } from "@/lib/supabase";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const pathname = request.nextUrl.pathname;

  const isAuthRoute =
    pathname.startsWith("/dashboard") || pathname.startsWith("/login") || pathname.startsWith("/signup");

  if (isAuthRoute) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      url.searchParams.set("authConfig", "missing");
      return NextResponse.redirect(url);
    }

    const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (pathname.startsWith("/dashboard") && !user) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }

    if ((pathname.startsWith("/login") || pathname.startsWith("/signup")) && user) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
  }

  if (!pathname.startsWith("/api/v1/")) {
    return response;
  }

  const apiKey = request.headers.get("x-api-key");
  if (!apiKey?.trim()) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_API_KEY",
          message: "Missing x-api-key header.",
        },
      },
      { status: 401 },
    );
  }

  return response;
}

export { middleware as proxy };

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
