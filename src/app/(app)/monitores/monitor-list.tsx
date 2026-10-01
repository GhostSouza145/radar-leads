"use client";

import { useState } from "react";
import { Building2, LoaderCircle, Pause, Play, Radar, RefreshCw, Trash2 } from "lucide-react";
import type { Monitor } from "@/lib/types";
import { deleteMonitor, toggleMonitor } from "@/app/actions";
import { formatDateTime } from "@/components/lead-bits";

export function MonitorList({ initialMonitors }: { initialMonitors: Monitor[] }) {
  const [monitors, setMonitors] = useState(initialMonitors);
  const [running, setRunning] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const patch = (id: string, changes: Partial<Monitor>) =>
    setMonitors((current) => current.map((m) => (m.id === id ? { ...m, ...changes } : m)));

  async function toggle(monitor: Monitor) {
    patch(monitor.id, { active: !monitor.active });
    const result = await toggleMonitor(monitor.id, !monitor.active);
    if (!result.ok) {
      patch(monitor.id, { active: monitor.active });
      setNotice(result.error ?? "Não foi possível alterar o monitor.");
    }
  }

  async function remove(monitor: Monitor) {
    if (!confirm(`Excluir o monitor "${monitor.label}"? Os leads já encontrados continuam salvos.`)) return;
    const result = await deleteMonitor(monitor.id);
    if (result.ok) setMonitors((current) => current.filter((m) => m.id !== monitor.id));
    else setNotice(result.error ?? "Não foi possível excluir.");
  }

  async function runNow(monitor: Monitor) {
    setRunning(monitor.id);
    setNotice(null);
    try {
      const res = await fetch(`/api/monitors/${monitor.id}/run`, { method: "POST" });
      const body = (await res.json()) as { newCount?: number; error?: string };
      if (!res.ok) throw new Error(body.error ?? "A execução falhou.");
      patch(monitor.id, { last_run_at: new Date().toISOString(), last_new: body.newCount ?? 0, last_error: null });
    } catch (err) {
      const message = err instanceof Error ? err.message : "A execução falhou.";
      patch(monitor.id, { last_run_at: new Date().toISOString(), last_error: message });
    } finally {
      setRunning(null);
    }
  }

  if (!monitors.length) {
    return <div className="card p-8 text-center text-sm text-muted">Nenhum monitor criado ainda.</div>;
  }

  return (
    <div className="space-y-3">
      {notice && <p className="text-sm text-warm">{notice}</p>}
      {monitors.map((monitor) => {
        const Icon = monitor.source === "maps" ? Radar : Building2;
        return (
          <div key={monitor.id} className={`card flex flex-wrap items-center gap-3 p-4 ${monitor.active ? "" : "opacity-60"}`}>
            <Icon className="size-5 shrink-0 text-accent" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{monitor.label}</p>
              <p className="text-xs text-muted">
                {monitor.active ? "Ativo" : "Pausado"}
                {monitor.last_run_at
                  ? ` · última execução em ${formatDateTime(monitor.last_run_at)}`
                  : " · ainda não executou"}
                {monitor.last_run_at && !monitor.last_error && ` · ${monitor.last_new ?? 0} lead(s) novo(s)`}
              </p>
              {monitor.last_error && <p className="mt-0.5 text-xs text-hot">Erro: {monitor.last_error}</p>}
            </div>
            <button type="button" className="btn btn-sm" onClick={() => runNow(monitor)} disabled={running !== null}>
              {running === monitor.id ? <LoaderCircle className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
              Rodar agora
            </button>
            <button type="button" className="btn btn-sm" onClick={() => toggle(monitor)}>
              {monitor.active ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
              {monitor.active ? "Pausar" : "Ativar"}
            </button>
            <button type="button" className="btn btn-sm btn-danger" onClick={() => remove(monitor)} aria-label="Excluir monitor">
              <Trash2 className="size-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
