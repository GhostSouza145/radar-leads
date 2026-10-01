import Link from "next/link";
import { ChevronLeft, ChevronRight, Download, Plus } from "lucide-react";
import { requireUser } from "@/lib/supabase/server";
import { applyFilters, PAGE_SIZE, parseFilters } from "@/lib/lead-filters";
import { STATUSES, STATUS_LABEL, type Lead } from "@/lib/types";
import { LeadsTableStateful } from "@/components/leads-table";

export default async function LeadsPage({ searchParams }: PageProps<"/leads">) {
  const raw = await searchParams;
  const filters = parseFilters(raw);
  const { supabase } = await requireUser();

  const from = (filters.page - 1) * PAGE_SIZE;
  const { data, count, error } = await applyFilters(
    supabase.from("leads").select("*", { count: "exact" }),
    filters,
  ).range(from, from + PAGE_SIZE - 1);
  if (error) throw new Error(error.message);

  const leads = (data ?? []) as Lead[];
  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string" && value && key !== "page") query.set(key, value);
  }
  const pageHref = (page: number) => `/leads?${new URLSearchParams({ ...Object.fromEntries(query), page: String(page) })}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start gap-3">
        <div>
          <h1 className="page-title">Leads</h1>
          <p className="page-sub">{total.toLocaleString("pt-BR")} lead(s) com os filtros atuais.</p>
        </div>
        <div className="ml-auto flex gap-2">
          <a href={`/api/leads/export?${query}`} className="btn">
            <Download className="size-4" /> Exportar CSV
          </a>
          <Link href="/leads/novo" className="btn btn-primary">
            <Plus className="size-4" /> Novo lead
          </Link>
        </div>
      </div>

      <form className="card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-9" action="/leads">
        {filters.busca && <input type="hidden" name="busca" value={filters.busca} />}
        <div className="sm:col-span-2">
          <label className="label" htmlFor="q">Nome</label>
          <input id="q" name="q" className="input" defaultValue={filters.q} placeholder="Buscar pelo nome" />
        </div>
        <Select name="status" label="Status" value={filters.status} options={STATUSES.map((s) => [s, STATUS_LABEL[s]])} />
        <Select name="temp" label="Temperatura" value={filters.temp}
          options={[["quente", "Quente (70+)"], ["morno", "Morno (45–69)"], ["frio", "Frio (até 44)"]]} />
        <Select name="site" label="Site" value={filters.site} options={[["sem", "Sem site"], ["com", "Com site"]]} />
        <Select name="source" label="Origem" value={filters.source}
          options={[["maps", "Google Maps"], ["cnpj", "Empresas novas"], ["manual", "Manual"]]} />
        <Select name="analise" label="Análise" value={filters.analise} options={[["sim", "Analisados"], ["nao", "Não analisados"]]} />
        <div className="sm:col-span-2">
          <label className="label" htmlFor="sort">Ordenar por</label>
          <div className="flex gap-2">
            <select id="sort" name="sort" className="input" defaultValue={filters.sort}>
              <option value="recentes">Mais recentes</option>
              <option value="nota">Maior nota</option>
              <option value="avaliacoes">Mais avaliações</option>
            </select>
            <button type="submit" className="btn btn-primary">Filtrar</button>
          </div>
        </div>
      </form>

      {filters.busca && (
        <p className="text-sm text-muted">
          Mostrando só os leads de uma busca. <Link href="/leads" className="text-accent hover:underline">Ver todos</Link>
        </p>
      )}

      <LeadsTableStateful
        key={`${query}|${filters.page}`}
        initialLeads={leads}
        emptyText="Nenhum lead encontrado. Faça uma busca no Radar ou ajuste os filtros."
      />

      {pages > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          {filters.page > 1 ? (
            <Link href={pageHref(filters.page - 1)} className="btn btn-sm"><ChevronLeft className="size-4" /> Anterior</Link>
          ) : <span />}
          <span className="text-muted">Página {filters.page} de {pages}</span>
          {filters.page < pages ? (
            <Link href={pageHref(filters.page + 1)} className="btn btn-sm">Próxima <ChevronRight className="size-4" /></Link>
          ) : <span />}
        </div>
      )}
    </div>
  );
}

function Select({
  name,
  label,
  value,
  options,
}: {
  name: string;
  label: string;
  value: string | undefined;
  options: (readonly [string, string])[];
}) {
  return (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <select id={name} name={name} className="input" defaultValue={value ?? ""}>
        <option value="">Todos</option>
        {options.map(([v, text]) => <option key={v} value={v}>{text}</option>)}
      </select>
    </div>
  );
}
