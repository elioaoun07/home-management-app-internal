import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  ssml: z.string().min(1).max(10000),
});

export async function POST(req: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const azureKey = process.env.AZURE_TTS_KEY;
  const azureRegion = process.env.AZURE_TTS_REGION;

  if (!azureKey || !azureRegion) {
    return NextResponse.json(
      { error: "TTS service not configured" },
      { status: 503 },
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const azureRes = await fetch(
      `https://${azureRegion}.tts.speech.microsoft.com/cognitiveservices/v1`,
      {
        method: "POST",
        headers: {
          "Ocp-Apim-Subscription-Key": azureKey,
          "Content-Type": "application/ssml+xml",
          "X-Microsoft-OutputFormat": "audio-48khz-192kbitrate-mono-mp3",
          "User-Agent": "BudgetApp-TTS",
        },
        body: parsed.data.ssml,
        signal: controller.signal,
      },
    );

    clearTimeout(timeout);

    if (!azureRes.ok) {
      const status = azureRes.status;
      if (status === 401 || status === 403) {
        return NextResponse.json(
          { error: "TTS service auth failed" },
          { status: 502 },
        );
      }
      if (status === 429) {
        return NextResponse.json(
          { error: "TTS rate limit exceeded" },
          { status: 429 },
        );
      }
      return NextResponse.json({ error: "TTS service error" }, { status: 500 });
    }

    const audioBuffer = await azureRes.arrayBuffer();

    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    clearTimeout(timeout);

    if (err instanceof DOMException && err.name === "AbortError") {
      return NextResponse.json(
        { error: "TTS request timed out" },
        { status: 504 },
      );
    }

    return NextResponse.json(
      { error: "TTS service unavailable" },
      { status: 500 },
    );
  }
}
