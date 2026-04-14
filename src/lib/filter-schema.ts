/**
 * Unified FilterConfig — role-agnostic filter shape for buyer/investor/realtor.
 *
 * Base = city + radius (loose). Zips layer on top:
 *   include → UNION with locations (zips can be anywhere in US)
 *   exclude → SUBTRACT from locations
 *   off     → ignore zips
 *
 * Strict-zip-only mode: set locations=[] and mode='include'.
 */

export interface LocationEntry {
  city: string;
  state: string;       // 2-letter code
  radiusMiles: number; // per-location radius
}

export type ZipMode = 'include' | 'exclude' | 'off';

export interface ZipFilter {
  mode: ZipMode;
  codes: string[]; // 5-digit, deduped, uppercased N/A — digits only
}

export interface FilterConfig {
  locations: LocationEntry[];
  zips: ZipFilter;
}

export const EMPTY_FILTER: FilterConfig = {
  locations: [],
  zips: { mode: 'off', codes: [] },
};

// ─── Validation / normalization ──────────────────────────────────────────────

const ZIP_RE = /^\d{5}$/;
const STATE_RE = /^[A-Z]{2}$/;
const MAX_ZIPS = 100;
const MAX_LOCATIONS = 20;
const MIN_RADIUS = 0;
const MAX_RADIUS = 500;
const DEFAULT_RADIUS = 30;

export function normalizeZip(raw: string): string | null {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, '').slice(0, 5);
  return ZIP_RE.test(digits) ? digits : null;
}

export function normalizeLocation(raw: unknown): LocationEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const city = typeof r.city === 'string' ? r.city.trim() : '';
  const state = typeof r.state === 'string' ? r.state.trim().toUpperCase() : '';
  const rawRadius = Number(r.radiusMiles);
  if (!city || !STATE_RE.test(state)) return null;
  const radiusMiles = Number.isFinite(rawRadius)
    ? Math.min(MAX_RADIUS, Math.max(MIN_RADIUS, rawRadius))
    : DEFAULT_RADIUS;
  return { city, state, radiusMiles };
}

/**
 * Normalize and validate an incoming FilterConfig payload.
 * Drops invalid entries silently; caps sizes; dedupes zips (case-insensitive).
 * Returns null if the entire payload is unusable.
 */
export function normalizeFilterConfig(input: unknown): FilterConfig {
  const src = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;

  // Locations
  const rawLocations = Array.isArray(src.locations) ? src.locations : [];
  const seenLoc = new Set<string>();
  const locations: LocationEntry[] = [];
  for (const raw of rawLocations) {
    const loc = normalizeLocation(raw);
    if (!loc) continue;
    const key = `${loc.city.toLowerCase()}|${loc.state}`;
    if (seenLoc.has(key)) continue;
    seenLoc.add(key);
    locations.push(loc);
    if (locations.length >= MAX_LOCATIONS) break;
  }

  // Zips
  const rawZips = (src.zips && typeof src.zips === 'object' ? src.zips : {}) as Record<string, unknown>;
  const mode: ZipMode =
    rawZips.mode === 'include' || rawZips.mode === 'exclude' ? rawZips.mode : 'off';
  const rawCodes = Array.isArray(rawZips.codes) ? rawZips.codes : [];
  const seenZip = new Set<string>();
  const codes: string[] = [];
  for (const raw of rawCodes) {
    const z = normalizeZip(typeof raw === 'string' ? raw : String(raw ?? ''));
    if (!z || seenZip.has(z)) continue;
    seenZip.add(z);
    codes.push(z);
    if (codes.length >= MAX_ZIPS) break;
  }

  // Force mode=off when no codes — avoids "include with empty list → 0 results" surprise
  const effectiveMode: ZipMode = codes.length === 0 ? 'off' : mode;

  return {
    locations,
    zips: { mode: effectiveMode, codes },
  };
}

/**
 * Returns true if the filter will produce any results. False when include-mode
 * has zero codes AND no locations — UI should warn before saving this.
 */
export function isFilterSearchable(cfg: FilterConfig): boolean {
  if (cfg.locations.length > 0) return true;
  if (cfg.zips.mode === 'include' && cfg.zips.codes.length > 0) return true;
  return false;
}

// ─── Legacy compat ───────────────────────────────────────────────────────────

interface LegacyProfileShape {
  preferredCity?: string;
  preferredState?: string;
  city?: string;
  state?: string;
  filter?: {
    nearbyCities?: string[];
    radiusMiles?: number;
  };
}

/**
 * Synthesize a FilterConfig from legacy buyer profile fields. Used when the
 * userFilters doc doesn't exist yet. Never throws; returns EMPTY_FILTER if
 * legacy fields are also missing.
 */
export function filterConfigFromLegacy(profile: LegacyProfileShape | null | undefined): FilterConfig {
  if (!profile) return EMPTY_FILTER;
  const city = (profile.preferredCity || profile.city || '').trim();
  const state = (profile.preferredState || profile.state || '').trim().toUpperCase();
  if (!city || !STATE_RE.test(state)) return EMPTY_FILTER;
  const radiusMiles = Number.isFinite(profile.filter?.radiusMiles)
    ? profile.filter!.radiusMiles!
    : DEFAULT_RADIUS;
  return {
    locations: [{ city, state, radiusMiles }],
    zips: { mode: 'off', codes: [] },
  };
}

export const FILTER_LIMITS = {
  MAX_ZIPS,
  MAX_LOCATIONS,
  MAX_RADIUS,
  MIN_RADIUS,
  DEFAULT_RADIUS,
} as const;
