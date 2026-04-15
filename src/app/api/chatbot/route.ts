import { NextResponse } from 'next/server';
import OpenAI from 'openai';

function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured');
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

function buildSystemPrompt(userContext?: UserContext): string {
  let personalized = '';
  if (userContext) {
    const parts: string[] = [];
    if (userContext.firstName) parts.push(`The user's name is ${userContext.firstName}.`);
    if (userContext.city && userContext.state) parts.push(`They're browsing from ${userContext.city}, ${userContext.state}.`);
    else if (userContext.city) parts.push(`They're browsing from ${userContext.city}.`);
    if (userContext.isRealtor) parts.push('They are a REALTOR using the referral program. When they ask about "leads", they mean buyer leads for agents — NOT property listings. Direct them to /realtor-dashboard/buyers to see available leads.');
    if (userContext.isInvestor) parts.push('They have Investor Mode enabled — they can see cash deals.');
    if (userContext.likedCount && userContext.likedCount > 0) parts.push(`They have ${userContext.likedCount} saved/liked properties.`);
    if (userContext.currentPage) {
      const pageMap: Record<string, string> = {
        '/dashboard': 'the property swiper dashboard',
        '/dashboard/investor': 'the investor dashboard',
        '/dashboard/liked': 'their favorites/liked properties page',
        '/dashboard/settings': 'the settings page',
      };
      const pageName = pageMap[userContext.currentPage] || userContext.currentPage;
      parts.push(`They're currently on ${pageName}.`);
    }
    if (parts.length > 0) {
      personalized = `\n\nCURRENT USER CONTEXT:\n${parts.join(' ')}\nUse this context to personalize your responses. For example, greet them by name, reference their city, or suggest relevant features based on their page.\n`;
    }
  }

  return `You are Sarah, Ownerfi's friendly property specialist. You're warm, knowledgeable, and genuinely helpful — like a friend who happens to know everything about owner financing and the Ownerfi platform.

PERSONALITY:
- Warm and conversational, never robotic or stiff
- Proactive — always suggest a next step or ask a follow-up question
- Use simple language anyone can understand
- When relevant, tell users which page to visit (e.g. "Head to your Settings page to change that")
- If someone seems ready, encourage them to sign up or browse
- Ask clarifying questions when the user's needs aren't clear
${personalized}
LANGUAGE:
- If the user writes in Spanish, respond fully in Spanish. Same for any other language.
- Match the user's language naturally. Do not ask them what language they prefer — just mirror them.

IMPORTANT LEGAL RULE:
Never say "we match buyers to properties", "we connect buyers with homes", or any language implying Ownerfi represents buyers or sellers. Ownerfi is a discovery platform. We SHOW properties. We REFER buyers to licensed buying agents. We do not represent either side.

WHAT IS OWNERFI:
Ownerfi is a FREE property discovery platform for owner-financed homes and investment deals across the US. We show you properties where owner financing may be possible — no bank loan needed. When you find a home you like, we refer you to a licensed buying agent in your area to write an offer and represent you. Free to browse, no credit card needed, no obligation.

For real estate agents, Ownerfi also runs a referral network that delivers pre-screened buyer leads.

HOW TO GET STARTED:
1. Sign up free at /auth — just a phone number or email
2. Pick your preferred city during setup
3. Browse properties on your personal dashboard at /dashboard
4. Swipe right (like) or left (pass) on properties — works like a dating app for homes
5. View all your saved homes at /dashboard/liked
6. When you find a home you like, we refer you to a licensed buying agent in your area

PLATFORM PAGES (mention these naturally when helping users):
- Homepage (ownerfi.com) — learn about owner financing, browse categories
- Sign Up (/auth) — create your free account with phone or email
- Dashboard (/dashboard) — swipe through properties in your city, like or pass
- Investor Dashboard (/dashboard/investor) — advanced view with cash deals, filters, sorting
- Favorites (/dashboard/liked) — all your saved/liked properties in one place
- Settings (/dashboard/settings) — change city, adjust filters (beds, baths, price range, sqft), toggle investor mode
- How It Works (/how-owner-finance-works) — detailed FAQ about owner financing
- Contact (/contact) — reach our team at support@ownerfi.ai
- For Realtors (/for-realtors) — learn about our realtor referral program

DASHBOARD FEATURES:
- Swipe-style browsing — swipe right to like, left to pass, just like Tinder but for homes
- Each property shows: photos, address, price, beds/baths/sqft
- Change search city anytime in Settings (/dashboard/settings)
- Filter by: price range, bedrooms, bathrooms, square footage, property type
- Save favorites and review them anytime at /dashboard/liked
- When you find a home you like, we refer you to a licensed buying agent in your area to write an offer and represent you
- First-time tutorial walks you through everything — click the ? button to replay it

INVESTOR FEATURES:
- Toggle "Investor Mode" in Settings (/dashboard/settings) to unlock the investor dashboard
- Cash deals: properties listed below After-Repair Value (ARV) — great for flipping or wholesale
- Filter by deal type: Owner Finance only, Cash Deal only, or both
- Sort by: price, % of ARV, discount from ARV, monthly payment
- Hide land properties toggle (default: on, since land values are less reliable)
- Deal Alert SMS ($5/month): get instant text notifications when new deals match your criteria in your city
- Customize your ARV threshold (e.g., only alert me if property is under 80% of ARV)
- Cancel anytime from billing settings

OWNER FINANCING EXPLAINED:
Owner financing means the seller is your lender. Instead of getting a bank loan, you pay the seller directly over time — like buying a car from a private seller with monthly payments.

Benefits: flexible terms, faster closing, credit-friendly, less paperwork, negotiable down payment.

4 DEAL TYPES (safest to riskiest):
1. Seller Finance (Safest) — Seller owns the home free and clear. You get the deed at closing and make monthly payments to the seller.
2. Subject-To — You take over the seller's existing mortgage payments. The loan stays in their name but you get the property.
3. Contract for Deed — You make payments but don't receive the deed until fully paid off. Higher risk for the buyer.
4. Lease-to-Own — Rent with an option to buy later. Not technically owner financing, but a stepping stone.

IMPORTANT THINGS BUYERS SHOULD KNOW:
- Terms (down payment, interest rate, monthly payment, term length) are ALL negotiated between buyer and seller — every deal is different
- We recommend working with a licensed buying agent to write an offer and negotiate terms on your behalf
- ALWAYS use a licensed real estate attorney and get title insurance
- No escrow — buyers pay property taxes, insurance, and HOA directly
- Property data comes from public sources — always do your own due diligence

PRICING:
- Browsing & searching: 100% FREE forever
- Saving favorites: FREE
- Investor Deal Alert SMS: $5/month (optional, cancel anytime)
- No hidden fees

PROPERTY SEARCH:
You have access to a search_properties tool. When users ask about specific properties or what's available, USE IT to search our database and share real results. Present 3-5 properties naturally in your response with key details (address, price, beds/baths). Always mention they can see more on their dashboard and that we can refer them to a licensed buying agent when they're ready.

IMPORTANT — DEAL TYPE PRIORITY:
When searching for properties, ALWAYS default to owner_finance deals first (set dealType to "owner_finance"). Owner financing is our core product — it's what Ownerfi is built for. Only show cash deals if the user specifically asks about cash deals, investment deals, or wholesale deals. If the user just says "what's available" or "show me homes", search for owner finance deals. After showing owner finance results, ALWAYS end by asking: "Would you also like to see cash/investment deals in this area?" — this gives them the option without overwhelming them.

IMPORTANT — REALTORS vs BUYERS:
If the user is a realtor (check the user context), they may ask about "leads" — this means BUYER LEADS (people looking to buy homes), NOT property listings. Do NOT use the search_properties tool for lead questions. Instead, direct them to their Realtor Dashboard at /realtor-dashboard/buyers where they can see available buyer leads in their area. Leads are pre-screened buyers with confirmed contact info. Realtors can accept leads, sign referral agreements, and get buyer contact details through the dashboard.

FOR REALTORS — REFERRAL PROGRAM:
Ownerfi runs a referral network for real estate agents. Here's what we offer:
- **Free to join** — no credit card, no upfront cost. Sign up at /auth?role=realtor
- **Pre-screened buyer leads** — buyers actively looking for owner-financed or creative finance properties, with confirmed contact info
- **1 free lead per month** — included automatically, additional leads available via credits
- **30% referral fee — only at closing** — if a lead doesn't close, the agent owes nothing. Fee is 30% of the agent's commission, paid within 7 days of closing
- **Service area** — agents set their primary city and receive leads within a 30-mile radius
- **Digital referral agreements** — standard eXp Realty Tennessee Referral Agreement (SkySlope® Forms), signed digitally
- **Double referral** — if an agent can't service a lead, they can re-refer it to another agent and set their own re-referral fee
- **Realtor Dashboard** at /realtor-dashboard — manage available leads, signed agreements, owned leads, and transactions
- To learn more, visit /for-realtors or sign up at /auth?role=realtor
- Requirements: active real estate license and affiliation with a licensed brokerage

COMMON QUESTIONS:
Q: Do I need good credit? A: Not necessarily! The seller sets the credit requirements, and many are flexible.
Q: How much is the down payment? A: Down payments are negotiated between buyer and seller — every deal is different. A licensed buying agent can help you negotiate the best terms.
Q: Is this legitimate/safe? A: Owner financing has been around for decades and is completely legal. Use an attorney and get title insurance.
Q: How is this different from renting? A: You're BUYING the home and building equity. With renting, your money goes to the landlord.
Q: What states do you cover? A: Nationwide, with strong coverage in Texas, Florida, and Georgia. New properties added daily.
Q: I can't log in? A: Enter your phone number again at /auth for a new verification code, or email support@ownerfi.ai.
Q: No properties in my area? A: Try nearby cities in Settings (/dashboard/settings). We add new properties daily!
Q: I'm a realtor — what do you offer? A: We deliver pre-screened buyer leads for free! 1 free lead/month, 30% referral fee only at closing. Visit /for-realtors to learn more or sign up at /auth?role=realtor.
Q: Can I negotiate terms? A: Absolutely! Down payment, interest rate, monthly payment, and term length are all negotiable between you and the seller. We recommend working with a licensed buying agent to write an offer and negotiate on your behalf.

ESCALATION — WHEN TO SUGGEST HUMAN SUPPORT:
If you can't solve it (account issues, billing, bugs, complaints), offer: support@ownerfi.ai or /contact.

RESPONSE RULES:
- Keep responses 2-4 sentences for simple questions, up to 5-6 for complex topics
- Always end with a follow-up question or suggested next step when natural
- Never provide specific legal, financial, or tax advice
- Use natural conversational language — avoid bullet points in chat (except when listing properties)
- When mentioning a page, include the path so users can navigate there
- When you use search_properties and find results, present them conversationally with key details`;
}

interface UserContext {
  firstName?: string;
  city?: string;
  state?: string;
  isInvestor?: boolean;
  isRealtor?: boolean;
  likedCount?: number;
  currentPage?: string;
}

const SEARCH_LEADS_TOOL: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'search_leads',
    description: 'Search for available buyer leads in a city. Use ONLY when a REALTOR asks about leads, buyers, or referrals in a specific area. Do NOT use for property listings.',
    parameters: {
      type: 'object',
      properties: {
        city: { type: 'string', description: 'City name (e.g. "Memphis")' },
        state: { type: 'string', description: 'Two-letter state code (e.g. "TN")' },
      },
      required: []
    }
  }
};

const SEARCH_TOOL: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'search_properties',
    description: 'Search Ownerfi properties. Use when the user asks about available properties, wants to see homes in a city, or asks about specific criteria like price/beds/baths.',
    parameters: {
      type: 'object',
      properties: {
        city: { type: 'string', description: 'City name (e.g. "Houston")' },
        state: { type: 'string', description: 'Two-letter state code (e.g. "TX")' },
        dealType: { type: 'string', enum: ['owner_finance', 'cash_deal'], description: 'Type of deal to search for' },
        minPrice: { type: 'number', description: 'Minimum price in dollars' },
        maxPrice: { type: 'number', description: 'Maximum price in dollars' },
        minBeds: { type: 'integer', description: 'Minimum bedrooms' },
        minBaths: { type: 'number', description: 'Minimum bathrooms' },
      },
      required: []
    }
  }
};

// Execute property search via Typesense
async function executeLeadSearch(args: Record<string, unknown>): Promise<string> {
  try {
    const { ConsolidatedLeadSystem } = await import('@/lib/consolidated-lead-system');

    const city = args.city ? String(args.city).split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ') : '';
    const state = args.state ? String(args.state).toUpperCase() : '';

    const realtorProfile = {
      cities: city ? [city] : [],
      languages: ['English'],
      state: state || 'Unknown',
    };

    const leads = await ConsolidatedLeadSystem.findAvailableLeads(realtorProfile, 50);

    // Filter by city if specified
    const filtered = city
      ? leads.filter((l: { city?: string; preferredCity?: string }) =>
          (l.city || l.preferredCity || '').toLowerCase() === city.toLowerCase()
        )
      : leads;

    const count = filtered.length;
    const totalInState = leads.length;

    return JSON.stringify({
      found: count,
      totalInState,
      message: count > 0
        ? `There are ${count} available buyer lead(s) in ${city || 'this area'}${totalInState > count ? ` (${totalInState} total in ${state || 'the state'})` : ''}. View and accept them at /realtor-dashboard/buyers.`
        : totalInState > 0
          ? `No leads specifically in ${city} right now, but there are ${totalInState} available leads in ${state || 'your state'}. Check /realtor-dashboard/buyers to see all available leads.`
          : 'No available buyer leads in this area right now. New leads are added regularly — check back soon or adjust your service area in Settings.'
    });
  } catch (error) {
    console.error('[chatbot] Lead search error:', error);
    return JSON.stringify({ error: 'Lead search temporarily unavailable', found: 0, leads: [] });
  }
}

async function executePropertySearch(args: Record<string, unknown>): Promise<string> {
  try {
    const { getTypesenseSearchClient, TYPESENSE_COLLECTIONS } = await import('@/lib/typesense/client');
    const client = getTypesenseSearchClient();
    if (!client) return JSON.stringify({ error: 'Search unavailable', found: 0, properties: [] });

    const filters: string[] = ['isActive:=true'];
    // Capitalize city name for case-sensitive Typesense filter (e.g. "houston" → "Houston")
    if (args.city) {
      const city = String(args.city).split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
      filters.push(`city:=${city}`);
    }
    if (args.state) filters.push(`state:=${String(args.state).toUpperCase()}`);
    if (args.minPrice) filters.push(`listPrice:>=${args.minPrice}`);
    if (args.maxPrice) filters.push(`listPrice:<=${args.maxPrice}`);
    if (args.minBeds) filters.push(`bedrooms:>=${args.minBeds}`);
    if (args.minBaths) filters.push(`bathrooms:>=${args.minBaths}`);
    if (args.dealType === 'owner_finance') {
      filters.push('dealType:=[owner_finance, both]');
    } else if (args.dealType === 'cash_deal') {
      filters.push('dealType:=[cash_deal, both]');
    }

    const result = await client
      .collections(TYPESENSE_COLLECTIONS.PROPERTIES)
      .documents()
      .search({
        q: '*',
        query_by: 'address,city,state,zipCode',
        filter_by: filters.join(' && '),
        sort_by: 'createdAt:desc',
        page: 1,
        per_page: 5
      });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const properties = (result.hits || []).map((hit: any) => {
      const d = hit.document;
      return {
        address: d.address,
        city: d.city,
        state: d.state,
        price: d.listPrice,
        beds: d.bedrooms,
        baths: d.bathrooms,
        sqft: d.squareFeet,
        monthlyPayment: d.monthlyPayment,
        downPayment: d.downPaymentAmount,
        interestRate: d.interestRate,
        dealType: d.dealType,
        propertyType: d.propertyType,
      };
    });

    return JSON.stringify({
      found: result.found || 0,
      showing: properties.length,
      properties
    });
  } catch (error) {
    console.error('[chatbot] Search error:', error);
    return JSON.stringify({ error: 'Search temporarily unavailable', found: 0, properties: [] });
  }
}

// Sanitize conversation history to prevent injection
function sanitizeHistory(history: unknown[]): Array<{role: 'user' | 'assistant', content: string}> {
  if (!Array.isArray(history)) return [];
  return history
    .filter((msg): msg is {role: string, content: string} =>
      msg != null &&
      typeof msg === 'object' &&
      'role' in msg &&
      'content' in msg &&
      typeof (msg as {role: unknown}).role === 'string' &&
      typeof (msg as {content: unknown}).content === 'string' &&
      ((msg as {role: string}).role === 'user' || (msg as {role: string}).role === 'assistant')
    )
    .map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content.slice(0, 1000)
    }));
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const message = typeof body.message === 'string' ? body.message.slice(0, 1000) : '';
    const conversationHistory = sanitizeHistory(body.conversationHistory || []);
    const userContext: UserContext | undefined = body.userContext && typeof body.userContext === 'object'
      ? {
          firstName: typeof body.userContext.firstName === 'string' ? body.userContext.firstName : undefined,
          city: typeof body.userContext.city === 'string' ? body.userContext.city : undefined,
          state: typeof body.userContext.state === 'string' ? body.userContext.state : undefined,
          isInvestor: typeof body.userContext.isInvestor === 'boolean' ? body.userContext.isInvestor : undefined,
          isRealtor: typeof body.userContext.isRealtor === 'boolean' ? body.userContext.isRealtor : undefined,
          likedCount: typeof body.userContext.likedCount === 'number' ? body.userContext.likedCount : undefined,
          currentPage: typeof body.userContext.currentPage === 'string' ? body.userContext.currentPage : undefined,
        }
      : undefined;

    if (!message.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
    }

    // Rate limit
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
               request.headers.get('x-real-ip') || 'unknown';
    const { rateLimit } = await import('@/lib/rate-limiter');
    const rateLimitCheck = await rateLimit(`chatbot:${ip}`, 10, 60);
    if (!rateLimitCheck.allowed) {
      return NextResponse.json({
        reply: `You're sending messages pretty fast! Give me ${rateLimitCheck.retryAfter || 30} seconds and try again.`,
        rateLimited: true,
      }, { status: 200 });
    }

    // Budget check
    const { estimateTokens, calculateCost, checkBudget, trackUsage } = await import('@/lib/openai-budget-tracker');
    const systemPrompt = buildSystemPrompt(userContext);

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.slice(-10),
      { role: 'user', content: message }
    ];

    const estimatedInputTokens = estimateTokens(JSON.stringify(messages));
    const estimatedCost = calculateCost(estimatedInputTokens, 500, 'gpt-4o-mini');
    const dailyBudgetCheck = await checkBudget(estimatedCost, 'daily');
    if (!dailyBudgetCheck.allowed) {
      return NextResponse.json({
        reply: "I'm taking a quick break due to high demand! Check out /how-owner-finance-works or email support@ownerfi.ai.",
        budgetExceeded: true
      });
    }

    const openai = getOpenAIClient();
    const encoder = new TextEncoder();
    let totalInputTokens = estimatedInputTokens;
    let totalOutputTokens = 0;

    const readable = new ReadableStream({
      async start(controller) {
        let fullResponse = '';
        try {
          // First pass: stream with tools available
          const stream = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages,
            tools: [SEARCH_TOOL, SEARCH_LEADS_TOOL],
            max_tokens: 500,
            temperature: 0.5,
            stream: true,
          });

          // Collect tool calls if any
          const toolCallMap: Record<number, { id: string; name: string; args: string }> = {};
          let hasToolCalls = false;

          for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta;

            // Stream text content directly
            if (delta?.content) {
              fullResponse += delta.content;
              controller.enqueue(encoder.encode(delta.content));
            }

            // Accumulate tool call fragments
            if (delta?.tool_calls) {
              hasToolCalls = true;
              for (const tc of delta.tool_calls) {
                const idx = tc.index ?? 0;
                if (!toolCallMap[idx]) {
                  toolCallMap[idx] = { id: tc.id || '', name: '', args: '' };
                }
                if (tc.id) toolCallMap[idx].id = tc.id;
                if (tc.function?.name) toolCallMap[idx].name = tc.function.name;
                if (tc.function?.arguments) toolCallMap[idx].args += tc.function.arguments;
              }
            }
          }

          // If model wants to search properties, execute and get formatted response
          if (hasToolCalls) {
            const toolCalls = Object.values(toolCallMap);

            // Build ONE assistant message with ALL tool calls (OpenAI requires this structure)
            const assistantToolCalls = toolCalls.map(tc => ({
              id: tc.id, type: 'function' as const, function: { name: tc.name, arguments: tc.args }
            }));

            const toolResults: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
              { role: 'assistant', content: null, tool_calls: assistantToolCalls } as OpenAI.Chat.Completions.ChatCompletionMessageParam,
            ];

            // Execute each tool call and add results
            for (const tc of toolCalls) {
              if (tc.name === 'search_properties' || tc.name === 'search_leads') {
                let args: Record<string, unknown> = {};
                try { args = JSON.parse(tc.args); } catch { /* use empty */ }
                const result = tc.name === 'search_leads'
                  ? await executeLeadSearch(args)
                  : await executePropertySearch(args);
                toolResults.push({
                  role: 'tool',
                  tool_call_id: tc.id,
                  content: result
                } as OpenAI.Chat.Completions.ChatCompletionMessageParam);
              }
            }

            if (toolResults.length > 1) { // > 1 because the assistant message is always there
              // Second pass: stream the formatted response with search results
              const secondStream = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [...messages, ...toolResults],
                max_tokens: 600,
                temperature: 0.5,
                stream: true,
              });

              for await (const chunk of secondStream) {
                const content = chunk.choices[0]?.delta?.content;
                if (content) {
                  fullResponse += content;
                  controller.enqueue(encoder.encode(content));
                }
              }

              totalInputTokens += estimateTokens(JSON.stringify(toolResults));
            }
          }

          if (!fullResponse.trim()) {
            const fallback = "I hit a snag — could you try that again? Or reach out to support@ownerfi.ai.";
            controller.enqueue(encoder.encode(fallback));
            fullResponse = fallback;
          }

          totalOutputTokens = estimateTokens(fullResponse);

        } catch (error) {
          console.error('[chatbot] Stream error:', error);
          if (!fullResponse) {
            const fallback = "I hit a snag — could you try asking that again?";
            controller.enqueue(encoder.encode(fallback));
          }
        } finally {
          controller.close();

          // Track usage in background
          const actualCost = calculateCost(totalInputTokens, totalOutputTokens, 'gpt-4o-mini');
          trackUsage({
            inputTokens: totalInputTokens,
            outputTokens: totalOutputTokens,
            totalTokens: totalInputTokens + totalOutputTokens,
            estimatedCost: actualCost,
            model: 'gpt-4o-mini',
            timestamp: Date.now()
          }).catch(err => console.error('[chatbot] Usage tracking error:', err));

          import('@/lib/cost-tracker').then(({ trackCost, calculateOpenAICost }) => {
            const cost = calculateOpenAICost(totalInputTokens, totalOutputTokens);
            trackCost('ownerfi', 'openai', 'chatbot_message', totalInputTokens + totalOutputTokens, cost)
              .catch(err => console.error('[chatbot] Cost tracking error:', err));
          }).catch(() => {});
        }
      }
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'X-Content-Type-Options': 'nosniff',
      }
    });

  } catch (error) {
    console.error('Chatbot API error:', error);
    return NextResponse.json(
      { reply: "Something went wrong on my end. Try again, or email support@ownerfi.ai!" },
      { status: 200 }
    );
  }
}
