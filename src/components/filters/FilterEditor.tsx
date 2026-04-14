'use client';

/**
 * FilterEditor — reusable UI for editing a FilterConfig.
 *
 * Sections:
 *   1. Saved Searches strip (load / save-as / rename / delete)
 *   2. Locations (multi-city + per-city radius)
 *   3. Zip Codes (include | exclude | off)
 *   4. Property Details (deal type, price, beds, baths, sqft, land, max ARV%)
 *
 * Used by:
 *   /admin/users/[userId]/filters       (admin edits any user)
 *   /dashboard/settings                 (buyer/investor self-edit)
 *   /realtor-dashboard/deals modal      (realtor self-edit)
 */

import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  FilterConfig,
  LocationEntry,
  ZipMode,
  DealTypeChoice,
  FILTER_LIMITS,
  EMPTY_FILTER,
  normalizeZip,
  isFilterSearchable,
} from '@/lib/filter-schema';
import { US_STATES } from '@/lib/us-states';
import type { SavedSearch } from '@/lib/saved-searches-store';

interface FilterEditorProps {
  initialFilter: FilterConfig;
  onSave: (next: FilterConfig) => Promise<void> | void;
  saving?: boolean;
  /** Optional label shown at top — e.g. "Editing filters for Alice Smith". */
  headerNote?: string;
  /** Disable the Saved Searches strip (e.g. when admin is editing a different user's filter). */
  disableSavedSearches?: boolean;
}

const RADIUS_PRESETS = [10, 30, 60, 100, 200];
const BED_PRESETS: Array<{ label: string; value: number }> = [
  { label: 'Any', value: 0 },
  { label: '1+', value: 1 },
  { label: '2+', value: 2 },
  { label: '3+', value: 3 },
  { label: '4+', value: 4 },
];
const BATH_PRESETS: Array<{ label: string; value: number }> = [
  { label: 'Any', value: 0 },
  { label: '1+', value: 1 },
  { label: '2+', value: 2 },
  { label: '3+', value: 3 },
];

function fcEquals(a: FilterConfig, b: FilterConfig): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function FilterEditor({
  initialFilter,
  onSave,
  saving = false,
  headerNote,
  disableSavedSearches = false,
}: FilterEditorProps) {
  // ─── All filter state ───
  const [locations, setLocations] = useState<LocationEntry[]>(initialFilter.locations);
  const [zipMode, setZipMode] = useState<ZipMode>(initialFilter.zips.mode);
  const [zipCodes, setZipCodes] = useState<string[]>(initialFilter.zips.codes);
  const [zipInput, setZipInput] = useState('');
  const [zipError, setZipError] = useState<string | null>(null);

  const [dealType, setDealType] = useState<DealTypeChoice>(initialFilter.dealType ?? 'all');
  const [priceMin, setPriceMin] = useState<string>(initialFilter.price?.min?.toString() ?? '');
  const [priceMax, setPriceMax] = useState<string>(initialFilter.price?.max?.toString() ?? '');
  const [beds, setBeds] = useState<number>(initialFilter.beds ?? 0);
  const [baths, setBaths] = useState<number>(initialFilter.baths ?? 0);
  const [sqftMin, setSqftMin] = useState<string>(initialFilter.sqft?.min?.toString() ?? '');
  const [sqftMax, setSqftMax] = useState<string>(initialFilter.sqft?.max?.toString() ?? '');
  const [excludeLand, setExcludeLand] = useState<boolean>(initialFilter.excludeLand ?? false);
  const [maxArvPercent, setMaxArvPercent] = useState<string>(
    initialFilter.maxArvPercent !== undefined ? String(initialFilter.maxArvPercent) : '',
  );

  // Re-seed from prop when the parent passes a new initialFilter (e.g. after save
  // or when a saved search is loaded).
  useEffect(() => {
    setLocations(initialFilter.locations);
    setZipMode(initialFilter.zips.mode);
    setZipCodes(initialFilter.zips.codes);
    setDealType(initialFilter.dealType ?? 'all');
    setPriceMin(initialFilter.price?.min?.toString() ?? '');
    setPriceMax(initialFilter.price?.max?.toString() ?? '');
    setBeds(initialFilter.beds ?? 0);
    setBaths(initialFilter.baths ?? 0);
    setSqftMin(initialFilter.sqft?.min?.toString() ?? '');
    setSqftMax(initialFilter.sqft?.max?.toString() ?? '');
    setExcludeLand(initialFilter.excludeLand ?? false);
    setMaxArvPercent(initialFilter.maxArvPercent !== undefined ? String(initialFilter.maxArvPercent) : '');
    setZipError(null);
    setZipInput('');
  }, [initialFilter]);

  // ─── Derive the current FilterConfig ───
  const current: FilterConfig = useMemo(() => {
    const cfg: FilterConfig = {
      locations,
      zips: { mode: zipMode, codes: zipCodes },
    };
    if (dealType !== 'all') cfg.dealType = dealType;
    const pMin = priceMin.trim() ? Number(priceMin.replace(/[^\d]/g, '')) : undefined;
    const pMax = priceMax.trim() ? Number(priceMax.replace(/[^\d]/g, '')) : undefined;
    if (Number.isFinite(pMin) || Number.isFinite(pMax)) {
      cfg.price = {};
      if (Number.isFinite(pMin)) cfg.price.min = pMin!;
      if (Number.isFinite(pMax)) cfg.price.max = pMax!;
    }
    if (beds > 0) cfg.beds = beds;
    if (baths > 0) cfg.baths = baths;
    const sMin = sqftMin.trim() ? Number(sqftMin.replace(/[^\d]/g, '')) : undefined;
    const sMax = sqftMax.trim() ? Number(sqftMax.replace(/[^\d]/g, '')) : undefined;
    if (Number.isFinite(sMin) || Number.isFinite(sMax)) {
      cfg.sqft = {};
      if (Number.isFinite(sMin)) cfg.sqft.min = sMin!;
      if (Number.isFinite(sMax)) cfg.sqft.max = sMax!;
    }
    if (excludeLand) cfg.excludeLand = true;
    const arv = maxArvPercent.trim() ? Number(maxArvPercent) : undefined;
    if (Number.isFinite(arv) && arv! > 0) cfg.maxArvPercent = arv;
    return cfg;
  }, [
    locations, zipMode, zipCodes, dealType, priceMin, priceMax,
    beds, baths, sqftMin, sqftMax, excludeLand, maxArvPercent,
  ]);

  const searchable = isFilterSearchable(current);
  const dirty = !fcEquals(current, initialFilter);

  // ─── Locations ───
  const addLocation = () => {
    if (locations.length >= FILTER_LIMITS.MAX_LOCATIONS) return;
    setLocations([...locations, { city: '', state: 'TX', radiusMiles: FILTER_LIMITS.DEFAULT_RADIUS }]);
  };

  const updateLocation = (index: number, patch: Partial<LocationEntry>) => {
    setLocations(prev => prev.map((loc, i) => (i === index ? { ...loc, ...patch } : loc)));
  };

  const removeLocation = (index: number) => {
    setLocations(prev => prev.filter((_, i) => i !== index));
  };

  // ─── Zips ───
  const addZipFromInput = () => {
    if (!zipInput.trim()) return;
    const tokens = zipInput.split(/[\s,;\n]+/).filter(Boolean);
    const accepted: string[] = [];
    const rejected: string[] = [];
    for (const tok of tokens) {
      const z = normalizeZip(tok);
      if (z && !zipCodes.includes(z) && !accepted.includes(z)) {
        if (zipCodes.length + accepted.length >= FILTER_LIMITS.MAX_ZIPS) break;
        accepted.push(z);
      } else if (!z) {
        rejected.push(tok);
      }
    }
    if (accepted.length) setZipCodes(prev => [...prev, ...accepted]);
    if (rejected.length) {
      setZipError(`Skipped ${rejected.length} invalid: ${rejected.slice(0, 3).join(', ')}${rejected.length > 3 ? '…' : ''}`);
    } else {
      setZipError(null);
    }
    setZipInput('');
  };

  const removeZip = (code: string) => {
    setZipCodes(prev => prev.filter(c => c !== code));
  };

  const clearZips = () => {
    setZipCodes([]);
    setZipError(null);
  };

  // ─── Saved Searches ───
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [savedLoading, setSavedLoading] = useState(false);
  const [saveAsOpen, setSaveAsOpen] = useState(false);
  const [saveAsName, setSaveAsName] = useState('');
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [savedError, setSavedError] = useState<string | null>(null);

  const fetchSavedSearches = useCallback(async () => {
    if (disableSavedSearches) return;
    setSavedLoading(true);
    try {
      const res = await fetch('/api/user/saved-searches', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setSavedSearches(data.searches || []);
    } catch {
      // non-fatal — strip just shows empty
    } finally {
      setSavedLoading(false);
    }
  }, [disableSavedSearches]);

  useEffect(() => {
    fetchSavedSearches();
  }, [fetchSavedSearches]);

  const loadSavedSearch = (search: SavedSearch) => {
    const cfg = search.filter || EMPTY_FILTER;
    setLocations(cfg.locations);
    setZipMode(cfg.zips.mode);
    setZipCodes(cfg.zips.codes);
    setDealType(cfg.dealType ?? 'all');
    setPriceMin(cfg.price?.min?.toString() ?? '');
    setPriceMax(cfg.price?.max?.toString() ?? '');
    setBeds(cfg.beds ?? 0);
    setBaths(cfg.baths ?? 0);
    setSqftMin(cfg.sqft?.min?.toString() ?? '');
    setSqftMax(cfg.sqft?.max?.toString() ?? '');
    setExcludeLand(cfg.excludeLand ?? false);
    setMaxArvPercent(cfg.maxArvPercent !== undefined ? String(cfg.maxArvPercent) : '');
  };

  const createSavedSearch = async () => {
    const name = saveAsName.trim();
    if (!name) return;
    setSavedError(null);
    try {
      const res = await fetch('/api/user/saved-searches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, filter: current }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setSavedSearches(prev => [data.search, ...prev]);
      setSaveAsOpen(false);
      setSaveAsName('');
    } catch (e) {
      setSavedError(e instanceof Error ? e.message : 'Save failed');
    }
  };

  const renameSavedSearch = async (id: string) => {
    const name = renameValue.trim();
    if (!name) return;
    setSavedError(null);
    try {
      const res = await fetch(`/api/user/saved-searches/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setSavedSearches(prev => prev.map(s => (s.id === id ? data.search : s)));
      setRenameId(null);
      setRenameValue('');
    } catch (e) {
      setSavedError(e instanceof Error ? e.message : 'Rename failed');
    }
  };

  const deleteSavedSearch = async (id: string) => {
    if (!confirm('Delete this saved search?')) return;
    setSavedError(null);
    try {
      const res = await fetch(`/api/user/saved-searches/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSavedSearches(prev => prev.filter(s => s.id !== id));
    } catch (e) {
      setSavedError(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  // ─── Save ───
  const handleSave = async () => {
    if (!searchable) {
      const ok = confirm('Filter matches nothing — save anyway?');
      if (!ok) return;
    }
    try {
      await onSave(current);
    } catch {
      // parent surfaces the error; keep modal open
    }
  };

  return (
    <div className="space-y-5">
      {headerNote && (
        <div className="text-xs text-slate-400 bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2">
          {headerNote}
        </div>
      )}

      {/* ── Saved Searches strip ── */}
      {!disableSavedSearches && (
        <section className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <h3 className="text-white font-semibold text-sm">Saved Searches</h3>
              <span className="text-[10px] text-slate-500">
                {savedSearches.length}/{FILTER_LIMITS.MAX_SAVED_SEARCHES}
              </span>
            </div>
            <button
              type="button"
              onClick={() => { setSaveAsOpen(true); setSaveAsName(''); setSavedError(null); }}
              className="text-xs text-[#00BC7D] hover:text-[#00d68f] font-semibold"
            >
              + Save current
            </button>
          </div>

          {saveAsOpen && (
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={saveAsName}
                onChange={e => setSaveAsName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); createSavedSearch(); } }}
                placeholder="Name (e.g. Memphis Fixers)"
                autoFocus
                className="flex-1 px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm focus:border-[#00BC7D] focus:outline-none"
              />
              <button
                type="button"
                onClick={createSavedSearch}
                disabled={!saveAsName.trim()}
                className="px-3 py-2 bg-[#00BC7D] hover:bg-[#00d68f] disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-semibold rounded-lg"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setSaveAsOpen(false)}
                className="px-3 py-2 text-slate-400 hover:text-white text-sm"
              >
                Cancel
              </button>
            </div>
          )}

          {savedError && <p className="text-xs text-red-400 mb-2">{savedError}</p>}

          {savedLoading ? (
            <p className="text-xs text-slate-500 italic py-1">Loading…</p>
          ) : savedSearches.length === 0 ? (
            <p className="text-xs text-slate-500 italic py-1">
              No saved searches yet. Set up a filter and hit "Save current" to pin it.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {savedSearches.map(s => (
                <div key={s.id} className="inline-flex items-center bg-slate-900 border border-slate-700 rounded-lg">
                  {renameId === s.id ? (
                    <>
                      <input
                        type="text"
                        value={renameValue}
                        onChange={e => setRenameValue(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') { e.preventDefault(); renameSavedSearch(s.id); }
                          if (e.key === 'Escape') { setRenameId(null); }
                        }}
                        autoFocus
                        className="px-2 py-1 bg-transparent text-white text-xs w-32 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => renameSavedSearch(s.id)}
                        className="px-2 py-1 text-[#00BC7D] text-xs hover:text-[#00d68f]"
                      >
                        ✓
                      </button>
                      <button
                        type="button"
                        onClick={() => setRenameId(null)}
                        className="px-2 py-1 text-slate-400 text-xs hover:text-white"
                      >
                        ✕
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => loadSavedSearch(s)}
                        className="px-2.5 py-1 text-white text-xs font-medium hover:bg-slate-800 rounded-l-lg"
                        title="Load this search"
                      >
                        {s.name}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setRenameId(s.id); setRenameValue(s.name); }}
                        aria-label="Rename"
                        className="px-1.5 py-1 text-slate-500 hover:text-slate-200 border-l border-slate-700"
                      >
                        ✎
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteSavedSearch(s.id)}
                        aria-label="Delete"
                        className="px-1.5 py-1 text-slate-500 hover:text-red-400 border-l border-slate-700 rounded-r-lg"
                      >
                        🗑
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── Locations ── */}
      <section className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-white font-semibold text-sm">Locations</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Cities with a search radius. Properties inside any radius match.
            </p>
          </div>
          <span className="text-[10px] text-slate-500">
            {locations.length}/{FILTER_LIMITS.MAX_LOCATIONS}
          </span>
        </div>

        {locations.length === 0 && (
          <p className="text-sm text-slate-500 italic py-3">
            No cities — add one below, or use zip-include mode for nationwide zip search.
          </p>
        )}

        <div className="space-y-2">
          {locations.map((loc, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center">
              <input
                type="text"
                value={loc.city}
                onChange={e => updateLocation(i, { city: e.target.value })}
                placeholder="City"
                className="col-span-5 px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm focus:border-[#00BC7D] focus:outline-none"
              />
              <select
                value={loc.state}
                onChange={e => updateLocation(i, { state: e.target.value })}
                className="col-span-3 px-2 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm focus:border-[#00BC7D] focus:outline-none"
              >
                {US_STATES.map(s => (
                  <option key={s.code} value={s.code}>{s.code}</option>
                ))}
              </select>
              <select
                value={loc.radiusMiles}
                onChange={e => updateLocation(i, { radiusMiles: Number(e.target.value) })}
                className="col-span-3 px-2 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm focus:border-[#00BC7D] focus:outline-none"
              >
                {RADIUS_PRESETS.concat(RADIUS_PRESETS.includes(loc.radiusMiles) ? [] : [loc.radiusMiles])
                  .sort((a, b) => a - b).map(r => (
                    <option key={r} value={r}>{r}mi</option>
                  ))}
              </select>
              <button
                type="button"
                onClick={() => removeLocation(i)}
                aria-label="Remove location"
                className="col-span-1 h-9 flex items-center justify-center text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
              >
                ×
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addLocation}
          disabled={locations.length >= FILTER_LIMITS.MAX_LOCATIONS}
          className="mt-3 w-full py-2 border border-dashed border-slate-600 rounded-lg text-sm text-slate-300 hover:border-[#00BC7D] hover:text-[#00BC7D] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          + Add city
        </button>
      </section>

      {/* ── Zip Codes ── */}
      <section className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-white font-semibold text-sm">Zip Codes</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {zipMode === 'include'
                ? 'Include: only these zip codes are searched — cities are ignored.'
                : zipMode === 'exclude'
                ? 'Exclude: properties in these zips are removed from your city results.'
                : 'Off: zip codes are ignored.'}
            </p>
          </div>
          <span className="text-[10px] text-slate-500">
            {zipCodes.length}/{FILTER_LIMITS.MAX_ZIPS}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-1.5 mb-3">
          {(['off', 'include', 'exclude'] as const).map(m => (
            <button
              key={m}
              type="button"
              onClick={() => setZipMode(m)}
              aria-pressed={zipMode === m}
              className={`px-3 py-2 rounded-lg text-xs font-semibold capitalize transition-all ${
                zipMode === m
                  ? m === 'include'
                    ? 'bg-[#00BC7D] text-white'
                    : m === 'exclude'
                    ? 'bg-amber-600 text-white'
                    : 'bg-slate-600 text-white'
                  : 'bg-slate-800/60 text-slate-400 border border-slate-700 hover:bg-slate-700/60'
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        <div className={`flex gap-2 ${zipMode === 'off' ? 'opacity-50 pointer-events-none' : ''}`}>
          <input
            type="text"
            value={zipInput}
            onChange={e => setZipInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addZipFromInput(); } }}
            placeholder="Paste zips (comma, space, or newline separated)"
            className="flex-1 px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm focus:border-[#00BC7D] focus:outline-none"
          />
          <button
            type="button"
            onClick={addZipFromInput}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            Add
          </button>
        </div>

        {zipError && <p className="text-xs text-amber-400 mt-2">{zipError}</p>}

        {zipCodes.length > 0 && (
          <div className={`mt-3 ${zipMode === 'off' ? 'opacity-50' : ''}`}>
            <div className="flex flex-wrap gap-1.5">
              {zipCodes.map(code => (
                <span
                  key={code}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-mono ${
                    zipMode === 'include'
                      ? 'bg-[#00BC7D]/20 text-[#00BC7D] border border-[#00BC7D]/30'
                      : zipMode === 'exclude'
                      ? 'bg-amber-600/20 text-amber-400 border border-amber-600/30'
                      : 'bg-slate-700 text-slate-300 border border-slate-600'
                  }`}
                >
                  {code}
                  <button
                    type="button"
                    onClick={() => removeZip(code)}
                    aria-label={`Remove ${code}`}
                    className="hover:text-white"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <button
              type="button"
              onClick={clearZips}
              className="mt-2 text-xs text-slate-500 hover:text-red-400 transition-colors"
            >
              Clear all {zipCodes.length} zip codes
            </button>
          </div>
        )}
      </section>

      {/* ── Property Details ── */}
      <section className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 space-y-4">
        <h3 className="text-white font-semibold text-sm">Property Details</h3>

        {/* Deal type */}
        <div>
          <label className="block text-xs text-slate-400 mb-1.5">Deal type</label>
          <div className="grid grid-cols-3 gap-1.5">
            {([
              { value: 'all', label: 'All' },
              { value: 'owner_finance', label: 'Owner Finance' },
              { value: 'cash_deal', label: 'Cash Deal' },
            ] as const).map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setDealType(opt.value)}
                aria-pressed={dealType === opt.value}
                className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                  dealType === opt.value
                    ? opt.value === 'owner_finance'
                      ? 'bg-amber-500 text-white'
                      : opt.value === 'cash_deal'
                      ? 'bg-emerald-500 text-white'
                      : 'bg-[#00BC7D] text-white'
                    : 'bg-slate-800/60 text-slate-400 border border-slate-700 hover:bg-slate-700/60'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Price range */}
        <div>
          <label className="block text-xs text-slate-400 mb-1.5">Price range</label>
          <div className="grid grid-cols-2 gap-2">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
              <input
                type="text"
                inputMode="numeric"
                value={priceMin}
                onChange={e => setPriceMin(e.target.value.replace(/[^\d]/g, ''))}
                placeholder="Min"
                className="w-full pl-7 pr-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm focus:border-[#00BC7D] focus:outline-none"
              />
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
              <input
                type="text"
                inputMode="numeric"
                value={priceMax}
                onChange={e => setPriceMax(e.target.value.replace(/[^\d]/g, ''))}
                placeholder="Max"
                className="w-full pl-7 pr-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm focus:border-[#00BC7D] focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Beds */}
        <div>
          <label className="block text-xs text-slate-400 mb-1.5">Beds (minimum)</label>
          <div className="grid grid-cols-5 gap-1.5">
            {BED_PRESETS.map(p => (
              <button
                key={p.value}
                type="button"
                onClick={() => setBeds(p.value)}
                aria-pressed={beds === p.value}
                className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                  beds === p.value
                    ? 'bg-[#00BC7D] text-white'
                    : 'bg-slate-800/60 text-slate-400 border border-slate-700 hover:bg-slate-700/60'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Baths */}
        <div>
          <label className="block text-xs text-slate-400 mb-1.5">Baths (minimum)</label>
          <div className="grid grid-cols-4 gap-1.5">
            {BATH_PRESETS.map(p => (
              <button
                key={p.value}
                type="button"
                onClick={() => setBaths(p.value)}
                aria-pressed={baths === p.value}
                className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                  baths === p.value
                    ? 'bg-[#00BC7D] text-white'
                    : 'bg-slate-800/60 text-slate-400 border border-slate-700 hover:bg-slate-700/60'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Square feet */}
        <div>
          <label className="block text-xs text-slate-400 mb-1.5">Square feet</label>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              inputMode="numeric"
              value={sqftMin}
              onChange={e => setSqftMin(e.target.value.replace(/[^\d]/g, ''))}
              placeholder="Min sqft"
              className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm focus:border-[#00BC7D] focus:outline-none"
            />
            <input
              type="text"
              inputMode="numeric"
              value={sqftMax}
              onChange={e => setSqftMax(e.target.value.replace(/[^\d]/g, ''))}
              placeholder="Max sqft"
              className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm focus:border-[#00BC7D] focus:outline-none"
            />
          </div>
        </div>

        {/* Max ARV % */}
        <div>
          <label className="block text-xs text-slate-400 mb-1.5">
            Max % of Zestimate
            <span className="ml-1 text-slate-600">(cash deal discount filter)</span>
          </label>
          <input
            type="text"
            inputMode="numeric"
            value={maxArvPercent}
            onChange={e => setMaxArvPercent(e.target.value.replace(/[^\d.]/g, ''))}
            placeholder="e.g. 80"
            className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm focus:border-[#00BC7D] focus:outline-none"
          />
        </div>

        {/* Exclude land */}
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={excludeLand}
            onChange={e => setExcludeLand(e.target.checked)}
            className="w-4 h-4 accent-[#00BC7D]"
          />
          <span className="text-sm text-slate-300">Exclude land / vacant lots</span>
        </label>
      </section>

      {/* ── Save bar ── */}
      <div className="sticky bottom-4 bg-slate-900/90 backdrop-blur-md border border-slate-700 rounded-xl p-3 flex items-center justify-between">
        <div className="text-xs">
          {searchable ? (
            <span className="text-slate-400">
              {locations.length} {locations.length === 1 ? 'city' : 'cities'} ·{' '}
              {zipMode === 'off' ? 'no zip filter' : `${zipCodes.length} ${zipMode} zip${zipCodes.length === 1 ? '' : 's'}`}
            </span>
          ) : (
            <span className="text-amber-400">Filter matches nothing — add a city or include zips</span>
          )}
          {dirty && <span className="ml-2 text-[#00BC7D]">• unsaved</span>}
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !dirty}
          className="px-5 py-2 bg-[#00BC7D] hover:bg-[#00d68f] disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-semibold rounded-lg transition-colors disabled:cursor-not-allowed"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}
