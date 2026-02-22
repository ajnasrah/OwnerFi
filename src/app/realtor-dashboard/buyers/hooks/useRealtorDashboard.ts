'use client';

import { useQuery } from '@tanstack/react-query';
import { DashboardData } from '../types';

async function fetchDashboard(search: string, city: string): Promise<DashboardData> {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (city) params.set('city', city);

  const url = `/api/realtor/dashboard${params.toString() ? `?${params.toString()}` : ''}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to load dashboard (${response.status})`);
  const data = await response.json();

  if (data.error) {
    throw new Error(data.error);
  }

  return data;
}

export function useRealtorDashboard(search: string, city: string, enabled: boolean) {
  return useQuery<DashboardData>({
    queryKey: ['realtor-dashboard', search, city],
    queryFn: () => fetchDashboard(search, city),
    enabled,
  });
}
