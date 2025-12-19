import { NextResponse } from 'next/server';
import OpenAI from 'openai';

// Create OpenAI client only when needed to avoid build errors
function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured');
  }
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

const OWNERFI_CONTEXT = `
You are OwnerFi's AI assistant.
Keep responses EXTREMELY CONCISE (1-2 sentences unless explaining a complex concept).

STRICT RULES:
- Max 2 sentences for simple questions
- Max 3-4 sentences for complex explanations
- Be direct, no fluff
- Do not repeat information unless asked
- Do not imply agency, representation, matching, or advising

OWNER FINANCING - SIMPLE EXPLANATION:
Owner financing means the seller accepts payments directly instead of a bank loan - similar to paying a private seller for a car over time.

DEAL STRUCTURES (SAFEST to RISKIEST):
1. Seller Finance (Safest): Seller owns the home free & clear; buyer receives the deed at closing
2. Subject-To: Buyer makes payments on seller's existing loan; loan stays in seller's name
3. Contract for Deed: No deed until paid in full (higher risk)
4. Lease-to-Own: Rental with an option - not owner financing

HOW THESE DEALS DIFFER FROM BANK LOANS:
- No escrow (buyers pay taxes, insurance, HOA directly)
- Faster, more flexible terms
- Credit rules vary by seller

KEY TERMS:
- Interest: Cost of borrowing money
- Balloon Payment: Smaller payments now, larger balance due later

IMPORTANT PROTECTIONS:
Always use a licensed real estate attorney, get title insurance, and verify the deal structure in writing.
This is general information, not legal or financial advice.

WHAT OWNERFI DOES (IMPORTANT):
OwnerFi shows owner-finance-friendly listings found on the open market.
We are not agents, brokers, or lenders, and we do not represent buyers or sellers.
Listings may not specify deal terms - buyers must confirm what the seller is offering.

PLATFORM NOTES:
- Free to browse
- No obligation
- Educational & discovery-only platform
`;

export async function POST(request: Request) {
  console.log(`🚀 [CHATBOT DEBUG] POST request received at ${new Date().toISOString()}`);

  try {
    const { message, conversationHistory = [] } = await request.json();
    console.log(`🚀 [CHATBOT DEBUG] Message: "${message?.substring(0, 50)}..."`);

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    // SECURITY FIX: Rate limit by IP (10 requests per minute)
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
               request.headers.get('x-real-ip') ||
               'unknown';

    const { rateLimit } = await import('@/lib/rate-limiter');
    const rateLimitCheck = await rateLimit(`chatbot:${ip}`, 10, 60);

    if (!rateLimitCheck.allowed) {
      return NextResponse.json({
        error: `Too many requests. Please try again in ${rateLimitCheck.retryAfter} seconds.`,
        rateLimitExceeded: true,
        retryAfter: rateLimitCheck.retryAfter
      }, {
        status: 429,
        headers: {
          'Retry-After': rateLimitCheck.retryAfter?.toString() || '60'
        }
      });
    }

    // Always use AI to respond to user questions intelligently
    let response = '';

    try {
      // BUDGET CHECK: Estimate cost before making request
      const { estimateTokens, calculateCost, checkBudget, trackUsage } = await import('@/lib/openai-budget-tracker');

      const messages = [
        { role: 'system', content: OWNERFI_CONTEXT },
        ...conversationHistory,
        { role: 'user', content: message }
      ];

      const estimatedInputTokens = estimateTokens(JSON.stringify(messages));
      const estimatedOutputTokens = 80; // max_tokens
      const estimatedCost = calculateCost(estimatedInputTokens, estimatedOutputTokens, 'gpt-4o-mini');

      console.log(`💬 [chatbot] Estimated cost: $${estimatedCost.toFixed(6)} (${estimatedInputTokens} input + ${estimatedOutputTokens} output tokens)`);

      // Check daily budget
      const dailyBudgetCheck = await checkBudget(estimatedCost, 'daily');

      if (!dailyBudgetCheck.allowed) {
        console.error(`❌ [chatbot] Daily budget exceeded: ${dailyBudgetCheck.reason}`);
        return NextResponse.json({
          reply: 'Our AI assistant is temporarily unavailable due to high usage. Please try again tomorrow or browse our properties.',
          budgetExceeded: true
        });
      }

      const openai = getOpenAIClient();

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',  // COST FIX: Use cheaper model (10x less expensive than GPT-4)
        messages: messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
        max_tokens: 80,
        temperature: 0.7,
      });

      response = completion.choices[0]?.message?.content || 'How can I help you with OwnerFi today?';

      // Track actual usage
      await trackUsage({
        inputTokens: completion.usage?.prompt_tokens || estimatedInputTokens,
        outputTokens: completion.usage?.completion_tokens || estimatedOutputTokens,
        totalTokens: completion.usage?.total_tokens || (estimatedInputTokens + estimatedOutputTokens),
        estimatedCost: calculateCost(
          completion.usage?.prompt_tokens || estimatedInputTokens,
          completion.usage?.completion_tokens || estimatedOutputTokens,
          'gpt-4o-mini'
        ),
        model: 'gpt-4o-mini',
        timestamp: Date.now()
      });

      // Track cost in main cost tracking system
      try {
        const { trackCost, calculateOpenAICost } = await import('@/lib/cost-tracker');
        const inputTokens = completion.usage?.prompt_tokens || estimatedInputTokens;
        const outputTokens = completion.usage?.completion_tokens || estimatedOutputTokens;
        const cost = calculateOpenAICost(inputTokens, outputTokens);

        await trackCost(
          'ownerfi', // Chatbot is OwnerFi brand
          'openai',
          'chatbot_message',
          completion.usage?.total_tokens || (estimatedInputTokens + estimatedOutputTokens),
          cost
        );
        console.log(`💰 [Chatbot] Tracked OpenAI cost: $${cost.toFixed(4)}`);
      } catch (costError) {
        console.error(`⚠️  [Chatbot] Failed to track OpenAI cost:`, costError);
      }

    } catch (error) {
      console.error('[chatbot] OpenAI error:', error);
      response = 'I\'m having trouble connecting right now. How can I help you with OwnerFi? Feel free to explore our platform or sign up to get started!';
    }

    return NextResponse.json({
      reply: response,
      conversationHistory: [...conversationHistory, 
        { role: 'user', content: message },
        { role: 'assistant', content: response }
      ]
    });

  } catch (error) {
    console.error('Chatbot API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to process chat message',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}