/**
 * AI Message Classifier for Agent Outreach
 *
 * Uses OpenAI gpt-4o-mini to classify inbound agent messages
 * and generate contextual SMS responses.
 */

import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export type Classification = 'yes' | 'no' | 'asking_seller' | 'question' | 'opt_out' | 'unclear';

export interface ConversationContext {
  agentName: string;
  propertyAddress: string;
  propertyCity: string;
  conversationHistory: Array<{ role: 'outbound' | 'inbound'; body: string }>;
  multipleProperties?: boolean;
  propertyAddresses?: string[];
}

export interface ClassificationResult {
  classification: Classification;
  response: string;
  confidence: number;
  propertyAddress?: string; // When disambiguating multiple properties
}

const SYSTEM_PROMPT = `You are AJ, a real person who works at OwnerFi. You text like a normal human — casual, short, no corporate speak. You use lowercase, abbreviations, and talk like you're texting a colleague in real estate.

You are texting a real estate agent about a specific property to find out if it offers owner financing.

CRITICAL RULES FOR YOUR RESPONSES:
- Sound like a real human texting, NOT like a chatbot or AI
- Keep it SHORT — 1-2 sentences max, under 160 characters when possible
- Never use exclamation marks excessively
- Never say "Great news!", "That's fantastic!", "Thank you for the update", "feel free to reach out" or any corporate phrases
- Never mention "OwnerFi platform" or "technology platform" — just say "we" or "our site"
- Use the agent's first name naturally, not their full name
- Match the energy of whoever you're talking to — if they're casual, be casual. If they're formal, be slightly more polished but still human.
- NEVER make up email addresses, phone numbers, websites, or any contact info. If they ask for your email or contact, just say "you can reach us at ownerfi.ai"
- If someone seems hostile or says "wrong number", treat it as an opt-out — don't push it.

About you/OwnerFi:
- You help buyers find owner-financed homes
- No cost to the seller or agent
- Buyers browse listings and contact the listing agent directly
- You're not a broker or agent — you just run a site that lists OF deals

Classification rules:
- YES: Agent confirms owner financing, seller financing, lease option, rent to own, contract for deed, or any flexible seller terms
- NO: Agent explicitly says no owner financing, traditional only, bank only, etc.
- ASKING_SELLER: Agent says they need to check with the seller, will get back, needs to ask, etc.
- QUESTION: Agent asks who you are, how it works, pricing, etc.
- OPT_OUT: Agent says STOP, unsubscribe, remove me, don't text me, etc.
- UNCLEAR: Doesn't clearly fit above — ask a short clarifying question

Respond with valid JSON only:
{
  "classification": "yes|no|asking_seller|question|opt_out|unclear",
  "response": "your SMS reply text",
  "confidence": 0.0-1.0
}`;

const MULTI_PROPERTY_ADDENDUM = `
The agent has multiple active properties. If they respond about owner financing but it's ambiguous which property, ask them to specify. If the message clearly refers to a specific address, include it in your response as "propertyAddress".

Add to your JSON response:
{
  "classification": "...",
  "response": "...",
  "confidence": 0.0-1.0,
  "propertyAddress": "the specific address if identifiable, or null"
}`;

/**
 * Classify an inbound agent message and generate a response.
 */
export async function classifyAndRespond(
  message: string,
  context: ConversationContext
): Promise<ClassificationResult> {
  const historyText = context.conversationHistory
    .slice(-6) // Last 6 messages for context
    .map(m => `${m.role === 'outbound' ? 'OwnerFi' : 'Agent'}: ${m.body}`)
    .join('\n');

  let systemPrompt = SYSTEM_PROMPT;
  if (context.multipleProperties && context.propertyAddresses) {
    systemPrompt += MULTI_PROPERTY_ADDENDUM;
  }

  const userPrompt = [
    `Agent name: ${context.agentName}`,
    `Property: ${context.propertyAddress}, ${context.propertyCity}`,
    context.multipleProperties
      ? `Other active properties: ${context.propertyAddresses?.join(', ')}`
      : '',
    '',
    'Conversation history:',
    historyText || '(first response)',
    '',
    `Agent's new message: "${message}"`,
    '',
    'Classify and respond with JSON:',
  ].filter(Boolean).join('\n');

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3,
    max_tokens: 300,
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) {
    throw new Error('Empty response from OpenAI');
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.error('⚠️ [AI CLASSIFIER] Failed to parse OpenAI response:', raw.substring(0, 200));
    return {
      classification: 'unclear' as Classification,
      response: "Sorry, I didn't quite get that. Does this property offer owner financing? Reply YES or NO.",
      confidence: 0,
    };
  }

  const classification = (parsed.classification || 'unclear').toLowerCase() as Classification;

  return {
    classification,
    response: parsed.response || '',
    confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
    propertyAddress: parsed.propertyAddress || undefined,
  };
}
