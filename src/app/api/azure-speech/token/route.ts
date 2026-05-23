import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Reuse the same Azure resource for both STT and TTS
  const key = process.env.AZURE_SPEECH_KEY ?? process.env.AZURE_TTS_KEY;
  const region = process.env.AZURE_SPEECH_REGION ?? process.env.AZURE_TTS_REGION;

  if (!key || !region) {
    return NextResponse.json({ error: "Azure Speech not configured" }, { status: 503 });
  }

  try {
    const res = await fetch(
      `https://${region}.api.cognitive.microsoft.com/sts/v1.0/issueToken`,
      {
        method: "POST",
        headers: { "Ocp-Apim-Subscription-Key": key },
      },
    );

    if (!res.ok) {
      return NextResponse.json({ error: "Token fetch failed" }, { status: 502 });
    }

    const token = await res.text();
    const expiresAt = Date.now() + 9 * 60 * 1000; // 9 min (tokens valid for 10 min)

    return NextResponse.json({ token, region, expiresAt });
  } catch {
    return NextResponse.json({ error: "Token service unavailable" }, { status: 500 });
  }
}
