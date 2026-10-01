"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/server";
import { STATUSES } from "@/lib/types";
import { CnpjParamsSchema, MapsParamsSchema } from "@/lib/schemas";
import { cnpjLabel, mapsLabel } from "@/lib/leads";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

const fail = (error: string): ActionResult => ({ ok: false, error });

const IdsSchema = z.array(z.string().uuid()).min(1).max(1000);

const LeadPatchSchema = z
  .object({
    status: z.enum(STATUSES),
    notes: z.string().max(5000).nullable(),
    pitch_whatsapp: z.string().max(4000).nullable(),
    pitch_email_subject: z.string().max(300).nullable(),
    pitch_email_body: z.string().max(8000).nullable(),
    phone: z.string().max(40).nullable(),
    email: z.string().max(200).nullable(),
    website: z.string().max(500).nullable(),
    instagram: z.string().max(60).nullable(),
  })
  .partial();

export async function updateLead(id: string, patch: z.input<typeof LeadPatchSchema>): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const parsed = LeadPatchSchema.safeParse(patch);
  if (!parsed.success) return fail("Dados inválidos.");
  const { error } = await supabase
    .from("leads")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return fail(error.message);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function setLeadsStatus(ids: string[], status: string): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const parsed = z.object({ ids: IdsSchema, status: z.enum(STATUSES) }).safeParse({ ids, status });
  if (!parsed.success) return fail("Dados inválidos.");
  const { error } = await supabase
    .from("leads")
    .update({ status: parsed.data.status, updated_at: new Date().toISOString() })
    .in("id", parsed.data.ids);
  if (error) return fail(error.message);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteLeads(ids: string[]): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const parsed = IdsSchema.safeParse(ids);
  if (!parsed.success) return fail("Dados inválidos.");
  const { error } = await supabase.from("leads").delete().in("id", parsed.data);
  if (error) return fail(error.message);
  revalidatePath("/", "layout");
  return { ok: true };
}

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim() || null;

export async function createManualLead(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const name = text(formData, "name");
  if (!name) return fail("Informe o nome do negócio.");
  const { data, error } = await supabase
    .from("leads")
    .insert({
      source: "manual",
      external_id: crypto.randomUUID(),
      name,
      category: text(formData, "category"),
      city: text(formData, "city"),
      phone: text(formData, "phone"),
      email: text(formData, "email"),
      website: text(formData, "website"),
      instagram: text(formData, "instagram")?.replace(/^@/, "").replace(/^.*instagram\.com\//, "").replace(/\/.*$/, "") ?? null,
    })
    .select("id")
    .single();
  if (error) return fail(error.message);
  redirect(`/leads/${data.id}`);
}

const SettingsSchema = z.object({
  seller_name: z.string().max(120).nullable(),
  company: z.string().max(120).nullable(),
  offer: z.string().max(1500).nullable(),
  differentials: z.string().max(1500).nullable(),
  tone: z.string().max(40),
  cta: z.string().max(300).nullable(),
  maps_provider: z.enum(["google", "serper"]),
  ai_model: z.string().max(60),
  webhook_url: z.string().max(500).nullable(),
});

const SECRET_FIELDS = ["google_places_key", "serper_key", "anthropic_key"] as const;

export async function saveSettings(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  const parsed = SettingsSchema.safeParse({
    seller_name: text(formData, "seller_name"),
    company: text(formData, "company"),
    offer: text(formData, "offer"),
    differentials: text(formData, "differentials"),
    tone: text(formData, "tone") ?? "consultivo",
    cta: text(formData, "cta"),
    maps_provider: text(formData, "maps_provider") ?? "google",
    ai_model: text(formData, "ai_model") ?? "claude-opus-5-5",
    webhook_url: text(formData, "webhook_url"),
  });
  if (!parsed.success) return fail("Confira os campos: " + parsed.error.issues.map((i) => i.path.join(".")).join(", "));

  // Chave em branco = manter a atual. Marcar "remover" apaga.
  const secrets: Record<string, string | null> = {};
  for (const field of SECRET_FIELDS) {
    const value = text(formData, field);
    if (formData.get(`${field}_clear`)) secrets[field] = null;
    else if (value) secrets[field] = value;
  }

  const { error } = await supabase
    .from("settings")
    .upsert({ user_id: user.id, ...parsed.data, ...secrets, updated_at: new Date().toISOString() });
  if (error) return fail(error.message);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function createMonitor(source: "maps" | "cnpj", params: unknown): Promise<ActionResult> {
  const { supabase } = await requireUser();
  let label: string;
  let clean: unknown;
  if (source === "maps") {
    const parsed = MapsParamsSchema.safeParse(params);
    if (!parsed.success) return fail("Busca inválida.");
    label = mapsLabel(parsed.data);
    clean = parsed.data;
  } else {
    const parsed = CnpjParamsSchema.safeParse(params);
    if (!parsed.success) return fail("Busca inválida.");
    label = cnpjLabel(parsed.data);
    clean = parsed.data;
  }
  const { error } = await supabase.from("monitors").insert({ source, label, params: clean });
  if (error) return fail(error.message);
  revalidatePath("/monitores");
  return { ok: true };
}

export async function toggleMonitor(id: string, active: boolean): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("monitors").update({ active }).eq("id", id);
  if (error) return fail(error.message);
  revalidatePath("/monitores");
  return { ok: true };
}

export async function deleteMonitor(id: string): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("monitors").delete().eq("id", id);
  if (error) return fail(error.message);
  revalidatePath("/monitores");
  return { ok: true };
}
