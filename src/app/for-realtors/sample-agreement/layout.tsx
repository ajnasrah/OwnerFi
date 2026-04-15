import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sample Referral Agreement | OwnerFi For Realtors',
  description: 'View the eXp Realty Tennessee Referral Agreement (SkySlope® Forms) you sign when accepting a buyer lead through OwnerFi. 30% referral fee, paid only at closing.',
  keywords: 'eXp Realty referral agreement, Tennessee referral agreement, real estate referral form, broker-to-broker referral, buyer referral contract',
  openGraph: {
    title: 'Sample Referral Agreement | OwnerFi',
    description: 'View the eXp Realty Tennessee Referral Agreement used when accepting buyer leads through OwnerFi.',
    url: 'https://ownerfi.ai/for-realtors/sample-agreement',
    siteName: 'OwnerFi',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Sample Referral Agreement | OwnerFi',
    description: 'eXp Realty Tennessee Referral Agreement for real estate agents.',
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
