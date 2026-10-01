export const STATUSES = [
  "novo",
  "contatado",
  "respondeu",
  "reuniao",
  "fechado",
  "perdido",
] as const;
export type LeadStatus = (typeof STATUSES)[number];

export const STATUS_LABEL: Record<LeadStatus, string> = {
  novo: "Novo",
  contatado: "Contatado",
  respondeu: "Respondeu",
  reuniao: "Reunião",
  fechado: "Fechado",
  perdido: "Perdido",
};

export type LeadSource = "maps" | "cnpj" | "manual";

export type SignalKind = "dor" | "positivo" | "info";

export interface Signal {
  key: string;
  label: string;
  kind: SignalKind;
  detail?: string;
}

export interface SiteData {
  url: string;
  finalUrl?: string;
  kind: "site" | "social" | "offline";
  socialNetwork?: string;
  status?: number;
  error?: string;
  https?: boolean;
  loadMs?: number;
  title?: string;
  description?: string;
  mobileFriendly?: boolean;
  platform?: string;
  hasAnalytics?: boolean;
  hasMetaPixel?: boolean;
  hasTagManager?: boolean;
  hasWhatsappButton?: boolean;
  hasBooking?: boolean;
  hasSchema?: boolean;
  copyrightYear?: number;
  emails?: string[];
  instagram?: string;
  facebook?: string;
}

export interface InstagramData {
  username: string;
  available: boolean;
  fullName?: string;
  bio?: string;
  followers?: number;
  following?: number;
  posts?: number;
  isBusiness?: boolean;
  category?: string;
  externalUrl?: string;
  lastPostAt?: string;
}

export interface Lead {
  id: string;
  user_id: string;
  source: LeadSource;
  external_id: string;
  name: string;
  category: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  instagram: string | null;
  maps_url: string | null;
  rating: number | null;
  reviews_count: number | null;
  cnpj: string | null;
  opened_at: string | null;
  extra: Record<string, unknown>;
  status: LeadStatus;
  score: number | null;
  signals: Signal[];
  site_data: SiteData | null;
  instagram_data: InstagramData | null;
  diagnosis: string | null;
  pitch_whatsapp: string | null;
  pitch_email_subject: string | null;
  pitch_email_body: string | null;
  pitch_by_ai: boolean;
  analyzed_at: string | null;
  notes: string | null;
  search_id: string | null;
  created_at: string;
  updated_at: string;
}

/** Campos que uma fonte de dados entrega antes de o lead ser salvo. */
export type LeadDraft = Pick<Lead, "source" | "external_id" | "name"> &
  Partial<
    Pick<
      Lead,
      | "category"
      | "address"
      | "city"
      | "state"
      | "phone"
      | "email"
      | "website"
      | "instagram"
      | "maps_url"
      | "rating"
      | "reviews_count"
      | "cnpj"
      | "opened_at"
      | "extra"
    >
  >;

export interface Settings {
  user_id: string;
  seller_name: string | null;
  company: string | null;
  offer: string | null;
  differentials: string | null;
  tone: string;
  cta: string | null;
  maps_provider: "google" | "serper";
  google_places_key: string | null;
  serper_key: string | null;
  anthropic_key: string | null;
  ai_model: string;
  webhook_url: string | null;
}

export interface Monitor {
  id: string;
  source: "maps" | "cnpj";
  label: string;
  params: Record<string, unknown>;
  active: boolean;
  last_run_at: string | null;
  last_new: number | null;
  last_error: string | null;
  created_at: string;
}

export interface SearchRecord {
  id: string;
  source: "maps" | "cnpj";
  label: string;
  params: Record<string, unknown>;
  total_found: number;
  new_leads: number;
  monitor_id: string | null;
  created_at: string;
}

export interface MapsSearchParams {
  niche: string;
  location: string;
  /** 1 = até 60 resultados; 2 = grade 2x2; 3 = grade 3x3 (só Google Places). */
  depth: 1 | 2 | 3;
  limit: number;
}

export interface CnpjSearchParams {
  uf: string;
  municipio: string;
  municipioNome: string;
  cnae: string;
  cnaeDescricao: string;
  days: number;
}

export function scoreLabel(score: number | null): "quente" | "morno" | "frio" | null {
  if (score == null) return null;
  if (score >= 70) return "quente";
  if (score >= 45) return "morno";
  return "frio";
}
