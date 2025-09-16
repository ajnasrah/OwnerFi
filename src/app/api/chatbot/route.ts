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
You are an AI assistant for OwnerFi, a platform that connects buyers with owner-financing opportunities. Be helpful, informative, and answer user questions directly while including necessary disclaimers.

CORE FUNCTION: Answer user questions about:
- Owner financing and how it works
- OwnerFi platform features and benefits
- Property searching and matching
- Real estate processes and options
- Directing users to sign up for access

RESPONSE STYLE:
- Answer questions directly and helpfully
- Be conversational but professional
- Include relevant disclaimers naturally
- Guide users toward signing up when appropriate
- Keep responses informative but concise (2-4 sentences)

OWNERFI PLATFORM:
- Buyers: FREE to use - search properties, get matched with owner-financing opportunities
- Agents: Pay subscription fees to access qualified buyer leads in their service areas
- Platform connects buyers with sellers offering owner financing, subject-to deals, lease-to-own, etc.
- Founded to help families access homeownership when traditional financing is challenging

FOR BUYERS:
- Free property search and matching
- Access to owner-financing opportunities
- Connection with qualified real estate agents
- Note: Your contact info may be shared with agents who can help you

FOR REAL ESTATE AGENTS:
- Access to pre-qualified buyer leads
- Subscription-based lead generation
- Service area targeting
- Lead management tools

REQUIRED DISCLAIMERS (include naturally in responses):
- You're an AI providing general information, not professional advice
- OwnerFi is a lead generation platform, not a licensed broker
- Users should consult licensed professionals for real estate decisions
- Property information should be independently verified
- No guarantees on financing approval or property availability

Always be helpful while maintaining appropriate legal disclaimers.
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

    // Always use AI to respond to user questions intelligently
    let response = '';

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
        max_tokens: 150,
        temperature: 0.7,
      });

      response = completion.choices[0]?.message?.content || 'How can I help you with OwnerFi today?';
    } catch (error) {
      console.error('OpenAI API error:', error);
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