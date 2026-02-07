import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const hostname = request.headers.get("host") || "";
  const { pathname } = request.nextUrl;

  // ----------------------------------------------------------------------
  // SUBDOMAIN STRATEGY FOR PWA
  // ----------------------------------------------------------------------
  // Check if we are accessing via "catalogue." subdomain
  // This allows the Catalogue PWA to have its own "Root Scope" ("/")
  // separating it from the main "Budget" app scope.
  // ----------------------------------------------------------------------

  // Adjust this check based on your actual domain (e.g. catalogue.myapp.com)
  // For localhost, you might use "catalogue.localhost:3000" (requires hosts file edit)
  const isCatalogueSubdomain = hostname.startsWith("catalogue.");

  if (isCatalogueSubdomain) {
    // If user hits root "/" on catalogue subdomain, rewrite to "/catalogue"
    // The user sees "/" in URL bar, but Next.js renders "/catalogue" page
    if (pathname === "/" || pathname === "/catalogue") {
      return NextResponse.rewrite(new URL("/catalogue", request.url));
    }

    // You might want to handle other assets or routes here if strictly needed
    // But mainly we just want the root to show the catalogue
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - catalogue- (catalogue icons)
     * - appicon- (app icons)
     * - manifest (manifest files)
     */
    "/((?!api|_next/static|_next/image|favicon.ico|catalogue-|appicon-|manifest|sw.js).*)",
  ],
};
