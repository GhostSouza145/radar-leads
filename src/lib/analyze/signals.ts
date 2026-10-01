import type { InstagramData, Lead, Signal, SiteData } from "@/lib/types";
import { isMobile, normalizeBrPhone } from "@/lib/phone";

type LeadFacts = Pick<
  Lead,
  "source" | "website" | "phone" | "email" | "rating" | "reviews_count" | "opened_at" | "instagram"
>;

interface Rule {
  signal: Signal;
  points: number;
}

function daysSince(date: string): number {
  return Math.floor((Date.now() - new Date(date).getTime()) / 86_400_000);
}

/**
 * Regras fixas que transformam o que foi observado em sinais de venda e numa
 * nota de 0 a 100 (quanto mais lacunas visíveis e mais fácil o contato, maior).
 */
export function computeSignals(
  lead: LeadFacts,
  site: SiteData | null,
  ig: InstagramData | null,
): { signals: Signal[]; score: number } {
  const rules: Rule[] = [];
  const add = (points: number, key: string, label: string, kind: Signal["kind"], detail?: string) =>
    rules.push({ points, signal: { key, label, kind, detail } });

  // --- Site ---
  if (!lead.website) {
    // Só o perfil do Google confirma a falta de site; nas outras origens o site é desconhecido.
    if (lead.source === "maps") add(24, "sem_site", "Sem site", "dor", "O perfil no Google não tem site cadastrado.");
    else add(0, "site_desconhecido", "Site não informado", "info", "Informe o site no lead para analisá-lo.");
  } else if (site?.kind === "social") {
    add(20, "site_e_rede_social", `"Site" é só ${site.socialNetwork}`, "dor",
      "O link de site aponta para uma rede social, não para um site próprio.");
  } else if (site?.kind === "offline") {
    add(22, "site_fora_do_ar", "Site fora do ar", "dor", site.error);
  } else if (site?.kind === "site" && !site.error) {
    if (site.https === false) add(8, "sem_https", "Site sem HTTPS", "dor", "O navegador mostra o site como não seguro.");
    if (site.mobileFriendly === false) add(10, "nao_responsivo", "Site não adaptado para celular", "dor");
    if ((site.loadMs ?? 0) > 4000) add(5, "site_lento", "Site lento", "dor", `Levou ${(site.loadMs! / 1000).toFixed(1)}s para responder.`);
    if (!site.hasAnalytics && !site.hasTagManager) add(5, "sem_analytics", "Sem Google Analytics", "dor", "Não mede as visitas do site.");
    if (!site.hasMetaPixel && !site.hasTagManager) add(5, "sem_pixel", "Sem Pixel da Meta", "dor", "Não consegue fazer remarketing no Instagram/Facebook.");
    if (!site.hasWhatsappButton) add(5, "sem_botao_whatsapp", "Sem botão de WhatsApp no site", "dor");
    if (!site.description) add(3, "sem_meta_description", "Sem descrição para o Google (SEO)", "dor");
    if (site.copyrightYear && site.copyrightYear <= new Date().getFullYear() - 3) {
      add(5, "site_desatualizado", `Site parado desde ${site.copyrightYear}`, "dor");
    }
    if (site.platform) add(0, "plataforma", `Feito em ${site.platform}`, "info");
    if (site.hasMetaPixel || site.hasAnalytics || site.hasTagManager) {
      add(3, "investe_em_marketing", "Já usa rastreamento (investe em marketing)", "positivo");
    }
  }

  // --- Google ---
  if (lead.source === "maps") {
    const reviews = lead.reviews_count ?? 0;
    if (reviews === 0) add(9, "sem_avaliacoes", "Nenhuma avaliação no Google", "dor");
    else if (reviews < 20) add(7, "poucas_avaliacoes", `Só ${reviews} avaliações no Google`, "dor");
    if (lead.rating != null && reviews >= 5 && lead.rating < 4) {
      add(8, "nota_baixa", `Nota ${lead.rating.toFixed(1)} no Google`, "dor", "Reputação abaixo de 4 afasta clientes.");
    }
    if (reviews >= 100 && (lead.rating ?? 0) >= 4.3) {
      add(4, "negocio_movimentado", `Negócio movimentado (${reviews} avaliações)`, "positivo");
    }
  }

  // --- Instagram ---
  const handle = lead.instagram ?? site?.instagram;
  if (!handle) {
    // Só conta como lacuna quando o site foi lido e não aponta para nenhum perfil.
    if (site?.kind === "site" && !site.error) add(4, "sem_instagram", "Site sem link para o Instagram", "dor");
  } else if (ig?.available) {
    if ((ig.followers ?? 0) < 1000) add(5, "poucos_seguidores", `Só ${ig.followers ?? 0} seguidores no Instagram`, "dor");
    if (ig.lastPostAt && daysSince(ig.lastPostAt) > 45) {
      add(6, "instagram_parado", `Instagram sem postar há ${daysSince(ig.lastPostAt)} dias`, "dor");
    }
    if ((ig.posts ?? 0) > 0 && (ig.posts ?? 0) < 12) add(3, "poucos_posts", `Só ${ig.posts} posts no Instagram`, "dor");
    // O link da bio só vem pela API; a prévia pública não informa.
    if (ig.isBusiness !== undefined && !ig.externalUrl) add(3, "sem_link_na_bio", "Instagram sem link na bio", "dor");
  }

  // --- Empresa nova ---
  if (lead.opened_at) {
    const age = daysSince(lead.opened_at);
    if (age <= 180) {
      add(age <= 60 ? 24 : 16, "empresa_nova", `Empresa aberta há ${age} dias`, "positivo",
        "Negócio novo costuma estar montando a estrutura e contratando fornecedores.");
    }
  }

  // --- Facilidade de contato ---
  const phone = normalizeBrPhone(lead.phone);
  if (isMobile(phone)) add(6, "tem_whatsapp", "Celular disponível (provável WhatsApp)", "positivo");
  else if (phone) add(3, "tem_telefone", "Telefone fixo disponível", "info");
  if (lead.email || site?.emails?.length) add(2, "tem_email", "E-mail disponível", "info");
  if (!phone && !lead.email && !site?.emails?.length) add(-15, "sem_contato", "Sem telefone nem e-mail", "info");

  const score = Math.max(0, Math.min(100, 25 + rules.reduce((sum, r) => sum + r.points, 0)));
  const order = { dor: 0, positivo: 1, info: 2 } as const;
  const signals = rules
    .sort((a, b) => order[a.signal.kind] - order[b.signal.kind] || b.points - a.points)
    .map((r) => r.signal);

  return { signals, score };
}
