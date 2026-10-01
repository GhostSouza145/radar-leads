import Link from "next/link";
import { requireUser } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings";
import { RadarClient } from "./radar-client";

export default async function RadarPage() {
  const { supabase, user } = await requireUser();
  const settings = await getSettings(supabase, user.id);
  const provider = settings.maps_provider;
  const ready = provider === "serper" ? Boolean(settings.serper_key) : Boolean(settings.google_places_key);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Radar Google Maps</h1>
        <p className="page-sub">
          Diga o nicho e a região. O radar traz os negócios do Google Maps com telefone, site e
          avaliações, e salva tudo nos seus leads.
        </p>
      </div>
      {ready ? (
        <RadarClient provider={provider} />
      ) : (
        <div className="card p-6 text-sm">
          <p>Para buscar no Google Maps falta cadastrar a chave da fonte de dados.</p>
          <Link href="/configuracoes#fontes" className="btn btn-primary mt-4">
            Abrir Configurações
          </Link>
        </div>
      )}
    </div>
  );
}
