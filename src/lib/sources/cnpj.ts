import "server-only";
import type { CnpjSearchParams, LeadDraft } from "@/lib/types";

const API = "https://minhareceita.org";
const PAGE_SIZE = 1000;

interface Empresa {
  cnpj: string;
  razao_social: string;
  nome_fantasia: string | null;
  descricao_situacao_cadastral: string;
  data_inicio_atividade: string;
  cnae_fiscal_descricao: string;
  descricao_tipo_de_logradouro: string | null;
  logradouro: string | null;
  numero: string | null;
  bairro: string | null;
  municipio: string | null;
  uf: string | null;
  cep: string | null;
  ddd_telefone_1: string | null;
  ddd_telefone_2: string | null;
  email: string | null;
  porte: string | null;
  capital_social: number | null;
  opcao_pelo_mei: boolean | null;
  qsa: { nome_socio: string; qualificacao_socio: string }[] | null;
}

function titleCase(text: string): string {
  return text
    .toLowerCase()
    .replace(/(^|[\s\-/.(])([a-zà-ú])/g, (_, sep: string, ch: string) => sep + ch.toUpperCase())
    .replace(/\b(Ltda|Me|Epp|Sa|S\/a|Eireli)\b\.?/g, (m) => m.toUpperCase());
}

function toDraft(e: Empresa): LeadDraft {
  const street = [e.descricao_tipo_de_logradouro, e.logradouro].filter(Boolean).join(" ");
  const address = [
    [street, e.numero].filter(Boolean).join(", "),
    e.bairro,
    e.municipio && e.uf ? `${e.municipio} - ${e.uf}` : null,
  ]
    .filter(Boolean)
    .join(" - ");
  return {
    source: "cnpj",
    external_id: e.cnpj,
    cnpj: e.cnpj,
    name: titleCase(e.nome_fantasia?.trim() || e.razao_social),
    category: e.cnae_fiscal_descricao,
    address: address ? titleCase(address).replace(/ - ([A-Za-z]{2})$/, (_, uf: string) => ` - ${uf.toUpperCase()}`) : null,
    city: e.municipio ? titleCase(e.municipio) : null,
    state: e.uf,
    phone: e.ddd_telefone_1 || e.ddd_telefone_2 || null,
    email: e.email?.toLowerCase() || null,
    opened_at: e.data_inicio_atividade,
    extra: {
      razao_social: e.razao_social,
      porte: e.porte,
      capital_social: e.capital_social,
      mei: e.opcao_pelo_mei === true,
      socios: (e.qsa ?? []).map((s) => titleCase(s.nome_socio)),
    },
  };
}

export interface CnpjScanResult {
  leads: LeadDraft[];
  scanned: number;
  /** null quando a base daquele filtro acabou. */
  cursor: string | null;
}

/**
 * A API não filtra por data de abertura, então varremos as empresas do
 * CNAE + município e filtramos aqui. `pages` limita o trabalho por chamada.
 */
export async function scanNewCompanies(
  params: Pick<CnpjSearchParams, "uf" | "municipio" | "cnae" | "days">,
  cursor: string | null,
  pages = 4,
): Promise<CnpjScanResult> {
  const cutoff = new Date(Date.now() - params.days * 86_400_000).toISOString().slice(0, 10);
  const leads: LeadDraft[] = [];
  let scanned = 0;
  let next = cursor;

  for (let i = 0; i < pages; i++) {
    const url = new URL(API);
    url.searchParams.set("uf", params.uf);
    url.searchParams.set("municipio", params.municipio);
    url.searchParams.set("cnae_fiscal", params.cnae);
    url.searchParams.set("limit", String(PAGE_SIZE));
    if (next) url.searchParams.set("cursor", next);

    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Base de CNPJ respondeu ${res.status}`);
    const page = (await res.json()) as { data: Empresa[]; cursor?: string | number | null };

    scanned += page.data.length;
    for (const e of page.data) {
      if (e.descricao_situacao_cadastral === "ATIVA" && e.data_inicio_atividade >= cutoff) {
        leads.push(toDraft(e));
      }
    }

    next = page.data.length === PAGE_SIZE && page.cursor ? String(page.cursor) : null;
    if (!next) break;
  }

  return { leads, scanned, cursor: next };
}

export async function baseUpdatedAt(): Promise<string | null> {
  try {
    const res = await fetch(`${API}/updated`, { next: { revalidate: 86_400 } });
    const data = (await res.json()) as { message?: string };
    return data.message ?? null;
  } catch {
    return null;
  }
}
