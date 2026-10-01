import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY, SUPABASE_URL } from "./env";

/** Cliente com a sessão do usuário (respeita RLS). */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components não podem gravar cookies; o proxy renova a sessão.
        }
      },
    },
  });
}

/** Cliente service-role (ignora RLS). Só para setup inicial e cron. */
export function createAdminClient() {
  return createSupabaseClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new UnauthorizedError();
  return { supabase, user };
}

export class UnauthorizedError extends Error {
  constructor() {
    super("Não autenticado");
  }
}
