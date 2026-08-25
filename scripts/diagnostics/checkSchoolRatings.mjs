import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { lookup } from "node:dns/promises";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("school ratings diagnostics: missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY");
  process.exitCode = 1;
} else {
  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  let connectionError = null;
  try {
    await lookup(new URL(supabaseUrl).hostname);
  } catch (error) {
    connectionError = error;
  }

  function safeError(error) {
    const rootError =
      /fetch failed/i.test(String(error?.message || "")) && connectionError
        ? connectionError
        : error?.cause || error;
    return {
      code: String(rootError?.code || error?.code || error?.status || rootError?.name || "unknown"),
      message: String(rootError?.message || error?.message || error?.details || "Unknown error"),
    };
  }

  async function runCheck(label, request) {
    try {
      const { error } = await request();
      if (error) {
        console.error(`${label}: failed`, safeError(error));
        return false;
      }
      console.log(`${label}: ok`);
      return true;
    } catch (error) {
      console.error(`${label}: failed`, safeError(error));
      return false;
    }
  }

  const results = await Promise.all([
    runCheck("reviews", () => client.from("school_reviews").select("id,school_id,rating").limit(1)),
    runCheck("likes", () => client.from("school_review_likes").select("id,review_id,user_id").limit(1)),
    runCheck("dislikes", () => client.from("school_review_dislikes").select("id,review_id,user_id").limit(1)),
    runCheck("RPC", () =>
      client.rpc("get_school_reviews", {
        p_school_id: "__baoyanpilot_diagnostics__",
        p_sort: "newest",
        p_limit: 1,
        p_offset: 0,
      }),
    ),
  ]);

  if (results.some((ok) => !ok)) process.exitCode = 1;
}
