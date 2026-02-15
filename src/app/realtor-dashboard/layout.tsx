'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { BottomTabBar } from '@/components/navigation/BottomTabBar';
import { getRealtorTabs } from '@/components/navigation/tab-configs';

export default function RealtorDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { status } = useSession();
  const [isInvestor, setIsInvestor] = useState(false);

  useEffect(() => {
    if (status !== 'authenticated') return;
    fetch('/api/buyer/profile')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.profile?.isInvestor) setIsInvestor(true);
      })
      .catch(() => {});
  }, [status]);

  return (
    <>
      {children}
      <BottomTabBar tabs={getRealtorTabs({ isInvestor })} />
    </>
  );
}
