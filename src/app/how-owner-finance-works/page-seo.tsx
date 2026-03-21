import { Metadata } from 'next'
import Link from 'next/link'
import { LegalFooter } from '@/components/ui/LegalFooter'
import Script from 'next/script'
import { metadata as pageMetadata } from './metadata'
import CollapsibleFAQ from './CollapsibleFAQ'

export const metadata = pageMetadata

// Generate FAQ Schema for SEO
function generateFAQSchema() {
  const faqs = [
    {
      question: "What is owner financing?",
      answer: "Owner financing is when the person selling a house acts like a bank. Instead of you getting a loan from a bank to buy their house, the seller lets you pay them directly over time. The seller becomes your lender and you make monthly payments to them instead of a traditional mortgage company."
    },
    {
      question: "How is owner financing different from a bank loan?",
      answer: "With owner financing, the seller determines credit requirements, potentially has less paperwork, may close faster, and owns the loan directly. Traditional bank loans have strict credit score requirements, extensive paperwork, take 30-45 days to close, and the bank owns the loan."
    },
    {
      question: "What are the 4 main types of alternative financing?",
      answer: "The 4 main types are: 1) Seller Finance - seller owns house outright, you get deed immediately. 2) Subject To - you take over existing mortgage payments. 3) Contract for Deed - you don't get deed until fully paid. 4) Lease-to-Own - you rent with option to buy later."
    },
    {
      question: "Why would sellers offer owner financing?",
      answer: "Sellers offer owner financing to earn interest income over time, sell their property faster by expanding the buyer pool, gain potential tax advantages, and create a steady investment income stream for retirement."
    },
    {
      question: "What are balloon payments in owner financing?",
      answer: "A balloon payment is when you make regular monthly payments for a set period (like 5 years), then must pay off the remaining balance. This gives you time to build equity and improve your credit to refinance with a traditional lender."
    },
    {
      question: "Do I need to pay property taxes and insurance separately with owner financing?",
      answer: "Yes, unlike bank loans, owner financing typically doesn't include an escrow account. You must pay property taxes directly to the county, arrange and pay for home insurance yourself, and pay any HOA fees directly."
    },
    {
      question: "What are the risks of owner financing for buyers?",
      answer: "Key risks include: seller might still owe money on the house, property might have hidden problems, varying interest rates, different legal protections than bank loans, and the seller's right to perform credit checks and income verification."
    },
    {
      question: "How can I protect myself in an owner finance deal?",
      answer: "Protect yourself by hiring a licensed real estate agent, using a title company or attorney, getting everything in writing, conducting a professional property inspection, purchasing title insurance, and consulting with professionals before signing anything."
    },
    {
      question: "Can I get owner financing with bad credit?",
      answer: "Owner financing may be more flexible than traditional bank loans regarding credit. Each seller sets their own requirements. While some sellers may work with buyers with poor credit, they may require larger down payments or higher interest rates."
    },
    {
      question: "What happens if I can't make a balloon payment when it's due?",
      answer: "Your options include refinancing with a bank using built equity, selling the property, paying the balance if you have funds available, or negotiating with the seller for an extension. Start planning for the balloon payment well in advance."
    }
  ]

  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqs.map(faq => ({
      "@type": "Question",
      "name": faq.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": faq.answer
      }
    }))
  }
}

// Generate Article Schema for SEO
function generateArticleSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": "How Owner Financing Works: Complete Guide to Seller Financing",
    "description": "Comprehensive guide explaining owner financing, seller financing, contract for deed, and alternative home buying methods without traditional bank loans.",
    "image": "https://ownerfi.ai/og-owner-finance-guide.png",
    "author": {
      "@type": "Organization",
      "name": "Ownerfi",
      "url": "https://ownerfi.ai"
    },
    "publisher": {
      "@type": "Organization",
      "name": "Ownerfi",
      "logo": {
        "@type": "ImageObject",
        "url": "https://ownerfi.ai/logo.png"
      }
    },
    "datePublished": "2024-01-01",
    "dateModified": new Date().toISOString(),
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": "https://ownerfi.ai/how-owner-finance-works"
    },
    "keywords": "owner financing, seller financing, contract for deed, subject to, lease to own, creative financing, no bank financing",
    "articleSection": "Real Estate Education",
    "wordCount": 3500,
    "speakable": {
      "@type": "SpeakableSpecification",
      "cssSelector": ["h1", ".summary", ".key-points"]
    }
  }
}

// Generate Breadcrumb Schema
function generateBreadcrumbSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Home",
        "item": "https://ownerfi.ai"
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": "How Owner Finance Works",
        "item": "https://ownerfi.ai/how-owner-finance-works"
      }
    ]
  }
}

export default function HowOwnerfinanceWorks() {
  return (
    <>
      {/* Schema Markup for SEO */}
      <Script
        id="faq-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(generateFAQSchema())
        }}
      />
      <Script
        id="article-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(generateArticleSchema())
        }}
      />
      <Script
        id="breadcrumb-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(generateBreadcrumbSchema())
        }}
      />

      <div className="min-h-screen bg-[#111625] text-white">
        {/* Header */}
        <header className="sticky top-0 z-50 bg-[#111625]/90 backdrop-blur-xl border-b border-white/[0.06] px-4 sm:px-6">
          <div className="max-w-4xl mx-auto flex items-center justify-between h-14 sm:h-16">
            <Link href="/" className="flex items-center gap-2">
              <svg width="28" height="28" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="lg" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse"><stop offset="0%" stopColor="#00BC7D"/><stop offset="100%" stopColor="#3B82F6"/></linearGradient></defs><circle cx="50" cy="50" r="45" stroke="url(#lg)" strokeWidth="7" fill="none"/><ellipse cx="50" cy="50" rx="42" ry="22" stroke="url(#lg)" strokeWidth="5.5" fill="none" transform="rotate(-25 50 50)"/><ellipse cx="50" cy="50" rx="22" ry="42" stroke="url(#lg)" strokeWidth="5.5" fill="none" transform="rotate(-25 50 50)"/></svg>
              <span className="text-lg font-bold text-white">Ownerfi</span>
            </Link>
            <nav aria-label="Breadcrumb">
              <Link
                href="/"
                className="hidden sm:inline-flex text-sm text-slate-400 hover:text-white px-3 py-2 rounded-lg transition-colors"
              >
                Back to Home
              </Link>
            </nav>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-4xl mx-auto px-6 py-12">
          {/* SEO-Optimized H1 */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-white mb-4">
              How Owner Financing Works: Complete Guide to Seller Financing
            </h1>
            <p className="text-xl text-slate-300 leading-relaxed summary">
              Learn everything about owner financing, seller financing, contract for deed, and buying homes without traditional bank loans. Common questions answered in simple terms.
            </p>
          </div>

          {/* Key Points for SEO */}
          <div className="key-points bg-blue-600/20 border border-blue-500/30 rounded-xl p-6 mb-8">
            <h2 className="text-blue-300 font-bold text-lg mb-4">Key Takeaways</h2>
            <ul className="space-y-2 text-blue-100">
              <li>• Owner financing allows you to buy directly from the seller without bank involvement</li>
              <li>• Four main types: Seller Finance, Subject-To, Contract for Deed, and Lease-to-Own</li>
              <li>• No escrow account - you pay taxes and insurance directly</li>
              <li>• May include balloon payments requiring refinancing in 3-7 years</li>
              <li>• Always use licensed professionals for protection</li>
            </ul>
          </div>

          {/* Content sections would go here - using the CollapsibleFAQ component */}
          <CollapsibleFAQ />

          {/* Internal Links for SEO */}
          <div className="mt-12 p-6 bg-slate-800/50 rounded-xl">
            <h2 className="text-xl font-bold text-white mb-4">Related Resources</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <Link href="/auth" className="text-blue-400 hover:text-blue-300">
                → Browse Owner Financed Properties
              </Link>
              <Link href="/about" className="text-blue-400 hover:text-blue-300">
                → About Ownerfi Platform
              </Link>
              <Link href="/contact" className="text-blue-400 hover:text-blue-300">
                → Contact Our Team
              </Link>
              <Link href="/realtor-dashboard" className="text-blue-400 hover:text-blue-300">
                → For Real Estate Agents
              </Link>
            </div>
          </div>

          {/* Call to Action */}
          <div className="text-center bg-gradient-to-r from-[#00BC7D]/20 to-blue-600/20 rounded-2xl p-8 mt-8">
            <h2 className="text-2xl font-bold text-white mb-4">
              Ready to Find Owner Financed Properties?
            </h2>
            <p className="text-slate-300 mb-6">
              Now that you understand owner financing, explore available properties in Texas, Florida, and Georgia.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/auth"
                className="bg-gradient-to-r from-[#00BC7D] to-[#009B66] hover:from-[#00d68f] hover:to-[#00BC7D] text-white py-3 px-8 rounded-xl font-semibold transition-all duration-300 hover:scale-105 shadow-lg"
              >
                Browse Properties
              </Link>
              <Link
                href="/auth"
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
    </>
  )
}