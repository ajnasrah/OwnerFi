'use client';

import Link from 'next/link';
import { LegalDisclaimers, TCPADisclosure, InvestmentDisclosure } from './LegalDisclaimers';

interface LegalFooterProps {
  showAll?: boolean;
  includeTCPA?: boolean;
  includeInvestment?: boolean;
  includeState?: boolean;
  state?: string;
}

export function LegalFooter({ 
  showAll = true, 
  includeTCPA = false, 
  includeInvestment = false, 
  includeState = false,
  state 
}: LegalFooterProps) {
  return (
    <section className="bg-slate-800 py-6 border-t border-slate-700">
      <div className="max-w-6xl mx-auto px-6 space-y-3">
        
        {/* Core Legal Disclaimer - Always Show */}
        <div className="bg-red-100 border border-red-300 rounded-lg p-4">
          <div className="text-center">
            <p className="text-red-800 font-bold text-sm mb-2">⚠️ IMPORTANT LEGAL NOTICE</p>
            <p className="text-red-700 text-xs leading-relaxed mb-2">
              <strong>OwnerFi is not a licensed real estate broker, agent, or lender.</strong> We are a lead generation platform that connects consumers with licensed real estate professionals.
              All property information is estimated and not guaranteed. No advice is provided.
              Consult licensed professionals for all real estate, financial, and legal decisions.
            </p>
            <p className="text-red-700 text-xs leading-relaxed font-medium">
              <strong>Owner Financing Availability:</strong> Listings may or may not be available with owner financing. Financing type and availability must be independently verified with the seller or their agent.
            </p>
          </div>
        </div>

        {/* Additional disclaimers based on props */}
        {showAll && (
          <>
            {(includeTCPA || showAll) && <TCPADisclosure />}
            {(includeInvestment || showAll) && <InvestmentDisclosure />}
            {(includeState || showAll) && <LegalDisclaimers type="state-specific" state={state} />}
          </>
        )}

        {/* Contact and Legal */}
        <div className="text-center pt-4 border-t border-slate-700">
          <div className="flex flex-wrap justify-center gap-4 md:gap-6 text-xs text-slate-400 mb-2">
            <Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link>
            <Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
            <Link href="/creative-finance-disclaimer" className="hover:text-white transition-colors">Creative Finance Disclaimer</Link>
            <Link href="/tcpa-compliance" className="hover:text-white transition-colors">TCPA Compliance</Link>
            <a href="mailto:support@ownerfi.ai" className="hover:text-white transition-colors">Legal Contact</a>
          </div>
          <p className="text-xs text-slate-500">
            © {new Date().getFullYear()} OwnerFi - Lead Generation Platform Only - Not Licensed Real Estate Services
          </p>
        </div>
      </div>
    </section>
  );
}