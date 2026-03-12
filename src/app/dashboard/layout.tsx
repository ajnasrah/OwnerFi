'use client';

import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { BottomTabBar } from '@/components/navigation/BottomTabBar';
import { getBuyerTabs, getInvestorTabs, getRealtorTabs, getAdminTabs } from '@/components/navigation/tab-configs';
import { ExtendedSession } from '@/types/session';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const userRole = (session as unknown as ExtendedSession)?.user?.role;
  const isAdmin = userRole === 'admin';
  const isRealtor = userRole === 'realtor';
  const isInvestor = pathname.startsWith('/dashboard/investor');

  // Admins always keep admin tabs so they can navigate back
  // Realtors always see realtor tabs (with Leads, Deals, Settings)
  const tabs = isAdmin
    ? getAdminTabs()
    : isRealtor
      ? getRealtorTabs()
      : isInvestor
        ? getInvestorTabs({ likedCount: 0 })
        : getBuyerTabs({ likedCount: 0 });

  return (
    <>
      {children}
      {/* Don't render tabs until session is loaded to avoid flashing wrong tabs */}
      {status !== 'loading' && <BottomTabBar tabs={tabs} />}
    </>
  );
}
