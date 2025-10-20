// Owner Finance Benefit Content Library
// Benefits for Sellers and Buyers

export interface BenefitPoint {
  id: string;
  audience: 'seller' | 'buyer';
  title: string;
  shortDescription: string; // 1-2 sentences for video script
  hashtags: string[];
  category: 'financial' | 'flexibility' | 'speed' | 'market' | 'tax' | 'investment';
}

export const SELLER_BENEFITS: BenefitPoint[] = [
  {
    id: 'seller_1',
    audience: 'seller',
    title: 'Sell Your Home Faster',
    shortDescription: 'Owner financing expands your buyer pool dramatically. While traditional buyers struggle with bank approvals, you can sell to credit-worthy individuals who banks overlook. This means less time on market and more serious offers.',
    hashtags: ['#OwnerFinancing', '#SellYourHome', '#RealEstateInvesting', '#HomeSelling', '#OwnerFi'],
    category: 'speed'
  },
  {
    id: 'seller_2',
    audience: 'seller',
    title: 'Create Passive Income Streams',
    shortDescription: 'Instead of a one-time cash payment, owner financing lets you receive monthly income for years. This steady cash flow can supplement retirement, fund other investments, or provide financial security.',
    hashtags: ['#PassiveIncome', '#OwnerFinancing', '#RealEstateIncome', '#RetirementPlanning', '#OwnerFi'],
    category: 'financial'
  },
  {
    id: 'seller_3',
    audience: 'seller',
    title: 'Earn Higher Returns Than Banks',
    shortDescription: 'Owner financing typically offers 6-10% interest rates on your money. That\'s significantly better than traditional savings accounts or CDs, turning your home sale into a high-yield investment.',
    hashtags: ['#InvestmentReturns', '#OwnerFinancing', '#HighYieldInvestment', '#SmartMoney', '#OwnerFi'],
    category: 'financial'
  },
  {
    id: 'seller_4',
    audience: 'seller',
    title: 'Sell in Any Market Condition',
    shortDescription: 'When interest rates are high and buyers can\'t qualify for traditional loans, owner financing keeps your home competitive. You can offer better terms than banks and attract buyers even in tough markets.',
    hashtags: ['#RealEstateMarket', '#OwnerFinancing', '#HomeSelling', '#MarketStrategy', '#OwnerFi'],
    category: 'market'
  },
  {
    id: 'seller_5',
    audience: 'seller',
    title: 'Defer Capital Gains Taxes',
    shortDescription: 'Owner financing spreads your capital gains over multiple years through installment sales. This can reduce your tax burden significantly compared to receiving all cash upfront.',
    hashtags: ['#TaxStrategy', '#OwnerFinancing', '#CapitalGains', '#SmartSelling', '#OwnerFi'],
    category: 'tax'
  },
  {
    id: 'seller_6',
    audience: 'seller',
    title: 'Set Your Own Terms',
    shortDescription: 'You control the down payment amount, interest rate, and payment schedule. This flexibility lets you create terms that work best for your financial situation and retirement goals.',
    hashtags: ['#RealEstateFlexibility', '#OwnerFinancing', '#SellerTerms', '#SmartSelling', '#OwnerFi'],
    category: 'flexibility'
  },
  {
    id: 'seller_7',
    audience: 'seller',
    title: 'Keep Property Rights Until Paid',
    shortDescription: 'With owner financing, you retain the deed until the loan is fully paid. This provides security and protection of your investment while earning interest income.',
    hashtags: ['#PropertyRights', '#OwnerFinancing', '#InvestmentSecurity', '#SmartSelling', '#OwnerFi'],
    category: 'flexibility'
  },
  {
    id: 'seller_8',
    audience: 'seller',
    title: 'Avoid Costly Repairs and Staging',
    shortDescription: 'Owner finance buyers are often more motivated and willing to purchase as-is. You can skip expensive repairs, updates, and staging costs that traditional buyers demand.',
    hashtags: ['#SaveMoney', '#OwnerFinancing', '#AsIsSale', '#HomeSelling', '#OwnerFi'],
    category: 'financial'
  },
  {
    id: 'seller_9',
    audience: 'seller',
    title: 'Build Long-Term Wealth',
    shortDescription: 'The interest income from owner financing compounds over time, potentially earning you significantly more than a traditional cash sale. It\'s like being your own bank.',
    hashtags: ['#WealthBuilding', '#OwnerFinancing', '#LongTermWealth', '#RealEstateInvesting', '#OwnerFi'],
    category: 'investment'
  },
  {
    id: 'seller_10',
    audience: 'seller',
    title: 'Skip Real Estate Agent Commissions',
    shortDescription: 'Many owner finance transactions happen directly between buyer and seller, saving you thousands in agent commissions. That\'s 5-6% more profit in your pocket.',
    hashtags: ['#SaveMoney', '#OwnerFinancing', '#FSBO', '#NoCommission', '#OwnerFi'],
    category: 'financial'
  }
];

export const BUYER_BENEFITS: BenefitPoint[] = [
  {
    id: 'buyer_1',
    audience: 'buyer',
    title: 'Become a Homeowner Without Bank Approval',
    shortDescription: 'Owner financing lets you buy a home even if traditional banks say no. Perfect if you\'re self-employed, building credit, or have a non-traditional income source.',
    hashtags: ['#Homeownership', '#OwnerFinancing', '#FirstTimeHomeBuyer', '#CreditChallenges', '#OwnerFi'],
    category: 'flexibility'
  },
  {
    id: 'buyer_2',
    audience: 'buyer',
    title: 'Build Equity While Building Credit',
    shortDescription: 'Every payment you make builds equity in your home while improving your credit score. In a few years, you can refinance to traditional financing with better terms.',
    hashtags: ['#BuildCredit', '#OwnerFinancing', '#HomeEquity', '#CreditBuilding', '#OwnerFi'],
    category: 'financial'
  },
  {
    id: 'buyer_3',
    audience: 'buyer',
    title: 'Close Faster Than Traditional Loans',
    shortDescription: 'Skip the bank\'s lengthy approval process, mountains of paperwork, and months of waiting. Owner financed deals can close in days or weeks, not months.',
    hashtags: ['#QuickClosing', '#OwnerFinancing', '#HomeBuying', '#FastClosing', '#OwnerFi'],
    category: 'speed'
  },
  {
    id: 'buyer_4',
    audience: 'buyer',
    title: 'Negotiate Better Terms',
    shortDescription: 'Work directly with the seller to create payment terms that fit your budget and life situation. Banks offer one-size-fits-all terms, but sellers can be flexible.',
    hashtags: ['#FlexibleTerms', '#OwnerFinancing', '#HomeBuying', '#NegotiableDeal', '#OwnerFi'],
    category: 'flexibility'
  },
  {
    id: 'buyer_5',
    audience: 'buyer',
    title: 'Lower Down Payment Requirements',
    shortDescription: 'Many owner finance sellers accept smaller down payments than banks require. This means you can become a homeowner sooner without waiting years to save 20%.',
    hashtags: ['#LowDownPayment', '#OwnerFinancing', '#AffordableHousing', '#HomeBuying', '#OwnerFi'],
    category: 'financial'
  },
  {
    id: 'buyer_6',
    audience: 'buyer',
    title: 'Avoid PMI and Excessive Fees',
    shortDescription: 'Owner financing typically skips private mortgage insurance, origination fees, and other bank charges. That can save you thousands of dollars upfront and monthly.',
    hashtags: ['#NoPMI', '#OwnerFinancing', '#SaveMoney', '#HomeBuying', '#OwnerFi'],
    category: 'financial'
  },
  {
    id: 'buyer_7',
    audience: 'buyer',
    title: 'Access Unique Properties',
    shortDescription: 'Many owner financed homes aren\'t listed on traditional markets or don\'t qualify for bank loans. You get access to properties other buyers can\'t purchase.',
    hashtags: ['#UniqueHomes', '#OwnerFinancing', '#HiddenGems', '#RealEstate', '#OwnerFi'],
    category: 'market'
  },
  {
    id: 'buyer_8',
    audience: 'buyer',
    title: 'Invest Without Perfect Credit',
    shortDescription: 'Want to start real estate investing but banks won\'t lend to you? Owner financing opens doors to investment properties and wealth building regardless of your credit score.',
    hashtags: ['#RealEstateInvesting', '#OwnerFinancing', '#Investment', '#WealthBuilding', '#OwnerFi'],
    category: 'investment'
  },
  {
    id: 'buyer_9',
    audience: 'buyer',
    title: 'Flexible Qualification Process',
    shortDescription: 'Sellers care more about your ability to pay than your credit history. Show stable income and commitment, and you can qualify even with past financial challenges.',
    hashtags: ['#FlexibleQualification', '#OwnerFinancing', '#SecondChance', '#Homeownership', '#OwnerFi'],
    category: 'flexibility'
  },
  {
    id: 'buyer_10',
    audience: 'buyer',
    title: 'Start Building Wealth Today',
    shortDescription: 'Don\'t wait years to fix credit or save huge down payments. Owner financing lets you start building home equity and wealth right now, not someday in the future.',
    hashtags: ['#WealthBuilding', '#OwnerFinancing', '#StartToday', '#Homeownership', '#OwnerFi'],
    category: 'investment'
  }
];

// Get all benefits
export function getAllBenefits(): BenefitPoint[] {
  return [...SELLER_BENEFITS, ...BUYER_BENEFITS];
}

// Get benefits by audience
export function getBenefitsByAudience(audience: 'seller' | 'buyer'): BenefitPoint[] {
  return audience === 'seller' ? SELLER_BENEFITS : BUYER_BENEFITS;
}

// Get random benefit (avoid recently used)
export function getRandomBenefit(
  audience: 'seller' | 'buyer',
  excludeIds: string[] = []
): BenefitPoint | null {
  const benefits = getBenefitsByAudience(audience);
  const available = benefits.filter(b => !excludeIds.includes(b.id));

  if (available.length === 0) {
    return null;
  }

  const randomIndex = Math.floor(Math.random() * available.length);
  return available[randomIndex];
}

// Get benefit by ID
export function getBenefitById(id: string): BenefitPoint | null {
  return getAllBenefits().find(b => b.id === id) || null;
}

// Generate video caption with CTA
export function generateBenefitCaption(benefit: BenefitPoint): string {
  const cta = '\n\n🏡 See owner-financed properties in your area at ownerfi.ai';
  const hashtags = '\n\n' + benefit.hashtags.join(' ');

  return `${benefit.shortDescription}${cta}${hashtags}`;
}

// Generate video title
export function generateBenefitTitle(benefit: BenefitPoint): string {
  const audiencePrefix = benefit.audience === 'seller' ? 'Sellers:' : 'Buyers:';
  return `${audiencePrefix} ${benefit.title}`;
}
