'use client';

import { usePathname } from 'next/navigation';
import { BottomTabBar } from '@/components/navigation/BottomTabBar';
import { getBuyerTabs, getInvestorTabs } from '@/components/navigation/tab-configs';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isInvestor = pathname.startsWith('/dashboard/investor');

  // Tab bar shown on all /dashboard/* pages
  const tabs = isInvestor
    ? getInvestorTabs({ likedCount: 0 })
    : getBuyerTabs({ likedCount: 0 });

  return (
    <>
      {children}
      <BottomTabBar tabs={tabs} />
    </>
  );
}
