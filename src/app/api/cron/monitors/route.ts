import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { runMonitor } from "@/lib/monitors";
import type { Monitor } from "@/lib/types";

export const maxDuration = 300;

/** Chamado uma vez por dia pelo cron da Vercel (ver vercel.json). */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Não autorizado" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.from("monitors").select("*").eq("active", true);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const results = [];
  for (const monitor of (data ?? []) as (Monitor & { user_id: string })[]) {
    try {
      const { newCount } = await runMonitor(supabase, monitor.user_id, monitor);
      results.push({ monitor: monitor.label, newCount });
    } catch (err) {
      results.push({ monitor: monitor.label, error: err instanceof Error ? err.message : "erro" });
    }
  }
  return Response.json({ ran: results.length, results });
}
