// Admin API to audit and fix realtor service area states
// GET: Audit all realtors — cross-references stored city/state against cities DB
// POST: Fix a specific realtor's state (or pass fixAll=true to auto-fix all mismatches)

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { ExtendedSession } from '@/types/session';
import { FirebaseDB } from '@/lib/firebase-db';
import {
  getCitiesWithinRadiusComprehensive,
  searchCitiesComprehensive,
} from '@/lib/comprehensive-cities';

async function requireAdmin(request?: NextRequest) {
  // Allow CRON_SECRET auth for scripted access
  if (request) {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
      return { user: { role: 'admin' } } as ExtendedSession;
    }
  }
  const session = await getServerSession(authOptions as unknown as Parameters<typeof getServerSession>[0]) as ExtendedSession | null;
  if (!session?.user || session.user.role !== 'admin') return null;
  return session;
}

interface RealtorAudit {
  id: string;
  name: string;
  email: string;
  phone: string;
  storedCity: string;
  storedState: string;
  actualState: string | null;
  mismatch: boolean;
  issue: string;
  nearbyCitiesCount: number;
}

/**
 * Validate that a city actually exists in the stored state.
 * Returns { valid: true } if the city is found in that state,
 * or { valid: false, suggestedState } if the city exists but in a different state.
 */
function validateCityState(
  cityName: string,
  storedState: string
): { valid: boolean; suggestedState: string | null } {
  if (!cityName || cityName === 'Not set' || cityName === 'Setup Required') {
    return { valid: false, suggestedState: null };
  }
  if (!storedState || storedState === 'Not set' || storedState === 'Setup Required') {
    return { valid: false, suggestedState: null };
  }

  // Check if the city exists in the stored state
  const inStoredState = searchCitiesComprehensive(cityName, storedState, 1);
  if (inStoredState.length > 0 && inStoredState[0].name.toLowerCase() === cityName.toLowerCase()) {
    return { valid: true, suggestedState: storedState };
  }

  // City not found in stored state — search all states
  const allResults = searchCitiesComprehensive(cityName, undefined, 20);
  const exactMatches = allResults.filter(
    (c) => c.name.toLowerCase() === cityName.toLowerCase()
  );

  if (exactMatches.length === 0) {
    return { valid: false, suggestedState: null };
  }

  // If there's only one state with this city name, that's the answer
  if (exactMatches.length === 1) {
    return { valid: false, suggestedState: exactMatches[0].state };
  }

  // Multiple states have this city — can't auto-determine
  // Return all possibilities so admin can decide
  return {
    valid: false,
    suggestedState: exactMatches.map((c) => c.state).join('/'),
  };
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireAdmin(request);
    if (!session) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const realtors = await FirebaseDB.queryDocuments('users', [
      { field: 'role', operator: '==', value: 'realtor' },
    ]);

    const audits: RealtorAudit[] = [];
    const mismatches: RealtorAudit[] = [];

    for (const realtor of realtors) {
      const r = realtor as any;
      const serviceArea = r.realtorData?.serviceArea;
      const primaryCity = serviceArea?.primaryCity;
      const storedCity =
        typeof primaryCity === 'object'
          ? primaryCity?.name || 'Not set'
          : primaryCity || 'Not set';
      const storedState =
        typeof primaryCity === 'object'
          ? primaryCity?.state || 'Not set'
          : 'Not set';
      const nearbyCities = serviceArea?.nearbyCities || [];

      // Validate that the stored city actually exists in the stored state
      const validation = validateCityState(storedCity, storedState);

      let issue = 'ok';
      let mismatch = false;

      if (storedCity === 'Not set' || storedCity === 'Setup Required') {
        issue = 'no_city_configured';
      } else if (storedState === 'Not set' || storedState === 'Setup Required') {
        issue = 'no_state_configured';
        mismatch = true;
      } else if (!validation.valid && !validation.suggestedState) {
        issue = 'city_not_found_in_db';
      } else if (!validation.valid) {
        issue = `wrong_state: stored=${storedState} suggested=${validation.suggestedState}`;
        mismatch = true;
      } else if (nearbyCities.length === 0) {
        issue = 'no_nearby_cities';
      }

      const audit: RealtorAudit = {
        id: r.id,
        name: r.realtorData?.firstName
          ? `${r.realtorData.firstName} ${r.realtorData.lastName || ''}`.trim()
          : r.name || r.email,
        email: r.email || '',
        phone: r.realtorData?.phone || r.phone || '',
        storedCity,
        storedState,
        actualState: validation.valid ? storedState : validation.suggestedState,
        mismatch,
        issue,
        nearbyCitiesCount: nearbyCities.length,
      };

      audits.push(audit);
      if (mismatch) mismatches.push(audit);
    }

    return NextResponse.json({
      total: audits.length,
      mismatchCount: mismatches.length,
      mismatches,
      allRealtors: audits,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to audit realtors' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAdmin(request);
    if (!session) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { fixAll } = body;

    // Auto-fix all mismatched realtors
    if (fixAll) {
      const realtors = await FirebaseDB.queryDocuments('users', [
        { field: 'role', operator: '==', value: 'realtor' },
      ]);

      const fixed: Array<{ id: string; name: string; from: string; to: string }> = [];
      const failed: Array<{ id: string; reason: string }> = [];

      for (const realtor of realtors) {
        const r = realtor as any;
        const serviceArea = r.realtorData?.serviceArea;
        const primaryCity = serviceArea?.primaryCity;
        const storedCity =
          typeof primaryCity === 'object' ? primaryCity?.name : primaryCity;
        const storedState =
          typeof primaryCity === 'object' ? primaryCity?.state : null;

        if (!storedCity || storedCity === 'Not set' || storedCity === 'Setup Required') {
          continue;
        }
        if (!storedState || storedState === 'Not set' || storedState === 'Setup Required') {
          continue;
        }

        const validation = validateCityState(storedCity, storedState);

        if (validation.valid) {
          // State is correct — just backfill nearby cities if missing
          const nearbyCities = serviceArea?.nearbyCities || [];
          if (nearbyCities.length === 0) {
            try {
              const computed = getCitiesWithinRadiusComprehensive(storedCity, storedState, 30);
              const updatedServiceArea = {
                ...serviceArea,
                nearbyCities: computed.map((c) => ({ name: c.name, state: storedState })),
                totalCitiesServed: 1 + computed.length,
              };
              await FirebaseDB.updateDocument('users', r.id, {
                'realtorData.serviceArea': updatedServiceArea,
              });
              fixed.push({
                id: r.id,
                name: r.realtorData?.firstName || r.email,
                from: `${storedCity}, ${storedState} (0 nearby)`,
                to: `${storedCity}, ${storedState} (${computed.length} nearby)`,
              });
            } catch {
              failed.push({ id: r.id, reason: 'Failed to compute nearby cities' });
            }
          }
          continue;
        }

        // State mismatch — only auto-fix if we have a single unambiguous suggestion
        const suggested = validation.suggestedState;
        if (!suggested || suggested.includes('/')) {
          failed.push({
            id: r.id,
            reason: `Ambiguous: ${storedCity} exists in ${suggested || 'unknown'} — needs manual fix`,
          });
          continue;
        }

        try {
          const computed = getCitiesWithinRadiusComprehensive(storedCity, suggested, 30);
          const updatedServiceArea = {
            ...serviceArea,
            primaryCity: {
              ...primaryCity,
              name: storedCity,
              state: suggested,
            },
            nearbyCities: computed.map((c) => ({ name: c.name, state: suggested })),
            totalCitiesServed: 1 + computed.length,
          };

          await FirebaseDB.updateDocument('users', r.id, {
            'realtorData.serviceArea': updatedServiceArea,
          });

          fixed.push({
            id: r.id,
            name: r.realtorData?.firstName || r.email,
            from: `${storedCity}, ${storedState}`,
            to: `${storedCity}, ${suggested}`,
          });
        } catch {
          failed.push({ id: r.id, reason: 'Update failed' });
        }
      }

      return NextResponse.json({
        success: true,
        fixedCount: fixed.length,
        failedCount: failed.length,
        fixed,
        failed,
      });
    }

    // Fix a single realtor
    const { realtorId, city, state } = body;

    if (!realtorId || !city || !state) {
      return NextResponse.json(
        { error: 'Provide realtorId + city + state, OR fixAll=true' },
        { status: 400 }
      );
    }

    const userData = await FirebaseDB.getDocument('users', realtorId);
    if (!userData) {
      return NextResponse.json({ error: 'Realtor not found' }, { status: 404 });
    }

    const user = userData as any;
    const nearbyCities = getCitiesWithinRadiusComprehensive(city, state, 30);

    const updatedServiceArea = {
      ...user.realtorData?.serviceArea,
      primaryCity: {
        ...user.realtorData?.serviceArea?.primaryCity,
        name: city,
        state: state,
      },
      nearbyCities: nearbyCities.map((c) => ({ name: c.name, state })),
      totalCitiesServed: 1 + nearbyCities.length,
    };

    await FirebaseDB.updateDocument('users', realtorId, {
      'realtorData.serviceArea': updatedServiceArea,
    });

    return NextResponse.json({
      success: true,
      message: `Fixed ${user.realtorData?.firstName || 'realtor'}: ${city}, ${state}`,
      nearbyCitiesCount: nearbyCities.length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fix realtor state' },
      { status: 500 }
    );
  }
}
