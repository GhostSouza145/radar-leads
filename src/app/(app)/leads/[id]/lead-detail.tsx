"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AtSign,
  Check,
  Copy,
  ExternalLink,
  Globe,
  LoaderCircle,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  RefreshCw,
  Send,
  Sparkles,
  Star,
  Trash2,
} from "lucide-react";
import { STATUSES, STATUS_LABEL, type Lead, type LeadStatus } from "@/lib/types";
import { formatBrPhone, isMobile, normalizeBrPhone, whatsappLink } from "@/lib/phone";
import { deleteLeads, updateLead } from "@/app/actions";
import { ScorePill, SignalBadges, formatDate, formatDateTime } from "@/components/lead-bits";

type Busy = "analyze" | "pitch" | "webhook" | null;

export function LeadDetail({
  initialLead,
  aiEnabled,
  webhookEnabled,
}: {
  initialLead: Lead;
  aiEnabled: boolean;
  webhookEnabled: boolean;
}) {
  const router = useRouter();
  const [lead, setLead] = useState(initialLead);
  const [busy, setBusy] = useState<Busy>(null);
  const [notice, setNotice] = useState<{ kind: "ok" | "warn"; text: string } | null>(null);

  const phone = normalizeBrPhone(lead.phone);
  const site = lead.site_data;
  const ig = lead.instagram_data;
  const socios = Array.isArray(lead.extra.socios) ? (lead.extra.socios as string[]) : [];

  /** Atualiza a tela na hora e grava em segundo plano. */
  async function save(patch: Parameters<typeof updateLead>[1]) {
    setLead((l) => ({ ...l, ...patch }) as Lead);
    const result = await updateLead(lead.id, patch);
    if (!result.ok) setNotice({ kind: "warn", text: result.error ?? "Não foi possível salvar." });
  }

  async function run(kind: "analyze" | "pitch") {
    setBusy(kind);
    setNotice(null);
    try {
      const res = await fetch(`/api/leads/${lead.id}/analyze${kind === "pitch" ? "?only=pitch" : ""}`, { method: "POST" });
      const body = (await res.json()) as { lead?: Lead; warning?: string; error?: string };
      if (!res.ok || !body.lead) throw new Error(body.error ?? "Falha ao analisar.");
      setLead(body.lead);
      if (body.warning) setNotice({ kind: "warn", text: body.warning });
    } catch (err) {
      setNotice({ kind: "warn", text: err instanceof Error ? err.message : "Falha ao analisar." });
    } finally {
      setBusy(null);
    }
  }

  async function sendWebhook() {
    setBusy("webhook");
    setNotice(null);
    const res = await fetch(`/api/leads/${lead.id}/webhook`, { method: "POST" }).catch(() => null);
    const body = (await res?.json().catch(() => null)) as { error?: string } | null;
    setNotice(res?.ok ? { kind: "ok", text: "Lead enviado para o webhook." } : { kind: "warn", text: body?.error ?? "Falha no envio." });
    setBusy(null);
  }

  async function remove() {
    if (!confirm(`Excluir "${lead.name}"? Isso não pode ser desfeito.`)) return;
    const result = await deleteLeads([lead.id]);
    if (result.ok) router.push("/leads");
    else setNotice({ kind: "warn", text: result.error ?? "Não foi possível excluir." });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0">
          <h1 className="page-title">{lead.name}</h1>
          <p className="page-sub">
            {[lead.category, lead.city && lead.state ? `${lead.city}/${lead.state}` : lead.city].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <ScorePill score={lead.score} large />
          <select
            className="input w-auto"
            value={lead.status}
            onChange={(e) => save({ status: e.target.value as LeadStatus })}
            aria-label="Status"
          >
            {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
          <button type="button" className="btn btn-primary" onClick={() => run("analyze")} disabled={busy !== null}>
            {busy === "analyze" ? <LoaderCircle className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            {lead.analyzed_at ? "Analisar de novo" : "Analisar"}
          </button>
        </div>
      </div>

      {notice && (
        <p className={`text-sm ${notice.kind === "ok" ? "text-accent" : "text-warm"}`}>{notice.text}</p>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div className="space-y-5">
          <section className="card space-y-3 p-5">
            <h2 className="text-sm font-semibold">Contato</h2>
            <ul className="space-y-2.5 text-sm">
              {phone && (
                <Item icon={isMobile(phone) ? MessageCircle : Phone}>
                  <span className="tabular-nums">{formatBrPhone(phone)}</span>
                  <span className="ml-2 text-xs text-muted">{isMobile(phone) ? "celular" : "fixo"}</span>
                </Item>
              )}
              {lead.email && <Item icon={Mail}><a href={`mailto:${lead.email}`} className="hover:underline">{lead.email}</a></Item>}
              {lead.website && (
                <Item icon={Globe}>
                  <a href={lead.website} target="_blank" rel="noreferrer" className="break-all hover:underline">{lead.website}</a>
                </Item>
              )}
              {lead.instagram && (
                <Item icon={AtSign}>
                  <a href={`https://instagram.com/${lead.instagram}`} target="_blank" rel="noreferrer" className="hover:underline">@{lead.instagram}</a>
                </Item>
              )}
              {lead.address && <Item icon={MapPin}>{lead.address}</Item>}
              {lead.source === "maps" && (
                <Item icon={Star}>
                  {lead.rating != null ? `${lead.rating.toFixed(1)} no Google (${lead.reviews_count ?? 0} avaliações)` : "Sem avaliações no Google"}
                </Item>
              )}
            </ul>
            {lead.maps_url && (
              <a href={lead.maps_url} target="_blank" rel="noreferrer" className="btn btn-sm">
                <ExternalLink className="size-3.5" /> Ver no Google Maps
              </a>
            )}
            {lead.source === "cnpj" && (
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 border-t border-line pt-3 text-xs">
                <dt className="text-muted">CNPJ</dt><dd className="tabular-nums">{lead.cnpj}</dd>
                <dt className="text-muted">Abertura</dt><dd>{formatDate(lead.opened_at)}</dd>
                {typeof lead.extra.razao_social === "string" && (<><dt className="text-muted">Razão social</dt><dd>{lead.extra.razao_social}</dd></>)}
                {typeof lead.extra.porte === "string" && (<><dt className="text-muted">Porte</dt><dd>{lead.extra.porte}{lead.extra.mei ? " (MEI)" : ""}</dd></>)}
                {socios.length > 0 && (<><dt className="text-muted">Sócios</dt><dd>{socios.join(", ")}</dd></>)}
              </dl>
            )}
          </section>

          <section className="card space-y-3 p-5">
            <h2 className="text-sm font-semibold">Presença digital</h2>
            {!lead.analyzed_at ? (
              <p className="text-sm text-muted">Ainda não analisado. Clique em Analisar para visitar o site e o Instagram deste negócio.</p>
            ) : (
              <div className="space-y-3 text-sm">
                <div>
                  <p className="label">Site</p>
                  {!site ? (
                    <p className="text-muted">Sem site cadastrado.</p>
                  ) : site.kind === "social" ? (
                    <p>O link de site leva para {site.socialNetwork}, não para um site próprio.</p>
                  ) : site.kind === "offline" ? (
                    <p className="text-hot">Fora do ar: {site.error}</p>
                  ) : site.error ? (
                    <p className="text-muted">{site.error}. Sem detalhes do conteúdo.</p>
                  ) : (
                    <>
                      {site.title && <p className="font-medium">{site.title}</p>}
                      {site.description && <p className="mt-0.5 text-xs text-muted">{site.description}</p>}
                      <div className="mt-2 flex flex-wrap gap-1">
                        <Fact ok={site.https} yes="HTTPS" no="Sem HTTPS" />
                        <Fact ok={site.mobileFriendly} yes="Adaptado ao celular" no="Não adaptado ao celular" />
                        <Fact ok={site.hasAnalytics || site.hasTagManager} yes="Mede visitas" no="Não mede visitas" />
                        <Fact ok={site.hasMetaPixel} yes="Pixel da Meta" no="Sem Pixel da Meta" />
                        <Fact ok={site.hasWhatsappButton} yes="Botão de WhatsApp" no="Sem botão de WhatsApp" />
                        {site.platform && <span className="badge">{site.platform}</span>}
                        {site.loadMs != null && <span className="badge">{(site.loadMs / 1000).toFixed(1)}s para responder</span>}
                      </div>
                    </>
                  )}
                </div>
                <div>
                  <p className="label">Instagram</p>
                  {!lead.instagram ? (
                    <p className="text-muted">Perfil não encontrado.</p>
                  ) : ig?.available ? (
                    <>
                      <p>
                        <strong>{(ig.followers ?? 0).toLocaleString("pt-BR")}</strong> seguidores ·{" "}
                        <strong>{(ig.posts ?? 0).toLocaleString("pt-BR")}</strong> posts
                        {ig.lastPostAt && <span className="text-muted"> · último post em {formatDate(ig.lastPostAt)}</span>}
                      </p>
                      {ig.bio && <p className="mt-1 text-xs whitespace-pre-line text-muted">{ig.bio}</p>}
                    </>
                  ) : (
                    <p className="text-muted">
                      Perfil @{lead.instagram} encontrado, mas o Instagram não liberou seguidores e posts para leitura automática.
                    </p>
                  )}
                </div>
                <p className="text-xs text-muted">Analisado em {formatDateTime(lead.analyzed_at)}.</p>
              </div>
            )}
          </section>

          <section className="card space-y-2 p-5">
            <h2 className="text-sm font-semibold">Anotações</h2>
            <textarea
              className="input"
              rows={4}
              defaultValue={lead.notes ?? ""}
              placeholder="Com quem falou, o que combinou, próximo passo…"
              onBlur={(e) => {
                const notes = e.target.value.trim() || null;
                if (notes !== lead.notes) save({ notes });
              }}
            />
            <p className="text-xs text-muted">Salva sozinho ao sair do campo.</p>
          </section>
        </div>

        <div className="space-y-5">
          {lead.analyzed_at && (
            <section className="card space-y-3 p-5">
              <h2 className="text-sm font-semibold">Diagnóstico</h2>
              {lead.diagnosis && <p className="text-sm leading-relaxed">{lead.diagnosis}</p>}
              <SignalBadges signals={lead.signals} />
            </section>
          )}

          <section className="card space-y-4 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold">Abordagem</h2>
              {lead.pitch_whatsapp && (
                <span className="badge">{lead.pitch_by_ai ? "escrita pela IA" : "modelo padrão"}</span>
              )}
              {lead.analyzed_at && (
                <button type="button" className="btn btn-sm ml-auto" onClick={() => run("pitch")} disabled={busy !== null}>
                  {busy === "pitch" ? <LoaderCircle className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
                  Escrever outra
                </button>
              )}
            </div>

            {!lead.pitch_whatsapp ? (
              <p className="text-sm text-muted">A mensagem aparece aqui depois da análise.</p>
            ) : (
              <>
                {!aiEnabled && (
                  <p className="text-xs text-muted">
                    Sem chave de IA, a mensagem segue um modelo fixo. Cadastre a chave da Anthropic em
                    Configurações para mensagens personalizadas.
                  </p>
                )}
                <div>
                  <p className="label">WhatsApp</p>
                  <textarea
                    key={`wa-${lead.updated_at}`}
                    className="input"
                    rows={6}
                    defaultValue={lead.pitch_whatsapp}
                    onBlur={(e) => e.target.value !== lead.pitch_whatsapp && save({ pitch_whatsapp: e.target.value })}
                  />
                  <div className="mt-2 flex flex-wrap gap-2">
                    {phone && (
                      <a
                        href={whatsappLink(phone, lead.pitch_whatsapp) ?? "#"}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-primary"
                        onClick={() => lead.status === "novo" && save({ status: "contatado" })}
                      >
                        <MessageCircle className="size-4" /> Abrir no WhatsApp
                      </a>
                    )}
                    <CopyButton text={lead.pitch_whatsapp} />
                  </div>
                  {phone && !isMobile(phone) && (
                    <p className="mt-1.5 text-xs text-muted">O número é fixo: só funciona se o negócio usar WhatsApp Business nele.</p>
                  )}
                </div>

                <div className="border-t border-line pt-4">
                  <p className="label">E-mail</p>
                  <input
                    key={`subject-${lead.updated_at}`}
                    className="input mb-2"
                    defaultValue={lead.pitch_email_subject ?? ""}
                    onBlur={(e) => e.target.value !== lead.pitch_email_subject && save({ pitch_email_subject: e.target.value })}
                    aria-label="Assunto"
                  />
                  <textarea
                    key={`body-${lead.updated_at}`}
                    className="input"
                    rows={9}
                    defaultValue={lead.pitch_email_body ?? ""}
                    onBlur={(e) => e.target.value !== lead.pitch_email_body && save({ pitch_email_body: e.target.value })}
                    aria-label="Corpo do e-mail"
                  />
                  <div className="mt-2 flex flex-wrap gap-2">
                    {lead.email && (
                      <a
                        href={`mailto:${lead.email}?subject=${encodeURIComponent(lead.pitch_email_subject ?? "")}&body=${encodeURIComponent(lead.pitch_email_body ?? "")}`}
                        className="btn"
                      >
                        <Mail className="size-4" /> Abrir no e-mail
                      </a>
                    )}
                    <CopyButton text={`${lead.pitch_email_subject ?? ""}\n\n${lead.pitch_email_body ?? ""}`} />
                  </div>
                </div>
              </>
            )}
          </section>

          <div className="flex flex-wrap gap-2">
            {webhookEnabled && (
              <button type="button" className="btn" onClick={sendWebhook} disabled={busy !== null}>
                {busy === "webhook" ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />}
                Enviar para o CRM (webhook)
              </button>
            )}
            <button type="button" className="btn btn-danger ml-auto" onClick={remove}>
              <Trash2 className="size-4" /> Excluir lead
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Item({ icon: Icon, children }: { icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted" />
      <span className="min-w-0">{children}</span>
    </li>
  );
}

function Fact({ ok, yes, no }: { ok: boolean | undefined; yes: string; no: string }) {
  if (ok == null) return null;
  return <span className={`badge ${ok ? "badge-positivo" : "badge-dor"}`}>{ok ? yes : no}</span>;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <Check className="size-4 text-accent" /> : <Copy className="size-4" />}
      {copied ? "Copiado" : "Copiar"}
    </button>
  );
}
