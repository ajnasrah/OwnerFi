/**
 * Firestore read/write for userFilters collection.
 *
 * Doc shape (keyed by userId):
 *   { userId, locations, zips, updatedAt, updatedBy }
 *
 * Falls back to legacy buyerProfile fields when a user has no filters doc yet.
 */

import { getAdminDb } from './firebase-admin';
import {
  FilterConfig,
  EMPTY_FILTER,
  filterConfigFromLegacy,
  normalizeFilterConfig,
} from './filter-schema';

const COLLECTION = 'userFilters';

/**
 * Read a user's filter config. If no doc exists, tries to synthesize from the
 * buyer profile's legacy fields (preferredCity/State, filter.radiusMiles).
 * Returns EMPTY_FILTER if nothing usable is found.
 */
export async function getUserFilter(userId: string): Promise<FilterConfig> {
  if (!userId) return EMPTY_FILTER;
  const db = await getAdminDb();
  if (!db) return EMPTY_FILTER;

  const snap = await db.collection(COLLECTION).doc(userId).get();
  if (snap.exists) {
    const data = snap.data() as Record<string, unknown>;
    return normalizeFilterConfig({ locations: data.locations, zips: data.zips });
  }

  // Legacy fallback — look up buyer profile by userId
  try {
    const profileSnap = await db
      .collection('buyerProfiles')
      .where('userId', '==', userId)
      .limit(1)
      .get();
    if (!profileSnap.empty) {
      return filterConfigFromLegacy(profileSnap.docs[0].data() as Record<string, unknown>);
    }
  } catch {
    // ignore — fall through to empty
  }

  return EMPTY_FILTER;
}

/**
 * Overwrite a user's filter. Caller is responsible for auth. Payload is
 * normalized before write (dedupe, validation, caps).
 */
export async function setUserFilter(
  userId: string,
  input: unknown,
  updatedBy: string,
): Promise<FilterConfig> {
  if (!userId) throw new Error('userId is required');
  const db = await getAdminDb();
  if (!db) throw new Error('Firestore admin unavailable');

  const normalized = normalizeFilterConfig(input);

  await db.collection(COLLECTION).doc(userId).set(
    {
      userId,
      locations: normalized.locations,
      zips: normalized.zips,
      updatedAt: new Date(),
      updatedBy,
    },
    { merge: false },
  );

  return normalized;
}
