/**
 * Unit Tests for Gaza Video Generator
 *
 * Tests the GazaVideoGenerator class and its methods.
 * Uses mocks for external dependencies (HeyGen API, OpenAI, Firebase).
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// Mock external dependencies
jest.mock('@/lib/api-utils', () => ({
  circuitBreakers: {
    heygen: {
      execute: jest.fn((fn) => fn()),
    },
  },
  fetchWithTimeout: jest.fn(),
  TIMEOUTS: {
    HEYGEN_API: 60000,
  },
}));

jest.mock('@/lib/brand-utils', () => ({
  getBrandWebhookUrl: jest.fn(() => 'https://test.com/api/webhooks/heygen/gaza'),
}));

jest.mock('./agent-selector', () => ({
  selectAgent: jest.fn(),
}));

jest.mock('@/config/heygen-agents', () => ({
  buildCharacterConfig: jest.fn(() => ({ type: 'avatar', avatar_id: 'test-avatar' })),
  buildVoiceConfig: jest.fn(() => ({ type: 'text', voice_id: 'test-voice', input_text: 'test' })),
  buildBackgroundConfig: jest.fn(() => ({ type: 'color', value: '#1a1a2e' })),
  getPrimaryAgentForBrand: jest.fn(),
}));

// Import after mocking
import { GazaVideoGenerator, GazaArticle, createGazaVideoGenerator } from '@/lib/gaza-video-generator';

describe('GazaVideoGenerator', () => {
  let generator: GazaVideoGenerator;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create generator with test API key
    generator = new GazaVideoGenerator('test-api-key');
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('constructor', () => {
    it('should create generator with valid API key', () => {
      expect(generator).toBeDefined();
    });

    it('should throw error without API key', () => {
      expect(() => new GazaVideoGenerator('')).toThrow('HeyGen API key is required');
    });
  });

  describe('validateScript', () => {
    // Access private method for testing
    const validateScript = (generator: any, script: string) => {
      return generator.validateScript(script);
    };

    it('should reject empty script', () => {
      const result = validateScript(generator, '');
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Script is empty');
    });

    it('should reject whitespace-only script', () => {
      const result = validateScript(generator, '   \n\t  ');
      expect(result.valid).toBe(false);
    });

    it('should reject script under 15 words', () => {
      const result = validateScript(generator, 'This is a short script.');
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('too short');
    });

    it('should reject script over 150 words', () => {
      const longScript = Array(160).fill('word').join(' ');
      const result = validateScript(generator, longScript);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('too long');
    });

    it('should reject script with undefined placeholder', () => {
      const result = validateScript(generator, 'This is a test script with undefined placeholder here making it long enough.');
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('invalid placeholders');
    });

    it('should accept valid script', () => {
      const validScript = 'Breaking news from Gaza. Civilians are in desperate need of humanitarian aid. Families are struggling to survive. The international community must act now. Your support can make a difference. Help families in Gaza. Donate through the link in bio.';
      const result = validateScript(generator, validScript);
      expect(result.valid).toBe(true);
    });
  });

  describe('createFallbackScript', () => {
    // Access private method for testing
    const createFallbackScript = (generator: any, article: GazaArticle) => {
      return generator.createFallbackScript(article);
    };

    it('should create fallback script with article title', () => {
      const article: GazaArticle = {
        id: 'test-123',
        title: 'Humanitarian Crisis in Gaza Worsens',
        content: 'Test content',
        link: 'https://test.com/article',
      };

      const script = createFallbackScript(generator, article);

      expect(script).toContain('Breaking news from Gaza');
      expect(script).toContain('Humanitarian Crisis in Gaza Worsens');
      expect(script).toContain('Donate');
    });
  });

  describe('generateCaption', () => {
    it('should generate caption with default hashtags', () => {
      const article: GazaArticle = {
        id: 'test-123',
        title: 'Test Article Title',
        content: 'Test content',
        link: 'https://test.com/article',
      };

      const caption = generator.generateCaption(article);

      expect(caption).toContain('Test Article Title');
      expect(caption).toContain('#Gaza');
      expect(caption).toContain('#Palestine');
      expect(caption).toContain('#FreePalestine');
    });

    it('should truncate long titles', () => {
      const article: GazaArticle = {
        id: 'test-123',
        title: 'This is a very long article title that exceeds one hundred characters and should be truncated properly',
        content: 'Test content',
        link: 'https://test.com/article',
      };

      const caption = generator.generateCaption(article);

      expect(caption.length).toBeLessThan(300); // Should be truncated
      expect(caption).toContain('...');
    });

    it('should use custom hashtags when provided', () => {
      const article: GazaArticle = {
        id: 'test-123',
        title: 'Test Article',
        content: 'Test content',
        link: 'https://test.com/article',
      };

      const caption = generator.generateCaption(article, ['#CustomTag', '#AnotherTag']);

      expect(caption).toContain('#CustomTag');
      expect(caption).toContain('#AnotherTag');
      expect(caption).not.toContain('#Gaza'); // Should not have default
    });
  });

  describe('validateHeyGenRequest', () => {
    // Access private method for testing
    const validateHeyGenRequest = (generator: any, request: any) => {
      return generator.validateHeyGenRequest(request);
    };

    it('should reject request without video_inputs', () => {
      const result = validateHeyGenRequest(generator, {});
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('video_inputs');
    });

    it('should reject empty video_inputs array', () => {
      const result = validateHeyGenRequest(generator, { video_inputs: [] });
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('empty');
    });

    it('should reject request without character', () => {
      const result = validateHeyGenRequest(generator, {
        video_inputs: [{ voice: { input_text: 'test', voice_id: 'test' } }],
      });
      expect(result.valid).toBe(false);
    });

    it('should reject request without voice input', () => {
      const result = validateHeyGenRequest(generator, {
        video_inputs: [{
          character: { avatar_id: 'test' },
          voice: { voice_id: 'test' },
        }],
      });
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('input_text');
    });

    it('should accept valid request', () => {
      const result = validateHeyGenRequest(generator, {
        video_inputs: [{
          character: { avatar_id: 'test-avatar' },
          voice: { voice_id: 'test-voice', input_text: 'Test script content' },
        }],
      });
      expect(result.valid).toBe(true);
    });
  });
});

describe('createGazaVideoGenerator', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should throw error if HEYGEN_API_KEY not set', () => {
    delete process.env.HEYGEN_API_KEY;

    expect(() => {
      // Need to re-import to test env check
      const { createGazaVideoGenerator: create } = require('@/lib/gaza-video-generator');
      create();
    }).toThrow('HEYGEN_API_KEY');
  });
});
