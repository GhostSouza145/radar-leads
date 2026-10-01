"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BellPlus, Check, LoaderCircle, Search, X } from "lucide-react";
import type { CnpjSearchParams, Lead } from "@/lib/types";
import { createMonitor } from "@/app/actions";
import { LeadsTable } from "@/components/leads-table";

type Pair = [id: string, name: string];

const UFS = [
  "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT", "PA",
  "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO",
];

const PERIODS = [30, 60, 90, 180, 365];

const plain = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function EmpresasNovasClient() {
  const [municipios, setMunicipios] = useState<Record<string, Pair[]>>({});
  const [cnaes, setCnaes] = useState<Pair[]>([]);
  const [uf, setUf] = useState("SP");
  const [municipio, setMunicipio] = useState("");
  const [cnaeQuery, setCnaeQuery] = useState("");
  const [cnae, setCnae] = useState<Pair | null>(null);
  const [days, setDays] = useState(90);

  const [running, setRunning] = useState(false);
  const [scanned, setScanned] = useState(0);
  const [finished, setFinished] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [lastParams, setLastParams] = useState<CnpjSearchParams | null>(null);
  const [monitor, setMonitor] = useState<"idle" | "saving" | "saved">("idle");
  const stop = useRef(false);

  useEffect(() => {
    fetch("/data/municipios.json").then((r) => r.json()).then(setMunicipios).catch(() => {});
    fetch("/data/cnaes.json").then((r) => r.json()).then(setCnaes).catch(() => {});
  }, []);

  const cnaeMatches = useMemo(() => {
    const terms = plain(cnaeQuery).split(/\s+/).filter(Boolean);
    if (!terms.length) return [];
    return cnaes
      .filter(([id, name]) => {
        const hay = `${id} ${plain(name)}`;
        return terms.every((t) => hay.includes(t));
      })
      .slice(0, 8);
  }, [cnaes, cnaeQuery]);

  const cities = municipios[uf] ?? [];

  async function scan(e: React.FormEvent) {
    e.preventDefault();
    const city = cities.find(([id]) => id === municipio);
    if (!city || !cnae) return setError("Escolha a cidade e a atividade.");

    const params: CnpjSearchParams = {
      uf, municipio, municipioNome: city[1], cnae: cnae[0], cnaeDescricao: cnae[1], days,
    };
    stop.current = false;
    setRunning(true);
    setFinished(false);
    setError(null);
    setLeads([]);
    setScanned(0);
    setLastParams(params);
    setMonitor("idle");

    let cursor: string | null = null;
    let searchId: string | null = null;
    try {
      do {
        const res = await fetch("/api/search/cnpj", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ params, cursor, searchId }),
        });
        const body = (await res.json()) as {
          leads?: Lead[]; scanned?: number; cursor?: string | null; searchId?: string; error?: string;
        };
        if (!res.ok || !body.leads) throw new Error(body.error ?? "A varredura falhou.");
        const batch = body.leads;
        setLeads((current) => [...current, ...batch.filter((l) => !current.some((c) => c.id === l.id))]);
        setScanned((n) => n + (body.scanned ?? 0));
        cursor = body.cursor ?? null;
        searchId = body.searchId ?? searchId;
      } while (cursor && !stop.current);
      setFinished(!cursor);
    } catch (err) {
      setError(err instanceof Error ? err.message : "A varredura falhou.");
    } finally {
      setRunning(false);
    }
  }

  async function saveMonitor() {
    if (!lastParams) return;
    setMonitor("saving");
    const result = await createMonitor("cnpj", lastParams);
    if (result.ok) setMonitor("saved");
    else {
      setMonitor("idle");
      setError(result.error ?? "Não foi possível criar o monitor.");
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={scan} className="card space-y-3 p-4">
        <div className="grid gap-3 md:grid-cols-[auto_1fr_auto]">
          <div>
            <label className="label" htmlFor="uf">Estado</label>
            <select id="uf" className="input" value={uf} onChange={(e) => { setUf(e.target.value); setMunicipio(""); }}>
              {UFS.map((u) => <option key={u}>{u}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="municipio">Cidade</label>
            <select id="municipio" className="input" required value={municipio} onChange={(e) => setMunicipio(e.target.value)}>
              <option value="">{cities.length ? "Escolha a cidade…" : "Carregando…"}</option>
              {cities.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="days">Abertas nos últimos</label>
            <select id="days" className="input" value={days} onChange={(e) => setDays(Number(e.target.value))}>
              {PERIODS.map((d) => <option key={d} value={d}>{d} dias</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="label" htmlFor="cnae">Atividade (CNAE)</label>
          {cnae ? (
            <div className="flex items-center gap-2">
              <span className="badge badge-positivo px-2 py-1 text-xs">{cnae[0]} · {cnae[1]}</span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setCnae(null)}>
                <X className="size-3.5" /> Trocar
              </button>
            </div>
          ) : (
            <>
              <input id="cnae" className="input" value={cnaeQuery} onChange={(e) => setCnaeQuery(e.target.value)}
                placeholder="Digite a atividade: odontológica, restaurante, advocacia, cabeleireiro…" autoComplete="off" />
              {cnaeMatches.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {cnaeMatches.map((c) => (
                    <button key={c[0]} type="button" className="btn btn-sm h-auto py-1 text-left whitespace-normal" onClick={() => setCnae(c)}>
                      {c[1]}
                    </button>
                  ))}
                </div>
              )}
              {cnaeQuery && !cnaeMatches.length && cnaes.length > 0 && (
                <p className="mt-2 text-xs text-muted">Nenhuma atividade com esse termo. Tente outra palavra.</p>
              )}
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button type="submit" className="btn btn-primary" disabled={running || !cnae || !municipio}>
            {running ? <LoaderCircle className="size-4 animate-spin" /> : <Search className="size-4" />}
            {running ? "Varrendo a base…" : "Buscar empresas novas"}
          </button>
          {running && (
            <button type="button" className="btn" onClick={() => (stop.current = true)}>
              <X className="size-4" /> Parar
            </button>
          )}
        </div>
      </form>

      {error && <p className="text-sm text-hot">{error}</p>}

      {(running || scanned > 0) && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm">
              <strong>{scanned.toLocaleString("pt-BR")}</strong> empresas verificadas,{" "}
              <strong className="text-accent">{leads.length}</strong> abertas no período.
              {!running && !finished && " Varredura interrompida."}
            </p>
            {!running && lastParams && (
              <button type="button" className="btn btn-sm ml-auto" onClick={saveMonitor} disabled={monitor !== "idle"}>
                {monitor === "saved" ? <Check className="size-3.5 text-accent" /> : <BellPlus className="size-3.5" />}
                {monitor === "saved" ? "Monitor criado" : "Monitorar esta busca"}
              </button>
            )}
          </div>
          <LeadsTable
            leads={leads}
            onLeadsChange={setLeads}
            emptyText={running ? "Procurando…" : "Nenhuma empresa aberta nesse período para essa atividade e cidade."}
          />
        </div>
      )}
    </div>
  );
}
