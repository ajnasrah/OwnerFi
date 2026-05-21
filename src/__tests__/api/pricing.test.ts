/**
 * Wire contract for GET /api/pricing. The mobile app reads this on
 * cold-launch of the deal-alert page; the response shape must stay
 * stable across deploys.
 */

import { describe, it, expect } from '@jest/globals';
import { GET } from '@/app/api/pricing/route';
import {
  CREDIT_PACKAGES,
  DEAL_ALERT_PRICE,
} from '@/lib/pricing';

describe('GET /api/pricing', () => {
  it('responds 200 with the canonical pricing snapshot', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({
      creditPackages: CREDIT_PACKAGES,
      dealAlert: DEAL_ALERT_PRICE,
    });
  });

  it('sets edge cache headers — pricing rarely changes', async () => {
    const res = await GET();
    const cache = res.headers.get('Cache-Control');
    expect(cache).toMatch(/s-maxage=\d+/);
    expect(cache).toMatch(/stale-while-revalidate=\d+/);
  });
});
