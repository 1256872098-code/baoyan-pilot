import { createClient } from "@supabase/supabase-js";

const supabaseUrl = typeof import.meta.env !== "undefined" ? import.meta.env.VITE_SUPABASE_URL : undefined;
const supabaseAnonKey = typeof import.meta.env !== "undefined" ? import.meta.env.VITE_SUPABASE_ANON_KEY : undefined;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
  // Keep the app usable in local/dev environments where Supabase is not configured yet.
  // eslint-disable-next-line no-console
  console.warn("Supabase is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
}

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        // Supabase Auth stores the refresh token in browser storage and restores
        // the account session after a refresh or a new browser tab.
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
