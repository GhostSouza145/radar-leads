"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import {
  AtSign,
  Globe,
  LoaderCircle,
  Mail,
  MessageCircle,
  Phone,
  Sparkles,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { STATUSES, STATUS_LABEL, type Lead, type LeadStatus } from "@/lib/types";
import { formatBrPhone, isMobile, normalizeBrPhone, whatsappLink } from "@/lib/phone";
import { deleteLeads, setLeadsStatus } from "@/app/actions";
import { ScorePill, SignalBadges, formatDate } from "./lead-bits";

const CONCURRENCY = 3;

interface Props {
  leads: Lead[];
  onLeadsChange: (update: (current: Lead[]) => Lead[]) => void;
  emptyText?: string;
}

/** Wrapper para páginas de servidor: guarda a lista localmente. */
export function LeadsTableStateful({ initialLeads, emptyText }: { initialLeads: Lead[]; emptyText?: string }) {
  const [leads, setLeads] = useState(initialLeads);
  return <LeadsTable leads={leads} onLeadsChange={setLeads} emptyText={emptyText} />;
}

export function LeadsTable({ leads, onLeadsChange, emptyText }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const cancelled = useRef(false);

  const selectedIds = leads.filter((l) => selected.has(l.id)).map((l) => l.id);
  const pending = leads.filter((l) => !l.analyzed_at).map((l) => l.id);
  const allSelected = leads.length > 0 && selectedIds.length === leads.length;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  async function analyzeOne(id: string): Promise<string | null> {
    setBusy((prev) => new Set(prev).add(id));
    try {
      const res = await fetch(`/api/leads/${id}/analyze`, { method: "POST" });
      const body = (await res.json()) as { lead?: Lead; warning?: string; error?: string };
      if (!res.ok || !body.lead) return body.error ?? "Falha ao analisar";
      const updated = body.lead;
      onLeadsChange((current) => current.map((l) => (l.id === id ? updated : l)));
      return body.warning ?? null;
    } catch {
      return "Falha de conexão ao analisar";
    } finally {
      setBusy((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  async function analyzeMany(ids: string[]) {
    if (!ids.length || progress) return;
    cancelled.current = false;
    setNotice(null);
    setProgress({ done: 0, total: ids.length });
    const queue = [...ids];
    const problems: string[] = [];

    const worker = async () => {
      while (queue.length && !cancelled.current) {
        const problem = await analyzeOne(queue.shift()!);
        if (problem) problems.push(problem);
        setProgress((p) => (p ? { ...p, done: p.done + 1 } : p));
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, ids.length) }, worker));

    setProgress(null);
    if (problems.length) {
      const unique = [...new Set(problems)];
      setNotice(`${problems.length} aviso(s): ${unique.slice(0, 2).join(" · ")}`);
    }
  }

  async function changeStatus(ids: string[], status: LeadStatus) {
    onLeadsChange((current) => current.map((l) => (ids.includes(l.id) ? { ...l, status } : l)));
    const result = await setLeadsStatus(ids, status);
    if (!result.ok) setNotice(result.error ?? "Não foi possível mudar o status.");
  }

  async function remove(ids: string[]) {
    if (!confirm(`Excluir ${ids.length} lead(s)? Isso não pode ser desfeito.`)) return;
    const result = await deleteLeads(ids);
    if (!result.ok) return setNotice(result.error ?? "Não foi possível excluir.");
    onLeadsChange((current) => current.filter((l) => !ids.includes(l.id)));
    setSelected(new Set());
  }

  if (!leads.length) {
    return <div className="card p-8 text-center text-sm text-muted">{emptyText ?? "Nenhum lead por aqui ainda."}</div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex min-h-9 flex-wrap items-center gap-2">
        {progress ? (
          <>
            <LoaderCircle className="size-4 animate-spin text-accent" />
            <span className="text-sm">Analisando {progress.done}/{progress.total}…</span>
            <button type="button" className="btn btn-sm" onClick={() => (cancelled.current = true)}>
              <X className="size-3.5" /> Parar
            </button>
          </>
        ) : selectedIds.length ? (
          <>
            <span className="text-sm text-muted">{selectedIds.length} selecionado(s)</span>
            <button type="button" className="btn btn-sm btn-primary" onClick={() => analyzeMany(selectedIds)}>
              <Sparkles className="size-3.5" /> Analisar
            </button>
            <select
              className="input h-7 w-auto text-xs"
              value=""
              onChange={(e) => e.target.value && changeStatus(selectedIds, e.target.value as LeadStatus)}
              aria-label="Mudar status dos selecionados"
            >
              <option value="">Mudar status…</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>{STATUS_LABEL[s]}</option>
              ))}
            </select>
            <button type="button" className="btn btn-sm btn-danger" onClick={() => remove(selectedIds)}>
              <Trash2 className="size-3.5" /> Excluir
            </button>
          </>
        ) : (
          <>
            <span className="text-sm text-muted">{leads.length} lead(s) nesta lista</span>
            {pending.length > 0 && (
              <button type="button" className="btn btn-sm btn-primary" onClick={() => analyzeMany(pending)}>
                <Sparkles className="size-3.5" /> Analisar {pending.length} pendente(s)
              </button>
            )}
          </>
        )}
        {notice && <span className="text-xs text-warm">{notice}</span>}
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-muted">
              <th className="w-9 py-2.5 pl-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={() => setSelected(allSelected ? new Set() : new Set(leads.map((l) => l.id)))}
                  aria-label="Selecionar todos"
                />
              </th>
              <th className="px-3 py-2.5 font-medium">Negócio</th>
              <th className="px-3 py-2.5 font-medium">Contato</th>
              <th className="px-3 py-2.5 font-medium">Google / abertura</th>
              <th className="px-3 py-2.5 font-medium">Sinais</th>
              <th className="px-3 py-2.5 font-medium">Nota</th>
              <th className="px-3 py-2.5 font-medium">Status</th>
              <th className="px-3 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <Row
                key={lead.id}
                lead={lead}
                selected={selected.has(lead.id)}
                busy={busy.has(lead.id)}
                onToggle={() => toggle(lead.id)}
                onAnalyze={() => analyzeOne(lead.id).then((w) => w && setNotice(w))}
                onStatus={(status) => changeStatus([lead.id], status)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Row({
  lead,
  selected,
  busy,
  onToggle,
  onAnalyze,
  onStatus,
}: {
  lead: Lead;
  selected: boolean;
  busy: boolean;
  onToggle: () => void;
  onAnalyze: () => void;
  onStatus: (status: LeadStatus) => void;
}) {
  const phone = normalizeBrPhone(lead.phone);
  const wa = whatsappLink(lead.phone, lead.pitch_whatsapp);
  const pains = lead.signals.filter((s) => s.kind === "dor");

  return (
    <tr className={`border-b border-line/60 last:border-0 ${selected ? "bg-accent/5" : "hover:bg-raised/50"}`}>
      <td className="py-2.5 pl-3 align-top">
        <input type="checkbox" checked={selected} onChange={onToggle} aria-label={`Selecionar ${lead.name}`} />
      </td>
      <td className="max-w-64 px-3 py-2.5 align-top">
        <Link href={`/leads/${lead.id}`} className="font-medium hover:text-accent hover:underline">
          {lead.name}
        </Link>
        <p className="truncate text-xs text-muted">
          {[lead.category, lead.city && lead.state ? `${lead.city}/${lead.state}` : lead.city].filter(Boolean).join(" · ")}
        </p>
      </td>
      <td className="px-3 py-2.5 align-top">
        {phone && <p className="text-xs whitespace-nowrap tabular-nums">{formatBrPhone(phone)}</p>}
        <div className="mt-1 flex items-center gap-2 text-muted">
          {wa && isMobile(phone) && (
            <a href={wa} target="_blank" rel="noreferrer" title="Abrir WhatsApp" className="text-accent hover:opacity-80">
              <MessageCircle className="size-4" />
            </a>
          )}
          {phone && !isMobile(phone) && (
            <a href={`tel:+55${phone}`} title="Ligar (número fixo)" className="hover:text-ink">
              <Phone className="size-4" />
            </a>
          )}
          {lead.website && (
            <a href={lead.website} target="_blank" rel="noreferrer" title={lead.website} className="hover:text-ink">
              <Globe className="size-4" />
            </a>
          )}
          {lead.instagram && (
            <a href={`https://instagram.com/${lead.instagram}`} target="_blank" rel="noreferrer" title={`@${lead.instagram}`} className="hover:text-ink">
              <AtSign className="size-4" />
            </a>
          )}
          {lead.email && (
            <a href={`mailto:${lead.email}`} title={lead.email} className="hover:text-ink">
              <Mail className="size-4" />
            </a>
          )}
          {!phone && !lead.website && !lead.instagram && !lead.email && <span className="text-xs">sem contato</span>}
        </div>
      </td>
      <td className="px-3 py-2.5 align-top text-xs whitespace-nowrap">
        {lead.source === "maps" ? (
          lead.rating != null ? (
            <span className="inline-flex items-center gap-1">
              <Star className="size-3.5 fill-warm text-warm" />
              {lead.rating.toFixed(1)}
              <span className="text-muted">({lead.reviews_count ?? 0})</span>
            </span>
          ) : (
            <span className="text-muted">sem avaliações</span>
          )
        ) : lead.opened_at ? (
          <span className="text-muted">aberta em {formatDate(lead.opened_at)}</span>
        ) : (
          <span className="text-muted">—</span>
        )}
      </td>
      <td className="max-w-72 px-3 py-2.5 align-top">
        {lead.analyzed_at ? (
          pains.length ? <SignalBadges signals={pains} max={3} /> : <span className="text-xs text-muted">nada evidente</span>
        ) : (
          <span className="text-xs text-muted">não analisado</span>
        )}
      </td>
      <td className="px-3 py-2.5 align-top">
        <ScorePill score={lead.score} />
      </td>
      <td className="px-3 py-2.5 align-top">
        <select
          className="input h-7 w-auto text-xs"
          value={lead.status}
          onChange={(e) => onStatus(e.target.value as LeadStatus)}
          aria-label={`Status de ${lead.name}`}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>{STATUS_LABEL[s]}</option>
          ))}
        </select>
      </td>
      <td className="py-2.5 pr-3 text-right align-top">
        <button type="button" className="btn btn-sm" onClick={onAnalyze} disabled={busy}>
          {busy ? <LoaderCircle className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
          {lead.analyzed_at ? "Refazer" : "Analisar"}
        </button>
      </td>
    </tr>
  );
}
