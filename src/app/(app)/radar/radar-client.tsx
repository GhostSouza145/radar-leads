"use client";

import { useState } from "react";
import { BellPlus, Check, LoaderCircle, Search } from "lucide-react";
import type { Lead, MapsSearchParams } from "@/lib/types";
import { isMobile, normalizeBrPhone } from "@/lib/phone";
import { createMonitor } from "@/app/actions";
import { LeadsTable } from "@/components/leads-table";

const NICHES = [
  "Dentista", "Clínica de estética", "Academia", "Restaurante", "Pizzaria", "Pet shop",
  "Clínica veterinária", "Advogado", "Contabilidade", "Imobiliária", "Oficina mecânica",
  "Salão de beleza", "Barbearia", "Psicólogo", "Fisioterapia", "Escola de idiomas",
  "Loja de móveis planejados", "Energia solar", "Arquiteto", "Nutricionista",
];

/** [quantidade, profundidade da grade, rótulo] */
const SIZES: [number, 1 | 2 | 3, string][] = [
  [20, 1, "Até 20"],
  [60, 1, "Até 60"],
  [120, 2, "Até 120 (varredura ampla)"],
  [240, 2, "Até 240 (varredura ampla)"],
  [540, 3, "Até 540 (varredura máxima)"],
];

const VIEW_FILTERS = {
  semSite: { label: "Sem site", test: (l: Lead) => !l.website },
  comCelular: { label: "Com celular", test: (l: Lead) => isMobile(normalizeBrPhone(l.phone)) },
  poucasAvaliacoes: { label: "Menos de 20 avaliações", test: (l: Lead) => (l.reviews_count ?? 0) < 20 },
  notaBaixa: { label: "Nota abaixo de 4,3", test: (l: Lead) => l.rating != null && l.rating < 4.3 },
} as const;
type ViewFilter = keyof typeof VIEW_FILTERS;

export function RadarClient({ provider }: { provider: "google" | "serper" }) {
  const [niche, setNiche] = useState("");
  const [location, setLocation] = useState("");
  const [size, setSize] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [summary, setSummary] = useState<{ total: number; newCount: number; params: MapsSearchParams } | null>(null);
  const [filters, setFilters] = useState<Set<ViewFilter>>(new Set());
  const [monitor, setMonitor] = useState<"idle" | "saving" | "saved">("idle");

  const sizes = provider === "serper" ? SIZES.slice(0, 2) : SIZES;

  async function search(e: React.FormEvent) {
    e.preventDefault();
    const [limit, depth] = sizes[size];
    const params: MapsSearchParams = { niche: niche.trim(), location: location.trim(), depth, limit };
    setLoading(true);
    setError(null);
    setMonitor("idle");
    try {
      const res = await fetch("/api/search/maps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      const body = (await res.json()) as { leads?: Lead[]; newCount?: number; total?: number; error?: string };
      if (!res.ok || !body.leads) throw new Error(body.error ?? "A busca falhou.");
      setLeads(body.leads);
      setSummary({ total: body.total ?? body.leads.length, newCount: body.newCount ?? 0, params });
      setFilters(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : "A busca falhou.");
    } finally {
      setLoading(false);
    }
  }

  async function saveMonitor() {
    if (!summary) return;
    setMonitor("saving");
    const result = await createMonitor("maps", summary.params);
    if (result.ok) setMonitor("saved");
    else {
      setMonitor("idle");
      setError(result.error ?? "Não foi possível criar o monitor.");
    }
  }

  const visible = leads.filter((l) => [...filters].every((f) => VIEW_FILTERS[f].test(l)));

  return (
    <div className="space-y-6">
      <form onSubmit={search} className="card grid gap-3 p-4 md:grid-cols-[1fr_1fr_auto_auto] md:items-end">
        <div>
          <label className="label" htmlFor="niche">Nicho</label>
          <input id="niche" className="input" list="niches" required minLength={2} value={niche}
            onChange={(e) => setNiche(e.target.value)} placeholder="Ex.: dentista" />
          <datalist id="niches">
            {NICHES.map((n) => <option key={n} value={n} />)}
          </datalist>
        </div>
        <div>
          <label className="label" htmlFor="location">Cidade ou bairro</label>
          <input id="location" className="input" required minLength={2} value={location}
            onChange={(e) => setLocation(e.target.value)} placeholder="Ex.: Campinas, SP" />
        </div>
        <div>
          <label className="label" htmlFor="size">Quantidade</label>
          <select id="size" className="input" value={size} onChange={(e) => setSize(Number(e.target.value))}>
            {sizes.map(([, , label], i) => <option key={label} value={i}>{label}</option>)}
          </select>
        </div>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? <LoaderCircle className="size-4 animate-spin" /> : <Search className="size-4" />}
          {loading ? "Varrendo…" : "Buscar"}
        </button>
      </form>

      {error && <p className="text-sm text-hot">{error}</p>}

      {summary && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm">
              <strong>{summary.total}</strong> negócios encontrados,{" "}
              <strong className="text-accent">{summary.newCount}</strong> novos na sua base.
            </p>
            <button type="button" className="btn btn-sm ml-auto" onClick={saveMonitor} disabled={monitor !== "idle"}>
              {monitor === "saved" ? <Check className="size-3.5 text-accent" /> : <BellPlus className="size-3.5" />}
              {monitor === "saved" ? "Monitor criado" : "Monitorar esta busca"}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(VIEW_FILTERS) as ViewFilter[]).map((key) => {
              const on = filters.has(key);
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    setFilters((prev) => {
                      const next = new Set(prev);
                      if (!next.delete(key)) next.add(key);
                      return next;
                    })
                  }
                  className={`btn btn-sm ${on ? "border-accent/60 bg-accent/10 text-accent" : ""}`}
                >
                  {VIEW_FILTERS[key].label}
                </button>
              );
            })}
          </div>
          <LeadsTable leads={visible} onLeadsChange={setLeads} emptyText="Nenhum resultado com esses filtros." />
        </div>
      )}
    </div>
  );
}
