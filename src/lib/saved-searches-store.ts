/**
 * Firestore CRUD for saved searches.
 *
 * Doc shape (savedSearches/{id}):
 *   { id, userId, name, filter, createdAt, updatedAt }
 *
 * Each user can have up to FILTER_LIMITS.MAX_SAVED_SEARCHES. Saved searches
 * never affect the active filter (userFilters/{userId}) — they're snapshots.
 * The UI loads one by writing its filter into /api/user/filters.
 */

import { getAdminDb } from './firebase-admin';
import { FilterConfig, FILTER_LIMITS, normalizeFilterConfig } from './filter-schema';

const COLLECTION = 'savedSearches';
const MAX_NAME_LENGTH = 80;

export interface SavedSearch {
  id: string;
  userId: string;
  name: string;
  filter: FilterConfig;
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

function normalizeName(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.trim().slice(0, MAX_NAME_LENGTH);
}

function timestampToIso(v: unknown): string {
  if (v && typeof v === 'object') {
    const obj = v as { toDate?: () => Date; _seconds?: number };
    if (typeof obj.toDate === 'function') return obj.toDate().toISOString();
    if (typeof obj._seconds === 'number') return new Date(obj._seconds * 1000).toISOString();
  }
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'string') return v;
  return new Date().toISOString();
}

export async function listSavedSearches(userId: string): Promise<SavedSearch[]> {
  if (!userId) return [];
  const db = await getAdminDb();
  if (!db) return [];

  const snap = await db
    .collection(COLLECTION)
    .where('userId', '==', userId)
    .orderBy('updatedAt', 'desc')
    .limit(FILTER_LIMITS.MAX_SAVED_SEARCHES * 2) // slight buffer in case of dupes
    .get();

  return snap.docs.map(d => {
    const data = d.data() as Record<string, unknown>;
    return {
      id: d.id,
      userId: String(data.userId || ''),
      name: String(data.name || ''),
      filter: normalizeFilterConfig({ locations: data.locations, zips: data.zips,
        dealType: data.dealType, price: data.price, beds: data.beds, baths: data.baths,
        sqft: data.sqft, excludeLand: data.excludeLand, maxArvPercent: data.maxArvPercent }),
      createdAt: timestampToIso(data.createdAt),
      updatedAt: timestampToIso(data.updatedAt),
    };
  });
}

export async function getSavedSearch(userId: string, id: string): Promise<SavedSearch | null> {
  if (!userId || !id) return null;
  const db = await getAdminDb();
  if (!db) return null;
  const snap = await db.collection(COLLECTION).doc(id).get();
  if (!snap.exists) return null;
  const data = snap.data() as Record<string, unknown>;
  if (data.userId !== userId) return null; // ownership check
  return {
    id: snap.id,
    userId: String(data.userId),
    name: String(data.name || ''),
    filter: normalizeFilterConfig({ locations: data.locations, zips: data.zips,
      dealType: data.dealType, price: data.price, beds: data.beds, baths: data.baths,
      sqft: data.sqft, excludeLand: data.excludeLand, maxArvPercent: data.maxArvPercent }),
    createdAt: timestampToIso(data.createdAt),
    updatedAt: timestampToIso(data.updatedAt),
  };
}

export interface CreateSavedSearchInput {
  name: unknown;
  filter: unknown;
}

export async function createSavedSearch(userId: string, input: CreateSavedSearchInput): Promise<SavedSearch> {
  if (!userId) throw new Error('userId required');
  const db = await getAdminDb();
  if (!db) throw new Error('Firestore admin unavailable');

  const name = normalizeName(input.name);
  if (!name) throw new Error('Name is required');

  const filter = normalizeFilterConfig(input.filter);

  // Enforce per-user cap
  const countSnap = await db.collection(COLLECTION).where('userId', '==', userId).count().get();
  const count = countSnap.data().count;
  if (count >= FILTER_LIMITS.MAX_SAVED_SEARCHES) {
    throw new Error(`Saved search limit reached (${FILTER_LIMITS.MAX_SAVED_SEARCHES}).`);
  }

  const now = new Date();
  const docRef = db.collection(COLLECTION).doc();
  await docRef.set({
    userId,
    name,
    locations: filter.locations,
    zips: filter.zips,
    dealType: filter.dealType ?? null,
    price: filter.price ?? null,
    beds: filter.beds ?? null,
    baths: filter.baths ?? null,
    sqft: filter.sqft ?? null,
    excludeLand: filter.excludeLand ?? false,
    maxArvPercent: filter.maxArvPercent ?? null,
    createdAt: now,
    updatedAt: now,
  });
  return {
    id: docRef.id,
    userId,
    name,
    filter,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

export interface UpdateSavedSearchInput {
  name?: unknown;
  filter?: unknown;
}

export async function updateSavedSearch(
  userId: string,
  id: string,
  input: UpdateSavedSearchInput,
): Promise<SavedSearch | null> {
  if (!userId || !id) return null;
  const db = await getAdminDb();
  if (!db) throw new Error('Firestore admin unavailable');

  const ref = db.collection(COLLECTION).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const existing = snap.data() as Record<string, unknown>;
  if (existing.userId !== userId) return null; // ownership

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (input.name !== undefined) {
    const name = normalizeName(input.name);
    if (!name) throw new Error('Name cannot be empty');
    patch.name = name;
  }
  if (input.filter !== undefined) {
    const filter = normalizeFilterConfig(input.filter);
    patch.locations = filter.locations;
    patch.zips = filter.zips;
    patch.dealType = filter.dealType ?? null;
    patch.price = filter.price ?? null;
    patch.beds = filter.beds ?? null;
    patch.baths = filter.baths ?? null;
    patch.sqft = filter.sqft ?? null;
    patch.excludeLand = filter.excludeLand ?? false;
    patch.maxArvPercent = filter.maxArvPercent ?? null;
  }

  await ref.update(patch);
  return getSavedSearch(userId, id);
}

export async function deleteSavedSearch(userId: string, id: string): Promise<boolean> {
  if (!userId || !id) return false;
  const db = await getAdminDb();
  if (!db) throw new Error('Firestore admin unavailable');

  const ref = db.collection(COLLECTION).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return false;
  const data = snap.data() as Record<string, unknown>;
  if (data.userId !== userId) return false;
  await ref.delete();
  return true;
}
