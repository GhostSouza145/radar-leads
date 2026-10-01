import Link from "next/link";
import { Building2, CircleCheck, Radar } from "lucide-react";
import { requireUser } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings";
import { STATUSES, STATUS_LABEL, type Lead, type SearchRecord } from "@/lib/types";
import { ScorePill, SignalBadges, formatDateTime } from "@/components/lead-bits";

const STATUS_COLOR: Record<string, string> = {
  novo: "bg-muted/50",
  contatado: "bg-cold",
  respondeu: "bg-warm",
  reuniao: "bg-accent",
  fechado: "bg-accent-strong",
  perdido: "bg-hot/60",
};

export default async function DashboardPage() {
  const { supabase, user } = await requireUser();
  const count = () => supabase.from("leads").select("id", { count: "exact", head: true });

  const [settings, total, hot, pending, byStatus, next, searches] = await Promise.all([
    getSettings(supabase, user.id),
    count(),
    count().gte("score", 70),
    count().is("analyzed_at", null),
    Promise.all(STATUSES.map((s) => count().eq("status", s))),
    supabase
      .from("leads")
      .select("*")
      .eq("status", "novo")
      .not("analyzed_at", "is", null)
      .order("score", { ascending: false, nullsFirst: false })
      .limit(8),
    supabase.from("searches").select("*").order("created_at", { ascending: false }).limit(6),
  ]);

  const statusCounts = STATUSES.map((s, i) => ({ status: s, n: byStatus[i].count ?? 0 }));
  const totalLeads = total.count ?? 0;
  const contacted = totalLeads - (statusCounts[0]?.n ?? 0);
  const won = statusCounts.find((s) => s.status === "fechado")?.n ?? 0;

  const mapsReady = settings.maps_provider === "serper" ? Boolean(settings.serper_key) : Boolean(settings.google_places_key);
  const steps = [
    { done: Boolean(settings.offer), text: "Descrever o que você vende", href: "/configuracoes" },
    { done: mapsReady, text: "Cadastrar a chave do Google Maps", href: "/configuracoes#fontes" },
    { done: Boolean(settings.anthropic_key), text: "Cadastrar a chave de IA (opcional)", href: "/configuracoes" },
    { done: totalLeads > 0, text: "Fazer a primeira busca", href: "/radar" },
  ];
  const onboarding = steps.some((s) => !s.done && !s.text.includes("opcional"));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start gap-3">
        <div>
          <h1 className="page-title">Painel</h1>
          <p className="page-sub">Como está a sua prospecção.</p>
        </div>
        <div className="ml-auto flex gap-2">
          <Link href="/empresas-novas" className="btn"><Building2 className="size-4" /> Empresas novas</Link>
          <Link href="/radar" className="btn btn-primary"><Radar className="size-4" /> Nova busca</Link>
        </div>
      </div>

      {onboarding && (
        <section className="card p-5">
          <h2 className="text-sm font-semibold">Para começar</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {steps.map((step) => (
              <li key={step.text} className="flex items-center gap-2">
                <CircleCheck className={`size-4 ${step.done ? "text-accent" : "text-line"}`} />
                {step.done ? (
                  <span className="text-muted line-through">{step.text}</span>
                ) : (
                  <Link href={step.href} className="hover:text-accent hover:underline">{step.text}</Link>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Leads na base" value={totalLeads} href="/leads" />
        <Stat label="Quentes (nota 70+)" value={hot.count ?? 0} href="/leads?temp=quente&sort=nota" tone="text-hot" />
        <Stat label="Aguardando análise" value={pending.count ?? 0} href="/leads?analise=nao" />
        <Stat label="Já abordados" value={contacted} href="/funil" />
        <Stat label="Fechados" value={won} href="/leads?status=fechado" tone="text-accent" />
      </div>

      {totalLeads > 0 && (
        <section className="card p-5">
          <h2 className="text-sm font-semibold">Funil</h2>
          <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-raised">
            {statusCounts.map(({ status, n }) =>
              n > 0 ? (
                <div key={status} className={STATUS_COLOR[status]} style={{ width: `${(n / totalLeads) * 100}%` }}
                  title={`${STATUS_LABEL[status]}: ${n}`} />
              ) : null,
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
            {statusCounts.map(({ status, n }) => (
              <span key={status} className="inline-flex items-center gap-1.5">
                <span className={`size-2 rounded-full ${STATUS_COLOR[status]}`} />
                {STATUS_LABEL[status]} <strong className="text-ink tabular-nums">{n}</strong>
              </span>
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <section className="card p-5">
          <h2 className="text-sm font-semibold">Próximos a abordar</h2>
          <p className="mt-1 text-xs text-muted">Leads analisados com as maiores notas e ainda sem contato.</p>
          <ul className="mt-3 divide-y divide-line/60">
            {((next.data ?? []) as Lead[]).map((lead) => (
              <li key={lead.id} className="flex items-start gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <Link href={`/leads/${lead.id}`} className="text-sm font-medium hover:text-accent hover:underline">
                    {lead.name}
                  </Link>
                  <div className="mt-1">
                    <SignalBadges signals={lead.signals.filter((s) => s.kind === "dor")} max={3} />
                  </div>
                </div>
                <ScorePill score={lead.score} />
              </li>
            ))}
            {!next.data?.length && (
              <li className="py-4 text-sm text-muted">Analise alguns leads para ver aqui os melhores para abordar.</li>
            )}
          </ul>
        </section>

        <section className="card p-5">
          <h2 className="text-sm font-semibold">Buscas recentes</h2>
          <ul className="mt-3 divide-y divide-line/60">
            {((searches.data ?? []) as SearchRecord[]).map((search) => (
              <li key={search.id} className="py-2.5">
                <Link href={`/leads?busca=${search.id}`} className="text-sm hover:text-accent hover:underline">
                  {search.label}
                </Link>
                <p className="text-xs text-muted">
                  {formatDateTime(search.created_at)} · {search.total_found} encontrados · {search.new_leads} novos
                  {search.monitor_id && " · monitor"}
                </p>
              </li>
            ))}
            {!searches.data?.length && <li className="py-4 text-sm text-muted">Nenhuma busca feita ainda.</li>}
          </ul>
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value, href, tone = "" }: { label: string; value: number; href: string; tone?: string }) {
  return (
    <Link href={href} className="card p-4 transition-colors hover:border-muted/50">
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${tone}`}>{value.toLocaleString("pt-BR")}</p>
    </Link>
  );
}
