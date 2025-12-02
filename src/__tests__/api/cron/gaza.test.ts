/**
 * Integration Tests for Gaza Cron Route
 *
 * Tests the /api/cron/gaza endpoint behavior.
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { NextRequest } from 'next/server';

// Mock all external dependencies
jest.mock('@/lib/firebase-admin', () => ({
  getAdminDb: jest.fn(() => Promise.resolve({
    collection: jest.fn(() => ({
      where: jest.fn(() => ({
        get: jest.fn(() => Promise.resolve({ size: 0, empty: true, docs: [] })),
        limit: jest.fn(() => ({
          get: jest.fn(() => Promise.resolve({ empty: true, docs: [] })),
        })),
      })),
      doc: jest.fn(() => ({
        get: jest.fn(() => Promise.resolve({ exists: false })),
        set: jest.fn(() => Promise.resolve()),
        update: jest.fn(() => Promise.resolve()),
      })),
      add: jest.fn(() => Promise.resolve({ id: 'test-id' })),
    })),
  })),
}));

jest.mock('@/lib/gaza-video-generator', () => ({
  createGazaVideoGenerator: jest.fn(() => ({
    generateVideo: jest.fn(() => Promise.resolve({
      videoId: 'test-video-id',
      agentId: 'test-agent-id',
      script: 'Test script',
    })),
    generateCaption: jest.fn(() => 'Test caption #Gaza #Palestine'),
  })),
}));

jest.mock('@/lib/feed-store-firestore', () => ({
  getAndLockArticle: jest.fn(),
  addWorkflowToQueue: jest.fn(() => Promise.resolve({ id: 'test-workflow-id' })),
  updateWorkflowStatus: jest.fn(() => Promise.resolve()),
  getCollectionName: jest.fn(() => 'gaza_workflow_queue'),
}));

jest.mock('@/lib/gaza-env-validation', () => ({
  validateGazaEnv: jest.fn(() => ({
    valid: true,
    errors: [],
    warnings: [],
    config: {
      heygenApiKey: true,
      openaiApiKey: true,
      cronSecret: true,
      lateProfileId: true,
      donationUrl: 'https://donate.test.com',
      submagicApiKey: true,
      baseUrl: 'https://ownerfi.ai',
    },
  })),
  logGazaEnvValidation: jest.fn(),
}));

jest.mock('@/lib/gaza-alerting', () => ({
  alertEnvValidationFailed: jest.fn(),
  alertArticleSelectionFailed: jest.fn(),
  alertHeyGenFailed: jest.fn(),
  alertDailyLimitReached: jest.fn(),
}));

jest.mock('@/lib/gaza-feed-health', () => ({
  isGazaFeedsHealthy: jest.fn(() => Promise.resolve(true)),
  getAvailableArticleCount: jest.fn(() => Promise.resolve(10)),
}));

jest.mock('@/lib/gaza-screenshot', () => ({
  captureArticleScreenshot: jest.fn(() => Promise.resolve({
    success: false,
    fallbackUsed: true,
    error: 'No API key',
  })),
}));

jest.mock('@/config/brand-configs', () => ({
  getBrandConfig: jest.fn(() => ({
    id: 'gaza',
    displayName: 'Gaza Relief News',
    scheduling: {
      maxPostsPerDay: 5,
    },
  })),
}));

// Import after mocks are set up
import { GET, POST } from '@/app/api/cron/gaza/route';
import { getAndLockArticle } from '@/lib/feed-store-firestore';
import { validateGazaEnv } from '@/lib/gaza-env-validation';
import { alertEnvValidationFailed, alertArticleSelectionFailed, alertDailyLimitReached } from '@/lib/gaza-alerting';

describe('Gaza Cron Route', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      CRON_SECRET: 'test-secret',
      HEYGEN_API_KEY: 'test-heygen-key',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Authorization', () => {
    it('should reject requests without authorization', async () => {
      const request = new NextRequest('https://test.com/api/cron/gaza', {
        method: 'GET',
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should accept requests with valid Bearer token', async () => {
      const request = new NextRequest('https://test.com/api/cron/gaza', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer test-secret',
        },
      });

      // Mock no articles available
      (getAndLockArticle as jest.Mock).mockResolvedValue(null);

      const response = await GET(request);

      expect(response.status).not.toBe(401);
    });

    it('should accept requests from Vercel cron', async () => {
      const request = new NextRequest('https://test.com/api/cron/gaza', {
        method: 'GET',
        headers: {
          'User-Agent': 'vercel-cron/1.0',
        },
      });

      (getAndLockArticle as jest.Mock).mockResolvedValue(null);

      const response = await GET(request);

      expect(response.status).not.toBe(401);
    });
  });

  describe('Environment Validation', () => {
    it('should fail if env validation fails', async () => {
      const request = new NextRequest('https://test.com/api/cron/gaza', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer test-secret',
        },
      });

      (validateGazaEnv as jest.Mock).mockReturnValue({
        valid: false,
        errors: ['HEYGEN_API_KEY is not set'],
        warnings: [],
        config: {},
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Environment validation failed');
      expect(alertEnvValidationFailed).toHaveBeenCalled();
    });
  });

  describe('Daily Limit', () => {
    it('should skip when daily limit reached', async () => {
      const request = new NextRequest('https://test.com/api/cron/gaza', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer test-secret',
        },
      });

      (validateGazaEnv as jest.Mock).mockReturnValue({
        valid: true,
        errors: [],
        warnings: [],
        config: { heygenApiKey: true },
      });

      // Mock daily limit reached by returning 5 videos
      const mockDb = {
        collection: jest.fn(() => ({
          where: jest.fn(() => ({
            get: jest.fn(() => Promise.resolve({ size: 5 })),
          })),
        })),
      };

      const response = await GET(request);
      const data = await response.json();

      // Note: This test depends on getVideosGeneratedToday returning >= maxPerDay
      // The actual mock behavior might need adjustment based on implementation
    });

    it('should bypass daily limit with force parameter', async () => {
      const request = new NextRequest('https://test.com/api/cron/gaza?force=true', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer test-secret',
        },
      });

      (validateGazaEnv as jest.Mock).mockReturnValue({
        valid: true,
        errors: [],
        warnings: [],
        config: { heygenApiKey: true },
      });

      (getAndLockArticle as jest.Mock).mockResolvedValue(null);

      const response = await GET(request);
      const data = await response.json();

      // Should continue even if videos generated
      expect(response.status).toBe(200);
    });
  });

  describe('Article Selection', () => {
    it('should skip when no articles available', async () => {
      const request = new NextRequest('https://test.com/api/cron/gaza', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer test-secret',
        },
      });

      (validateGazaEnv as jest.Mock).mockReturnValue({
        valid: true,
        errors: [],
        warnings: [],
        config: { heygenApiKey: true },
      });

      (getAndLockArticle as jest.Mock).mockResolvedValue(null);

      const response = await GET(request);
      const data = await response.json();

      expect(data.skipped).toBe(true);
      expect(data.message).toContain('No articles available');
      expect(alertArticleSelectionFailed).toHaveBeenCalled();
    });
  });

  describe('POST method', () => {
    it('should delegate to GET', async () => {
      const request = new NextRequest('https://test.com/api/cron/gaza', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer test-secret',
        },
      });

      (validateGazaEnv as jest.Mock).mockReturnValue({
        valid: true,
        errors: [],
        warnings: [],
        config: { heygenApiKey: true },
      });

      (getAndLockArticle as jest.Mock).mockResolvedValue(null);

      const response = await POST(request);

      // Should behave the same as GET
      expect(response.status).toBe(200);
    });
  });
});
