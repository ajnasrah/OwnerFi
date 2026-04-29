/**
 * Tests for memory-efficient property matching system
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import {
  isPropertyMatch,
  matchBuyerToPropertiesEfficient,
  matchPropertyToBuyersEfficient,
  recalculateAllMatchesEfficient,
  getBuyerMatchesPaginated
} from '@/lib/matching-efficient';
import * as admin from 'firebase-admin';

// Mock Firebase Admin
jest.mock('firebase-admin', () => ({
  initializeApp: jest.fn(),
  apps: [],
  firestore: jest.fn(() => ({
    collection: jest.fn().mockReturnThis(),
    doc: jest.fn().mockReturnThis(),
    get: jest.fn(),
    set: jest.fn(),
    update: jest.fn(),
    batch: jest.fn(() => ({
      set: jest.fn(),
      update: jest.fn(),
      commit: jest.fn().mockResolvedValue(undefined)
    })),
    FieldValue: {
      serverTimestamp: jest.fn(() => new Date())
    }
  })),
  credential: {
    cert: jest.fn()
  }
}));

describe('Memory-Efficient Property Matching', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('isPropertyMatch', () => {
    const baseProperty = {
      id: 'prop1',
      city: 'Austin',
      state: 'TX',
      bedrooms: 3,
      bathrooms: 2,
      squareFeet: 1500,
      listPrice: 300000,
      latitude: 30.2672,
      longitude: -97.7431
    };

    const baseBuyer = {
      id: 'buyer1',
      preferredCity: 'Austin',
      preferredState: 'TX',
      searchRadius: 25,
      latitude: 30.2672,
      longitude: -97.7431,
      minBedrooms: 2,
      maxBedrooms: 4,
      minBathrooms: 1,
      maxBathrooms: 3,
      minPrice: 200000,
      maxPrice: 400000
    };

    it('should match property within all buyer criteria', () => {
      const result = isPropertyMatch(baseProperty, baseBuyer);
      
      expect(result.matches).toBe(true);
      expect(result.matchedOn.location).toBe(true);
      expect(result.matchedOn.bedrooms).toBe(true);
      expect(result.matchedOn.bathrooms).toBe(true);
      expect(result.score).toBeGreaterThan(0.8);
    });

    it('should not match property outside location radius', () => {
      const distantProperty = {
        ...baseProperty,
        city: 'Houston',
        latitude: 29.7604,
        longitude: -95.3698
      };
      
      const result = isPropertyMatch(distantProperty, baseBuyer);
      
      expect(result.matches).toBe(false);
      expect(result.matchedOn.location).toBe(false);
    });

    it('should not match property outside bedroom requirements', () => {
      const property = {
        ...baseProperty,
        bedrooms: 5
      };
      
      const result = isPropertyMatch(property, baseBuyer);
      
      expect(result.matches).toBe(false);
    });

    it('should match using nearby cities array', () => {
      const buyerWithCities = {
        ...baseBuyer,
        filter: {
          nearbyCities: ['Austin', 'Round Rock', 'Cedar Park']
        }
      };
      
      const nearbyProperty = {
        ...baseProperty,
        city: 'Round Rock'
      };
      
      const result = isPropertyMatch(nearbyProperty, buyerWithCities);
      
      expect(result.matches).toBe(true);
      expect(result.matchedOn.location).toBe(true);
    });

    it('should match using bounding box', () => {
      const buyerWithBounds = {
        ...baseBuyer,
        filter: {
          boundingBox: {
            minLat: 30.0,
            maxLat: 30.5,
            minLng: -98.0,
            maxLng: -97.5
          }
        }
      };
      
      const result = isPropertyMatch(baseProperty, buyerWithBounds);
      
      expect(result.matches).toBe(true);
      expect(result.matchedOn.location).toBe(true);
    });

    it('should calculate distance when coordinates available', () => {
      const result = isPropertyMatch(baseProperty, baseBuyer);
      
      expect(result.distanceMiles).toBeDefined();
      expect(result.distanceMiles).toBeLessThan(1); // Same location
    });
  });

  describe('matchBuyerToPropertiesEfficient', () => {
    const mockFirestore = admin.firestore() as jest.MockedObject<admin.firestore.Firestore>;
    
    beforeEach(() => {
      // Mock buyer document
      (mockFirestore.collection as jest.Mock).mockImplementation((collection: string) => {
        if (collection === 'buyer_profiles') {
          return {
            doc: jest.fn(() => ({
              get: jest.fn().mockResolvedValue({
                exists: true,
                data: () => ({
                  id: 'buyer1',
                  preferredCity: 'Austin',
                  preferredState: 'TX',
                  searchRadius: 25,
                  minBedrooms: 2
                })
              })
            }))
          };
        }
        if (collection === 'properties') {
          return {
            where: jest.fn().mockReturnThis(),
            orderBy: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            startAfter: jest.fn().mockReturnThis(),
            get: jest.fn().mockResolvedValueOnce({
              empty: false,
              docs: [
                {
                  id: 'prop1',
                  data: () => ({
                    city: 'Austin',
                    state: 'TX',
                    bedrooms: 3,
                    bathrooms: 2,
                    listPrice: 300000
                  })
                }
              ]
            }).mockResolvedValueOnce({
              empty: true,
              docs: []
            })
          };
        }
        if (collection === 'property_buyer_matches') {
          return {
            doc: jest.fn(() => ({
              set: jest.fn()
            }))
          };
        }
        return mockFirestore;
      });
    });

    it('should process properties in batches', async () => {
      const result = await matchBuyerToPropertiesEfficient('buyer1');
      
      expect(result.matchedProperties).toBe(1);
      expect(result.totalProperties).toBe(1);
    });

    it('should throw error for non-existent buyer', async () => {
      (mockFirestore.collection as jest.Mock).mockImplementation(() => ({
        doc: jest.fn(() => ({
          get: jest.fn().mockResolvedValue({
            exists: false
          })
        }))
      }));
      
      await expect(matchBuyerToPropertiesEfficient('invalid'))
        .rejects.toThrow('Buyer not found');
    });
  });

  describe('matchPropertyToBuyersEfficient', () => {
    const mockFirestore = admin.firestore() as jest.MockedObject<admin.firestore.Firestore>;
    
    beforeEach(() => {
      // Mock property document
      (mockFirestore.collection as jest.Mock).mockImplementation((collection: string) => {
        if (collection === 'properties') {
          return {
            doc: jest.fn(() => ({
              get: jest.fn().mockResolvedValue({
                exists: true,
                data: () => ({
                  id: 'prop1',
                  city: 'Austin',
                  state: 'TX',
                  bedrooms: 3,
                  bathrooms: 2,
                  listPrice: 300000
                })
              })
            }))
          };
        }
        if (collection === 'buyer_profiles') {
          return {
            where: jest.fn().mockReturnThis(),
            orderBy: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            startAfter: jest.fn().mockReturnThis(),
            get: jest.fn().mockResolvedValueOnce({
              empty: false,
              docs: [
                {
                  id: 'buyer1',
                  data: () => ({
                    preferredCity: 'Austin',
                    preferredState: 'TX',
                    searchRadius: 25,
                    minBedrooms: 2,
                    maxBedrooms: 4
                  })
                }
              ]
            }).mockResolvedValueOnce({
              empty: true,
              docs: []
            })
          };
        }
        if (collection === 'property_buyer_matches') {
          return {
            doc: jest.fn(() => ({
              set: jest.fn()
            }))
          };
        }
        return mockFirestore;
      });
    });

    it('should process buyers in batches', async () => {
      const result = await matchPropertyToBuyersEfficient('prop1');
      
      expect(result.matchedBuyers).toBe(1);
      expect(result.totalBuyers).toBe(1);
    });

    it('should throw error for non-existent property', async () => {
      (mockFirestore.collection as jest.Mock).mockImplementation(() => ({
        doc: jest.fn(() => ({
          get: jest.fn().mockResolvedValue({
            exists: false
          })
        }))
      }));
      
      await expect(matchPropertyToBuyersEfficient('invalid'))
        .rejects.toThrow('Property not found');
    });
  });

  describe('recalculateAllMatchesEfficient', () => {
    const mockFirestore = admin.firestore() as jest.MockedObject<admin.firestore.Firestore>;
    
    beforeEach(() => {
      const mockBatch = {
        update: jest.fn(),
        set: jest.fn(),
        commit: jest.fn().mockResolvedValue(undefined)
      };
      
      (mockFirestore.batch as jest.Mock).mockReturnValue(mockBatch);
      
      (mockFirestore.collection as jest.Mock).mockImplementation((collection: string) => {
        if (collection === 'property_buyer_matches') {
          return {
            where: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            get: jest.fn().mockResolvedValue({
              empty: false,
              docs: [{
                ref: { update: jest.fn() }
              }]
            }),
            doc: jest.fn(() => ({
              set: jest.fn()
            }))
          };
        }
        if (collection === 'properties') {
          return {
            where: jest.fn().mockReturnThis(),
            orderBy: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            startAfter: jest.fn().mockReturnThis(),
            get: jest.fn().mockResolvedValueOnce({
              empty: false,
              docs: [{
                id: 'prop1',
                data: () => ({
                  city: 'Austin',
                  state: 'TX',
                  bedrooms: 3,
                  bathrooms: 2
                })
              }]
            }).mockResolvedValueOnce({
              empty: true,
              docs: []
            })
          };
        }
        if (collection === 'buyer_profiles') {
          return {
            where: jest.fn().mockReturnThis(),
            orderBy: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            startAfter: jest.fn().mockReturnThis(),
            get: jest.fn().mockResolvedValueOnce({
              empty: false,
              docs: [{
                id: 'buyer1',
                data: () => ({
                  preferredCity: 'Austin',
                  preferredState: 'TX',
                  searchRadius: 25
                })
              }]
            }).mockResolvedValueOnce({
              empty: true,
              docs: []
            })
          };
        }
        return mockFirestore;
      });
    });

    it('should recalculate all matches efficiently', async () => {
      const result = await recalculateAllMatchesEfficient();
      
      expect(result.totalProperties).toBeGreaterThan(0);
      expect(result.totalBuyers).toBeGreaterThan(0);
      expect(result.message).toBe('Recalculation complete');
    });
  });

  describe('getBuyerMatchesPaginated', () => {
    const mockFirestore = admin.firestore() as jest.MockedObject<admin.firestore.Firestore>;
    
    beforeEach(() => {
      (mockFirestore.collection as jest.Mock).mockImplementation(() => ({
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        startAfter: jest.fn().mockReturnThis(),
        doc: jest.fn(() => ({
          get: jest.fn().mockResolvedValue({
            exists: true
          })
        })),
        get: jest.fn().mockResolvedValue({
          docs: [
            {
              id: 'match1',
              data: () => ({
                propertyId: 'prop1',
                buyerId: 'buyer1',
                matchScore: 0.95
              })
            }
          ]
        })
      }));
    });

    it('should return paginated buyer matches', async () => {
      const result = await getBuyerMatchesPaginated('buyer1', 10);
      
      expect(result.matches).toHaveLength(1);
      expect(result.matches[0].buyerId).toBe('buyer1');
      expect(result.hasMore).toBe(false);
    });

    it('should handle pagination with startAfter', async () => {
      const result = await getBuyerMatchesPaginated('buyer1', 10, 'match1');
      
      expect(result.matches).toBeDefined();
      expect(mockFirestore.collection).toHaveBeenCalledWith('property_buyer_matches');
    });
  });
});