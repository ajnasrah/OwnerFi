import { NextResponse } from 'next/server';
import { getPricingSnapshot } from '@/lib/pricing';

/**
 * GET /api/pricing
 *
 * Public read-only snapshot of the platform's pricing. Consumed by the
 * mobile app's `BuyDealAlertPage` (P3) to render live prices instead of
 * hard-coding them in the binary — keeps mobile in lockstep with web
 * when a pack price changes.
 *
 * No auth: pricing is the same for every visitor; gating it would just
 * add friction for the deal-alert intro screen mobile shows pre-signup.
 *
 * Edge runtime would be nice here but the project is on the Node
 * runtime by default — leaving it consistent with the rest of `/api/*`.
 */
export async function GET() {
  return NextResponse.json(getPricingSnapshot(), {
    headers: {
      // Pricing changes are rare and propagate by redeploy; safe to
      // cache at the edge for a minute. Mobile already caches the
      // response in-memory per app session, so this is belt-and-braces.
      'Cache-Control': 's-maxage=60, stale-while-revalidate=300',
    },
  });
}
