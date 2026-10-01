import type { NextRequest } from "next/server";
import { BadRequest, withUser } from "@/lib/api";
import { getSettings } from "@/lib/settings";
import { normalizeUrl } from "@/lib/analyze/site";

/** Envia o lead para o webhook configurado (Make, Zapier, n8n, CRM...). */
export async function POST(_request: NextRequest, ctx: RouteContext<"/api/leads/[id]/webhook">) {
  return withUser(async ({ supabase, user }) => {
    const { id } = await ctx.params;
    const settings = await getSettings(supabase, user.id);
    const url = settings.webhook_url ? normalizeUrl(settings.webhook_url) : null;
    if (!url) throw new BadRequest("Cadastre a URL do webhook em Configurações.");

    const { data: lead } = await supabase.from("leads").select("*").eq("id", id).maybeSingle();
    if (!lead) throw new BadRequest("Lead não encontrado.");

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: "lead", lead }),
      signal: AbortSignal.timeout(15_000),
    }).catch(() => null);
    if (!res?.ok) {
      throw new BadRequest(`O webhook não aceitou o envio${res ? ` (HTTP ${res.status})` : ""}.`);
    }
    return Response.json({ ok: true });
  });
}
