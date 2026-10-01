import type { NextRequest } from "next/server";
import { BadRequest, withUser } from "@/lib/api";
import { runMonitor } from "@/lib/monitors";
import type { Monitor } from "@/lib/types";

export const maxDuration = 300;

export async function POST(_request: NextRequest, ctx: RouteContext<"/api/monitors/[id]/run">) {
  return withUser(async ({ supabase, user }) => {
    const { id } = await ctx.params;
    const { data } = await supabase.from("monitors").select("*").eq("id", id).maybeSingle();
    if (!data) throw new BadRequest("Monitor não encontrado.");
    const result = await runMonitor(supabase, user.id, data as Monitor);
    return Response.json(result);
  });
}
