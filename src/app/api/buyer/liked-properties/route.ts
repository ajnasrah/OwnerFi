import { NextRequest, NextResponse } from 'next/server';
import {
  collection,
  query,
  where,
  getDocs,
  documentId,
  Query,
  QuerySnapshot,
  DocumentData
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { requireRole } from '@/lib/auth-helpers';
import {
  ErrorResponses,
  createSuccessResponse,
  logError
} from '@/lib/api-error-handler';
import { getAllPhoneFormats } from '@/lib/phone-utils';

export async function GET(request: NextRequest) {
  // Standardized authentication - allow buyers, admins, and realtors
  const authResult = await requireRole(request, ['buyer', 'admin', 'realtor']);
  if ('error' in authResult) return authResult.error;
  const { session } = authResult;

  try {
    if (!db) {
      return ErrorResponses.serviceUnavailable('Database not available');
    }

    console.log('🔍 [LIKED-PROPERTIES] Session:', {
      userId: session.user.id,
      phone: session.user.phone,
      role: session.user.role
    });

    // Get buyer profile with liked properties - try PHONE FIRST, then userId
    let profilesQuery: Query<DocumentData> | undefined;
    let snapshot: QuerySnapshot<DocumentData> | undefined;
    let foundBy = '';

    // 1. Try by PHONE (most reliable for phone-auth users)
    if (session.user.phone) {
      const phoneFormats = getAllPhoneFormats(session.user.phone);
      console.log('🔍 [LIKED-PROPERTIES] Trying phone formats:', phoneFormats);
      for (const phoneFormat of phoneFormats) {
        profilesQuery = query(
          collection(db, 'buyerProfiles'),
          where('phone', '==', phoneFormat)
        );
        snapshot = await getDocs(profilesQuery);
        if (!snapshot.empty) {
          foundBy = `phone:${phoneFormat}`;
          console.log('✅ [LIKED-PROPERTIES] Found by phone:', phoneFormat);
          break;
        }
      }
    }

    // 2. Fallback to userId if phone lookup failed
    if (!snapshot || snapshot.empty) {
      console.log('🔍 [LIKED-PROPERTIES] Phone lookup failed, trying userId');
      profilesQuery = query(
        collection(db, 'buyerProfiles'),
        where('userId', '==', session.user.id)
      );
      snapshot = await getDocs(profilesQuery);
      if (!snapshot.empty) {
        foundBy = 'userId';
      }
    }

    if (snapshot.empty) {
      console.log('❌ [LIKED-PROPERTIES] No profile found');
      return createSuccessResponse({
        likedProperties: [],
        profile: null,
        total: 0
      });
    }

    const profile = snapshot.docs[0].data();
    const profileId = snapshot.docs[0].id;
    const likedPropertyIds = profile.likedPropertyIds || profile.likedProperties || [];

    console.log('✅ [LIKED-PROPERTIES] Profile found:', {
      profileId,
      foundBy,
      likedPropertyIds,
      likedPropertyIdsCount: likedPropertyIds.length
    });

    if (likedPropertyIds.length === 0) {
      return createSuccessResponse({
        likedProperties: [],
        profile,
        total: 0
      });
    }

    // Get property details for liked properties from unified properties collection
    const allProperties: any[] = [];

    console.log('🔍 [LIKED-PROPERTIES] Fetching property details for IDs:', likedPropertyIds);

    // Batch fetch in groups of 10 (Firestore limit)
    for (let i = 0; i < likedPropertyIds.length; i += 10) {
      const batch = likedPropertyIds.slice(i, i + 10);

      console.log('🔍 [LIKED-PROPERTIES] Querying batch:', batch);

      // Query unified properties collection
      const propertiesSnapshot = await getDocs(
        query(collection(db, 'properties'), where(documentId(), 'in', batch))
      );

      console.log('📊 [LIKED-PROPERTIES] Query results:', {
        propertiesFound: propertiesSnapshot.docs.length
      });

      const batchProperties = propertiesSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          // Normalize fields for compatibility
          address: data.address || data.streetAddress || data.fullAddress,
          city: data.city,
          state: data.state,
          zipCode: data.zipCode || data.zipcode,
          listPrice: data.listPrice || data.price,
          imageUrl: data.firstPropertyImage || data.imgSrc || data.imageUrl,
          isLiked: true,
          source: data.isOwnerFinance ? 'owner_finance' : data.isCashDeal ? 'cash_deal' : 'curated'
        };
      });

      allProperties.push(...batchProperties);
    }

    console.log('✅ [LIKED-PROPERTIES] Returning', allProperties.length, 'properties');

    return createSuccessResponse({
      likedProperties: allProperties,
      profile,
      total: allProperties.length
    });

  } catch (error) {
    logError('GET /api/buyer/liked-properties', error, {
      userId: session.user.id
    });
    return ErrorResponses.databaseError('Failed to load liked properties', error);
  }
}
