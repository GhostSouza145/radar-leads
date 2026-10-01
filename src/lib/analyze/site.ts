import "server-only";
import type { SiteData } from "@/lib/types";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const TIMEOUT_MS = 9000;
const MAX_HTML_BYTES = 600_000;

/** Endereços que não são um site próprio: o "site" do negócio é só um perfil ou link. */
const SOCIAL_HOSTS: [RegExp, string][] = [
  [/(^|\.)instagram\.com$/, "Instagram"],
  [/(^|\.)facebook\.com$|(^|\.)fb\.com$|(^|\.)fb\.me$/, "Facebook"],
  [/(^|\.)wa\.me$|(^|\.)whatsapp\.com$|(^|\.)wa\.link$/, "WhatsApp"],
  [/(^|\.)linktr\.ee$|(^|\.)linktree\.com$|(^|\.)beacons\.ai$|(^|\.)bio\.site$|(^|\.)bio\.link$|(^|\.)lnk\.bio$/, "link na bio"],
  [/(^|\.)ifood\.com\.br$/, "iFood"],
  [/(^|\.)tiktok\.com$/, "TikTok"],
  [/(^|\.)youtube\.com$/, "YouTube"],
  [/(^|\.)business\.site$|(^|\.)negocio\.site$/, "site do Google Meu Negócio"],
  [/(^|\.)booksy\.com$|(^|\.)doctoralia\.com\.br$|(^|\.)trinks\.com$/, "plataforma de agendamento"],
];

const PLATFORMS: [RegExp, string][] = [
  [/wp-content|wp-includes/i, "WordPress"],
  [/wixstatic\.com|wix\.com/i, "Wix"],
  [/cdn\.shopify\.com/i, "Shopify"],
  [/squarespace/i, "Squarespace"],
  [/webflow/i, "Webflow"],
  [/nuvemshop|tiendanube/i, "Nuvemshop"],
  [/lojaintegrada/i, "Loja Integrada"],
  [/vtex/i, "VTEX"],
  [/tray\.com\.br|traycdn/i, "Tray"],
  [/sites\.google\.com/i, "Google Sites"],
  [/godaddy|wsimg\.com/i, "GoDaddy"],
  [/hostinger|zyrosite/i, "Hostinger"],
  [/rdstation|rdstation-static/i, "RD Station"],
];

export function normalizeUrl(raw: string): URL | null {
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

/** Não busca endereços internos (o site vem de dados externos e de digitação manual). */
function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) return true;
  if (host.includes(":")) return true; // IPv6 literal
  const ip = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (!ip) return false;
  const [a, b] = [Number(ip[1]), Number(ip[2])];
  return (
    a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224
  );
}

export function socialNetworkOf(url: URL): string | null {
  const host = url.hostname.toLowerCase();
  return SOCIAL_HOSTS.find(([re]) => re.test(host))?.[1] ?? null;
}

const IG_RESERVED = new Set(["p", "reel", "reels", "explore", "stories", "tv", "accounts", "share", "direct"]);

export function instagramHandle(text: string | null | undefined): string | null {
  if (!text) return null;
  for (const m of text.matchAll(/instagram\.com\/([A-Za-z0-9_.]{2,30})/g)) {
    const handle = m[1].replace(/\.$/, "").toLowerCase();
    if (!IG_RESERVED.has(handle)) return handle;
  }
  return null;
}

async function readLimited(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < MAX_HTML_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.length;
  }
  await reader.cancel().catch(() => {});
  return Buffer.concat(chunks).toString("utf8");
}

function meta(html: string, name: string): string | undefined {
  const tag = html.match(
    new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]*>`, "i"),
  )?.[0];
  return tag?.match(/content=["']([^"']*)["']/i)?.[1]?.trim() || undefined;
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)));
}

function parseHtml(html: string): Partial<SiteData> {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  const description = meta(html, "description") ?? meta(html, "og:description");
  const years = [...html.matchAll(/(?:©|&copy;|copyright)[^<]{0,40}?(20\d{2})/gi)].map((m) => Number(m[1]));
  const emails = [
    ...new Set(
      [...html.matchAll(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g)]
        .map((m) => m[0].toLowerCase())
        .filter((e) => !/\.(png|jpe?g|gif|webp|svg|css|js)$/.test(e) && !/sentry|wixpress|u003e|@(email|e-mail|exemplo|example|dominio|seudominio|domain|teste)\./.test(e)),
    ),
  ].slice(0, 3);
  const facebook = html.match(/facebook\.com\/(?!tr\b|sharer|plugins|dialog)([A-Za-z0-9_.\-]{3,60})/)?.[1];

  return {
    title: title ? decodeEntities(title.replace(/\s+/g, " ").trim()).slice(0, 160) : undefined,
    description: description ? decodeEntities(description).slice(0, 300) : undefined,
    mobileFriendly: /<meta[^>]+name=["']viewport["']/i.test(html),
    platform: PLATFORMS.find(([re]) => re.test(html))?.[1],
    hasAnalytics: /googletagmanager\.com\/gtag|google-analytics\.com|gtag\(\s*['"]config/i.test(html),
    hasTagManager: /googletagmanager\.com\/gtm\.js|GTM-[A-Z0-9]{4,}/.test(html),
    hasMetaPixel: /connect\.facebook\.net\/[^"']*\/fbevents\.js|fbq\(\s*['"]init/i.test(html),
    hasWhatsappButton: /wa\.me\/|api\.whatsapp\.com\/send|web\.whatsapp\.com\/send|wa\.link\//i.test(html),
    hasBooking: /agend(e|ar|amento)\s+(online|agora|sua|seu|uma|um)|calendly\.com|booksy\.com|doctoralia/i.test(html),
    hasSchema: /application\/ld\+json/i.test(html),
    copyrightYear: years.length ? Math.max(...years) : undefined,
    emails: emails.length ? emails : undefined,
    instagram: instagramHandle(html) ?? undefined,
    facebook,
  };
}

export async function analyzeSite(rawUrl: string): Promise<SiteData> {
  const url = normalizeUrl(rawUrl);
  if (!url || isPrivateHost(url.hostname)) {
    return { url: rawUrl, kind: "offline", error: "Endereço inválido" };
  }

  const social = socialNetworkOf(url);
  if (social) {
    return {
      url: url.href,
      kind: "social",
      socialNetwork: social,
      instagram: instagramHandle(url.href) ?? undefined,
    };
  }

  const started = Date.now();
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, "Accept-Language": "pt-BR,pt;q=0.9", Accept: "text/html,*/*" },
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    const html = await readLimited(res);
    const loadMs = Date.now() - started;
    const finalUrl = new URL(res.url || url.href);

    // Redirecionou para rede social: o domínio existe mas não há site próprio.
    const redirectedSocial = socialNetworkOf(finalUrl);
    if (redirectedSocial) {
      return {
        url: url.href,
        finalUrl: finalUrl.href,
        kind: "social",
        socialNetwork: redirectedSocial,
        instagram: instagramHandle(finalUrl.href) ?? undefined,
      };
    }

    // 401/403/429 costumam ser proteção anti-robô, não site fora do ar.
    const blocked = [401, 403, 429, 503].includes(res.status);
    if (!res.ok && !blocked) {
      return { url: url.href, finalUrl: finalUrl.href, kind: "offline", status: res.status, loadMs, error: `HTTP ${res.status}` };
    }

    return {
      url: url.href,
      finalUrl: finalUrl.href,
      kind: "site",
      status: res.status,
      https: finalUrl.protocol === "https:",
      loadMs,
      ...(blocked ? { error: "Site bloqueou a leitura automática" } : parseHtml(html)),
    };
  } catch (err) {
    const timedOut = err instanceof Error && err.name === "TimeoutError";
    return {
      url: url.href,
      kind: "offline",
      loadMs: Date.now() - started,
      error: timedOut ? "Não respondeu em 9 segundos" : "Não foi possível abrir o site",
    };
  }
}
