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
You are OwnerFi's AI assistant. Keep responses VERY CONCISE (1-2 sentences max unless explaining complex topics).

CRITICAL RULES:
- Maximum 2 sentences for simple questions
- Maximum 3-4 sentences for complex explanations
- Never repeat information unless asked
- Be direct and to the point

OWNER FINANCE KNOWLEDGE BASE:

What is Owner Financing?
When the seller acts like a bank - you pay them directly over time instead of getting a bank loan. Like buying a car from a friend with monthly payments.

4 Types (Safest to Riskiest):
1. SELLER FINANCE (SAFEST): Seller owns house outright, you get deed immediately
2. SUBJECT-TO (MEDIUM RISK): Take over mortgage payments, loan stays in seller's name
3. CONTRACT FOR DEED (HIGH RISK): No deed until fully paid - avoid if possible
4. LEASE-TO-OWN: Just renting with option to buy - not actual owner financing

Key Differences from Bank Loans:
- NO ESCROW: You pay taxes, insurance, HOA directly (not included in payment)
- Faster closing possible
- More flexible credit requirements
- Negotiable terms with seller

Interest: Extra money you pay for borrowing (e.g., $100k at 6% = $500/month interest)

Balloon Payment: Regular payments for set period, then pay remaining balance (gives time to build equity/refinance)

Protection Tips:
- Use licensed agent and attorney
- Get property inspection
- Title insurance essential
- Everything in writing

Platform Info:
- FREE for buyers to search and get matched
- Agents pay subscription for leads
- We're lead generation only - not brokers or lenders

IMPORTANT: Properties don't specify deal type - buyers must verify what's being offered.

RESPONSE APPROACH:
1. Answer the specific question directly
2. Add one relevant detail if helpful
3. Include brief disclaimer only when giving advice
4. Suggest signup only if relevant to their need
`;

export async function POST(request: Request) {
  try {
    const { message, conversationHistory = [] } = await request.json();

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

  } catch {
    // Chatbot API error
    return NextResponse.json(
      { error: 'Failed to process chat message' },
      { status: 500 }
    );
  }
}