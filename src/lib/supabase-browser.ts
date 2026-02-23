import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type GlobalWithBrowserSupabase = typeof globalThis & {
  __overlapTimeBrowserSupabase?: SupabaseClient;
};

const globalBrowser = globalThis as GlobalWithBrowserSupabase;

export function getBrowserSupabaseClient(): SupabaseClient | null {
  if (typeof window === "undefined") {
    return null;
  }

  if (globalBrowser.__overlapTimeBrowserSupabase) {
    return globalBrowser.__overlapTimeBrowserSupabase;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return null;
  }

  const client = createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  globalBrowser.__overlapTimeBrowserSupabase = client;
  return client;
}
