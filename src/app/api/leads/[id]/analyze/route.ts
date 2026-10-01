import type { NextRequest } from "next/server";
import { BadRequest, withUser } from "@/lib/api";
import { getSettings } from "@/lib/settings";
import { analyzeLead, rewritePitch } from "@/lib/analyze";
import type { Lead } from "@/lib/types";

export const maxDuration = 60;

/** `?only=pitch` reescreve só a mensagem, sem visitar o site de novo. */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/leads/[id]/analyze">) {
  return withUser(async ({ supabase, user }) => {
    const { id } = await ctx.params;
    const onlyPitch = request.nextUrl.searchParams.get("only") === "pitch";

    const { data, error } = await supabase.from("leads").select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new BadRequest("Lead não encontrado.");
    const lead = data as Lead;

    const settings = await getSettings(supabase, user.id);
    const { update, warning } =
      onlyPitch && lead.analyzed_at ? await rewritePitch(lead, settings) : await analyzeLead(lead, settings);

    const { data: saved, error: saveError } = await supabase
      .from("leads")
      .update({ ...update, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single();
    if (saveError) throw new Error(saveError.message);

    return Response.json({ lead: saved, warning });
  });
}
