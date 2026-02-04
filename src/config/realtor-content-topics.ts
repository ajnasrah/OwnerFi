/**
 * Realtor Sub-Brand Content Topics
 *
 * Each topic starts with a pain-point question that realtors face,
 * followed by how OwnerFi solves it and why they should try it.
 *
 * Format: Question → Problem → OwnerFi Solution → CTA
 */

export interface RealtorContentTopic {
  id: string;
  question: string; // Hook question to start the video
  painPoint: string; // The problem realtors face
  solution: string; // How OwnerFi solves it
  benefit: string; // Why this matters to the realtor
  cta: string; // Call to action
  hashtags: string[]; // Topic-specific hashtags
  category: 'leads' | 'income' | 'efficiency' | 'education' | 'closing';
}

/**
 * Content topics organized by category
 * Each video should use one topic and follow the question-first format
 */
export const REALTOR_CONTENT_TOPICS: RealtorContentTopic[] = [
  // ============================================================================
  // LEADS CATEGORY - Getting more qualified buyers
  // ============================================================================
  {
    id: 'leads-1',
    question: 'Tired of chasing cold leads that go nowhere?',
    painPoint: 'Most leads from Zillow or Realtor.com are just browsing, not ready to buy.',
    solution: 'OwnerFi sends you pre-screened buyers who are actively looking for owner-financed properties in YOUR area.',
    benefit: 'No more wasted showings. These buyers are motivated and ready to close.',
    cta: 'Sign up free at OwnerFi.ai and get your first lead on us.',
    hashtags: ['#RealEstateLeads', '#QualifiedBuyers', '#RealtorTips'],
    category: 'leads',
  },
  {
    id: 'leads-2',
    question: 'What if buyers came to YOU instead of you chasing them?',
    painPoint: 'Cold calling, door knocking, and buying leads gets exhausting.',
    solution: 'OwnerFi matches you with buyers already searching for owner-financed homes in your market.',
    benefit: 'Inbound leads mean less hustle and more closings.',
    cta: 'Get started free at OwnerFi.ai',
    hashtags: ['#InboundLeads', '#RealtorLife', '#RealEstateAgent'],
    category: 'leads',
  },
  {
    id: 'leads-3',
    question: 'How do you find buyers who actually qualify for owner financing?',
    painPoint: 'Traditional financing falls through. Buyers get rejected. Deals die.',
    solution: 'OwnerFi pre-screens buyers specifically for owner-financed deals before sending them to you.',
    benefit: 'Higher close rates because these buyers already fit the owner-finance criteria.',
    cta: 'Claim your free lead at OwnerFi.ai',
    hashtags: ['#OwnerFinancing', '#PreQualified', '#ClosingDeals'],
    category: 'leads',
  },
  {
    id: 'leads-4',
    question: 'Want leads in YOUR service area, not random cities?',
    painPoint: 'Most lead platforms send you buyers 50 miles away.',
    solution: 'OwnerFi lets you set your exact service area and only sends buyers within your radius.',
    benefit: 'Work your market. No more driving hours for one showing.',
    cta: 'Set up your service area free at OwnerFi.ai',
    hashtags: ['#LocalLeads', '#RealEstateMarketing', '#AgentLife'],
    category: 'leads',
  },
  {
    id: 'leads-5',
    question: 'Why are your leads not converting?',
    painPoint: 'You buy 10 leads and maybe 1 responds. Sound familiar?',
    solution: 'OwnerFi leads have already expressed intent to buy owner-financed properties.',
    benefit: 'Intent-driven leads convert 5x better than cold contacts.',
    cta: 'Try OwnerFi free and see the difference.',
    hashtags: ['#LeadConversion', '#RealEstateSales', '#AgentSuccess'],
    category: 'leads',
  },

  // ============================================================================
  // INCOME CATEGORY - Making more money with less risk
  // ============================================================================
  {
    id: 'income-1',
    question: 'What if you could earn commission without upfront costs?',
    painPoint: 'Paying for leads, ads, and marketing with no guarantee of closing.',
    solution: 'OwnerFi only takes a 30% referral fee AFTER you close. No upfront cost.',
    benefit: 'You keep 70% of your commission and pay nothing until the deal closes.',
    cta: 'Zero risk, all reward. Join at OwnerFi.ai',
    hashtags: ['#ReferralFee', '#NoRisk', '#RealtorIncome'],
    category: 'income',
  },
  {
    id: 'income-2',
    question: 'How do top agents close deals without spending on ads?',
    painPoint: 'Facebook ads, Google ads, Zillow Premier... it adds up fast.',
    solution: 'OwnerFi gives you 1 free lead every month. Build your pipeline without spending.',
    benefit: 'Free leads = free money when they close.',
    cta: 'Get your free monthly lead at OwnerFi.ai',
    hashtags: ['#FreeLeads', '#RealtorMarketing', '#ZeroCost'],
    category: 'income',
  },
  {
    id: 'income-3',
    question: 'Want to make money from leads you can\'t work yourself?',
    painPoint: 'Sometimes leads are outside your area or you\'re too busy.',
    solution: 'OwnerFi lets you refer leads to other agents and earn a cut of their commission.',
    benefit: 'Turn unused leads into passive income.',
    cta: 'Start referring at OwnerFi.ai',
    hashtags: ['#PassiveIncome', '#AgentReferrals', '#RealtorNetwork'],
    category: 'income',
  },
  {
    id: 'income-4',
    question: 'Is your cost per lead killing your profit margin?',
    painPoint: 'Spending $50-100 per lead and closing 1 in 50? Do the math.',
    solution: 'OwnerFi leads cost you nothing upfront. Pay only when you get paid.',
    benefit: 'Your profit margin stays intact because costs come after revenue.',
    cta: 'Protect your margins with OwnerFi.ai',
    hashtags: ['#ProfitMargin', '#RealEstateBusiness', '#SmartAgent'],
    category: 'income',
  },
  {
    id: 'income-5',
    question: 'How do you scale income without scaling expenses?',
    painPoint: 'More leads usually means more money spent on marketing.',
    solution: 'OwnerFi\'s referral model means you only pay when deals close.',
    benefit: 'Scale your business without scaling your costs.',
    cta: 'Scale smart at OwnerFi.ai',
    hashtags: ['#ScaleYourBusiness', '#AgentGrowth', '#RealEstateScaling'],
    category: 'income',
  },

  // ============================================================================
  // EFFICIENCY CATEGORY - Working smarter not harder
  // ============================================================================
  {
    id: 'efficiency-1',
    question: 'How much time do you waste on unqualified buyers?',
    painPoint: 'Driving to showings, only to find out they can\'t afford the home.',
    solution: 'OwnerFi pre-qualifies every buyer before you ever contact them.',
    benefit: 'Spend your time with serious buyers, not tire kickers.',
    cta: 'Work smarter at OwnerFi.ai',
    hashtags: ['#TimeManagement', '#EfficientAgent', '#QualifiedBuyers'],
    category: 'efficiency',
  },
  {
    id: 'efficiency-2',
    question: 'Tired of deals falling through at the last minute?',
    painPoint: 'Financing denied. Inspection issues. Buyer backs out.',
    solution: 'Owner-financed deals have fewer hurdles. No bank approval needed.',
    benefit: 'Faster, smoother closes with less fallout.',
    cta: 'Close more deals with OwnerFi.ai',
    hashtags: ['#SmoothClosing', '#OwnerFinancing', '#DealFlow'],
    category: 'efficiency',
  },
  {
    id: 'efficiency-3',
    question: 'What if your leads came with their contact info already verified?',
    painPoint: 'Wrong numbers. Fake emails. Ghost leads.',
    solution: 'OwnerFi verifies buyer contact info before releasing it to you.',
    benefit: 'Every lead you get is reachable and real.',
    cta: 'Get verified leads at OwnerFi.ai',
    hashtags: ['#VerifiedLeads', '#RealContacts', '#AgentTools'],
    category: 'efficiency',
  },
  {
    id: 'efficiency-4',
    question: 'How many hours do you spend generating leads each week?',
    painPoint: 'Prospecting, follow-ups, social media... it\'s a full-time job.',
    solution: 'Let OwnerFi do the prospecting. You focus on closing.',
    benefit: 'Reclaim 10+ hours a week for what actually makes you money.',
    cta: 'Automate your leads at OwnerFi.ai',
    hashtags: ['#LeadGeneration', '#Automation', '#AgentProductivity'],
    category: 'efficiency',
  },
  {
    id: 'efficiency-5',
    question: 'Want a simpler referral agreement process?',
    painPoint: 'Paperwork, signatures, faxing... it\'s 2024, why is this so hard?',
    solution: 'OwnerFi uses digital RF-701 agreements. Sign in seconds online.',
    benefit: 'Legal, compliant, and done in under a minute.',
    cta: 'Go digital with OwnerFi.ai',
    hashtags: ['#DigitalAgreements', '#Paperless', '#ModernRealtor'],
    category: 'efficiency',
  },

  // ============================================================================
  // EDUCATION CATEGORY - Understanding owner financing
  // ============================================================================
  {
    id: 'education-1',
    question: 'What is owner financing and why should you care?',
    painPoint: 'Many agents don\'t understand this powerful tool.',
    solution: 'Owner financing lets sellers BE the bank. Buyers pay the seller directly over time.',
    benefit: 'Opens up a whole new market of buyers who can\'t get traditional loans.',
    cta: 'Learn more and get leads at OwnerFi.ai',
    hashtags: ['#OwnerFinancing101', '#RealEstateEducation', '#AgentTraining'],
    category: 'education',
  },
  {
    id: 'education-2',
    question: 'Why are your clients missing out on owner-financed deals?',
    painPoint: 'Most agents only know traditional financing.',
    solution: 'OwnerFi connects you with buyers specifically looking for creative financing.',
    benefit: 'Expand your expertise and close deals others can\'t.',
    cta: 'Get certified in owner financing at OwnerFi.ai',
    hashtags: ['#CreativeFinancing', '#AgentEducation', '#DealMaking'],
    category: 'education',
  },
  {
    id: 'education-3',
    question: 'How do you explain owner financing to skeptical sellers?',
    painPoint: 'Sellers think it\'s risky or complicated.',
    solution: 'OwnerFi provides education materials and handles the buyer screening.',
    benefit: 'You become the expert who opens new doors for your clients.',
    cta: 'Get seller resources at OwnerFi.ai',
    hashtags: ['#SellerEducation', '#OwnerFinance', '#TrustedAdvisor'],
    category: 'education',
  },
  {
    id: 'education-4',
    question: 'What types of buyers look for owner-financed properties?',
    painPoint: 'You might think it\'s only for people with bad credit.',
    solution: 'Self-employed, new to credit, immigrants, investors - all seek owner financing.',
    benefit: 'A huge untapped market most agents ignore.',
    cta: 'Tap into this market at OwnerFi.ai',
    hashtags: ['#BuyerTypes', '#UntappedMarket', '#OwnerFinanceBuyers'],
    category: 'education',
  },
  {
    id: 'education-5',
    question: 'Is owner financing legal in your state?',
    painPoint: 'Agents worry about compliance and Dodd-Frank.',
    solution: 'Yes, it\'s legal. OwnerFi helps you stay compliant with proper documentation.',
    benefit: 'Work confidently knowing you\'re protected.',
    cta: 'Stay compliant with OwnerFi.ai',
    hashtags: ['#Compliance', '#DoddFrank', '#LegalRealEstate'],
    category: 'education',
  },

  // ============================================================================
  // CLOSING CATEGORY - Actually getting deals done
  // ============================================================================
  {
    id: 'closing-1',
    question: 'How do you close more deals in a tough market?',
    painPoint: 'High rates, low inventory, buyers backing out.',
    solution: 'Owner financing bypasses traditional lending barriers.',
    benefit: 'Close deals that would die waiting for bank approval.',
    cta: 'Beat the market with OwnerFi.ai',
    hashtags: ['#ToughMarket', '#ClosingDeals', '#MarketProof'],
    category: 'closing',
  },
  {
    id: 'closing-2',
    question: 'What\'s your conversion rate from lead to close?',
    painPoint: 'Industry average is under 2%. That\'s 98 leads wasted.',
    solution: 'OwnerFi leads are pre-screened for intent AND ability to close.',
    benefit: 'Higher conversion means more commission per lead.',
    cta: 'Improve your conversion at OwnerFi.ai',
    hashtags: ['#ConversionRate', '#LeadToClose', '#AgentMetrics'],
    category: 'closing',
  },
  {
    id: 'closing-3',
    question: 'How fast can you close an owner-financed deal?',
    painPoint: 'Traditional deals take 30-60 days minimum.',
    solution: 'No bank means no underwriting delays. Closings can happen in 2 weeks.',
    benefit: 'Faster closes = faster paychecks.',
    cta: 'Speed up your closes at OwnerFi.ai',
    hashtags: ['#FastClosing', '#QuickSale', '#CashFlow'],
    category: 'closing',
  },
  {
    id: 'closing-4',
    question: 'Ever lost a deal because the buyer couldn\'t get a loan?',
    painPoint: 'Last-minute denials are the worst.',
    solution: 'Owner financing removes the bank from the equation.',
    benefit: 'No more watching deals die at the finish line.',
    cta: 'Close with confidence at OwnerFi.ai',
    hashtags: ['#NoMoreDenials', '#FinancingSolutions', '#DealSaver'],
    category: 'closing',
  },
  {
    id: 'closing-5',
    question: 'Want to close deals your competitors can\'t?',
    painPoint: 'Everyone fights for the same traditionally-financed buyers.',
    solution: 'OwnerFi opens the door to buyers others can\'t help.',
    benefit: 'Differentiate yourself and dominate your market.',
    cta: 'Stand out with OwnerFi.ai',
    hashtags: ['#CompetitiveEdge', '#MarketDomination', '#UniqueAgent'],
    category: 'closing',
  },
];

/**
 * Get a random topic from a specific category
 */
export function getRandomTopicByCategory(category: RealtorContentTopic['category']): RealtorContentTopic {
  const categoryTopics = REALTOR_CONTENT_TOPICS.filter(t => t.category === category);
  return categoryTopics[Math.floor(Math.random() * categoryTopics.length)];
}

/**
 * Get N random topics, ensuring variety across categories
 */
export function getRandomTopics(count: number): RealtorContentTopic[] {
  const categories: RealtorContentTopic['category'][] = ['leads', 'income', 'efficiency', 'education', 'closing'];
  const selected: RealtorContentTopic[] = [];
  const usedIds = new Set<string>();

  for (let i = 0; i < count; i++) {
    // Rotate through categories for variety
    const category = categories[i % categories.length];
    const categoryTopics = REALTOR_CONTENT_TOPICS.filter(
      t => t.category === category && !usedIds.has(t.id)
    );

    if (categoryTopics.length > 0) {
      const topic = categoryTopics[Math.floor(Math.random() * categoryTopics.length)];
      selected.push(topic);
      usedIds.add(topic.id);
    }
  }

  return selected;
}

/**
 * Get 3 daily topics (one per posting time)
 * Ensures variety by picking from different categories
 */
export function getDailyTopics(): RealtorContentTopic[] {
  return getRandomTopics(3);
}

/**
 * Generate video script from a topic
 * Returns a script formatted for HeyGen or similar video generation
 */
export function generateVideoScript(topic: RealtorContentTopic): string {
  return `${topic.question}

${topic.painPoint}

Here's the solution...

${topic.solution}

${topic.benefit}

${topic.cta}`;
}

/**
 * Generate social media caption from a topic
 */
export function generateCaption(topic: RealtorContentTopic): string {
  const baseHashtags = ['#OwnerFi', '#RealEstateAgent', '#RealtorLife'];
  const allHashtags = Array.from(new Set([...topic.hashtags, ...baseHashtags]));

  return `${topic.question}

${topic.painPoint}

${topic.solution}

${topic.cta}

${allHashtags.join(' ')}`;
}
