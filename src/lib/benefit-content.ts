/**
 * Benefit Content Library - BUYER-ONLY
 * Owner financing benefits for homebuyers
 */

export interface BenefitPoint {
  id: string;
  title: string;
  shortDescription: string;
  hashtags: string[];
  category: 'financial' | 'flexibility' | 'speed' | 'market' | 'investment';
}

export const BUYER_BENEFITS: BenefitPoint[] = [
  {
    id: 'buyer_1',
    title: 'Become a Homeowner Without Bank Approval',
    shortDescription: 'Owner financing lets you buy a home even if traditional banks say no. Perfect if you\'re self-employed, building credit, or have a non-traditional income source.',
    hashtags: ['#Homeownership', '#OwnerFinancing', '#FirstTimeHomeBuyer', '#CreditChallenges', '#OwnerFi'],
    category: 'flexibility'
  },
  {
    id: 'buyer_2',
    title: 'Build Equity While Building Credit',
    shortDescription: 'Every payment you make builds equity in your home while improving your credit score. In a few years, you can refinance to traditional financing with better terms.',
    hashtags: ['#BuildCredit', '#OwnerFinancing', '#HomeEquity', '#CreditBuilding', '#OwnerFi'],
    category: 'financial'
  },
  {
    id: 'buyer_3',
    title: 'Close Faster Than Traditional Loans',
    shortDescription: 'Skip the bank\'s lengthy approval process, mountains of paperwork, and months of waiting. Owner financed deals can close in days or weeks, not months.',
    hashtags: ['#QuickClosing', '#OwnerFinancing', '#HomeBuying', '#FastClosing', '#OwnerFi'],
    category: 'speed'
  },
  {
    id: 'buyer_4',
    title: 'Negotiate Better Terms',
    shortDescription: 'Work directly with the seller to create payment terms that fit your budget and life situation. Banks offer one-size-fits-all terms, but sellers can be flexible.',
    hashtags: ['#FlexibleTerms', '#OwnerFinancing', '#HomeBuying', '#NegotiableDeal', '#OwnerFi'],
    category: 'flexibility'
  },
  {
    id: 'buyer_5',
    title: 'Lower Down Payment Requirements',
    shortDescription: 'Many owner finance sellers accept smaller down payments than banks require. This means you can become a homeowner sooner without waiting years to save 20%.',
    hashtags: ['#LowDownPayment', '#OwnerFinancing', '#AffordableHousing', '#HomeBuying', '#OwnerFi'],
    category: 'financial'
  },
  {
    id: 'buyer_6',
    title: 'Avoid PMI and Excessive Fees',
    shortDescription: 'Owner financing typically skips private mortgage insurance, origination fees, and other bank charges. That can save you thousands of dollars upfront and monthly.',
    hashtags: ['#NoPMI', '#OwnerFinancing', '#SaveMoney', '#HomeBuying', '#OwnerFi'],
    category: 'financial'
  },
  {
    id: 'buyer_7',
    title: 'Access Unique Properties',
    shortDescription: 'Many owner financed homes aren\'t listed on traditional markets or don\'t qualify for bank loans. You get access to properties other buyers can\'t purchase.',
    hashtags: ['#UniqueHomes', '#OwnerFinancing', '#HiddenGems', '#RealEstate', '#OwnerFi'],
    category: 'market'
  },
  {
    id: 'buyer_8',
    title: 'Invest Without Perfect Credit',
    shortDescription: 'Want to start real estate investing but banks won\'t lend to you? Owner financing opens doors to investment properties and wealth building regardless of your credit score.',
    hashtags: ['#RealEstateInvesting', '#OwnerFinancing', '#Investment', '#WealthBuilding', '#OwnerFi'],
    category: 'investment'
  },
  {
    id: 'buyer_9',
    title: 'Flexible Qualification Process',
    shortDescription: 'Sellers care more about your ability to pay than your credit history. Show stable income and commitment, and you can qualify even with past financial challenges.',
    hashtags: ['#FlexibleQualification', '#OwnerFinancing', '#SecondChance', '#Homeownership', '#OwnerFi'],
    category: 'flexibility'
  },
  {
    id: 'buyer_10',
    title: 'Start Building Wealth Today',
    shortDescription: 'Don\'t wait years to fix credit or save huge down payments. Owner financing lets you start building home equity and wealth right now, not someday in the future.',
    hashtags: ['#WealthBuilding', '#OwnerFinancing', '#StartToday', '#Homeownership', '#OwnerFi'],
    category: 'investment'
  }
];

/**
 * Get a random benefit, excluding recently used IDs
 */
export function getRandomBenefit(excludeIds: string[] = []): BenefitPoint | null {
  const available = BUYER_BENEFITS.filter(b => !excludeIds.includes(b.id));

  if (available.length === 0) {
    return null;
  }

  const randomIndex = Math.floor(Math.random() * available.length);
  return available[randomIndex];
}

/**
 * Get benefit by ID
 */
export function getBenefitById(id: string): BenefitPoint | null {
  return BUYER_BENEFITS.find(b => b.id === id) || null;
}

/**
 * Generate social media caption with CTA
 */
export function generateBenefitCaption(benefit: BenefitPoint): string {
  const cta = '\n\n🏡 See owner-financed properties in your area at ownerfi.ai';
  const hashtags = '\n\n' + benefit.hashtags.join(' ');
  return `${benefit.shortDescription}${cta}${hashtags}`;
}

/**
 * Generate video title
 */
export function generateBenefitTitle(benefit: BenefitPoint): string {
  return `Buyers: ${benefit.title}`;
}
