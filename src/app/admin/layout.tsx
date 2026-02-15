'use client';

import DealAlerts from '@/components/DealAlerts';
import { BottomTabBar } from '@/components/navigation/BottomTabBar';
import { getAdminTabs } from '@/components/navigation/tab-configs';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
      <DealAlerts />
      <BottomTabBar tabs={getAdminTabs()} />
    </>
  );
}
