import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Singleton instance for browser - required for realtime subscriptions to work!
let browserClient: SupabaseClient | null = null;

export function supabaseBrowser() {
  if (!browserClient) {
    browserClient = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: true, autoRefreshToken: true },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    });
  }
  return browserClient;
}
