/**
 * Unified FilterConfig — role-agnostic filter shape for buyer/investor/realtor.
 *
 * Base = city + radius (loose). Zips layer on top:
 *   include → overrides cities entirely (zip-only search)
 *   exclude → SUBTRACT from locations
 *   off     → ignore zips
 *
 * Property details (price, beds, baths, sqft, dealType, excludeLand,
 * maxArvPercent) are optional. When set, they narrow the result set on top of
 * the location/zip selection.
 */

export interface LocationEntry {
  city: string;
  state: string;       // 2-letter code
  radiusMiles: number; // per-location radius
}

export type ZipMode = 'include' | 'exclude' | 'off';

export interface ZipFilter {
  mode: ZipMode;
  codes: string[]; // 5-digit strings, deduped
}

export type DealTypeChoice = 'all' | 'owner_finance' | 'cash_deal';

export interface Range {
  min?: number;
  max?: number;
}

export interface FilterConfig {
  locations: LocationEntry[];
  zips: ZipFilter;
  dealType?: DealTypeChoice;
  price?: Range;
  beds?: number;          // minimum beds
  baths?: number;         // minimum baths
  sqft?: Range;
  excludeLand?: boolean;
  /** Hides auction / foreclosure / bank-owned ("distressed") listings. */
  excludeAuctions?: boolean;
  maxArvPercent?: number; // show only deals at or below this % of Zestimate
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

const MAX_PRICE = 100_000_000;
const MAX_SQFT = 1_000_000;
const MAX_BEDS = 20;
const MAX_BATHS = 20;
const MAX_ARV_PERCENT = 300;

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

function clampInt(raw: unknown, min: number, max: number): number | undefined {
  if (raw === null || raw === undefined || raw === '') return undefined;
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n)) return undefined;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function clampFloat(raw: unknown, min: number, max: number): number | undefined {
  if (raw === null || raw === undefined || raw === '') return undefined;
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n)) return undefined;
  return Math.max(min, Math.min(max, n));
}

function normalizeRange(raw: unknown, max: number): Range | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  let min = clampInt(r.min, 0, max);
  let maxV = clampInt(r.max, 0, max);
  // Swap if min > max (user probably intended the wider window)
  if (min !== undefined && maxV !== undefined && min > maxV) {
    [min, maxV] = [maxV, min];
  }
  if (min === undefined && maxV === undefined) return undefined;
  const out: Range = {};
  if (min !== undefined) out.min = min;
  if (maxV !== undefined) out.max = maxV;
  return out;
}

/**
 * Normalize an incoming FilterConfig payload. Drops invalid entries silently,
 * dedupes, enforces caps (MAX_LOCATIONS, MAX_ZIPS). Always returns a valid
 * FilterConfig — unusable input produces EMPTY_FILTER.
 *
 * Side-effect worth knowing: an include-mode payload with zero valid codes is
 * downgraded to mode='off' so callers can't accidentally save a filter that
 * matches nothing.
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

  const out: FilterConfig = {
    locations,
    zips: { mode: effectiveMode, codes },
  };

  // Optional property-detail fields
  if (src.dealType === 'all' || src.dealType === 'owner_finance' || src.dealType === 'cash_deal') {
    out.dealType = src.dealType;
  }
  const price = normalizeRange(src.price, MAX_PRICE);
  if (price) out.price = price;
  const beds = clampInt(src.beds, 0, MAX_BEDS);
  if (beds !== undefined && beds > 0) out.beds = beds;
  const baths = clampFloat(src.baths, 0, MAX_BATHS);
  if (baths !== undefined && baths > 0) out.baths = baths;
  const sqft = normalizeRange(src.sqft, MAX_SQFT);
  if (sqft) out.sqft = sqft;
  if (src.excludeLand === true) out.excludeLand = true;
  if (src.excludeAuctions === true) out.excludeAuctions = true;
  const maxArv = clampFloat(src.maxArvPercent, 0, MAX_ARV_PERCENT);
  if (maxArv !== undefined && maxArv > 0) out.maxArvPercent = maxArv;

  return out;
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

/**
 * True when the filter has no criteria at all — no locations, no zips, no
 * property-detail restrictions. Used to reject empty saved-searches.
 */
export function isFilterEmpty(cfg: FilterConfig): boolean {
  if (cfg.locations.length > 0) return false;
  if (cfg.zips.codes.length > 0) return false;
  if (cfg.dealType && cfg.dealType !== 'all') return false;
  if (cfg.price && (cfg.price.min !== undefined || cfg.price.max !== undefined)) return false;
  if (cfg.beds !== undefined) return false;
  if (cfg.baths !== undefined) return false;
  if (cfg.sqft && (cfg.sqft.min !== undefined || cfg.sqft.max !== undefined)) return false;
  if (cfg.excludeLand) return false;
  if (cfg.excludeAuctions) return false;
  if (cfg.maxArvPercent !== undefined) return false;
  return true;
}

/**
 * Deterministic serialization of a FilterConfig for equality checks.
 * Key order is fixed, so server-sent and client-built configs compare equal
 * when they represent the same filter (fixes the JSON.stringify key-order
 * dirty flicker).
 */
export function serializeFilter(cfg: FilterConfig): string {
  const locs = cfg.locations
    .map(l => `${l.city.toLowerCase()}|${l.state}|${l.radiusMiles}`)
    .sort();
  const zips = [...cfg.zips.codes].sort();
  const parts: string[] = [
    `loc:${locs.join(',')}`,
    `zm:${cfg.zips.mode}`,
    `zc:${zips.join(',')}`,
    `dt:${cfg.dealType || ''}`,
    `pmin:${cfg.price?.min ?? ''}`,
    `pmax:${cfg.price?.max ?? ''}`,
    `b:${cfg.beds ?? ''}`,
    `ba:${cfg.baths ?? ''}`,
    `smin:${cfg.sqft?.min ?? ''}`,
    `smax:${cfg.sqft?.max ?? ''}`,
    `el:${cfg.excludeLand ? 1 : 0}`,
    `ea:${cfg.excludeAuctions ? 1 : 0}`,
    `arv:${cfg.maxArvPercent ?? ''}`,
  ];
  return parts.join('||');
}

export function filterEquals(a: FilterConfig, b: FilterConfig): boolean {
  return serializeFilter(a) === serializeFilter(b);
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
  const rawRadius = Number(profile.filter?.radiusMiles);
  const radiusMiles = Number.isFinite(rawRadius)
    ? Math.min(MAX_RADIUS, Math.max(MIN_RADIUS, rawRadius))
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
  MAX_PRICE,
  MAX_SQFT,
  MAX_BEDS,
  MAX_BATHS,
  MAX_ARV_PERCENT,
  MAX_SAVED_SEARCHES: 50,
} as const;
