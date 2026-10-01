import "server-only";
import type { Lead, Settings } from "@/lib/types";
import { analyzeSite, instagramHandle } from "./site";
import { analyzeInstagram } from "./instagram";
import { computeSignals } from "./signals";
import { templatePitch, type Pitch } from "./pitch-template";
import { AiError, aiPitch } from "./ai";

export type LeadUpdate = Partial<Lead>;

async function writePitch(
  lead: Lead,
  baseScore: number,
  settings: Settings,
): Promise<{ pitch: Pitch; score: number; byAi: boolean; warning?: string }> {
  if (settings.anthropic_key) {
    try {
      const { score, ...pitch } = await aiPitch(
        settings.anthropic_key,
        settings.ai_model,
        lead,
        lead.signals,
        lead.site_data,
        lead.instagram_data,
        baseScore,
        settings,
      );
      return { pitch, score, byAi: true };
    } catch (err) {
      if (!(err instanceof AiError)) throw err;
      return {
        pitch: templatePitch(lead, lead.signals, settings),
        score: baseScore,
        byAi: false,
        warning: `${err.message} Usei a mensagem padrão.`,
      };
    }
  }
  return { pitch: templatePitch(lead, lead.signals, settings), score: baseScore, byAi: false };
}

function pitchFields(pitch: Pitch, byAi: boolean): LeadUpdate {
  return {
    diagnosis: pitch.diagnosis,
    pitch_whatsapp: pitch.whatsapp,
    pitch_email_subject: pitch.emailSubject,
    pitch_email_body: pitch.emailBody,
    pitch_by_ai: byAi,
  };
}

/** Visita site e Instagram, calcula sinais e nota, e escreve a abordagem. */
export async function analyzeLead(
  lead: Lead,
  settings: Settings,
): Promise<{ update: LeadUpdate; warning?: string }> {
  const site = lead.website ? await analyzeSite(lead.website) : null;
  const handle = lead.instagram ?? site?.instagram ?? instagramHandle(lead.website);
  const ig = handle ? await analyzeInstagram(handle) : null;

  const email = lead.email ?? site?.emails?.[0] ?? null;
  const facts = { ...lead, instagram: handle ?? null, email };
  const { signals, score: baseScore } = computeSignals(facts, site, ig);

  const analyzed: Lead = { ...facts, signals, site_data: site, instagram_data: ig };
  const { pitch, score, byAi, warning } = await writePitch(analyzed, baseScore, settings);

  return {
    update: {
      instagram: handle ?? null,
      email,
      site_data: site,
      instagram_data: ig,
      signals,
      score,
      ...pitchFields(pitch, byAi),
      analyzed_at: new Date().toISOString(),
    },
    warning,
  };
}

/** Reescreve só a mensagem, reaproveitando a análise já salva. */
export async function rewritePitch(
  lead: Lead,
  settings: Settings,
): Promise<{ update: LeadUpdate; warning?: string }> {
  const { score: baseScore } = computeSignals(lead, lead.site_data, lead.instagram_data);
  const { pitch, score, byAi, warning } = await writePitch(lead, baseScore, settings);
  return { update: { score, ...pitchFields(pitch, byAi) }, warning };
}
