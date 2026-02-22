'use client';

import { useQuery } from '@tanstack/react-query';
import { Agreement } from '../types';

async function fetchAgreements(): Promise<Agreement[]> {
  const response = await fetch('/api/realtor/agreements');
  if (!response.ok) throw new Error(`Failed to load agreements (${response.status})`);
  const data = await response.json();

  if (!data.success) {
    throw new Error('Failed to load agreements');
  }

  return data.agreements;
}

export function useRealtorAgreements(enabled: boolean) {
  return useQuery<Agreement[]>({
    queryKey: ['realtor-agreements'],
    queryFn: fetchAgreements,
    enabled,
  });
}
