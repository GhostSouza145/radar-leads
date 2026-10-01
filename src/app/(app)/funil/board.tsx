"use client";

import { useState } from "react";
import Link from "next/link";
import { STATUSES, STATUS_LABEL, type Lead, type LeadStatus } from "@/lib/types";
import { formatBrPhone } from "@/lib/phone";
import { setLeadsStatus } from "@/app/actions";
import { ScorePill } from "@/components/lead-bits";

export type BoardLead = Pick<Lead, "id" | "name" | "category" | "city" | "state" | "phone" | "score" | "status" | "updated_at">;

export function Board({ initialLeads, totals }: { initialLeads: BoardLead[]; totals: Record<string, number> }) {
  const [leads, setLeads] = useState(initialLeads);
  const [counts, setCounts] = useState(totals);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<LeadStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function move(id: string, status: LeadStatus) {
    const lead = leads.find((l) => l.id === id);
    if (!lead || lead.status === status) return;
    const previous = lead.status;
    const apply = (from: LeadStatus, to: LeadStatus) => {
      setLeads((current) => current.map((l) => (l.id === id ? { ...l, status: to } : l)));
      setCounts((c) => ({ ...c, [from]: (c[from] ?? 1) - 1, [to]: (c[to] ?? 0) + 1 }));
    };
    apply(previous, status);
    const result = await setLeadsStatus([id], status);
    if (!result.ok) {
      apply(status, previous);
      setError(result.error ?? "Não foi possível mover o lead.");
    }
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-hot">{error}</p>}
      <div className="flex gap-3 overflow-x-auto pb-4">
        {STATUSES.map((status) => {
          const column = leads.filter((l) => l.status === status);
          return (
            <section
              key={status}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(status);
              }}
              onDragLeave={() => setOver((o) => (o === status ? null : o))}
              onDrop={(e) => {
                e.preventDefault();
                setOver(null);
                move(e.dataTransfer.getData("text/plain"), status);
              }}
              className={`flex w-64 shrink-0 flex-col rounded-xl border bg-panel transition-colors ${
                over === status ? "border-accent/60" : "border-line"
              }`}
            >
              <header className="flex items-center justify-between px-3 py-2.5 text-sm font-medium">
                {STATUS_LABEL[status]}
                <span className="badge tabular-nums">{counts[status] ?? 0}</span>
              </header>
              <div className="flex min-h-24 flex-col gap-2 px-2 pb-2">
                {column.map((lead) => (
                  <article
                    key={lead.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", lead.id);
                      e.dataTransfer.effectAllowed = "move";
                      setDragging(lead.id);
                    }}
                    onDragEnd={() => setDragging(null)}
                    className={`cursor-grab rounded-lg border border-line bg-raised p-2.5 active:cursor-grabbing ${
                      dragging === lead.id ? "opacity-40" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <Link href={`/leads/${lead.id}`} className="text-sm leading-snug font-medium hover:text-accent hover:underline">
                        {lead.name}
                      </Link>
                      <ScorePill score={lead.score} />
                    </div>
                    <p className="mt-1 truncate text-xs text-muted">
                      {[lead.category, lead.city].filter(Boolean).join(" · ")}
                    </p>
                    {lead.phone && <p className="mt-1 text-xs text-muted tabular-nums">{formatBrPhone(lead.phone)}</p>}
                    {/* Sem arrastar (celular): troca pelo seletor. */}
                    <select
                      className="input mt-2 h-7 text-xs md:hidden"
                      value={lead.status}
                      onChange={(e) => move(lead.id, e.target.value as LeadStatus)}
                      aria-label={`Mover ${lead.name}`}
                    >
                      {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                    </select>
                  </article>
                ))}
                {!column.length && <p className="px-1 py-4 text-center text-xs text-muted">Vazio</p>}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
