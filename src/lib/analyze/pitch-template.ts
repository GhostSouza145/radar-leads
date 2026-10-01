import type { Lead, Settings, Signal } from "@/lib/types";

export interface Pitch {
  diagnosis: string;
  whatsapp: string;
  emailSubject: string;
  emailBody: string;
}

type PitchLead = Pick<Lead, "name" | "city" | "rating" | "source">;

const OBSERVATIONS: Record<string, (lead: PitchLead, s: Signal) => string> = {
  sem_site: () => "vocês ainda não têm um site próprio",
  site_e_rede_social: () => "o link de site de vocês leva direto para uma rede social, sem um site próprio",
  site_fora_do_ar: () => "o site de vocês não está abrindo",
  nao_responsivo: () => "o site de vocês não abre bem no celular",
  sem_https: () => 'o site de vocês aparece como "não seguro" no navegador',
  site_lento: () => "o site de vocês está demorando bastante para carregar",
  site_desatualizado: () => "o site de vocês parece estar sem atualização há um bom tempo",
  sem_avaliacoes: () => "o perfil de vocês no Google ainda não tem avaliações",
  poucas_avaliacoes: () => "o perfil de vocês no Google tem poucas avaliações",
  nota_baixa: (lead) => `a nota de vocês no Google está em ${lead.rating?.toFixed(1)}`,
  sem_pixel: () => "o site de vocês não tem o rastreamento que os anúncios precisam para funcionar bem",
  sem_analytics: () => "o site de vocês não está medindo as visitas",
  sem_botao_whatsapp: () => "o site de vocês não tem um botão direto para o WhatsApp",
  instagram_parado: () => "o Instagram de vocês está sem postagens recentes",
  poucos_seguidores: () => "o Instagram de vocês ainda tem pouco alcance",
  sem_instagram: () => "o site de vocês não leva para o Instagram",
  empresa_nova: () => "vocês abriram há pouco tempo (parabéns pelo novo negócio!)",
};

function pickObservations(lead: PitchLead, signals: Signal[], max: number): string[] {
  return signals
    .filter((s) => OBSERVATIONS[s.key])
    .slice(0, max)
    .map((s) => OBSERVATIONS[s.key](lead, s));
}

/** Mensagem montada por regras, usada quando não há chave de IA configurada. */
export function templatePitch(lead: PitchLead, signals: Signal[], settings: Settings | null): Pitch {
  const seller = settings?.seller_name?.trim();
  const company = settings?.company?.trim();
  const intro = seller
    ? `Aqui é ${seller}${company ? `, da ${company}` : ""}.`
    : company
      ? `Falo da ${company}.`
      : "";
  const where = lead.source === "maps" ? "no Google" : "na internet";
  const offer =
    settings?.offer?.trim() ||
    "Trabalho ajudando negócios como o de vocês a atrair mais clientes pela internet.";
  const [first, second] = pickObservations(lead, signals, 2);
  const hasGap = signals.some((s) => s.kind === "dor" && OBSERVATIONS[s.key]);
  const cta =
    settings?.cta?.trim() ||
    (hasGap ? "Posso te mandar uma ideia rápida de como resolver isso?" : "Posso te mandar uma ideia rápida?");
  const noticed = first
    ? `Encontrei a ${lead.name} ${where} e reparei que ${first}${second ? ` e que ${second}` : ""}.`
    : `Encontrei a ${lead.name} ${where}${lead.city ? ` aqui em ${lead.city}` : ""} e dei uma olhada na presença online de vocês.`;

  const whatsapp = ["Oi, tudo bem?", intro, noticed, offer, cta].filter(Boolean).join(" ");

  const pains = signals.filter((s) => s.kind === "dor");
  const diagnosis = pains.length
    ? `Pontos de atenção encontrados: ${pains.map((s) => s.label).join("; ")}.`
    : "Nenhuma lacuna evidente foi encontrada na presença online deste negócio.";

  const emailBody = [
    "Olá, tudo bem?",
    [intro, noticed].filter(Boolean).join(" "),
    offer,
    cta,
    seller ? `Abraço,\n${seller}${company ? `\n${company}` : ""}` : "Abraço!",
  ].join("\n\n");

  return {
    diagnosis,
    whatsapp,
    emailSubject: first ? `${lead.name}: uma observação rápida` : `Uma ideia para a ${lead.name}`,
    emailBody,
  };
}
