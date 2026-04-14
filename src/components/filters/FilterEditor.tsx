'use client';

/**
 * FilterEditor — reusable UI for editing a FilterConfig.
 *
 * Used by:
 *   /admin/users/[userId]/filters       (admin edits any user)
 *   /dashboard/settings                 (buyer/investor self-edit)
 *   /realtor-dashboard/deals modal      (realtor self-edit)
 *
 * All validation happens server-side via normalizeFilterConfig; this component
 * only enforces UX-friendly client-side limits (max counts, 5-digit zip input).
 */

import { useState, useMemo } from 'react';
import {
  FilterConfig,
  LocationEntry,
  ZipMode,
  FILTER_LIMITS,
  normalizeZip,
  isFilterSearchable,
} from '@/lib/filter-schema';
import { US_STATES } from '@/lib/us-states';

interface FilterEditorProps {
  initialFilter: FilterConfig;
  onSave: (next: FilterConfig) => Promise<void> | void;
  saving?: boolean;
  /** Optional label shown at top — e.g. "Editing filters for Alice Smith". */
  headerNote?: string;
}

const RADIUS_PRESETS = [10, 30, 60, 100, 200];

export function FilterEditor({ initialFilter, onSave, saving = false, headerNote }: FilterEditorProps) {
  const [locations, setLocations] = useState<LocationEntry[]>(initialFilter.locations);
  const [zipMode, setZipMode] = useState<ZipMode>(initialFilter.zips.mode);
  const [zipCodes, setZipCodes] = useState<string[]>(initialFilter.zips.codes);
  const [zipInput, setZipInput] = useState('');
  const [zipError, setZipError] = useState<string | null>(null);

  const current: FilterConfig = useMemo(
    () => ({
      locations,
      zips: { mode: zipMode, codes: zipCodes },
    }),
    [locations, zipMode, zipCodes],
  );

  const searchable = isFilterSearchable(current);
  const dirty =
    JSON.stringify(current) !== JSON.stringify(initialFilter);

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
  // Accepts: single zip, comma/space/newline separated pasted list
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

  // ─── Save ───
  const handleSave = async () => {
    // If user set include mode but has no codes, don't let that silently become 'off'
    // on save without a heads-up
    if (zipMode === 'include' && zipCodes.length === 0 && locations.length === 0) {
      const ok = confirm('No locations and no include zips — filter will be empty (no results). Save anyway?');
      if (!ok) return;
    }
    await onSave(current);
  };

  return (
    <div className="space-y-6">
      {headerNote && (
        <div className="text-xs text-slate-400 bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2">
          {headerNote}
        </div>
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
                  <option key={s.code} value={s.code}>
                    {s.code}
                  </option>
                ))}
              </select>
              <select
                value={loc.radiusMiles}
                onChange={e => updateLocation(i, { radiusMiles: Number(e.target.value) })}
                className="col-span-3 px-2 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm focus:border-[#00BC7D] focus:outline-none"
              >
                {RADIUS_PRESETS.concat(RADIUS_PRESETS.includes(loc.radiusMiles) ? [] : [loc.radiusMiles]).sort((a, b) => a - b).map(r => (
                  <option key={r} value={r}>
                    {r}mi
                  </option>
                ))}
              </select>
              <button
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

        {/* Mode toggle */}
        <div className="grid grid-cols-3 gap-1.5 mb-3">
          {(['off', 'include', 'exclude'] as const).map(m => (
            <button
              key={m}
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

        {/* Input */}
        <div className={`flex gap-2 ${zipMode === 'off' ? 'opacity-50 pointer-events-none' : ''}`}>
          <input
            type="text"
            value={zipInput}
            onChange={e => setZipInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addZipFromInput();
              }
            }}
            placeholder="Paste zips (comma, space, or newline separated)"
            className="flex-1 px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm focus:border-[#00BC7D] focus:outline-none"
          />
          <button
            onClick={addZipFromInput}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            Add
          </button>
        </div>

        {zipError && <p className="text-xs text-amber-400 mt-2">{zipError}</p>}

        {/* Chip list */}
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
              onClick={clearZips}
              className="mt-2 text-xs text-slate-500 hover:text-red-400 transition-colors"
            >
              Clear all {zipCodes.length} zip codes
            </button>
          </div>
        )}
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
