import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sample RF-701 Referral Agreement | OwnerFi For Realtors',
  description: 'View a sample RF-701 Referral Agreement used by OwnerFi. Tennessee Association of REALTORS standard form with 30% referral fee and 180-day term.',
  keywords: 'RF-701 referral agreement, real estate referral form, realtor referral agreement, Tennessee REALTORS form, buyer referral contract',
  openGraph: {
    title: 'Sample RF-701 Referral Agreement | OwnerFi',
    description: 'View the standard referral agreement used when accepting buyer leads through OwnerFi.',
    url: 'https://ownerfi.ai/for-realtors/sample-agreement',
    siteName: 'OwnerFi',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Sample RF-701 Referral Agreement | OwnerFi',
    description: 'Standard referral agreement for real estate agents.',
  },
  alternates: {
    canonical: 'https://ownerfi.ai/for-realtors/sample-agreement',
  },
  robots: {
    index: true,
    follow: true,
  }
}

export default function SampleAgreementLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
