import { scoreLabel, type Signal } from "@/lib/types";

const TEMP_STYLE = {
  quente: "border-hot/30 bg-hot/10 text-hot",
  morno: "border-warm/30 bg-warm/10 text-warm",
  frio: "border-cold/30 bg-cold/10 text-cold",
} as const;

const TEMP_TEXT = { quente: "Quente", morno: "Morno", frio: "Frio" } as const;

export function ScorePill({ score, large = false }: { score: number | null; large?: boolean }) {
  const temp = scoreLabel(score);
  if (!temp) return <span className="text-xs text-muted">—</span>;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium tabular-nums ${TEMP_STYLE[temp]} ${
        large ? "px-3 py-1 text-sm" : "px-2 py-0.5 text-xs"
      }`}
      title={`Chance de compra: ${score}/100`}
    >
      {score}
      <span className="font-normal opacity-80">{TEMP_TEXT[temp]}</span>
    </span>
  );
}

export function SignalBadges({ signals, max }: { signals: Signal[]; max?: number }) {
  const shown = max ? signals.slice(0, max) : signals;
  const hidden = signals.length - shown.length;
  return (
    <div className="flex flex-wrap gap-1">
      {shown.map((s) => (
        <span
          key={s.key}
          title={s.detail}
          className={`badge ${s.kind === "dor" ? "badge-dor" : s.kind === "positivo" ? "badge-positivo" : ""}`}
        >
          {s.label}
        </span>
      ))}
      {hidden > 0 && <span className="badge">+{hidden}</span>}
    </div>
  );
}

export function formatDate(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
