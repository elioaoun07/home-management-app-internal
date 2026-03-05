// Lightweight health-check endpoint used by the connectivity manager
// to detect real network availability (not just navigator.onLine).
// Returns a tiny 200 OK with no auth required.

import { NextResponse } from "next/server";

export const runtime = "edge"; // fast cold-start on Vercel

export function GET() {
  return NextResponse.json({ ok: true }, { status: 200 });
}

export function HEAD() {
  return new Response(null, { status: 200 });
}
