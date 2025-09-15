'use client';

import Link from 'next/link';
import { LegalFooter } from '@/components/ui/LegalFooter';
import { useState } from 'react';

export default function HowOwnerFinanceWorks() {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  const toggleSection = (sectionId: string) => {
    setOpenSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  const CollapsibleSection = ({ 
    id, 
    question, 
    children, 
    color = "blue",
    defaultOpen = false 
  }: { 
    id: string; 
    question: string; 
    children: React.ReactNode; 
    color?: string;
    defaultOpen?: boolean;
  }) => {
    const isOpen = openSections[id] ?? defaultOpen;
    const colorClasses = {
      blue: "border-blue-400/30 bg-blue-500/10",
      green: "border-green-400/30 bg-green-500/10", 
      red: "border-red-400/30 bg-red-500/10",
      orange: "border-orange-400/30 bg-orange-500/10",
      purple: "border-purple-400/30 bg-purple-500/10",
      cyan: "border-cyan-400/30 bg-cyan-500/10"
    };

    return (
      <div className={`${colorClasses[color as keyof typeof colorClasses]} border rounded-lg`}>
        <button
          onClick={() => toggleSection(id)}
          className="w-full p-4 text-left flex items-center justify-between hover:bg-white/5 transition-colors"
        >
          <h3 className="text-lg font-semibold text-white">{question}</h3>
          <span className="text-white text-xl ml-4">
            {isOpen ? '−' : '+'}
          </span>
        </button>
        {isOpen && (
          <div className="px-4 pb-4">
            {children}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <header className="bg-slate-800/50 backdrop-blur-lg border-b border-slate-700/50 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-blue-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">O</span>
            </div>
            <span className="text-lg font-bold text-white">OwnerFi</span>
          </Link>
          <Link
            href="/"
            className="text-slate-300 hover:text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            ← Back to Home
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 py-12">
        {/* Important Legal Disclaimer */}
        <div className="bg-yellow-600/20 border border-yellow-500/30 rounded-xl p-6 mb-8">
          <div className="flex items-start gap-3">
            <div className="text-yellow-400 text-2xl">⚠️</div>
            <div>
              <h3 className="text-yellow-300 font-bold text-lg mb-2">Important Disclaimer</h3>
              <p className="text-yellow-100 text-sm leading-relaxed">
                This information is for educational purposes only and should not be considered legal, financial, or real estate advice. 
                OwnerFi does not provide recommendations or guidance on specific transactions. Always consult with qualified professionals 
                including real estate attorneys, financial advisors, and licensed real estate agents before making any property purchase decisions.
              </p>
            </div>
          </div>
        </div>

        {/* Title Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">
            How Owner Finance Works
          </h1>
          <p className="text-xl text-slate-300 leading-relaxed">
            Common questions answered in simple terms
          </p>
        </div>

        {/* Q&A Sections */}
        <div className="space-y-4">
          
          {/* Critical Difference Alert */}
          <div className="bg-red-600/20 border border-red-500/30 rounded-xl p-6 mb-6">
            <h3 className="text-red-300 font-bold text-xl mb-4 flex items-center gap-2">
              ⚠️ Important Difference from Bank Loans
            </h3>
            <div className="bg-red-500/20 rounded-lg p-4">
              <h4 className="text-red-200 font-semibold mb-3">🏦 No Escrow Account Provided</h4>
              <p className="text-red-100 text-sm mb-3">
                <strong>Unlike bank loans, there's usually no escrow account to automatically collect and pay your:</strong>
              </p>
              <div className="grid md:grid-cols-3 gap-3">
                <div className="bg-red-600/30 rounded p-3 text-center">
                  <p className="text-red-100 font-semibold text-sm">Property Taxes</p>
                  <p className="text-red-200 text-xs">You pay county directly</p>
                </div>
                <div className="bg-red-600/30 rounded p-3 text-center">
                  <p className="text-red-100 font-semibold text-sm">Home Insurance</p>
                  <p className="text-red-200 text-xs">You arrange & pay</p>
                </div>
                <div className="bg-red-600/30 rounded p-3 text-center">
                  <p className="text-red-100 font-semibold text-sm">HOA Fees</p>
                  <p className="text-red-200 text-xs">You pay HOA directly</p>
                </div>
              </div>
              <p className="text-red-100 text-xs mt-3 text-center font-medium">
                💡 Budget for these separately - they're NOT included in your monthly payment to the seller
              </p>
            </div>
          </div>

          {/* Basic Understanding */}
          <CollapsibleSection id="what-is" question="What is owner financing?" color="green" defaultOpen={true}>
            <div className="space-y-4 text-slate-200">
              <p>
                Owner financing is when the person selling a house acts like a bank. Instead of you getting a loan from a bank to buy their house, 
                the seller lets you pay them directly over time.
              </p>
              <p>
                Think of it like buying a car from a friend. Instead of paying your friend all the money upfront, 
                they might let you pay them $300 every month until you've paid the full price. Owner financing works the same way with houses.
              </p>
              <div className="bg-slate-700/30 rounded-lg p-4 mt-4">
                <h4 className="text-white font-semibold mb-2">Example:</h4>
                <p className="text-slate-300 text-sm">
                  Sarah wants to sell her $200,000 house. Instead of waiting for someone to get a bank loan, 
                  she agrees to let John pay her $1,500 per month for several years until he's paid the full amount (plus interest).
                </p>
              </div>
              <div className="bg-yellow-100 border border-yellow-300 rounded p-2 mt-3">
                <p className="text-yellow-800 text-xs text-center">💡 <em>Info only - not advice. Consult professionals.</em></p>
              </div>
            </div>
          </CollapsibleSection>

          <CollapsibleSection id="vs-lease" question="What's the difference between owner financing and lease-to-own?" color="cyan">
            <div className="space-y-4">
              <p className="text-slate-200">
                People often confuse these two! They're completely different:
              </p>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-emerald-500/10 border border-emerald-400/30 rounded-lg p-4">
                  <h5 className="text-emerald-300 font-semibold mb-2">Owner Financing</h5>
                  <ul className="space-y-1 text-slate-300 text-sm">
                    <li>✓ You own the house from day one</li>
                    <li>✓ You get the deed</li>
                    <li>✓ You can make changes</li>
                    <li>✓ You get tax benefits</li>
                    <li>✓ You build equity</li>
                  </ul>
                </div>
                <div className="bg-orange-500/10 border border-orange-400/30 rounded-lg p-4">
                  <h5 className="text-orange-300 font-semibold mb-2">Lease-to-Own</h5>
                  <ul className="space-y-1 text-slate-300 text-sm">
                    <li>⚠️ You're renting with option to buy</li>
                    <li>⚠️ Seller keeps ownership</li>
                    <li>⚠️ No tax benefits until you buy</li>
                    <li>⚠️ May lose money if you don't buy</li>
                    <li>⚠️ More restrictions</li>
                  </ul>
                </div>
              </div>
            </div>
          </CollapsibleSection>

          <CollapsibleSection id="vs-banks" question="How is owner financing different from a bank loan?" color="blue">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-red-500/10 border border-red-400/30 rounded-lg p-4">
                <h5 className="text-red-300 font-semibold mb-3">Traditional Bank Loan</h5>
                <ul className="space-y-1 text-slate-300 text-sm">
                  <li>• Bank checks your credit score</li>
                  <li>• Lots of paperwork and requirements</li>
                  <li>• Can take 30-45 days to close</li>
                  <li>• Strict income requirements</li>
                  <li>• Bank owns the loan</li>
                  <li>• Standardized terms</li>
                </ul>
              </div>
              <div className="bg-green-500/10 border border-green-400/30 rounded-lg p-4">
                <h5 className="text-green-300 font-semibold mb-3">Owner Financing</h5>
                <ul className="space-y-1 text-slate-300 text-sm">
                  <li>• Seller may check credit and set their own criteria</li>
                  <li>• Potentially less paperwork than banks</li>
                  <li>• May close faster (varies by seller)</li>
                  <li>• Seller determines income requirements</li>
                  <li>• Seller owns the loan directly</li>
                  <li>• Terms may be more negotiable</li>
                </ul>
              </div>
            </div>
          </CollapsibleSection>

          <CollapsibleSection id="why-sellers" question="Why would sellers do this?" color="purple">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="bg-slate-700/30 rounded-lg p-3">
                  <h5 className="text-emerald-300 font-semibold mb-1">💰 Earn Interest Income</h5>
                  <p className="text-slate-300 text-xs">They can charge interest and make extra money over time instead of getting paid all at once.</p>
                </div>
                <div className="bg-slate-700/30 rounded-lg p-3">
                  <h5 className="text-emerald-300 font-semibold mb-1">🏃‍♂️ Sell Faster</h5>
                  <p className="text-slate-300 text-xs">Expands the pool of potential buyers beyond those who qualify for traditional loans.</p>
                </div>
              </div>
              <div className="space-y-3">
                <div className="bg-slate-700/30 rounded-lg p-3">
                  <h5 className="text-emerald-300 font-semibold mb-1">📊 Tax Considerations</h5>
                  <p className="text-slate-300 text-xs">May have tax advantages by receiving payments over time instead of one large payment.</p>
                </div>
                <div className="bg-slate-700/30 rounded-lg p-3">
                  <h5 className="text-emerald-300 font-semibold mb-1">🎯 Investment Strategy</h5>
                  <p className="text-slate-300 text-xs">Can be part of their investment or retirement income strategy.</p>
                </div>
              </div>
            </div>
          </CollapsibleSection>

          <CollapsibleSection id="what-interest" question="What is interest and how does it work?" color="cyan">
            <div className="space-y-4">
              <p className="text-slate-200">
                Interest is extra money you pay for borrowing someone else's money. Think of it as "rent" you pay for using their money.
              </p>
              <div className="bg-slate-700/50 rounded-lg p-4">
                <h5 className="text-white font-semibold mb-2">Simple Example:</h5>
                <p className="text-slate-300 text-sm">
                  <strong>Borrow:</strong> $100,000 at 6% interest per year<br/>
                  <strong>Interest Cost:</strong> $6,000 per year (6% of $100,000)<br/>
                  <strong>Monthly Interest:</strong> About $500 per month<br/>
                  <strong>Plus:</strong> You also pay back some of the original $100,000
                </p>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-blue-500/10 border border-blue-400/30 rounded-lg p-3">
                  <h6 className="text-blue-300 font-semibold mb-2">Key Terms:</h6>
                  <ul className="space-y-1 text-slate-300 text-xs">
                    <li>• <strong>Interest Rate:</strong> Percentage per year (5%, 8%, etc.)</li>
                    <li>• <strong>Principal:</strong> Original amount borrowed</li>
                    <li>• <strong>Payment Split:</strong> Each payment covers interest + principal</li>
                  </ul>
                </div>
                <div className="bg-orange-500/10 border border-orange-400/30 rounded-lg p-3">
                  <h6 className="text-orange-300 font-semibold mb-2">In Owner Financing:</h6>
                  <ul className="space-y-1 text-slate-300 text-xs">
                    <li>• Rates vary by individual situation</li>
                    <li>• Terms may be negotiable</li>
                    <li>• Influenced by market conditions</li>
                  </ul>
                </div>
              </div>
            </div>
          </CollapsibleSection>

          <CollapsibleSection id="balloon-payments" question="What are balloon payments?" color="red">
            <div className="space-y-4">
              <p className="text-slate-200">
                A balloon payment is a financing structure where you make regular monthly payments for a set period, 
                then pay off the remaining balance at the balloon due date. This gives you time to build equity and improve your financial position.
              </p>
              
              <div className="bg-slate-700/50 rounded-lg p-4">
                <h5 className="text-white font-semibold mb-2">Example with Interest:</h5>
                <div className="text-slate-300 text-sm space-y-1">
                  <p><strong>House Price:</strong> $200,000</p>
                  <p><strong>Down Payment:</strong> $20,000</p>
                  <p><strong>Amount Financed:</strong> $180,000</p>
                  <p><strong>Interest Rate:</strong> 7% per year</p>
                  <p><strong>Monthly Payment:</strong> $1,356 for 5 years</p>
                  <p><strong>At balloon due date:</strong> ~$155,000 remaining balance</p>
                </div>
                <div className="bg-blue-600/20 rounded p-2 mt-2">
                  <p className="text-blue-200 text-xs">
                    🎯 During the 5 years, you build equity and can work toward refinancing or other options.
                  </p>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-green-500/10 border border-green-400/30 rounded-lg p-3">
                  <h6 className="text-green-300 font-semibold mb-2">Your Options at Balloon Due Date:</h6>
                  <ul className="space-y-1 text-slate-300 text-xs">
                    <li>• Refinance with a bank using equity built</li>
                    <li>• Sell the property</li>
                    <li>• Pay the balance if available</li>
                    <li>• Negotiate with seller for extension</li>
                  </ul>
                </div>
                <div className="bg-blue-500/10 border border-blue-400/30 rounded-lg p-3">
                  <h6 className="text-blue-300 font-semibold mb-2">Planning Tips:</h6>
                  <ul className="space-y-1 text-slate-300 text-xs">
                    <li>• Know exact date and amount</li>
                    <li>• Work on credit improvement</li>
                    <li>• Understand your options</li>
                    <li>• Plan refinancing strategy early</li>
                  </ul>
                </div>
              </div>
            </div>
          </CollapsibleSection>

          <CollapsibleSection id="types" question="What are the different types of seller financing?" color="purple">
            <div className="space-y-4">
              <p className="text-slate-200">There are three main types, each with different complexity levels:</p>
              
              <div className="space-y-4">
                <div className="bg-green-500/10 border border-green-400/30 rounded-lg p-4">
                  <h5 className="text-green-300 font-semibold mb-2">1. Traditional Owner Financing (Cleanest)</h5>
                  <p className="text-slate-300 text-sm mb-2">Seller owns house outright, no existing mortgage. You get deed, make payments to seller.</p>
                  <p className="text-green-300 text-xs"><strong>Risk Level:</strong> Lower - straightforward structure</p>
                </div>
                
                <div className="bg-orange-500/10 border border-orange-400/30 rounded-lg p-4">
                  <h5 className="text-orange-300 font-semibold mb-2">2. Subject To Deals (More Complex)</h5>
                  <p className="text-slate-300 text-sm mb-2">Seller still owes on mortgage. You take over payments but loan stays in seller's name.</p>
                  <p className="text-orange-300 text-xs"><strong>Risk Level:</strong> Medium - existing mortgage complications</p>
                </div>
                
                <div className="bg-purple-500/10 border border-purple-400/30 rounded-lg p-4">
                  <h5 className="text-purple-300 font-semibold mb-2">3. Wraparound Mortgages (Most Complex)</h5>
                  <p className="text-slate-300 text-sm mb-2">Seller keeps their mortgage, creates new loan with you. You pay seller, seller pays their bank.</p>
                  <p className="text-purple-300 text-xs"><strong>Risk Level:</strong> Higher - multiple financing layers</p>
                </div>
              </div>
            </div>
          </CollapsibleSection>

          <CollapsibleSection id="risks" question="What are the risks I should know about?" color="orange">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <h5 className="text-red-300 font-semibold mb-2">For Buyers:</h5>
                <ul className="space-y-1 text-slate-300 text-sm">
                  <li>• Seller might still owe money on the house</li>
                  <li>• Property might have hidden problems</li>
                  <li>• Interest rates vary by arrangement</li>
                  <li>• Different legal protections than bank loans</li>
                  <li>• Seller has right to perform credit checks and income verification</li>
                </ul>
              </div>
              <div>
                <h5 className="text-red-300 font-semibold mb-2">For Sellers:</h5>
                <ul className="space-y-1 text-slate-300 text-sm">
                  <li>• Buyer might stop making payments</li>
                  <li>• Property value fluctuations</li>
                  <li>• Foreclosure process expenses</li>
                  <li>• Don't receive full payment immediately</li>
                </ul>
              </div>
            </div>
          </CollapsibleSection>

          <CollapsibleSection id="protect" question="How should I protect myself?" color="green">
            <div className="space-y-4">
              <div className="grid gap-4">
                <div className="bg-emerald-500/10 border border-emerald-400/30 rounded-lg p-4">
                  <h5 className="text-emerald-300 font-semibold mb-2">🏘️ Hire a Buying Agent</h5>
                  <p className="text-slate-300 text-sm mb-2">A licensed agent representing YOU can review contracts, research properties, and guide you through the process.</p>
                  <p className="text-emerald-300 text-xs">💡 Seller usually pays agent fees</p>
                </div>
                
                <div className="bg-blue-500/10 border border-blue-400/30 rounded-lg p-4">
                  <h5 className="text-blue-300 font-semibold mb-2">🏢 Use Title Company or Attorney</h5>
                  <p className="text-slate-300 text-sm">Always use licensed professionals to verify ownership, prepare documents, and handle the transaction safely.</p>
                </div>

                <div className="bg-red-500/10 border border-red-400/30 rounded-lg p-4">
                  <h5 className="text-red-300 font-semibold mb-2">🏦 Understand Escrow Responsibilities</h5>
                  <p className="text-slate-300 text-sm mb-2">
                    <strong>CRITICAL:</strong> Unlike bank loans, there usually isn't an escrow account for taxes, insurance, or HOA fees. 
                    YOU are responsible for paying these directly.
                  </p>
                  <ul className="space-y-1 text-slate-300 text-xs mt-2">
                    <li>• Property taxes - paid directly to county</li>
                    <li>• Homeowner's insurance - you arrange and pay</li>
                    <li>• HOA fees - paid directly to HOA</li>
                    <li>• Get contact info and due dates from seller/title company</li>
                    <li>• Budget separately - these costs not included in monthly payment</li>
                  </ul>
                  <div className="bg-red-600/20 rounded p-2 mt-2">
                    <p className="text-red-200 text-xs">
                      ⚠️ Failure to pay can result in tax liens, insurance cancellation, or HOA penalties
                    </p>
                  </div>
                </div>
                
                <div className="grid md:grid-cols-3 gap-3 mt-4">
                  <div className="bg-slate-700/30 rounded p-3">
                    <h6 className="text-white font-semibold text-sm mb-1">📋 Written Contracts</h6>
                    <p className="text-slate-300 text-xs">Get everything documented properly</p>
                  </div>
                  <div className="bg-slate-700/30 rounded p-3">
                    <h6 className="text-white font-semibold text-sm mb-1">🔍 Property Inspection</h6>
                    <p className="text-slate-300 text-xs">Professional inspection for problems</p>
                  </div>
                  <div className="bg-slate-700/30 rounded p-3">
                    <h6 className="text-white font-semibold text-sm mb-1">💰 Title Insurance</h6>
                    <p className="text-slate-300 text-xs">Protection against ownership claims</p>
                  </div>
                </div>
              </div>
            </div>
          </CollapsibleSection>

          <CollapsibleSection id="common-terms" question="What other terms should I understand?" color="orange">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="bg-slate-700/30 rounded-lg p-3">
                  <h6 className="text-yellow-300 font-semibold mb-1">Contract for Deed</h6>
                  <p className="text-slate-300 text-xs">You don't get ownership papers until fully paid. Higher risk structure.</p>
                </div>
                <div className="bg-slate-700/30 rounded-lg p-3">
                  <h6 className="text-yellow-300 font-semibold mb-1">Due on Sale Clause</h6>
                  <p className="text-slate-300 text-xs">Bank rule requiring loan payoff when property is sold. Important to verify.</p>
                </div>
              </div>
              <div className="space-y-3">
                <div className="bg-slate-700/30 rounded-lg p-3">
                  <h6 className="text-yellow-300 font-semibold mb-1">Owner Will Carry</h6>
                  <p className="text-slate-300 text-xs">Another term for owner financing. Seller "carries" the financing.</p>
                </div>
                <div className="bg-slate-700/30 rounded-lg p-3">
                  <h6 className="text-yellow-300 font-semibold mb-1">Deed of Trust</h6>
                  <p className="text-slate-300 text-xs">Document securing the loan with the property as collateral.</p>
                </div>
              </div>
            </div>
          </CollapsibleSection>

          <CollapsibleSection id="questions" question="What questions should I ask before signing?" color="blue">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <h5 className="text-blue-300 font-semibold mb-2">About the Property:</h5>
                <ul className="space-y-1 text-slate-300 text-sm">
                  <li>• Do you own the house outright?</li>
                  <li>• Are there any existing mortgages?</li>
                  <li>• Are property taxes and insurance current?</li>
                  <li>• Any liens or judgments against the property?</li>
                </ul>
              </div>
              <div>
                <h5 className="text-blue-300 font-semibold mb-2">About the Financing:</h5>
                <ul className="space-y-1 text-slate-300 text-sm">
                  <li>• What is the exact interest rate?</li>
                  <li>• Is there a balloon payment and when?</li>
                  <li>• Can I refinance or pay early?</li>
                  <li>• What happens if I can't make payments?</li>
                </ul>
              </div>
            </div>
          </CollapsibleSection>

        </div>

        {/* Comprehensive Legal Protection */}
        <div className="bg-red-100 border border-red-300 rounded-lg p-6 mt-8">
          <h3 className="text-red-800 font-bold text-xl mb-4">⚖️ Legal Risk & Limitation of Liability</h3>
          
          <div className="space-y-4 text-red-800 text-sm">
            <div>
              <h4 className="font-bold mb-2">🏢 Platform Role</h4>
              <p>
                <strong>OwnerFi is a marketing and lead-generation platform only.</strong> We are NOT a licensed real estate broker, agent, lender, title company, attorney, or financial advisor. We do not negotiate, structure, or close transactions. All decisions are your sole responsibility.
              </p>
            </div>
            
            <div>
              <h4 className="font-bold mb-2">🚫 No Guarantee of Accuracy</h4>
              <p>
                All property information and financial figures are provided by third parties. OwnerFi makes no warranty as to accuracy, completeness, or reliability. You must independently verify all property details, financing terms, taxes, insurance, and HOA fees.
              </p>
            </div>
            
            <div>
              <h4 className="font-bold mb-2">📋 Your Responsibilities</h4>
              <ul className="list-disc ml-4 space-y-1">
                <li>Verify property availability and seller's current willingness to offer owner financing</li>
                <li>Verify property legal status, liens, and title defects</li>
                <li>Understand and pay taxes, insurance, HOA (no escrow provided)</li>
                <li>Understand balloon payments and refinancing obligations</li>
                <li>Ensure compliance with all applicable laws</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-bold mb-2">🛡️ Limitation of Liability</h4>
              <p>
                OwnerFi and Prosway are not liable for losses, damages, or expenses from: inaccurate information, failed transactions, third-party actions, or your real estate/investment decisions.
              </p>
            </div>
            
            <div>
              <h4 className="font-bold mb-2">🔒 Indemnification</h4>
              <p>
                You agree to indemnify and hold harmless OwnerFi and Prosway from claims arising from your use of the platform or participation in any transaction.
              </p>
            </div>
          </div>
          
          <div className="bg-yellow-100 border border-yellow-300 rounded-lg p-3 mt-4">
            <p className="text-yellow-800 text-xs leading-relaxed">
              <strong>Plain English:</strong> OwnerFi is just a website that shows property information we found and connects you with real estate agents. We're just letting you know what possible owner finance deals are out there - we don't guarantee these houses are still available or that sellers will actually offer owner financing. We don't guarantee anything is accurate. We're not your broker, lawyer, or lender. If something goes wrong with a property deal, that's between you and the people you're actually working with - not us. You're responsible for checking everything yourself and getting professional help.
            </p>
          </div>
        </div>

        {/* Call to Action */}
        <div className="text-center bg-gradient-to-r from-emerald-600/20 to-blue-600/20 rounded-2xl p-8 mt-8">
          <h3 className="text-2xl font-bold text-white mb-4">
            Ready to Explore Properties?
          </h3>
          <p className="text-slate-300 mb-6">
            Now that you understand the basics, you can make informed decisions with professional guidance.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/signup"
              className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white py-3 px-8 rounded-xl font-semibold transition-all duration-300 hover:scale-105 shadow-lg"
            >
              Browse Properties
            </Link>
            <Link
              href="/realtor-signup"
              className="bg-transparent border-2 border-blue-400 hover:bg-blue-400/10 text-blue-400 py-3 px-8 rounded-xl font-semibold transition-all duration-300 hover:scale-105"
            >
              I'm a Real Estate Agent
            </Link>
          </div>
        </div>
      </main>

      {/* Comprehensive Legal Footer */}
      <LegalFooter includeInvestment={true} includeState={true} />
    </div>
  );
}