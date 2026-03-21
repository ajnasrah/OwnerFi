'use client';

import DealAlerts from '@/components/DealAlerts';
import { BottomTabBar } from '@/components/navigation/BottomTabBar';
import { getAdminTabs } from '@/components/navigation/tab-configs';
import { Header } from '@/components/ui/Header';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Header />
      {children}
      <DealAlerts />
      <BottomTabBar tabs={getAdminTabs()} />
    </>
  );
}
