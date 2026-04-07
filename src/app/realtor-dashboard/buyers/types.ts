export interface BuyerLead {
  id: string;
  firstName: string;
  lastName: string;
  city: string;
  state: string;
  matchScore?: number;
  matchReasons?: string[];
  likedPropertiesCount?: number;
  createdAt: string;
}

export interface OwnedBuyer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  purchasedAt: string;
}

export interface Transaction {
  id: string;
  description: string;
  creditsChange: number;
  runningBalance: number;
  type: string;
  createdAt: string;
}

export interface Agreement {
  id: string;
  agreementNumber: string;
  status: string;
  buyerId?: string;
  buyerFirstName?: string;
  buyerLastName?: string;
  buyerCity?: string;
  buyerState?: string;
  buyerEmail?: string | null;
  buyerPhone?: string | null;
  referralFeePercent: number;
  leadInfoReleased: boolean;
  effectiveDate: string;
  expirationDate: string;
  signedAt?: string | null;
  createdAt: string;
  isReReferral?: boolean;
  canBeReReferred?: boolean;
  hasActiveInvite?: boolean;
  referralInviteFeePercent?: number;
}

export interface DashboardData {
  availableLeads: BuyerLead[];
  ownedBuyers: OwnedBuyer[];
  transactions: Transaction[];
  realtorData: {
    firstName: string;
    lastName: string;
    credits: number;
    serviceArea?: {
      primaryCity: string;
      totalCitiesServed: number;
    };
  };
}

export interface AgreementModalState {
  isOpen: boolean;
  step: 'loading' | 'review' | 'signing' | 'success';
  leadId: string | null;
  agreementId: string | null;
  agreementNumber: string | null;
  agreementHTML: string | null;
  terms: {
    referralFeePercent: number;
    agreementTermDays: number;
    expirationDate: string;
  } | null;
  buyerName: string | null;
  buyerDetails: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    city: string;
    state: string;
  } | null;
  typedName: string;
  agreeToTerms: boolean;
  agreeTCPA: boolean;
  agreeCreativeFinance: boolean;
  agreeDataAsIs: boolean;
  error: string | null;
}

export interface ReferralModalState {
  isOpen: boolean;
  agreement: Agreement | null;
  feePercent: number;
  loading: boolean;
  success: boolean;
  inviteUrl: string | null;
  error: string | null;
  shareMethod: 'select' | 'email' | 'text' | 'copy';
  shareEmail: string;
  sharePhone: string;
  copied: boolean;
}

export interface DisputeModalState {
  buyer: OwnedBuyer | null;
  reason: string;
  description: string;
  submitting: boolean;
  success: boolean;
  error: string | null;
}
