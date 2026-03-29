/**
 * Test Script: AI Outreach Classifier — Full Personality Gauntlet
 *
 * 25 realistic agent personalities from all walks of life.
 * Tests classification accuracy AND response quality.
 *
 * Run: npx tsx scripts/test-ai-outreach.ts
 */

import { config } from 'dotenv';
config({ path: '.env.local' });
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

type Classification = 'yes' | 'no' | 'asking_seller' | 'question' | 'opt_out' | 'unclear';

interface TestCase {
  name: string;
  personality: string;
  messages: Array<{ text: string; expected: Classification }>;
  property: string;
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

const TEST_CASES: TestCase[] = [
  // === RUDE / HOSTILE ===
  {
    name: 'Karen the Realtor',
    personality: 'Rude, condescending, thinks you are beneath her',
    property: '4420 Maple Dr, Nashville',
    messages: [
      { text: "Excuse me? Who gave you permission to text me? This is extremely unprofessional.", expected: 'opt_out' },
    ],
  },
  {
    name: 'Big Rick',
    personality: 'Hostile bro energy, curses freely',
    property: '1150 Oak Ave, Memphis',
    messages: [
      { text: "Bro who tf is this? Delete my number", expected: 'opt_out' },
    ],
  },
  {
    name: 'Debra the Boomer',
    personality: 'Offended by unsolicited texts, threatens legal action',
    property: '302 Pine St, Little Rock',
    messages: [
      { text: "This is solicitation. I am reporting this number to the FCC. Do NOT contact me again.", expected: 'opt_out' },
    ],
  },
  {
    name: 'Annoyed Mike',
    personality: 'Gets 50 spam texts a day, zero patience',
    property: '8800 Elm Blvd, Jackson',
    messages: [
      { text: "nah", expected: 'no' },
    ],
  },
  {
    name: 'Sarcastic Tony',
    personality: 'Sarcasm dripping from every word',
    property: '5505 Chaucer Ln, Cordova',
    messages: [
      { text: "Oh wow another spam text asking about owner financing. How original. No.", expected: 'no' },
    ],
  },

  // === CONFUSED / DOESN'T UNDERSTAND ===
  {
    name: 'Grandma Linda',
    personality: 'Elderly agent, barely understands texting, types in all caps',
    property: '77 Sunset Dr, Germantown',
    messages: [
      { text: "WHO IS THIS?? I DONT KNOW WHAT OWNER FINANCING IS. MY GRANDSON SET UP MY PHONE", expected: 'question' },
    ],
  },
  {
    name: 'New Agent Derek',
    personality: 'Just got his license last week, knows nothing',
    property: '330 River Rd, Bartlett',
    messages: [
      { text: "Hey sorry im pretty new at this. What exactly is owner financing? Like the owner pays for the house? Im confused", expected: 'question' },
    ],
  },
  {
    name: 'ESL Maria',
    personality: 'English is her second language, broken grammar but earnest',
    property: '1900 Central Ave, Hot Springs',
    messages: [
      { text: "hello yes i am agent for this home. i not sure what is owner finance. seller maybe yes but i need ask first ok?", expected: 'asking_seller' },
    ],
  },
  {
    name: 'Clueless Brad',
    personality: 'Thinks you are trying to buy the house',
    property: '450 Market St, Conway',
    messages: [
      { text: "Are you trying to make an offer? You need to go through the MLS. Whats your pre-approval?", expected: 'question' },
    ],
  },
  {
    name: 'Wrong Number Pam',
    personality: 'Thinks you texted the wrong person',
    property: '600 Highland, Jonesboro',
    messages: [
      { text: "I think you have the wrong number. I dont have any listings on Highland.", expected: 'opt_out' },
    ],
  },

  // === SMART / ASKS GREAT QUESTIONS ===
  {
    name: 'Investor Agent Dave',
    personality: 'Very experienced, asks sharp business questions',
    property: '2100 Commerce St, Dallas',
    messages: [
      { text: "Interesting. Whats your business model? How do you monetize? Do you take a cut of the deal or charge the buyer?", expected: 'question' },
    ],
  },
  {
    name: 'Tech-Savvy Priya',
    personality: 'Runs her own CRM, data-driven, wants specifics',
    property: '880 Innovation Way, Austin',
    messages: [
      { text: "How many active buyers do you have in the Austin market? What's your conversion rate from listing to buyer contact? I need numbers before I commit.", expected: 'question' },
    ],
  },
  {
    name: 'Attorney Agent James',
    personality: 'Lawyer who also sells real estate, legally minded',
    property: '1500 Court St, Birmingham',
    messages: [
      { text: "What are the compliance requirements? Is the seller entering a brokerage relationship with your company? Who holds the escrow? I need to understand the legal structure.", expected: 'question' },
    ],
  },
  {
    name: 'Veteran Broker Tom',
    personality: '30 years in real estate, seen it all, skeptical but fair',
    property: '4000 Plantation Rd, Savannah',
    messages: [
      { text: "Ive been doing this 30 years son. Ive seen 100 companies like yours come and go. What makes you different? And yes the seller does offer owner financing on this one. 10% down 7% interest.", expected: 'yes' },
    ],
  },
  {
    name: 'Multi-unit Specialist Rachel',
    personality: 'Commercial agent, wants to know if you handle commercial too',
    property: '200 Industrial Pkwy, Chattanooga',
    messages: [
      { text: "This is a 4-plex actually. Do you handle multi-family or just SFR? The owner might do seller carry on this one.", expected: 'yes' },
    ],
  },

  // === COMMON SENSE / NORMAL PEOPLE ===
  {
    name: 'Normal Lisa',
    personality: 'Average agent, polite, gives a straight answer',
    property: '3300 Walnut, Fayetteville',
    messages: [
      { text: "Hi AJ, yes the seller is open to owner financing. They want 15% down.", expected: 'yes' },
    ],
  },
  {
    name: 'Friendly Marcus',
    personality: 'Super nice, adds you on everything',
    property: '710 Dogwood Ln, Rogers',
    messages: [
      { text: "Hey man! Yep owner financing available. Shoot me your email too ill send you the flyer", expected: 'yes' },
    ],
  },
  {
    name: 'Busy Vanessa',
    personality: 'In a showing right now, quick reply',
    property: '5505 Chaucer Ln, Cordova',
    messages: [
      { text: "in a showing rn. let me ask seller and get back 2 u", expected: 'asking_seller' },
    ],
  },
  {
    name: 'Straight Shooter Carlos',
    personality: 'No BS, yes or no answers only',
    property: '900 Jefferson Ave, West Memphis',
    messages: [
      { text: "No owner financing. Cash or conventional only.", expected: 'no' },
    ],
  },
  {
    name: 'Helpful Andrea',
    personality: 'Says no but tries to help you find alternatives',
    property: '1200 Broadway, Tupelo',
    messages: [
      { text: "No owner financing on this one unfortunately. But I have another listing on Cherry Lane that the seller might consider it on. Want me to send you the details?", expected: 'no' },
    ],
  },

  // === MULTI-TURN EDGE CASES ===
  {
    name: 'Vague Victor',
    personality: 'Never gives a straight answer',
    property: '400 Main St, Oxford',
    messages: [
      { text: "maybe. depends.", expected: 'asking_seller' },
    ],
  },
  {
    name: 'Changes-Mind Tanya',
    personality: 'Said yes initially but now says actually no',
    property: '550 Campus Dr, Starkville',
    messages: [
      { text: "Actually I spoke to the seller again and they changed their mind. No owner financing anymore, sorry.", expected: 'no' },
    ],
  },
  {
    name: 'Lease Option Larry',
    personality: 'Doesnt call it owner financing but offers equivalent',
    property: '800 Lakeshore, Biloxi',
    messages: [
      { text: "We dont do traditional owner financing but the seller would consider a lease option or rent to own arrangement", expected: 'yes' },
    ],
  },
  {
    name: 'Price Checker Pete',
    personality: 'Wants to know your buyers budget before answering',
    property: '3000 Mountain Rd, Gatlinburg',
    messages: [
      { text: "What kind of down payment are your buyers looking at? And what price range? The seller might be open to terms if the numbers make sense.", expected: 'asking_seller' },
    ],
  },
  {
    name: 'Already-Sold Sarah',
    personality: 'Property is no longer available',
    property: '150 Park Ave, Franklin',
    messages: [
      { text: "Hey that property actually went under contract yesterday. But thanks for reaching out!", expected: 'opt_out' },
    ],
  },
];

async function classifyMessage(
  agentName: string,
  property: string,
  message: string,
  history: string[]
): Promise<{ classification: string; response: string; confidence: number }> {
  const historyText = history.length > 0
    ? history.map((h, i) => i % 2 === 0 ? `OwnerFi: ${h}` : `Agent: ${h}`).join('\n')
    : `OwnerFi: Hi ${agentName.split(' ')[0]}, this is OwnerFi. We help buyers find owner-financed homes. Does the property at ${property} offer owner financing or flexible terms? Reply YES or NO. Reply STOP to opt out.`;

  const userPrompt = [
    `Agent name: ${agentName}`,
    `Property: ${property}`,
    '',
    'Conversation history:',
    historyText,
    '',
    `Agent's new message: "${message}"`,
    '',
    'Classify and respond with JSON:',
  ].join('\n');

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3,
    max_tokens: 300,
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error('Empty OpenAI response');

  const parsed = JSON.parse(raw);
  return {
    classification: (parsed.classification || 'unclear').toLowerCase(),
    response: parsed.response || '',
    confidence: parsed.confidence || 0,
  };
}

async function main() {
  console.log('='.repeat(80));
  console.log('  AI OUTREACH GAUNTLET — 25 Agent Personalities');
  console.log('  Testing: rude, confused, smart, normal, edge cases');
  console.log('='.repeat(80));

  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY not set');
    process.exit(1);
  }

  let passed = 0;
  let failed = 0;
  let totalChars = 0;
  let overLength = 0;
  const failures: string[] = [];

  const roboticPatterns = [
    /as an ai/i, /i'm an ai/i, /language model/i, /certainly!/i,
    /i'd be happy to/i, /great question/i, /Thank you for (your|the)/,
    /feel free to/i, /don't hesitate/i, /I understand your/i,
    /platform/i, /That's fantastic/i, /Great news/i,
  ];

  for (let i = 0; i < TEST_CASES.length; i++) {
    const tc = TEST_CASES[i];
    const msg = tc.messages[0];

    const result = await classifyMessage(tc.name, tc.property, msg.text, []);

    const correct = result.classification === msg.expected;
    if (correct) passed++; else { failed++; failures.push(`#${i + 1} ${tc.name}`); }

    totalChars += result.response.length;
    if (result.response.length > 160) overLength++;

    const roboticHits = roboticPatterns.filter(p => p.test(result.response));

    console.log(`\n${'-'.repeat(80)}`);
    console.log(`#${String(i + 1).padStart(2)} ${tc.name} — ${tc.personality}`);
    console.log(`${'-'.repeat(80)}`);
    console.log(`  AGENT: "${msg.text}"`);
    console.log(`  CLASS: ${result.classification} (expected: ${msg.expected}) ${correct ? '✅' : '❌'}`);
    console.log(`  REPLY: "${result.response}" [${result.response.length} chars]`);
    if (roboticHits.length > 0) {
      console.log(`  ⚠️  ROBOTIC: ${roboticHits.map(p => p.source).join(', ')}`);
    }
    if (result.response.length > 160) {
      console.log(`  ⚠️  OVER 160 CHARS`);
    }
  }

  const avgChars = Math.round(totalChars / TEST_CASES.length);

  console.log(`\n${'='.repeat(80)}`);
  console.log(`  RESULTS`);
  console.log(`${'='.repeat(80)}`);
  console.log(`  Classification: ${passed}/${TEST_CASES.length} correct`);
  console.log(`  Avg response length: ${avgChars} chars`);
  console.log(`  Over 160 chars: ${overLength}/${TEST_CASES.length}`);
  if (failures.length > 0) {
    console.log(`  Failures: ${failures.join(', ')}`);
  }
  console.log(`${'='.repeat(80)}\n`);

  if (failed === 0) {
    console.log('✅ ALL 25 TESTS PASSED\n');
  } else {
    console.log(`❌ ${failed} FAILED\n`);
    process.exit(1);
  }
}

main().catch(console.error);
