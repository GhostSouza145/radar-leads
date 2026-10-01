import "server-only";
import { createAdminClient } from "@/lib/supabase/server";

/** O app é de um dono só: só existe cadastro enquanto não houver nenhuma conta. */
export async function needsSetup(): Promise<boolean> {
  const { data, error } = await createAdminClient().auth.admin.listUsers({ page: 1, perPage: 1 });
  if (error) throw new Error(error.message);
  return data.users.length === 0;
}
