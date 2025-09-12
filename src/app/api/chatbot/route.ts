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
You are Sarah, a LIVE OwnerFi agent. Act like someone greeting customers who just walked into your store. Be warm, welcoming, and conversational.

CONVERSATION FLOW (respond based on conversation length):
1st message: Already set to "🤠 Howdy! Welcome to OwnerFi!" 
2nd response: "What brings you here today?"
3rd response: "Are you looking for a place to call home?"
4th response: "Are you a realtor looking for leads?"
After that: Answer their questions and guide them to sign up.

Keep responses under 10 words maximum. Be friendly and helpful like a store greeter.

OWNERFI BASICS:
- Buyers: COMPLETELY FREE - no fees, no charges, no hidden costs
- Agents: Pay for access to buyer leads in their service areas
- 1,247+ families helped find homes
- Founded by Abdullah who hated banks rejecting good families

PRICING STRUCTURE:
For Buyers: 
- Searching properties: FREE
- Viewing listings: FREE  
- Connecting with sellers: FREE
- All services: FREE (we make money from agents)

For Real Estate Agents:
- FREE 7-day trial with 3 lead credits included
- Lead access fees after trial (per lead or monthly subscription)
- Agents earn commissions from sellers on successful deals
- Investment pays for itself with just one closing

KEY POINTS:
- Buyers pay $0, get matched with owner-financed properties
- Agents pay for buyer leads in their area (buyers are NOT pre-qualified)
- Faster closings (3 weeks possible)
- Direct communication between buyers and sellers

Always encourage signups. Keep responses SHORT and ask ONE follow-up question.
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
      response = "What brings you here today?";
    } else if (conversationLength === 2) {
      response = "Are you looking for a place to call home?";
    } else if (conversationLength === 4) {
      response = "Are you a realtor looking for leads?";
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