import { requireUser } from "@/lib/supabase/server";
import { STATUSES } from "@/lib/types";
import { Board, type BoardLead } from "./board";

const PER_COLUMN = 100;

export default async function FunilPage() {
  const { supabase } = await requireUser();

  const columns = await Promise.all(
    STATUSES.map((status) =>
      supabase
        .from("leads")
        .select("id, name, category, city, state, phone, score, status, updated_at", { count: "exact" })
        .eq("status", status)
        .order("score", { ascending: false, nullsFirst: false })
        .order("updated_at", { ascending: false })
        .limit(PER_COLUMN),
    ),
  );
  const failed = columns.find((c) => c.error);
  if (failed?.error) throw new Error(failed.error.message);

  const leads = columns.flatMap((c) => (c.data ?? []) as BoardLead[]);
  const totals = Object.fromEntries(STATUSES.map((status, i) => [status, columns[i].count ?? 0]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Funil</h1>
        <p className="page-sub">
          Arraste os cartões entre as colunas conforme a conversa avança. Cada coluna mostra até{" "}
          {PER_COLUMN} leads, os de maior nota primeiro.
        </p>
      </div>
      <Board initialLeads={leads} totals={totals} />
    </div>
  );
}
