import type { NextRequest } from "next/server";
import { withUser } from "@/lib/api";
import { applyFilters, parseFilters } from "@/lib/lead-filters";
import { STATUS_LABEL, type Lead } from "@/lib/types";
import { formatBrPhone, whatsappLink } from "@/lib/phone";

const COLUMNS: [string, (l: Lead) => string | number | null][] = [
  ["Nome", (l) => l.name],
  ["Categoria", (l) => l.category],
  ["Status", (l) => STATUS_LABEL[l.status]],
  ["Nota", (l) => l.score],
  ["Telefone", (l) => formatBrPhone(l.phone)],
  ["WhatsApp", (l) => whatsappLink(l.phone)],
  ["E-mail", (l) => l.email],
  ["Site", (l) => l.website],
  ["Instagram", (l) => (l.instagram ? `https://instagram.com/${l.instagram}` : null)],
  ["Cidade", (l) => l.city],
  ["UF", (l) => l.state],
  ["Endereço", (l) => l.address],
  ["Nota Google", (l) => l.rating],
  ["Avaliações", (l) => l.reviews_count],
  ["CNPJ", (l) => l.cnpj],
  ["Aberta em", (l) => l.opened_at],
  ["Sinais", (l) => l.signals.filter((s) => s.kind === "dor").map((s) => s.label).join(" | ")],
  ["Diagnóstico", (l) => l.diagnosis],
  ["Mensagem WhatsApp", (l) => l.pitch_whatsapp],
  ["Google Maps", (l) => l.maps_url],
  ["Notas", (l) => l.notes],
];

function cell(value: string | number | null): string {
  if (value == null) return "";
  let text = String(value);
  // Evita que o Excel interprete o conteúdo como fórmula.
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export async function GET(request: NextRequest) {
  return withUser(async ({ supabase }) => {
    const filters = parseFilters(Object.fromEntries(request.nextUrl.searchParams));
    const { data, error } = await applyFilters(supabase.from("leads").select("*"), filters).limit(5000);
    if (error) throw new Error(error.message);

    const rows = (data as Lead[]).map((lead) => COLUMNS.map(([, get]) => cell(get(lead))).join(";"));
    // BOM + ponto e vírgula: abre direto no Excel em português.
    const csv = "﻿" + [COLUMNS.map(([title]) => title).join(";"), ...rows].join("\r\n");

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="leads-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  });
}
