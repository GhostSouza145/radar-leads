import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Settings } from "@/lib/types";
import { DEFAULT_MODEL } from "@/lib/analyze/ai";

/** Configurações do usuário; chaves ausentes caem nas variáveis de ambiente. */
export async function getSettings(supabase: SupabaseClient, userId: string): Promise<Settings> {
  const { data } = await supabase.from("settings").select("*").eq("user_id", userId).maybeSingle();
  const row = (data ?? {}) as Partial<Settings>;
  return {
    user_id: userId,
    seller_name: row.seller_name ?? null,
    company: row.company ?? null,
    offer: row.offer ?? null,
    differentials: row.differentials ?? null,
    tone: row.tone ?? "consultivo",
    cta: row.cta ?? null,
    maps_provider: row.maps_provider ?? "google",
    google_places_key: row.google_places_key || process.env.GOOGLE_PLACES_API_KEY || null,
    serper_key: row.serper_key || process.env.SERPER_API_KEY || null,
    anthropic_key: row.anthropic_key || process.env.ANTHROPIC_API_KEY || null,
    ai_model: row.ai_model || DEFAULT_MODEL,
    webhook_url: row.webhook_url ?? null,
  };
}

export function maskKey(key: string | null): string | null {
  if (!key) return null;
  return key.length <= 8 ? "••••" : `${key.slice(0, 4)}••••${key.slice(-4)}`;
}
