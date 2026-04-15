import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Known bot user agent patterns
const BOT_USER_AGENTS = [
  'bot', 'crawl', 'spider', 'slurp', 'mediapartners',
  'headless', 'phantom', 'selenium', 'puppeteer', 'playwright',
  'wget', 'curl', 'python-requests', 'python-urllib', 'java/',
  'go-http-client', 'node-fetch', 'axios', 'okhttp',
  'scrapy', 'httpclient', 'libwww', 'httpunit', 'nutch',
  'biglotron', 'teoma', 'convera', 'gigablast', 'ia_archiver',
  'webmon', 'httrack', 'grub.org', 'netresearchserver',
  'speedy', 'fluffy', 'findlink', 'msrbot', 'panscient',
  'yacybot', 'aisearchbot', 'ioi', 'ips-agent', 'tagoobot',
  'mj12bot', 'dotbot', 'semrushbot', 'ahrefsbot', 'baiduspider',
  'sogou', 'exabot', 'bytespider', 'petalbot', 'dataforseo',
  'gptbot', 'claudebot', 'anthropic', 'ccbot', 'omgili', 'omgilibot'
];

// Legitimate bots to allow (search engines, social media previews)
const ALLOWED_BOTS = [
  'googlebot', 'google-inspectiontool', 'bingbot', 'applebot',
  'yandex', 'duckduckbot', 'slackbot', 'twitterbot', 'linkedinbot',
  'whatsapp', 'telegrambot', 'discordbot', 'vercel',
  'facebookexternalhit', 'facebot' // Allow Facebook link previews
];

// Paths that should bypass bot protection (webhooks, crons, external services)
const BYPASS_PATHS = [
  '/api/webhooks/',           // All webhook endpoints
  '/api/gohighlevel/webhook/', // GoHighLevel webhooks (different path)
  '/api/stripe/webhook',      // Stripe payment webhooks
  '/api/cron/',               // All cron jobs
  '/api/v2/scraper/',         // Scraper v2 cron endpoints
  '/api/workers/',            // Background workers
  '/api/admin/',              // Admin API endpoints
  '/_next/',                  // Next.js internals
  '/favicon.ico',
  '/robots.txt',
  '/sitemap.xml',
  '/sitemap',
  // Public legal/compliance pages — must be reachable by carrier verification
  // crawlers (Twilio A2P 10DLC, etc.) which don't send standard browser headers.
  '/privacy',
  '/terms',
  '/tcpa-compliance',
  '/creative-finance-disclaimer',
  '/contact',
  '/about',
];

// EU/EEA + UK + Switzerland — countries with comprehensive personal-data laws
// (GDPR, UK GDPR, Swiss FADP). Ownerfi is a US-only service; we redirect rather
// than serve to avoid extraterritorial GDPR exposure.
const RESTRICTED_COUNTRIES = new Set([
  'AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT',
  'LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE',  // EU 27
  'IS','LI','NO',                                                 // EEA non-EU
  'GB',                                                           // UK
  'CH',                                                           // Switzerland
]);

const GEO_BYPASS_PATHS = [
  '/eu-restricted',  // The block page itself must always be reachable
  '/api/',           // APIs already auth-gated; let webhooks/crons through
  '/_next/',
];

function isBot(userAgent: string): boolean {
  const ua = userAgent.toLowerCase();

  // First check if it's a legitimate bot we want to allow
  if (ALLOWED_BOTS.some(bot => ua.includes(bot))) {
    return false;
  }

  // Check for known bad bot patterns
  if (BOT_USER_AGENTS.some(bot => ua.includes(bot))) {
    return true;
  }

  return false;
}

function hasValidBrowserSignature(request: NextRequest): boolean {
  const headers = request.headers;
  const userAgent = headers.get('user-agent') || '';

  // Real browsers send these headers
  const hasAcceptLanguage = headers.has('accept-language');
  const hasAcceptEncoding = headers.has('accept-encoding');

  // Suspicious: No user agent at all
  if (!userAgent || userAgent.length < 10) {
    return false;
  }

  // Suspicious: Missing standard browser headers (real browsers always send these)
  if (!hasAcceptLanguage && !hasAcceptEncoding) {
    return false;
  }

  // Check for headless browser indicators
  if (userAgent.includes('HeadlessChrome') || userAgent.includes('PhantomJS')) {
    return false;
  }

  return true;
}

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const userAgent = request.headers.get('user-agent') || '';

  // Allow bypass paths (webhooks, static assets, etc.)
  if (BYPASS_PATHS.some(path => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // EU / EEA / UK / Switzerland → redirect to /eu-restricted so we don't
  // process personal data of users in jurisdictions covered by GDPR / UK GDPR
  // / Swiss FADP. The block page itself + APIs are exempt from this redirect.
  if (!GEO_BYPASS_PATHS.some(path => pathname.startsWith(path))) {
    const country = (request.headers.get('x-vercel-ip-country') || '').toUpperCase();
    if (country && RESTRICTED_COUNTRIES.has(country)) {
      const url = request.nextUrl.clone();
      url.pathname = '/eu-restricted';
      url.search = '';
      return NextResponse.redirect(url, 307);
    }
  }

  // Block known bad bots
  if (isBot(userAgent)) {
    return new NextResponse('Forbidden', {
      status: 403,
      headers: { 'X-Blocked-Reason': 'bot-detected' }
    });
  }

  // Block requests with suspicious missing headers (likely bots/scrapers)
  if (!hasValidBrowserSignature(request)) {
    return new NextResponse('Forbidden', {
      status: 403,
      headers: { 'X-Blocked-Reason': 'invalid-browser-signature' }
    });
  }

  return NextResponse.next();
}

// Configure which routes the middleware runs on
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files (images, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
