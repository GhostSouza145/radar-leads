"use client";

import { useActionState } from "react";
import { Check, LoaderCircle } from "lucide-react";
import { saveSettings, type ActionResult } from "@/app/actions";
import type { Settings } from "@/lib/types";

type Profile = Pick<
  Settings,
  "seller_name" | "company" | "offer" | "differentials" | "tone" | "cta" | "maps_provider" | "ai_model" | "webhook_url"
>;
type KeyName = "google_places_key" | "serper_key" | "anthropic_key";

const MODELS = [
  ["claude-opus-5-5", "Claude Opus 5.5 (melhor qualidade)"],
  ["claude-sonnet-5-5", "Claude Sonnet 5.5 (mais barato)"],
  ["claude-haiku-4-5", "Claude Haiku 4.5 (o mais barato)"],
];

const TONES = [
  ["consultivo", "Consultivo"],
  ["direto", "Direto ao ponto"],
  ["descontraido", "Descontraído"],
  ["formal", "Formal"],
];

export function SettingsForm({ settings, keys }: { settings: Profile; keys: Record<KeyName, string | null> }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(saveSettings, null);

  return (
    <form action={action} className="space-y-5">
      <section className="card space-y-4 p-5">
        <div>
          <h2 className="text-sm font-semibold">Seu perfil de vendas</h2>
          <p className="mt-1 text-xs text-muted">Quanto mais específico, melhor a nota e a mensagem de cada lead.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field name="seller_name" label="Seu nome" defaultValue={settings.seller_name} placeholder="Ex.: Ana" />
          <Field name="company" label="Sua empresa (opcional)" defaultValue={settings.company} />
        </div>
        <div>
          <label className="label" htmlFor="offer">O que você vende</label>
          <textarea id="offer" name="offer" rows={3} className="input" defaultValue={settings.offer ?? ""}
            placeholder="Ex.: Crio sites profissionais para clínicas e consultórios, com agendamento online e botão de WhatsApp, entregues em 7 dias." />
        </div>
        <div>
          <label className="label" htmlFor="differentials">Diferenciais e provas (opcional)</label>
          <textarea id="differentials" name="differentials" rows={2} className="input" defaultValue={settings.differentials ?? ""}
            placeholder="Ex.: Já atendi 30 clínicas na região; site pronto antes do pagamento." />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="tone">Tom das mensagens</label>
            <select id="tone" name="tone" className="input" defaultValue={settings.tone}>
              {TONES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
          <Field name="cta" label="Como você gosta de encerrar (opcional)" defaultValue={settings.cta}
            placeholder="Ex.: Posso te mandar um exemplo?" />
        </div>
      </section>

      <section id="fontes" className="card scroll-mt-6 space-y-4 p-5">
        <div>
          <h2 className="text-sm font-semibold">Fonte do Google Maps</h2>
          <p className="mt-1 text-xs text-muted">Escolha uma das duas. A busca de empresas novas (CNPJ) não precisa de chave.</p>
        </div>
        <div>
          <label className="label" htmlFor="maps_provider">Usar</label>
          <select id="maps_provider" name="maps_provider" className="input" defaultValue={settings.maps_provider}>
            <option value="google">Google Places API (oficial)</option>
            <option value="serper">Serper.dev</option>
          </select>
        </div>
        <SecretField name="google_places_key" label="Chave do Google Places API" current={keys.google_places_key}>
          Em{" "}
          <a href="https://console.cloud.google.com/google/maps-apis/credentials" target="_blank" rel="noreferrer" className="text-accent hover:underline">
            console.cloud.google.com
          </a>
          : crie um projeto, ative a &quot;Places API (New)&quot; e gere uma chave de API. O Google
          pede um cartão para criar a conta de faturamento e dá uma cota gratuita por mês; acima
          dela, cobra por consulta.
        </SecretField>
        <SecretField name="serper_key" label="Chave do Serper.dev" current={keys.serper_key}>
          Em{" "}
          <a href="https://serper.dev" target="_blank" rel="noreferrer" className="text-accent hover:underline">serper.dev</a>
          : o cadastro dá créditos de teste sem cartão. Traz menos resultados por busca que a API oficial.
        </SecretField>
      </section>

      <section className="card space-y-4 p-5">
        <div>
          <h2 className="text-sm font-semibold">IA para o diagnóstico e as mensagens</h2>
          <p className="mt-1 text-xs text-muted">
            Sem chave, o app continua funcionando com uma nota por regras e uma mensagem em modelo fixo.
          </p>
        </div>
        <SecretField name="anthropic_key" label="Chave da API da Anthropic (Claude)" current={keys.anthropic_key}>
          Em{" "}
          <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer" className="text-accent hover:underline">
            console.anthropic.com
          </a>
          . É paga por uso (centavos de dólar por lead analisado).
        </SecretField>
        <div>
          <label className="label" htmlFor="ai_model">Modelo</label>
          <select id="ai_model" name="ai_model" className="input" defaultValue={settings.ai_model}>
            {MODELS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
      </section>

      <section className="card space-y-4 p-5">
        <div>
          <h2 className="text-sm font-semibold">Enviar leads para o seu CRM (opcional)</h2>
          <p className="mt-1 text-xs text-muted">
            Cole a URL de um webhook (Make, Zapier, n8n ou do próprio CRM). Um botão na página do
            lead envia os dados em JSON para ela.
          </p>
        </div>
        <Field name="webhook_url" label="URL do webhook" defaultValue={settings.webhook_url} placeholder="https://" />
      </section>

      <div className="flex items-center gap-3">
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending && <LoaderCircle className="size-4 animate-spin" />}
          Salvar configurações
        </button>
        {state?.ok && !pending && (
          <span className="inline-flex items-center gap-1 text-sm text-accent"><Check className="size-4" /> Salvo</span>
        )}
        {state?.error && <span className="text-sm text-hot">{state.error}</span>}
      </div>
    </form>
  );
}

function Field({
  name,
  label,
  defaultValue,
  placeholder,
}: {
  name: string;
  label: string;
  defaultValue: string | null;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <input id={name} name={name} className="input" defaultValue={defaultValue ?? ""} placeholder={placeholder} />
    </div>
  );
}

function SecretField({
  name,
  label,
  current,
  children,
}: {
  name: KeyName;
  label: string;
  current: string | null;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <input
        id={name}
        name={name}
        type="password"
        autoComplete="off"
        className="input font-mono"
        placeholder={current ? `Cadastrada (${current}). Deixe em branco para manter.` : "Cole a chave aqui"}
      />
      <p className="mt-1.5 text-xs leading-relaxed text-muted">{children}</p>
      {current && (
        <label className="mt-1.5 flex items-center gap-2 text-xs text-muted">
          <input type="checkbox" name={`${name}_clear`} /> Remover esta chave
        </label>
      )}
    </div>
  );
}
