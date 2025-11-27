/**
 * Legal Agreement Tracking System
 *
 * Stores and manages user acceptance of legal agreements including:
 * - Terms of Service
 * - Privacy Policy
 * - Buyer Risk Waiver
 * - Agent Data Accuracy Agreement
 * - TCPA Compliance
 * - Creative Finance Disclaimer
 */

import { getFirestore, doc, setDoc, getDoc, updateDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { getFirebaseApp } from './firebase-lazy';

export type AgreementType =
  | 'terms_of_service'
  | 'privacy_policy'
  | 'buyer_risk_waiver'
  | 'agent_data_agreement'
  | 'tcpa_compliance'
  | 'creative_finance_disclaimer';

export interface LegalAgreement {
  agreementType: AgreementType;
  version: string; // e.g., "2025-01-13" or "v1.0"
  acceptedAt: Timestamp;
  userId: string;
  userEmail: string;
  userName?: string;
  ipAddress?: string;
  userAgent?: string;
  signature?: string; // For agent agreements
  licenseNumber?: string; // For agent agreements
  metadata?: Record<string, any>;
}

export interface UserLegalStatus {
  userId: string;
  userEmail: string;
  userType: 'buyer' | 'agent' | 'admin';
  agreements: {
    [key in AgreementType]?: {
      accepted: boolean;
      version: string;
      acceptedAt: Timestamp;
      signature?: string;
    };
  };
  lastUpdated: Timestamp;
  createdAt: Timestamp;
}

/**
 * Record a user's acceptance of a legal agreement
 */
export async function recordAgreementAcceptance(
  userId: string,
  userEmail: string,
  agreementType: AgreementType,
  options: {
    version?: string;
    userName?: string;
    ipAddress?: string;
    userAgent?: string;
    signature?: string;
    licenseNumber?: string;
    metadata?: Record<string, any>;
  } = {}
): Promise<void> {
  try {
    const app = getFirebaseApp();
    const db = getFirestore(app);

    const version = options.version || new Date().toISOString().split('T')[0]; // Default to today's date

    // Store individual agreement record
    const agreementRef = doc(db, 'legal_agreements', `${userId}_${agreementType}_${Date.now()}`);
    const agreementData: LegalAgreement = {
      agreementType,
      version,
      acceptedAt: serverTimestamp() as Timestamp,
      userId,
      userEmail,
      userName: options.userName,
      ipAddress: options.ipAddress,
      userAgent: options.userAgent,
      signature: options.signature,
      licenseNumber: options.licenseNumber,
      metadata: options.metadata,
    };

    await setDoc(agreementRef, agreementData);

    // Update user's legal status document
    const userLegalRef = doc(db, 'user_legal_status', userId);
    const userLegalDoc = await getDoc(userLegalRef);

    if (userLegalDoc.exists()) {
      // Update existing document
      await updateDoc(userLegalRef, {
        [`agreements.${agreementType}`]: {
          accepted: true,
          version,
          acceptedAt: serverTimestamp(),
          signature: options.signature || null,
        },
        lastUpdated: serverTimestamp(),
      });
    } else {
      // Create new document
      const userType = agreementType === 'agent_data_agreement' ? 'agent' : 'buyer';
      const userLegalData: Partial<UserLegalStatus> = {
        userId,
        userEmail,
        userType,
        agreements: {
          [agreementType]: {
            accepted: true,
            version,
            acceptedAt: serverTimestamp() as Timestamp,
            signature: options.signature,
          },
        },
        lastUpdated: serverTimestamp() as Timestamp,
        createdAt: serverTimestamp() as Timestamp,
      };

      await setDoc(userLegalRef, userLegalData);
    }

    console.log(`✅ Recorded ${agreementType} acceptance for user ${userId}`);
  } catch (error) {
    console.error('Error recording agreement acceptance:', error);
    throw error;
  }
}

/**
 * Check if a user has accepted a specific agreement
 */
export async function hasAcceptedAgreement(
  userId: string,
  agreementType: AgreementType,
  requiredVersion?: string
): Promise<boolean> {
  try {
    const app = getFirebaseApp();
    const db = getFirestore(app);

    const userLegalRef = doc(db, 'user_legal_status', userId);
    const userLegalDoc = await getDoc(userLegalRef);

    if (!userLegalDoc.exists()) {
      return false;
    }

    const data = userLegalDoc.data() as UserLegalStatus;
    const agreement = data.agreements?.[agreementType];

    if (!agreement || !agreement.accepted) {
      return false;
    }

    // If a specific version is required, check version match
    if (requiredVersion && agreement.version !== requiredVersion) {
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error checking agreement acceptance:', error);
    return false;
  }
}

/**
 * Get a user's complete legal status
 */
export async function getUserLegalStatus(userId: string): Promise<UserLegalStatus | null> {
  try {
    const app = getFirebaseApp();
    const db = getFirestore(app);

    const userLegalRef = doc(db, 'user_legal_status', userId);
    const userLegalDoc = await getDoc(userLegalRef);

    if (!userLegalDoc.exists()) {
      return null;
    }

    return userLegalDoc.data() as UserLegalStatus;
  } catch (error) {
    console.error('Error getting user legal status:', error);
    return null;
  }
}

/**
 * Get required agreements for a user type
 */
export function getRequiredAgreements(userType: 'buyer' | 'agent'): AgreementType[] {
  const commonAgreements: AgreementType[] = [
    'terms_of_service',
    'privacy_policy',
  ];

  if (userType === 'buyer') {
    return [
      ...commonAgreements,
      'buyer_risk_waiver',
    ];
  } else {
    return [
      ...commonAgreements,
      'agent_data_agreement',
      'tcpa_compliance',
    ];
  }
}

/**
 * Check if user has completed all required agreements
 */
export async function hasCompletedRequiredAgreements(
  userId: string,
  userType: 'buyer' | 'agent'
): Promise<{
  completed: boolean;
  missing: AgreementType[];
}> {
  const required = getRequiredAgreements(userType);
  const missing: AgreementType[] = [];

  for (const agreementType of required) {
    const accepted = await hasAcceptedAgreement(userId, agreementType);
    if (!accepted) {
      missing.push(agreementType);
    }
  }

  return {
    completed: missing.length === 0,
    missing,
  };
}

/**
 * Utility to get current user's IP address (client-side)
 */
export async function getCurrentUserIP(): Promise<string | undefined> {
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    return data.ip;
  } catch (error) {
    console.error('Error getting IP address:', error);
    return undefined;
  }
}

/**
 * Utility to get user agent string
 */
export function getUserAgent(): string {
  return typeof window !== 'undefined' ? window.navigator.userAgent : '';
}

/**
 * Current version constants (update these when legal documents change)
 */
export const CURRENT_VERSIONS = {
  terms_of_service: '2025-01-13',
  privacy_policy: '2025-09-03',
  buyer_risk_waiver: '2025-01-13',
  agent_data_agreement: '2025-01-13',
  tcpa_compliance: '2025-01-13',
  creative_finance_disclaimer: '2025-01-13',
} as const;
