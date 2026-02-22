'use client';

import { useState, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AgreementModalState } from '../types';

const INITIAL_STATE: AgreementModalState = {
  isOpen: false,
  step: 'loading',
  leadId: null,
  agreementId: null,
  agreementNumber: null,
  agreementHTML: null,
  terms: null,
  buyerName: null,
  buyerDetails: null,
  typedName: '',
  agreeToTerms: false,
  agreeTCPA: false,
  agreeCreativeFinance: false,
  agreeDataAsIs: false,
  error: null,
};

export function useAgreementActions() {
  const [modal, setModal] = useState<AgreementModalState>(INITIAL_STATE);
  const modalRef = useRef(modal);
  modalRef.current = modal;
  const queryClient = useQueryClient();

  const acceptLead = useCallback(async (leadId: string, buyerName: string) => {
    setModal({
      ...INITIAL_STATE,
      isOpen: true,
      step: 'loading',
      leadId,
      buyerName,
    });

    try {
      const response = await fetch('/api/realtor/agreements/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId }),
      });
      if (!response.ok) throw new Error(`Server error (${response.status})`);
      const result = await response.json();

      if (result.success) {
        setModal(prev => ({
          ...prev,
          step: 'review',
          agreementId: result.agreementId,
          agreementNumber: result.agreementNumber,
          agreementHTML: result.agreementHTML,
          terms: result.terms,
        }));
        queryClient.invalidateQueries({ queryKey: ['realtor-agreements'] });
      } else {
        setModal(prev => ({
          ...prev,
          step: 'review',
          error: result.error || 'Failed to generate agreement',
        }));
      }
    } catch {
      setModal(prev => ({
        ...prev,
        step: 'review',
        error: 'Failed to generate agreement. Please try again.',
      }));
    }
  }, [queryClient]);

  const openPendingAgreement = useCallback(async (agreement: {
    id: string;
    agreementNumber: string;
    referralFeePercent: number;
    expirationDate: string;
    buyerFirstName?: string;
    buyerLastName?: string;
  }) => {
    setModal({
      ...INITIAL_STATE,
      isOpen: true,
      step: 'loading',
      agreementId: agreement.id,
      agreementNumber: agreement.agreementNumber,
      terms: {
        referralFeePercent: agreement.referralFeePercent,
        agreementTermDays: 180,
        expirationDate: agreement.expirationDate,
      },
      buyerName: [agreement.buyerFirstName, agreement.buyerLastName].filter(Boolean).join(' ') || 'Unknown',
    });

    try {
      const response = await fetch(`/api/realtor/agreements?id=${agreement.id}`);
      if (!response.ok) throw new Error(`Server error (${response.status})`);
      const data = await response.json();
      if (data.success) {
        setModal(prev => ({
          ...prev,
          step: 'review',
          agreementHTML: data.agreementHTML,
        }));
      } else {
        setModal(prev => ({
          ...prev,
          step: 'review',
          error: data.error || 'Failed to load agreement',
        }));
      }
    } catch {
      setModal(prev => ({
        ...prev,
        step: 'review',
        error: 'Failed to load agreement. Please try again.',
      }));
    }
  }, []);

  const signAgreement = useCallback(async () => {
    const current = modalRef.current;

    if (
      !current.agreementId ||
      !current.typedName ||
      !current.agreeToTerms ||
      !current.agreeTCPA ||
      !current.agreeCreativeFinance ||
      !current.agreeDataAsIs
    ) {
      return;
    }

    setModal(prev => ({ ...prev, step: 'signing', error: null }));

    try {
      const response = await fetch('/api/realtor/agreements/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agreementId: current.agreementId,
          typedName: current.typedName,
          agreeToTerms: current.agreeToTerms,
          agreeTCPA: current.agreeTCPA,
          agreeCreativeFinance: current.agreeCreativeFinance,
          agreeDataAsIs: current.agreeDataAsIs,
        }),
      });
      if (!response.ok) throw new Error(`Server error (${response.status})`);
      const result = await response.json();

      if (result.success) {
        setModal(prev => ({
          ...prev,
          step: 'success',
          buyerDetails: result.buyerDetails,
        }));
        queryClient.invalidateQueries({ queryKey: ['realtor-dashboard'] });
        queryClient.invalidateQueries({ queryKey: ['realtor-agreements'] });
      } else {
        setModal(prev => ({
          ...prev,
          step: 'review',
          error: result.error || 'Failed to sign agreement',
        }));
      }
    } catch {
      setModal(prev => ({
        ...prev,
        step: 'review',
        error: 'Failed to sign agreement. Please try again.',
      }));
    }
  }, [queryClient]);

  const close = useCallback(() => setModal(INITIAL_STATE), []);

  const updateField = useCallback(
    (updates: Partial<AgreementModalState>) =>
      setModal(prev => ({ ...prev, ...updates })),
    []
  );

  return { modal, setModal, acceptLead, openPendingAgreement, signAgreement, close, updateField };
}
