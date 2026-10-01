import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CnpjSearchParams, Lead, LeadDraft, MapsSearchParams, Settings } from "@/lib/types";
import { searchGooglePlaces, MapsProviderError } from "@/lib/sources/google-places";
import { searchSerper } from "@/lib/sources/serper";

const CHUNK = 100;

/**
 * Salva os leads sem sobrescrever os que já existem (a análise e o status
 * feitos antes são preservados). Devolve todos os leads da busca, já com id.
 */
export async function saveLeads(
  supabase: SupabaseClient,
  userId: string,
  drafts: LeadDraft[],
  searchId: string | null,
): Promise<{ leads: Lead[]; newCount: number }> {
  if (!drafts.length) return { leads: [], newCount: 0 };

  let newCount = 0;
  const leads: Lead[] = [];

  for (let i = 0; i < drafts.length; i += CHUNK) {
    const chunk = drafts.slice(i, i + CHUNK);
    const rows = chunk.map((d) => ({ ...d, user_id: userId, search_id: searchId }));

    const { data: inserted, error } = await supabase
      .from("leads")
      .upsert(rows, { onConflict: "user_id,source,external_id", ignoreDuplicates: true })
      .select("id");
    if (error) throw new Error(`Erro ao salvar leads: ${error.message}`);
    newCount += inserted?.length ?? 0;

    const { data: saved, error: readError } = await supabase
      .from("leads")
      .select("*")
      .eq("user_id", userId)
      .eq("source", chunk[0].source)
      .in("external_id", chunk.map((d) => d.external_id));
    if (readError) throw new Error(`Erro ao ler leads: ${readError.message}`);
    leads.push(...((saved ?? []) as Lead[]));
  }

  return { leads, newCount };
}

export async function runMapsSearch(settings: Settings, params: MapsSearchParams): Promise<LeadDraft[]> {
  if (settings.maps_provider === "serper") {
    if (!settings.serper_key) throw new MapsProviderError("Cadastre a chave do Serper em Configurações.");
    return searchSerper(settings.serper_key, params);
  }
  if (!settings.google_places_key) {
    throw new MapsProviderError("Cadastre a chave do Google Places em Configurações.");
  }
  return searchGooglePlaces(settings.google_places_key, params);
}

export function mapsLabel(p: MapsSearchParams): string {
  return `${p.niche} em ${p.location}`;
}

export function cnpjLabel(p: CnpjSearchParams): string {
  return `${p.cnaeDescricao} em ${p.municipioNome}/${p.uf} (últimos ${p.days} dias)`;
}
