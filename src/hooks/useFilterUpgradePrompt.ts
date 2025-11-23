'use client';

import { useState, useEffect } from 'react';

interface BuyerProfile {
  maxMonthlyPayment?: number;
  maxDownPayment?: number;
  minBedrooms?: number;
  maxBedrooms?: number;
  minBathrooms?: number;
  maxBathrooms?: number;
  minSquareFeet?: number;
  maxSquareFeet?: number;
  minPrice?: number;
  maxPrice?: number;
}

const STORAGE_KEY = 'filter_upgrade_prompt_dismissed';

export function useFilterUpgradePrompt(profile: BuyerProfile | null) {
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    if (!profile) return;

    // Check if user has already seen the prompt
    const hasSeenPrompt = localStorage.getItem(STORAGE_KEY);
    if (hasSeenPrompt) {
      setShouldShow(false);
      return;
    }

    // Check if this is an "old user" who needs the upgrade
    const isOldUser =
      // Has old budget fields
      (profile.maxMonthlyPayment !== undefined || profile.maxDownPayment !== undefined) &&
      // But missing ALL new filter fields
      profile.minBedrooms === undefined &&
      profile.maxBedrooms === undefined &&
      profile.minBathrooms === undefined &&
      profile.maxBathrooms === undefined &&
      profile.minSquareFeet === undefined &&
      profile.maxSquareFeet === undefined &&
      profile.minPrice === undefined &&
      profile.maxPrice === undefined;

    if (isOldUser) {
      // Small delay to prevent modal showing during page load
      setTimeout(() => {
        setShouldShow(true);
      }, 1000);
    }
  }, [profile]);

  const dismissPrompt = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setShouldShow(false);
  };

  return {
    shouldShow,
    dismissPrompt
  };
}
