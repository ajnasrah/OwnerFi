'use client';

import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { BottomTabBar } from '@/components/navigation/BottomTabBar';
import { getBuyerTabs, getInvestorTabs, getRealtorTabs } from '@/components/navigation/tab-configs';
import { ExtendedSession } from '@/types/session';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const isInvestor = pathname.startsWith('/dashboard/investor');
  const isRealtor = (session as unknown as ExtendedSession)?.user?.role === 'realtor';

  // Realtors always see realtor tabs (with Leads, Deals, Settings)
  // so they can navigate back to buyer leads from any page
  const tabs = isRealtor
    ? getRealtorTabs()
    : isInvestor
      ? getInvestorTabs({ likedCount: 0 })
      : getBuyerTabs({ likedCount: 0 });

  return (
    <>
      {children}
      <BottomTabBar tabs={tabs} />
    </>
  );
}
