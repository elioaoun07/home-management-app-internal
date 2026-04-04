// src/app/nfc/[tag]/page.tsx
// NFC tag interaction page — public route, auth handled client-side
import { supabaseServerRSC } from "@/lib/supabase/server";
import NfcTapClient from "./nfc-tap-client";

export const dynamic = "force-dynamic";

export default async function NfcTagPage({
  params,
}: {
  params: Promise<{ tag: string }>;
}) {
  const { tag } = await params;

  const supabase = await supabaseServerRSC();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fetch profile only when authenticated
  const { data: profile } = user
    ? await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle()
    : { data: null };

  return (
    <NfcTapClient
      tagSlug={tag}
      isAuthenticated={!!user}
      displayName={profile?.full_name ?? user?.email?.split("@")[0] ?? ""}
    />
  );
}
