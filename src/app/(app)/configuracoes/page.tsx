import { requireUser } from "@/lib/supabase/server";
import { getSettings, maskKey } from "@/lib/settings";
import { SettingsForm } from "./settings-form";

export default async function ConfiguracoesPage({ searchParams }: PageProps<"/configuracoes">) {
  const { bemvindo } = await searchParams;
  const { supabase, user } = await requireUser();
  const settings = await getSettings(supabase, user.id);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="page-title">Configurações</h1>
        <p className="page-sub">Quem você é, o que vende e de onde vêm os dados.</p>
      </div>
      {bemvindo && (
        <div className="card border-accent/40 p-4 text-sm">
          <p className="font-medium text-accent">Conta criada. Faltam dois passos para começar:</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted">
            <li>Preencha o seu perfil de vendas: é com ele que as mensagens são escritas.</li>
            <li>Cadastre a chave de uma fonte de dados do Google Maps, logo abaixo.</li>
          </ol>
        </div>
      )}
      <SettingsForm
        settings={{
          seller_name: settings.seller_name,
          company: settings.company,
          offer: settings.offer,
          differentials: settings.differentials,
          tone: settings.tone,
          cta: settings.cta,
          maps_provider: settings.maps_provider,
          ai_model: settings.ai_model,
          webhook_url: settings.webhook_url,
        }}
        keys={{
          google_places_key: maskKey(settings.google_places_key),
          serper_key: maskKey(settings.serper_key),
          anthropic_key: maskKey(settings.anthropic_key),
        }}
      />
    </div>
  );
}
