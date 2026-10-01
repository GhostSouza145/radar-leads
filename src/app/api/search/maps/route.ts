import { withUser } from "@/lib/api";
import { MapsParamsSchema } from "@/lib/schemas";
import { getSettings } from "@/lib/settings";
import { mapsLabel, runMapsSearch, saveLeads } from "@/lib/leads";

export const maxDuration = 60;

export async function POST(request: Request) {
  return withUser(async ({ supabase, user }) => {
    const params = MapsParamsSchema.parse(await request.json());
    const settings = await getSettings(supabase, user.id);

    const drafts = await runMapsSearch(settings, params);

    const { data: search, error } = await supabase
      .from("searches")
      .insert({ source: "maps", label: mapsLabel(params), params, total_found: drafts.length })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const { leads, newCount } = await saveLeads(supabase, user.id, drafts, search.id);
    await supabase.from("searches").update({ new_leads: newCount }).eq("id", search.id);

    return Response.json({ leads, newCount, total: drafts.length });
  });
}
