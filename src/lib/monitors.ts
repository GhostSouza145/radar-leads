import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CnpjSearchParams, LeadDraft, MapsSearchParams, Monitor } from "@/lib/types";
import { CnpjParamsSchema, MapsParamsSchema } from "@/lib/schemas";
import { getSettings } from "@/lib/settings";
import { runMapsSearch, saveLeads } from "@/lib/leads";
import { scanNewCompanies } from "@/lib/sources/cnpj";

/** Teto de páginas (1.000 empresas cada) por execução de um monitor de CNPJ. */
const CNPJ_MAX_PAGES = 20;

async function collect(
  supabase: SupabaseClient,
  userId: string,
  monitor: Pick<Monitor, "source" | "params">,
): Promise<LeadDraft[]> {
  if (monitor.source === "maps") {
    const params: MapsSearchParams = MapsParamsSchema.parse(monitor.params);
    return runMapsSearch(await getSettings(supabase, userId), params);
  }
  const params: CnpjSearchParams = CnpjParamsSchema.parse(monitor.params);
  const { leads } = await scanNewCompanies(params, null, CNPJ_MAX_PAGES);
  return leads;
}

/**
 * Repete a busca do monitor e guarda só o que ainda não estava na base.
 * `supabase` pode ser o cliente do usuário ou o service-role (cron).
 */
export async function runMonitor(
  supabase: SupabaseClient,
  userId: string,
  monitor: Pick<Monitor, "id" | "source" | "label" | "params">,
): Promise<{ newCount: number; total: number }> {
  try {
    const drafts = await collect(supabase, userId, monitor);
    const { data: search, error } = await supabase
      .from("searches")
      .insert({
        user_id: userId,
        source: monitor.source,
        label: monitor.label,
        params: monitor.params,
        total_found: drafts.length,
        monitor_id: monitor.id,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const { newCount } = await saveLeads(supabase, userId, drafts, search.id);
    await supabase.from("searches").update({ new_leads: newCount }).eq("id", search.id);
    await supabase
      .from("monitors")
      .update({ last_run_at: new Date().toISOString(), last_new: newCount, last_error: null })
      .eq("id", monitor.id);
    return { newCount, total: drafts.length };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro inesperado";
    await supabase
      .from("monitors")
      .update({ last_run_at: new Date().toISOString(), last_error: message })
      .eq("id", monitor.id);
    throw err;
  }
}
