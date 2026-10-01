import { z } from "zod";
import { withUser } from "@/lib/api";
import { CnpjParamsSchema } from "@/lib/schemas";
import { scanNewCompanies } from "@/lib/sources/cnpj";
import { cnpjLabel, saveLeads } from "@/lib/leads";

export const maxDuration = 60;

const BodySchema = z.object({
  params: CnpjParamsSchema,
  cursor: z.string().nullable().default(null),
  searchId: z.string().uuid().nullable().default(null),
});

/**
 * Varre a base em lotes: a tela chama de novo com o `cursor` devolvido até
 * ele vir nulo, mostrando o progresso.
 */
export async function POST(request: Request) {
  return withUser(async ({ supabase, user }) => {
    const { params, cursor, searchId: givenId } = BodySchema.parse(await request.json());

    let searchId = givenId;
    if (!searchId) {
      const { data, error } = await supabase
        .from("searches")
        .insert({ source: "cnpj", label: cnpjLabel(params), params })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      searchId = data.id as string;
    }

    const scan = await scanNewCompanies(params, cursor);
    const { leads, newCount } = await saveLeads(supabase, user.id, scan.leads, searchId);

    const { data: current } = await supabase
      .from("searches")
      .select("total_found, new_leads")
      .eq("id", searchId)
      .single();
    await supabase
      .from("searches")
      .update({
        total_found: (current?.total_found ?? 0) + scan.leads.length,
        new_leads: (current?.new_leads ?? 0) + newCount,
      })
      .eq("id", searchId);

    return Response.json({ leads, newCount, scanned: scan.scanned, cursor: scan.cursor, searchId });
  });
}
