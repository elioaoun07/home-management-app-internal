import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export default async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, {
              ...options,
              sameSite: "lax",
              secure: process.env.NODE_ENV === "production",
            });
          });
        },
      },
    },
  );

  // Refresh session if expired.
  // Cap at 3 s — on slow/flaky mobile networks this call can hang for 60 s,
  // causing a white screen on cold iOS PWA launches. If it times out, the
  // existing auth cookies remain valid and the client SDK refreshes later.
  try {
    await Promise.race([
      supabase.auth.getUser(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("auth-timeout")), 3000)
      ),
    ]);
  } catch {
    // Timeout or network error — proceed without refreshing the session.
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     * - login, signup, reset-password pages (public pages)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$|login|signup|reset-password).*)",
  ],
};
