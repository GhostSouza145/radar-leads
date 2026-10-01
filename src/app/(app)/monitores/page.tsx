import Link from "next/link";
import { requireUser } from "@/lib/supabase/server";
import type { Monitor } from "@/lib/types";
import { MonitorList } from "./monitor-list";

export default async function MonitoresPage() {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.from("monitors").select("*").order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const monitors = (data ?? []) as Monitor[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Monitores</h1>
        <p className="page-sub">
          Buscas que se repetem sozinhas uma vez por dia (por volta das 7h) e guardam só o que
          apareceu de novo. Crie um monitor pelo botão &quot;Monitorar esta busca&quot; no{" "}
          <Link href="/radar" className="text-accent hover:underline">Radar</Link> ou em{" "}
          <Link href="/empresas-novas" className="text-accent hover:underline">Empresas novas</Link>.
        </p>
      </div>
      <MonitorList initialMonitors={monitors} />
    </div>
  );
}
