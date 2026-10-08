// Thin REST client for the Qloo hackathon API (https://hackathon.api.qloo.com).
// Auth: X-Api-Key header (NOT Authorization: Bearer - that returns 401).
// All behavior here is based on live-tested calls against the hackathon API, 2026-10-05/06.

const BASE_URL = process.env.QLOO_API_BASE_URL ?? "https://hackathon.api.qloo.com";

function apiKey(): string {
  const key = process.env.QLOO_API_KEY;
  if (!key) throw new Error("QLOO_API_KEY is not set");
  return key;
}

const MAX_RETRIES = 3;
const RETRY_BASE_MS = 500;

function isRetryable(err: unknown): boolean {
  if (err instanceof Error) {
    if (/ECONNRESET|ETIMEDOUT|ENOTFOUND|socket hang up/i.test(err.message)) return true;
    if (/Qloo request failed \((429|5\d\d)\)/.test(err.message)) return true;
  }
  return false;
}

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === MAX_RETRIES || !isRetryable(err)) throw err;
      const delay = RETRY_BASE_MS * 2 ** attempt + Math.random() * 200;
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error("withRetry: exhausted retries"); // unreachable
}

async function qlooFetch(path: string, params: Record<string, string>): Promise<unknown> {
  const url = new URL(path, BASE_URL);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") url.searchParams.set(k, v);
  }

  return withRetry(async () => {
    const res = await fetch(url.toString(), {
      headers: { "X-Api-Key": apiKey() },
    });

    const body = await res.json();

    if (!res.ok || body?.errors) {
      const message =
        body?.errors?.[0]?.message ?? body?.message ?? `Qloo request failed (${res.status})`;
      throw new Error(message);
    }

    return body;
  });
}

export type QlooEntityType =
  | "urn:entity:artist"
  | "urn:entity:book"
  | "urn:entity:brand"
  | "urn:entity:destination"
  | "urn:entity:locality"
  | "urn:entity:movie"
  | "urn:entity:person"
  | "urn:entity:place"
  | "urn:entity:podcast"
  | "urn:entity:tv_show"
  | "urn:entity:videogame";

export interface QlooEntity {
  entityId: string;
  name: string;
  type: string;
  subtype?: string;
  popularity?: number;
  tags: { id: string; name: string; type: string }[];
}

export interface QlooSearchResult extends QlooEntity {
  disambiguation?: string;
}

/**
 * Resolve a free-text taste anchor (e.g. "Radiohead", "Nobu") to a Qloo entity.
 * Confirmed live 2026-10-05: works cleanly for artist/place/etc with `types` filter applied.
 */
export async function searchEntity(
  query: string,
  type?: QlooEntityType,
  take = 1,
): Promise<QlooSearchResult[]> {
  const body = (await qlooFetch("/search", {
    query,
    types: type ?? "",
    take: String(take),
  })) as { results: any[] };

  return (body.results ?? []).map((r) => ({
    entityId: r.entity_id,
    name: r.name,
    type: Array.isArray(r.types) ? r.types[0] : r.type,
    popularity: r.popularity,
    disambiguation: r.disambiguation,
    tags: (r.tags ?? []).map((t: any) => ({ id: t.tag_id ?? t.id, name: t.name, type: t.type })),
  }));
}

/**
 * Look up a tag ID by keyword (e.g. "rooftop bar" -> urn:tag:amenity:place:rooftop_bar).
 * Confirmed live 2026-10-06.
 */
export async function getTags(query: string, take = 5): Promise<
  { id: string; name: string; type: string }[]
> {
  const body = (await qlooFetch("/v2/tags", {
    "filter.query": query,
    take: String(take),
  })) as { results: { tags: any[] } };

  return (body.results?.tags ?? []).map((t) => ({ id: t.id, name: t.name, type: t.type }));
}

export interface InsightsEntityAttribution {
  entityId: string;
  score: number;
}

export interface InsightsResult extends QlooEntity {
  affinity: number;
  explainability?: InsightsEntityAttribution[];
}

export interface GetInsightsParams {
  /** Target entity category to get recommendations for. */
  filterType: QlooEntityType;
  /** Entity IDs feeding the affinity computation - can mix types (confirmed live). */
  signalEntityIds: string[];
  /** Entity IDs to exclude from results (used for reject -> re-negotiate). */
  excludeEntityIds?: string[];
  /** Fuzzy location scoping, e.g. a destination name, for round-2 place queries. */
  locationQuery?: string;
  /** Request per-signal attribution breakdown. Confirmed live 2026-10-05. */
  explainability?: boolean;
  take?: number;
}

/**
 * The core Palatable call: combined cross-domain affinity across multiple
 * participants' taste signals, for a given target entity category.
 *
 * Confirmed live 2026-10-05/06:
 * - signal.interests.entities accepts MIXED entity types and computes genuine
 *   combined affinity (not an average) when filterType is urn:entity:destination
 *   or urn:entity:place.
 * - urn:entity:locality does NOT accept entity/tag signals (will 400 or 504) -
 *   use urn:entity:destination instead for trip-destination recommendations.
 */
export async function getInsights(params: GetInsightsParams): Promise<InsightsResult[]> {
  const body = (await qlooFetch("/v2/insights", {
    "filter.type": params.filterType,
    "signal.interests.entities": params.signalEntityIds.join(","),
    "filter.exclude.entities": (params.excludeEntityIds ?? []).join(","),
    "signal.location.query": params.locationQuery ?? "",
    "feature.explainability": params.explainability ? "true" : "",
    take: String(params.take ?? 5),
  })) as { results: { entities: any[] } };

  return (body.results?.entities ?? []).map((e) => ({
    entityId: e.entity_id,
    name: e.name,
    type: e.type,
    subtype: e.subtype,
    popularity: e.popularity,
    tags: (e.tags ?? []).map((t: any) => ({ id: t.id, name: t.name, type: t.type })),
    affinity: e.query?.affinity,
    explainability: e.query?.explainability?.["signal.interests.entities"]?.map((a: any) => ({
      entityId: a.entity_id,
      score: a.score ?? a.avg_score,
    })),
  }));
}
