import { STATUSES, type LeadStatus } from "@/lib/types";

export const PAGE_SIZE = 50;

export interface LeadFilters {
  q?: string;
  status?: LeadStatus;
  temp?: "quente" | "morno" | "frio";
  source?: "maps" | "cnpj" | "manual";
  site?: "sem" | "com";
  analise?: "sim" | "nao";
  busca?: string;
  sort: "recentes" | "nota" | "avaliacoes";
  page: number;
}

type RawParams = Record<string, string | string[] | undefined>;

function one<T extends string>(raw: RawParams, key: string, allowed: readonly T[]): T | undefined {
  const value = raw[key];
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}

export function parseFilters(raw: RawParams): LeadFilters {
  const q = typeof raw.q === "string" ? raw.q.trim().slice(0, 80) : "";
  const busca = typeof raw.busca === "string" && /^[0-9a-f-]{36}$/.test(raw.busca) ? raw.busca : undefined;
  return {
    q: q || undefined,
    status: one(raw, "status", STATUSES),
    temp: one(raw, "temp", ["quente", "morno", "frio"] as const),
    source: one(raw, "source", ["maps", "cnpj", "manual"] as const),
    site: one(raw, "site", ["sem", "com"] as const),
    analise: one(raw, "analise", ["sim", "nao"] as const),
    busca,
    sort: one(raw, "sort", ["recentes", "nota", "avaliacoes"] as const) ?? "recentes",
    page: Math.max(1, Number(typeof raw.page === "string" ? raw.page : 1) || 1),
  };
}

// O tipo do query builder do Supabase é recursivo demais para anotar aqui.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyFilters<Q extends Record<string, any>>(query: Q, f: LeadFilters): Q {
  let q = query;
  if (f.q) q = q.ilike("name", `%${f.q.replace(/[%_\\]/g, "\\$&")}%`);
  if (f.status) q = q.eq("status", f.status);
  if (f.source) q = q.eq("source", f.source);
  if (f.busca) q = q.eq("search_id", f.busca);
  if (f.site === "sem") q = q.is("website", null);
  if (f.site === "com") q = q.not("website", "is", null);
  if (f.analise === "sim") q = q.not("analyzed_at", "is", null);
  if (f.analise === "nao") q = q.is("analyzed_at", null);
  if (f.temp === "quente") q = q.gte("score", 70);
  if (f.temp === "morno") q = q.gte("score", 45).lt("score", 70);
  if (f.temp === "frio") q = q.lt("score", 45);

  if (f.sort === "nota") q = q.order("score", { ascending: false, nullsFirst: false });
  if (f.sort === "avaliacoes") q = q.order("reviews_count", { ascending: false, nullsFirst: false });
  return q.order("created_at", { ascending: false }).order("id");
}
