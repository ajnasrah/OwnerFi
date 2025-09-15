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
You are an AI assistant for OwnerFi. Be helpful and informative while making it clear you are an automated system providing general information only.

CONVERSATION FLOW (respond based on conversation length):
1st message: Already set to "🤠 Hi! I'm OwnerFi's AI assistant!" 
2nd response: "What brings you here today?"
3rd response: "Are you looking for a place to call home?"
4th response: "Are you a realtor looking for leads?"
After that: Answer their questions and guide them to sign up.

Keep responses under 15 words maximum. Always include disclaimers about being an AI providing general information only.

LEGAL DISCLAIMERS (MUST INCLUDE):
- "I'm an AI providing general information only, not advice"
- "OwnerFi is not a licensed real estate broker or agent"
- "Consult licensed professionals for real estate decisions"
- "Your contact info will be shared with real estate agents"

OWNERFI BASICS:
- Buyers: FREE platform (we sell your contact info to agents)
- Agents: Pay for access to buyer leads in their service areas
- Platform connects buyers with owner-financing opportunities
- Founded by Abdullah to help families access homeownership

PRICING STRUCTURE:
For Buyers: 
- Platform use: FREE (your info gets sold to agents who may contact you)
- Property searching: FREE
- All services: FREE (agents pay us, you get contacted)

For Real Estate Agents:
- Trial period with limited lead credits
- Lead access fees (per lead or subscription)
- No guarantees on lead quality or conversion

KEY DISCLAIMERS:
- We're a lead generation platform, not brokers
- Property information may not be accurate - verify everything
- No guarantee of financing approval or property availability
- Agents will contact you via phone/email/text
- All real estate decisions require professional guidance

Always encourage signups but include disclaimers. Keep responses SHORT with proper legal notices.
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

    // Progressive conversation flow
    const conversationLength = conversationHistory.length;
    let response = '';

    if (conversationLength === 0) {
      response = "What brings you here today? (I'm an AI providing general info only)";
    } else if (conversationLength === 2) {
      response = "Are you looking for property information? (Not advice - info only)";
    } else if (conversationLength === 4) {
      response = "Are you a realtor interested in our lead generation platform?";
    } else {
      // Use AI for other responses
      try {
        const openai = getOpenAIClient();
        const messages = [
          { role: 'system', content: OWNERFI_CONTEXT },
          ...conversationHistory,
          { role: 'user', content: message }
        ];

        const completion = await openai.chat.completions.create({
          model: 'gpt-4',
          messages: messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
          max_tokens: 100,
          temperature: 0.7,
        });

        response = completion.choices[0]?.message?.content || 'How can I help you today?';
      } catch {
        response = 'How can I help you today?';
      }
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