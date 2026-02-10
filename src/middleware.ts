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
  '/api/workers/',            // Background workers
  '/_next/',                  // Next.js internals
  '/favicon.ico',
  '/robots.txt',
  '/sitemap.xml',
  '/sitemap',
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
