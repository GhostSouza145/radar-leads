import "server-only";
import type { LeadDraft, MapsSearchParams } from "@/lib/types";

const ENDPOINT = "https://places.googleapis.com/v1/places:searchText";

const PLACE_FIELDS = [
  "id",
  "displayName",
  "formattedAddress",
  "addressComponents",
  "nationalPhoneNumber",
  "websiteUri",
  "rating",
  "userRatingCount",
  "googleMapsUri",
  "primaryTypeDisplayName",
  "businessStatus",
  "location",
]
  .map((f) => `places.${f}`)
  .join(",");

interface LatLng {
  latitude: number;
  longitude: number;
}
interface Rect {
  low: LatLng;
  high: LatLng;
}
interface Place {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  addressComponents?: { longText: string; shortText: string; types: string[] }[];
  nationalPhoneNumber?: string;
  websiteUri?: string;
  rating?: number;
  userRatingCount?: number;
  googleMapsUri?: string;
  primaryTypeDisplayName?: { text: string };
  businessStatus?: string;
  location?: LatLng;
  viewport?: Rect;
}
interface SearchResponse {
  places?: Place[];
  nextPageToken?: string;
}

export class MapsProviderError extends Error {}

async function searchText(
  apiKey: string,
  body: Record<string, unknown>,
  fieldMask: string,
): Promise<SearchResponse> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": fieldMask,
    },
    body: JSON.stringify({ languageCode: "pt-BR", regionCode: "BR", ...body }),
    cache: "no-store",
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new MapsProviderError(
      `Google Places respondeu ${res.status}: ${err?.error?.message ?? res.statusText}`,
    );
  }
  return (await res.json()) as SearchResponse;
}

function component(place: Place, type: string, short = false): string | null {
  const c = place.addressComponents?.find((a) => a.types.includes(type));
  return c ? (short ? c.shortText : c.longText) : null;
}

function toDraft(place: Place): LeadDraft {
  return {
    source: "maps",
    external_id: place.id,
    name: place.displayName?.text ?? "(sem nome)",
    category: place.primaryTypeDisplayName?.text ?? null,
    address: place.formattedAddress ?? null,
    city: component(place, "administrative_area_level_2") ?? component(place, "locality"),
    state: component(place, "administrative_area_level_1", true),
    phone: place.nationalPhoneNumber ?? null,
    website: place.websiteUri ?? null,
    maps_url: place.googleMapsUri ?? null,
    rating: place.rating ?? null,
    reviews_count: place.userRatingCount ?? 0,
    extra: place.location ? { lat: place.location.latitude, lng: place.location.longitude } : {},
  };
}

/** Uma consulta paginada: no máximo 60 lugares (limite da API). */
async function searchAllPages(
  apiKey: string,
  body: Record<string, unknown>,
  max: number,
): Promise<Place[]> {
  const places: Place[] = [];
  let pageToken: string | undefined;
  do {
    const page = await searchText(
      apiKey,
      { ...body, pageSize: 20, ...(pageToken ? { pageToken } : {}) },
      `${PLACE_FIELDS},nextPageToken`,
    );
    places.push(...(page.places ?? []));
    pageToken = page.nextPageToken;
  } while (pageToken && places.length < max);
  return places;
}

function splitGrid(rect: Rect, n: number): Rect[] {
  const latStep = (rect.high.latitude - rect.low.latitude) / n;
  const lngStep = (rect.high.longitude - rect.low.longitude) / n;
  const cells: Rect[] = [];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      cells.push({
        low: {
          latitude: rect.low.latitude + i * latStep,
          longitude: rect.low.longitude + j * lngStep,
        },
        high: {
          latitude: rect.low.latitude + (i + 1) * latStep,
          longitude: rect.low.longitude + (j + 1) * lngStep,
        },
      });
    }
  }
  return cells;
}

export async function searchGooglePlaces(
  apiKey: string,
  { niche, location, depth, limit }: MapsSearchParams,
): Promise<LeadDraft[]> {
  const found = new Map<string, Place>();
  const add = (list: Place[]) => {
    for (const p of list) {
      if (p.businessStatus === "CLOSED_PERMANENTLY") continue;
      if (!found.has(p.id)) found.set(p.id, p);
    }
  };

  add(await searchAllPages(apiKey, { textQuery: `${niche} em ${location}` }, limit));

  // A API devolve no máximo 60 por consulta. Para ir além, divide a área da
  // cidade em uma grade e repete a busca restrita a cada célula.
  if (depth > 1 && found.size < limit) {
    const area = await searchText(
      apiKey,
      { textQuery: location, pageSize: 1 },
      "places.viewport",
    );
    const viewport = area.places?.[0]?.viewport;
    if (viewport) {
      for (const cell of splitGrid(viewport, depth)) {
        if (found.size >= limit) break;
        add(
          await searchAllPages(
            apiKey,
            { textQuery: niche, locationRestriction: { rectangle: cell } },
            limit - found.size,
          ),
        );
      }
    }
  }

  return [...found.values()].slice(0, limit).map(toDraft);
}
