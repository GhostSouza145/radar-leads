import "server-only";
import type { InstagramData } from "@/lib/types";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const IG_APP_ID = "936619743392459";
/** Agente de prévia de link, para o qual o Instagram entrega as meta tags públicas. */
const PREVIEW_UA = "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)";

interface IgUser {
  full_name?: string;
  biography?: string;
  edge_followed_by?: { count: number };
  edge_follow?: { count: number };
  edge_owner_to_timeline_media?: {
    count: number;
    edges?: { node: { taken_at_timestamp?: number } }[];
  };
  is_business_account?: boolean;
  category_name?: string;
  external_url?: string;
}

/** "1,234" | "12.5K" | "1.2M" | "3 mil" -> número */
function parseCount(text: string): number | undefined {
  const m = text.trim().match(/^([\d.,]+)\s*(k|m|mil|mi)?/i);
  if (!m) return undefined;
  const unit = m[2]?.toLowerCase();
  if (!unit) return Number(m[1].replace(/[.,]/g, ""));
  const value = Number(m[1].replace(",", "."));
  return Math.round(value * (unit === "k" || unit === "mil" ? 1_000 : 1_000_000));
}

async function fromApi(username: string): Promise<InstagramData | null> {
  const res = await fetch(
    `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`,
    {
      headers: { "User-Agent": UA, "x-ig-app-id": IG_APP_ID, Accept: "*/*" },
      signal: AbortSignal.timeout(7000),
      cache: "no-store",
    },
  );
  if (!res.ok || !res.headers.get("content-type")?.includes("json")) return null;
  const user = ((await res.json()) as { data?: { user?: IgUser } }).data?.user;
  if (!user) return null;
  const lastPost = Math.max(
    0,
    ...(user.edge_owner_to_timeline_media?.edges ?? []).map((e) => e.node.taken_at_timestamp ?? 0),
  );
  return {
    username,
    available: true,
    fullName: user.full_name,
    bio: user.biography,
    followers: user.edge_followed_by?.count,
    following: user.edge_follow?.count,
    posts: user.edge_owner_to_timeline_media?.count,
    isBusiness: user.is_business_account,
    category: user.category_name,
    externalUrl: user.external_url,
    lastPostAt: lastPost ? new Date(lastPost * 1000).toISOString() : undefined,
  };
}

function decode(text: string): string {
  return text
    .replace(/&#0?64;/g, "@").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&amp;/g, "&")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)));
}

/**
 * Plano B: a prévia de link da página pública (a mesma que aparece ao colar o
 * perfil num chat) traz seguidores, posts e a bio na meta description:
 *   4M Followers, 33 Following, 1,254 Posts - Nome (@user) on Instagram: "bio"
 */
async function fromHtml(username: string): Promise<InstagramData | null> {
  const res = await fetch(`https://www.instagram.com/${encodeURIComponent(username)}/`, {
    headers: { "User-Agent": PREVIEW_UA, "Accept-Language": "en-US,en;q=0.9" },
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
  });
  if (!res.ok) return null;
  const html = await res.text();
  const tag = html.match(/<meta[^>]*name="description"[^>]*>/i)?.[0] ?? html.match(/<meta[^>]*property="og:description"[^>]*>/i)?.[0];
  const raw = tag?.match(/content="([^"]*)"/i)?.[1];
  if (!raw) return null;
  const desc = decode(raw);
  const m = desc.match(/([\d.,]+\s*[KMkm]?)\s+Followers,\s+([\d.,]+\s*[KMkm]?)\s+Following,\s+([\d.,]+\s*[KMkm]?)\s+Posts/);
  if (!m) return null;
  return {
    username,
    available: true,
    fullName: desc.match(/Posts - (.+?) \(@/)?.[1],
    bio: desc.match(/on Instagram: "([\s\S]*)"$/)?.[1] || undefined,
    followers: parseCount(m[1]),
    following: parseCount(m[2]),
    posts: parseCount(m[3]),
  };
}

/**
 * Melhor esforço: o Instagram costuma barrar leituras sem login vindas de
 * servidores. Quando barra, devolve `available: false` e a análise segue sem
 * os números do perfil.
 */
export async function analyzeInstagram(username: string): Promise<InstagramData> {
  for (const attempt of [fromApi, fromHtml]) {
    try {
      const data = await attempt(username);
      if (data) return data;
    } catch {
      // tenta o próximo
    }
  }
  return { username, available: false };
}
