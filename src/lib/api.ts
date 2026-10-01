import "server-only";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { z } from "zod";
import { requireUser, UnauthorizedError } from "@/lib/supabase/server";
import { MapsProviderError } from "@/lib/sources/google-places";

interface Ctx {
  supabase: SupabaseClient;
  user: User;
}

export class BadRequest extends Error {}

/** Autentica, executa e converte erros conhecidos em respostas JSON legíveis. */
export async function withUser(fn: (ctx: Ctx) => Promise<Response>): Promise<Response> {
  try {
    return await fn(await requireUser());
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return Response.json({ error: err.message }, { status: 401 });
    }
    if (err instanceof z.ZodError) {
      return Response.json({ error: "Dados inválidos: " + err.issues.map((i) => i.message).join("; ") }, { status: 400 });
    }
    if (err instanceof BadRequest || err instanceof MapsProviderError) {
      return Response.json({ error: err.message }, { status: 400 });
    }
    console.error(err);
    const message = err instanceof Error ? err.message : "Erro inesperado";
    return Response.json({ error: message }, { status: 500 });
  }
}
