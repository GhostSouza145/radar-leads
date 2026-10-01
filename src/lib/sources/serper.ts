import "server-only";
import type { LeadDraft, MapsSearchParams } from "@/lib/types";
import { MapsProviderError } from "./google-places";

interface SerperPlace {
  title: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  rating?: number;
  ratingCount?: number;
  type?: string;
  website?: string;
  phoneNumber?: string;
  cid?: string;
  placeId?: string;
}

/** "Rua X, 10 - Centro, Campinas - SP, 13000-000" -> { city: "Campinas", state: "SP" } */
function cityState(address: string | undefined): { city: string | null; state: string | null } {
  const match = address?.match(/([^,-]+?)\s*-\s*([A-Z]{2})(?:,|$)/);
  return { city: match?.[1]?.trim() ?? null, state: match?.[2] ?? null };
}

export async function searchSerper(
  apiKey: string,
  { niche, location, limit }: MapsSearchParams,
): Promise<LeadDraft[]> {
  const found = new Map<string, LeadDraft>();

  for (let page = 1; page <= 5 && found.size < limit; page++) {
    const res = await fetch("https://google.serper.dev/maps", {
      method: "POST",
      headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ q: `${niche} em ${location}`, gl: "br", hl: "pt-br", page }),
      cache: "no-store",
    });
    if (!res.ok) {
      if (page > 1) break;
      const err = (await res.json().catch(() => null)) as { message?: string } | null;
      throw new MapsProviderError(`Serper respondeu ${res.status}: ${err?.message ?? res.statusText}`);
    }
    const data = (await res.json()) as { places?: SerperPlace[] };
    const places = data.places ?? [];
    const before = found.size;
    for (const p of places) {
      const id = p.placeId ?? p.cid;
      if (!id || found.has(id)) continue;
      found.set(id, {
        source: "maps",
        external_id: id,
        name: p.title,
        category: p.type ?? null,
        address: p.address ?? null,
        ...cityState(p.address),
        phone: p.phoneNumber ?? null,
        website: p.website ?? null,
        maps_url: p.cid
          ? `https://www.google.com/maps?cid=${p.cid}`
          : `https://www.google.com/maps/place/?q=place_id:${id}`,
        rating: p.rating ?? null,
        reviews_count: p.ratingCount ?? 0,
        extra: p.latitude && p.longitude ? { lat: p.latitude, lng: p.longitude } : {},
      });
    }
    if (found.size === before) break;
  }

  return [...found.values()].slice(0, limit);
}
