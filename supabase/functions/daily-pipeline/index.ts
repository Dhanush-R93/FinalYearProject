// supabase/functions/daily-pipeline/index.ts
// ────────────────────────────────────────────
// Supabase scheduled function (cron) that triggers the
// FastAPI daily pipeline every morning at 08:00 IST.
//
// Configure in supabase/config.toml:
//   [functions.daily-pipeline]
//   schedule = "0 2 * * *"   # 08:00 IST = 02:30 UTC
//
// Or via Supabase dashboard → Edge Functions → Schedule

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const BACKEND_URL = Deno.env.get("BACKEND_URL") ?? "http://localhost:8000";

serve(async (_req: Request) => {
  try {
    const res = await fetch(`${BACKEND_URL}/pipeline/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    const data = await res.json();
    console.log("Pipeline triggered:", data);

    return new Response(JSON.stringify({ success: true, ...data }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Pipeline trigger failed:", err);
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
