import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Gate the hosted PM Command Center behind the same Supabase login as the rest
// of the app. The console is served as a static page (public/pm.html, exposed at
// /pm via the next.config rewrite) with all its data embedded in the HTML — so
// without this anyone who knew the URL could read every PM doc without logging
// in. The matcher below is scoped to /pm only; no other route runs through
// middleware, so this has zero effect on the rest of the app.
//
// Both /pm and the raw /pm.html are matched: /pm.html is a real static file, so
// gating only /pm would leave the file itself as an open bypass.
//
// Offline still works: when the phone is offline the service worker serves the
// last cached /pm response (captured during an authenticated online visit) and
// middleware never runs.
export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: Record<string, unknown>) {
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: Record<string, unknown>) {
          response.cookies.set({ name, value: "", ...options });
        },
      },
    },
  );

  // getUser() revalidates the JWT with Supabase (unlike getSession(), which only
  // trusts the local cookie) — the correct choice for an access gate.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("redirect", "/pm");
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/pm", "/pm.html"],
};
