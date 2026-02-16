'use client';

import { BottomTabBar } from '@/components/navigation/BottomTabBar';
import { getRealtorTabs } from '@/components/navigation/tab-configs';

export default function RealtorDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
      <BottomTabBar tabs={getRealtorTabs()} />
    </>
  );
}
