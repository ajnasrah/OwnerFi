/**
 * Unit Tests for Gaza Environment Validation
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  validateGazaEnv,
  checkGazaCriticalEnv,
  GazaEnvValidationResult,
} from '@/lib/gaza-env-validation';

describe('Gaza Environment Validation', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment before each test
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('validateGazaEnv', () => {
    it('should return valid when all critical vars are set', () => {
      process.env.HEYGEN_API_KEY = 'test-heygen-key';
      process.env.CRON_SECRET = 'test-cron-secret';
      process.env.SUBMAGIC_API_KEY = 'test-submagic-key';
      process.env.LATE_GAZA_PROFILE_ID = 'test-profile-id';
      process.env.OPENAI_API_KEY = 'test-openai-key';
      process.env.GAZA_DONATION_URL = 'https://donate.test.com';
      process.env.NEXT_PUBLIC_BASE_URL = 'https://ownerfi.ai';

      const result = validateGazaEnv();

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should return errors for missing critical vars', () => {
      // Clear all Gaza-related env vars
      delete process.env.HEYGEN_API_KEY;
      delete process.env.CRON_SECRET;
      delete process.env.SUBMAGIC_API_KEY;
      delete process.env.LATE_GAZA_PROFILE_ID;

      const result = validateGazaEnv();

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.includes('HEYGEN_API_KEY'))).toBe(true);
      expect(result.errors.some(e => e.includes('CRON_SECRET'))).toBe(true);
      expect(result.errors.some(e => e.includes('SUBMAGIC_API_KEY'))).toBe(true);
      expect(result.errors.some(e => e.includes('LATE_GAZA_PROFILE_ID'))).toBe(true);
    });

    it('should return warnings for missing optional vars', () => {
      // Set required vars
      process.env.HEYGEN_API_KEY = 'test-heygen-key';
      process.env.CRON_SECRET = 'test-cron-secret';
      process.env.SUBMAGIC_API_KEY = 'test-submagic-key';
      process.env.LATE_GAZA_PROFILE_ID = 'test-profile-id';

      // Clear optional vars
      delete process.env.OPENAI_API_KEY;
      delete process.env.GAZA_DONATION_URL;
      delete process.env.NEXT_PUBLIC_BASE_URL;

      const result = validateGazaEnv();

      expect(result.valid).toBe(true); // Should still be valid
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.includes('OPENAI_API_KEY'))).toBe(true);
      expect(result.warnings.some(w => w.includes('GAZA_DONATION_URL'))).toBe(true);
    });

    it('should return config status correctly', () => {
      process.env.HEYGEN_API_KEY = 'test-key';
      process.env.LATE_GAZA_PROFILE_ID = '';
      process.env.GAZA_DONATION_URL = 'https://donate.test.com';

      const result = validateGazaEnv();

      expect(result.config.heygenApiKey).toBe(true);
      expect(result.config.lateProfileId).toBe(false); // Empty string is falsy
      expect(result.config.donationUrl).toBe('https://donate.test.com');
    });
  });

  describe('checkGazaCriticalEnv', () => {
    it('should return valid when all critical vars set', () => {
      process.env.HEYGEN_API_KEY = 'test';
      process.env.LATE_GAZA_PROFILE_ID = 'test';
      process.env.SUBMAGIC_API_KEY = 'test';

      const result = checkGazaCriticalEnv();

      expect(result.valid).toBe(true);
      expect(result.missing).toHaveLength(0);
    });

    it('should return missing vars list', () => {
      delete process.env.HEYGEN_API_KEY;
      delete process.env.LATE_GAZA_PROFILE_ID;
      process.env.SUBMAGIC_API_KEY = 'test';

      const result = checkGazaCriticalEnv();

      expect(result.valid).toBe(false);
      expect(result.missing).toContain('HEYGEN_API_KEY');
      expect(result.missing).toContain('LATE_GAZA_PROFILE_ID');
      expect(result.missing).not.toContain('SUBMAGIC_API_KEY');
    });
  });
});
