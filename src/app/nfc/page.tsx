// src/app/nfc/page.tsx
// NFC Admin — server component with auth guard
import { supabaseServerRSC } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import NfcAdminClient from "./nfc-admin-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "NFC Tags • ERA",
  description: "Manage your NFC tags",
};

export default async function NfcAdminPage() {
  const supabase = await supabaseServerRSC();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login?redirect=/nfc");
  }

  return <NfcAdminClient />;
}
