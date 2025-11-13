'use client';

import { Header } from '@/components/ui/Header';
import { Footer } from '@/components/ui/Footer';
import Link from 'next/link';

export default function CreativeFinanceDisclaimer() {
  return (
    <div className="min-h-screen bg-primary-bg">
      <Header />

      <div className="max-w-4xl mx-auto px-6 py-16">
        <div className="bg-white rounded-xl shadow-light p-8 md:p-12">
          <h1 className="text-4xl font-bold text-primary-text mb-8">
            Creative Finance Disclaimer
          </h1>
          <p className="text-slate-600 mb-8">
            Subject-To, Wraparound Mortgages, Lease Options, Contract-for-Deed
          </p>

          {/* Critical Warning Banner */}
          <div className="bg-red-100 border-2 border-red-400 rounded-xl p-6 mb-8">
            <h2 className="text-2xl font-bold text-red-900 mb-4 text-center">
              🚨 CRITICAL WARNING - READ BEFORE PROCEEDING
            </h2>
            <p className="text-red-800 text-center font-semibold">
              OwnerFi does NOT review, inspect, verify, structure, advise on, or guarantee the legality, compliance, or risk associated with ANY creative financing technique. You proceed entirely at your own risk.
            </p>
          </div>

          <div className="space-y-8 text-lg leading-relaxed text-slate-700">

            <section>
              <h2 className="text-2xl font-semibold text-primary-text mb-4">
                What OwnerFi Does NOT Do
              </h2>
              <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                <p className="font-bold text-red-800 mb-4">OwnerFi Does NOT:</p>
                <ul className="space-y-2 text-red-700">
                  <li className="flex items-start gap-2">
                    <span className="text-red-500 mt-1">✗</span>
                    <span>Advise on creative finance structures (sub2, wraps, lease options, contract-for-deed)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-500 mt-1">✗</span>
                    <span>Structure, facilitate, or assist with creative finance deals</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-500 mt-1">✗</span>
                    <span>Draft creative finance documents or legal agreements</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-500 mt-1">✗</span>
                    <span>Verify the status, balance, or payment history of existing mortgages</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-500 mt-1">✗</span>
                    <span>Confirm the existence, legality, or validity of wraparound terms</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-500 mt-1">✗</span>
                    <span>Determine whether a transaction triggers due-on-sale clauses</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-500 mt-1">✗</span>
                    <span>Provide Dodd-Frank Act or SAFE Act compliance guidance</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-500 mt-1">✗</span>
                    <span>Verify compliance with RESPA, TILA, or state lending laws</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-500 mt-1">✗</span>
                    <span>Assess balloon payment risks or refinancing feasibility</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-500 mt-1">✗</span>
                    <span>Evaluate title risks, lien priority, or insurance requirements</span>
                  </li>
                </ul>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary-text mb-4">
                Information Source: Listing Agents Only
              </h2>
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-6">
                <p className="text-orange-800 font-semibold mb-3">
                  Any reference to seller financing, subject-to transactions, wraparound mortgages, lease options, or any creative finance structure originates SOLELY from the listing agent or seller.
                </p>
                <p className="text-orange-700">
                  OwnerFi is a platform that displays property information as provided by third parties. We do not:
                </p>
                <ul className="list-disc ml-6 mt-2 space-y-1 text-orange-700">
                  <li>Verify the accuracy of creative finance terms</li>
                  <li>Validate the legality of proposed structures</li>
                  <li>Endorse or recommend any creative finance method</li>
                  <li>Guarantee the viability of any financing arrangement</li>
                </ul>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary-text mb-4">
                Critical Risks of Creative Finance
              </h2>

              <div className="space-y-4">
                <div className="bg-red-50 border border-red-200 rounded-lg p-5">
                  <h3 className="font-bold text-red-800 mb-2">🏦 Due-on-Sale Clause Risk</h3>
                  <p className="text-red-700 text-sm">
                    Most mortgages contain due-on-sale clauses that allow the lender to demand full payment if ownership transfers. Subject-to and wraparound transactions may trigger this clause, resulting in loan acceleration and potential foreclosure.
                  </p>
                </div>

                <div className="bg-orange-50 border border-orange-200 rounded-lg p-5">
                  <h3 className="font-bold text-orange-800 mb-2">💰 Balloon Payment Risk</h3>
                  <p className="text-orange-700 text-sm">
                    Many creative finance deals include balloon payments—large lump sums due at a specific date. If you cannot refinance or pay the balloon, you may lose the property and all payments made.
                  </p>
                </div>

                <div className="bg-purple-50 border border-purple-200 rounded-lg p-5">
                  <h3 className="font-bold text-purple-800 mb-2">📋 Title and Lien Risks</h3>
                  <p className="text-purple-700 text-sm">
                    In subject-to and wrap transactions, the seller retains title initially or existing liens remain. You may be making payments on a property you don't legally own, with no protection if the seller defaults on the underlying mortgage.
                  </p>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-5">
                  <h3 className="font-bold text-blue-800 mb-2">⚖️ Legal and Regulatory Compliance</h3>
                  <p className="text-blue-700 text-sm">
                    Dodd-Frank and state laws may require sellers offering financing to be licensed as mortgage loan originators. Violations can void contracts, trigger penalties, or result in criminal liability.
                  </p>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-5">
                  <h3 className="font-bold text-yellow-800 mb-2">🔍 Insurance and Tax Complications</h3>
                  <p className="text-yellow-700 text-sm">
                    Creative finance structures may affect insurance coverage, property tax reassessment, homestead exemptions, and capital gains treatment. Consult professionals before proceeding.
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary-text mb-4">
                Mandatory Buyer Verification Requirements
              </h2>
              <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                <p className="font-bold text-red-800 mb-4">
                  Before entering ANY creative finance transaction, you MUST independently verify:
                </p>
                <div className="grid md:grid-cols-2 gap-4">
                  <ul className="space-y-2 text-red-700 text-sm">
                    <li><strong>✓</strong> Mortgage status, balance, and payment history</li>
                    <li><strong>✓</strong> Due-on-sale clause existence and enforceability</li>
                    <li><strong>✓</strong> Title status, ownership, and liens</li>
                    <li><strong>✓</strong> Lien priority and encumbrances</li>
                    <li><strong>✓</strong> State-specific lending laws</li>
                    <li><strong>✓</strong> Usury limits and interest rate caps</li>
                  </ul>
                  <ul className="space-y-2 text-red-700 text-sm">
                    <li><strong>✓</strong> Dodd-Frank/SAFE Act compliance</li>
                    <li><strong>✓</strong> Seller's licensing requirements</li>
                    <li><strong>✓</strong> Balloon payment refinancing feasibility</li>
                    <li><strong>✓</strong> Insurance requirements and coverage</li>
                    <li><strong>✓</strong> Tax implications and reassessment risk</li>
                    <li><strong>✓</strong> Default consequences and remedies</li>
                  </ul>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary-text mb-4">
                Required Professional Consultations
              </h2>
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
                <p className="font-bold text-purple-800 mb-4">
                  ALL creative finance structures MUST be reviewed by licensed professionals:
                </p>
                <div className="space-y-3 text-purple-700">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">👨‍⚖️</span>
                    <div>
                      <p className="font-semibold">Licensed Real Estate Attorney</p>
                      <p className="text-sm">Review all contracts, explain legal implications, verify compliance with state laws</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">🏦</span>
                    <div>
                      <p className="font-semibold">Residential Mortgage Loan Originator (RMLO)</p>
                      <p className="text-sm">Verify financing structure, assess Dodd-Frank compliance, evaluate risks</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">📜</span>
                    <div>
                      <p className="font-semibold">Title Company or Title Attorney</p>
                      <p className="text-sm">Conduct title search, verify ownership, identify liens and encumbrances</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">💼</span>
                    <div>
                      <p className="font-semibold">Certified Public Accountant (CPA)</p>
                      <p className="text-sm">Assess tax implications, capital gains treatment, depreciation rules</p>
                    </div>
                  </div>
                </div>
                <div className="bg-purple-100 border border-purple-300 rounded-lg p-4 mt-4">
                  <p className="text-purple-900 font-bold text-center">
                    Do NOT proceed with creative finance without professional legal and financial advice.
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary-text mb-4">
                OwnerFi Liability Disclaimer
              </h2>
              <div className="bg-red-100 border-2 border-red-400 rounded-lg p-6">
                <h3 className="font-bold text-red-900 text-xl mb-4 text-center">
                  ⛔ ZERO LIABILITY FOR CREATIVE FINANCE STRUCTURES
                </h3>
                <div className="space-y-3 text-red-800">
                  <p className="font-semibold">
                    OwnerFi bears ZERO liability for any consequences arising from creative finance transactions, including but not limited to:
                  </p>
                  <ul className="grid md:grid-cols-2 gap-2 text-sm">
                    <li>• Due-on-sale clause triggers</li>
                    <li>• Loan acceleration or foreclosure</li>
                    <li>• Balloon payment defaults</li>
                    <li>• Title defects or lien priority issues</li>
                    <li>• Seller mortgage defaults</li>
                    <li>• Dodd-Frank or SAFE Act violations</li>
                    <li>• State lending law violations</li>
                    <li>• Insurance coverage gaps</li>
                    <li>• Tax reassessment or penalties</li>
                    <li>• Loss of property or investment</li>
                    <li>• Legal fees or litigation costs</li>
                    <li>• Regulatory fines or penalties</li>
                  </ul>
                  <div className="bg-red-200 border border-red-400 rounded p-4 mt-4">
                    <p className="text-red-900 font-bold text-center">
                      YOU ASSUME ALL RISK ASSOCIATED WITH CREATIVE FINANCING.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary-text mb-4">
                State-Specific Considerations
              </h2>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <p className="text-blue-800 mb-3">
                  Creative finance laws vary significantly by state. Some states have:
                </p>
                <ul className="list-disc ml-6 space-y-1 text-blue-700">
                  <li>Restrictions on wraparound mortgages or contract-for-deed</li>
                  <li>Mandatory seller licensing for owner financing</li>
                  <li>Usury caps that limit interest rates</li>
                  <li>Required disclosures and waiting periods</li>
                  <li>Specific remedies for buyer default</li>
                  <li>Prohibition on certain creative finance structures</li>
                </ul>
                <p className="text-blue-800 font-semibold mt-4">
                  Consult a licensed attorney in the property's state to verify legality and compliance.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary-text mb-4">
                Related Legal Documents
              </h2>
              <div className="grid md:grid-cols-2 gap-4">
                <Link
                  href="/terms"
                  className="bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg p-4 transition-colors"
                >
                  <p className="font-semibold text-primary-text mb-1">Terms of Service</p>
                  <p className="text-sm text-slate-600">Complete terms and conditions</p>
                </Link>
                <Link
                  href="/privacy"
                  className="bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg p-4 transition-colors"
                >
                  <p className="font-semibold text-primary-text mb-1">Privacy Policy</p>
                  <p className="text-sm text-slate-600">How we handle your information</p>
                </Link>
              </div>
            </section>

            <div className="border-t pt-8 mt-8">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                <p className="text-yellow-900 font-bold mb-2">Final Warning:</p>
                <p className="text-yellow-800 text-sm">
                  By using OwnerFi, you acknowledge that you have been warned about the risks of creative finance, understand that OwnerFi provides no verification or guidance on creative finance structures, and agree to independently verify all information with licensed professionals before proceeding with any transaction. You accept full responsibility for all consequences of creative finance decisions.
                </p>
              </div>
            </div>

          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
