'use client';

import { BottomTabBar } from '@/components/navigation/BottomTabBar';
import { getRealtorTabs } from '@/components/navigation/tab-configs';
import { Header } from '@/components/ui/Header';

export default function RealtorDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Header />
      {children}
      <BottomTabBar tabs={getRealtorTabs()} />
    </>
  );
}
