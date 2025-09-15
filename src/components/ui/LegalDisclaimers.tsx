'use client';

interface LegalDisclaimersProps {
  type?: 'property' | 'general' | 'investment' | 'lead-consent' | 'state-specific';
  compact?: boolean;
  state?: string;
}

export function LegalDisclaimers({ type = 'general', compact = false, state }: LegalDisclaimersProps) {
  if (type === 'property') {
    if (compact) {
      return (
        <div className="bg-yellow-100 border border-yellow-300 rounded p-2">
          <p className="text-xs text-yellow-800 text-center">
            ⚠️ Estimates only. Not guaranteed. No escrow account - you pay taxes/insurance/HOA directly. Properties may not be available or offer owner financing. Sellers may credit check. Balloon payments may apply. Seller discretion reserved. Not a loan offer. We're just letting you know what's out there. OwnerFi not licensed broker.
          </p>
        </div>
      );
    }

    return (
      <div className="bg-yellow-100 border border-yellow-300 rounded-lg p-3">
        <div className="flex items-start gap-2">
          <span className="text-yellow-600 text-lg">⚠️</span>
          <div className="text-xs text-yellow-800">
            <p className="font-semibold mb-2">Property Information Disclaimers:</p>
            <div className="space-y-1">
              <p>• <strong>Payments are approximate</strong> - Numbers shown are examples only</p>
              <p>• <strong>No escrow account</strong> - You pay taxes, insurance, HOA directly (no automatic collection like banks)</p>
              <p>• <strong>Terms are examples only</strong> - Interest, balloon, length may vary</p>
              <p>• <strong>Not a loan offer</strong> - No commitment to lend or guarantee approval</p>
              <p>• <strong>Credit approval required</strong> - Sellers have right to credit checks and income verification</p>
              <p>• <strong>Balloon payments may apply</strong> - Balance may be due at 3-5 years</p>
              <p>• <strong>Availability not guaranteed</strong> - Properties may no longer be available or offer owner financing</p>
              <p>• <strong>Seller discretion reserved</strong> - Right to accept/deny any offer</p>
              <p>• <strong>OwnerFi not licensed broker</strong> - We're just letting you know what's out there</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (type === 'investment') {
    return (
      <div className="bg-red-100 border border-red-300 rounded-lg p-3">
        <div className="flex items-start gap-2">
          <span className="text-red-600 text-lg">🚨</span>
          <div className="text-xs text-red-800">
            <p className="font-semibold mb-1">Investment/Financial Disclaimer:</p>
            <p>
              OwnerFi does not provide financial, investment, or lending advice. All financial projections, payment estimates, 
              and investment returns are for informational purposes only and not guaranteed. Real estate investments involve 
              significant risk. Consult licensed financial advisors, CPAs, and real estate attorneys before making any 
              financial or investment decisions.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (type === 'lead-consent') {
    return (
      <div className="bg-blue-100 border border-blue-300 rounded-lg p-4">
        <div className="text-sm text-blue-800">
          <p className="font-semibold mb-2">📞 Lead Sharing & Contact Consent (Required)</p>
          <p className="mb-2">
            <strong>By registering, you expressly agree and consent to:</strong>
          </p>
          <ul className="list-disc ml-4 space-y-1 mb-2">
            <li>Having your contact information SOLD to licensed real estate agents and brokers</li>
            <li>Being contacted by multiple real estate professionals via phone, text, and email</li>
            <li>Receiving marketing communications using automated dialing systems</li>
            <li>Being contacted even if your number is on a Do Not Call registry</li>
            <li>Standard message and data rates applying to text communications</li>
          </ul>
          <p className="text-xs">
            This consent is required to use our service and cannot be withdrawn while using the platform. 
            You may be contacted by agents from multiple states depending on your property preferences.
          </p>
        </div>
      </div>
    );
  }

  if (type === 'state-specific') {
    const getStateDisclaimer = (stateCode?: string) => {
      const baseDisclaimer = "OwnerFi is not licensed to provide real estate brokerage services in any state.";
      
      switch(stateCode?.toUpperCase()) {
        case 'CA':
          return `${baseDisclaimer} California Real Estate Law requires all real estate transactions to be handled by licensed professionals. OwnerFi License Disclosure: Not licensed in California. California Bureau of Real Estate License #: N/A.`;
        case 'TX':
          return `${baseDisclaimer} Texas Real Estate License Disclosure: OwnerFi is not licensed by the Texas Real Estate Commission (TREC). All Texas real estate transactions must comply with TREC regulations.`;
        case 'FL':
          return `${baseDisclaimer} Florida Real Estate License Disclosure: Not licensed by the Florida Department of Business and Professional Regulation. All Florida transactions require licensed representation.`;
        case 'NY':
          return `${baseDisclaimer} New York State License Disclosure: Not licensed by the New York Department of State. New York Real Property Law requires licensed representation for real estate transactions.`;
        default:
          return `${baseDisclaimer} State licensing requirements vary. Verify local licensing requirements and regulations before engaging in real estate activities.`;
      }
    };

    return (
      <div className="bg-purple-100 border border-purple-300 rounded-lg p-3">
        <div className="text-xs text-purple-800">
          <p className="font-semibold mb-1">🏛️ State Licensing Disclosure:</p>
          <p>{getStateDisclaimer(state)}</p>
        </div>
      </div>
    );
  }

  // General disclaimer
  if (compact) {
    return (
      <div className="bg-gray-100 border border-gray-300 rounded p-2">
        <p className="text-xs text-gray-700">
          ⚠️ OwnerFi is not a licensed real estate broker. Information not guaranteed. Consult licensed professionals.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-yellow-100 border border-yellow-300 rounded-lg p-4">
      <div className="text-sm text-yellow-800">
        <p className="font-semibold mb-2">⚠️ Important Legal Disclaimers</p>
        <div className="space-y-2">
          <p>
            <strong>Not Licensed Professionals:</strong> OwnerFi is not a licensed real estate broker, agent, or lender. 
            We are solely a lead generation and marketing platform.
          </p>
          <p>
            <strong>No Guarantees:</strong> All property information, financing terms, and availability are estimates only 
            and not guaranteed. Information may be outdated or inaccurate.
          </p>
          <p>
            <strong>Professional Consultation Required:</strong> Always consult with licensed real estate agents, 
            attorneys, financial advisors, and other qualified professionals before making any real estate decisions.
          </p>
          <p>
            <strong>Lead Generation Service:</strong> Your contact information will be sold to licensed real estate 
            professionals who may contact you via phone, text, and email.
          </p>
        </div>
      </div>
    </div>
  );
}

// Component for TCPA compliance
export function TCPADisclosure({ className = "" }: { className?: string }) {
  return (
    <div className={`bg-orange-100 border border-orange-300 rounded-lg p-3 ${className}`}>
      <div className="text-xs text-orange-800">
        <p className="font-semibold mb-1">📱 TCPA Compliance Notice:</p>
        <p>
          By providing your phone number, you consent to receive calls and text messages from 
          real estate partner agents using automated technology. Consent is not required to purchase services. 
          Message frequency varies. Message and data rates may apply. Reply STOP to opt out of texts, HELP for help.
        </p>
      </div>
    </div>
  );
}

// Component for investment disclaimers
export function InvestmentDisclosure({ className = "" }: { className?: string }) {
  return (
    <div className={`bg-red-100 border border-red-300 rounded-lg p-3 ${className}`}>
      <div className="text-xs text-red-800">
        <p className="font-semibold mb-1">💰 Investment Risk Disclosure:</p>
        <p>
          Real estate investments involve substantial risk and may result in partial or total loss of investment. 
          Past performance does not guarantee future results. All financial projections are estimates only. 
          Consult licensed financial advisors before making investment decisions.
        </p>
      </div>
    </div>
  );
}