/**
 * Gaza System Environment Validation
 *
 * Validates all required environment variables at startup
 * and provides clear error messages for missing configuration.
 */

export interface GazaEnvValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  config: {
    heygenApiKey: boolean;
    openaiApiKey: boolean;
    cronSecret: boolean;
    lateProfileId: boolean;
    donationUrl: string | null;
    submagicApiKey: boolean;
    baseUrl: string;
  };
}

/**
 * Validate all Gaza system environment variables
 * Call this at the start of Gaza cron jobs to fail fast
 */
export function validateGazaEnv(): GazaEnvValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Critical - will cause immediate failure
  const heygenApiKey = !!process.env.HEYGEN_API_KEY;
  if (!heygenApiKey) {
    errors.push('HEYGEN_API_KEY is not set - video generation will fail');
  }

  const cronSecret = !!process.env.CRON_SECRET;
  if (!cronSecret) {
    errors.push('CRON_SECRET is not set - cron authentication will fail');
  }

  const submagicApiKey = !!process.env.SUBMAGIC_API_KEY;
  if (!submagicApiKey) {
    errors.push('SUBMAGIC_API_KEY is not set - caption generation will fail');
  }

  // Important - will cause social posting to fail
  const lateProfileId = !!process.env.LATE_GAZA_PROFILE_ID;
  if (!lateProfileId) {
    errors.push('LATE_GAZA_PROFILE_ID is not set - videos will NOT be posted to social media');
  }

  // Warning - will use fallbacks
  const openaiApiKey = !!process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    warnings.push('OPENAI_API_KEY is not set - will use fallback scripts (lower quality)');
  }

  const donationUrl = process.env.GAZA_DONATION_URL || null;
  if (!donationUrl) {
    warnings.push('GAZA_DONATION_URL is not set - CTAs will say "link in bio" instead of donation link');
  }

  // Base URL (has fallback but should be set)
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'https://ownerfi.ai';

  if (!process.env.NEXT_PUBLIC_BASE_URL) {
    warnings.push(`NEXT_PUBLIC_BASE_URL not set - using fallback: ${baseUrl}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    config: {
      heygenApiKey,
      openaiApiKey,
      cronSecret,
      lateProfileId,
      donationUrl,
      submagicApiKey,
      baseUrl,
    },
  };
}

/**
 * Log validation results with formatted output
 */
export function logGazaEnvValidation(result: GazaEnvValidationResult): void {
  console.log('\n🔍 Gaza System Environment Validation');
  console.log('='.repeat(50));

  // Log configuration status
  console.log('📋 Configuration Status:');
  console.log(`   HEYGEN_API_KEY:       ${result.config.heygenApiKey ? '✅ Set' : '❌ MISSING'}`);
  console.log(`   OPENAI_API_KEY:       ${result.config.openaiApiKey ? '✅ Set' : '⚠️  Not set (fallback)'}`);
  console.log(`   CRON_SECRET:          ${result.config.cronSecret ? '✅ Set' : '❌ MISSING'}`);
  console.log(`   LATE_GAZA_PROFILE_ID: ${result.config.lateProfileId ? '✅ Set' : '❌ MISSING'}`);
  console.log(`   GAZA_DONATION_URL:    ${result.config.donationUrl ? '✅ Set' : '⚠️  Not set (fallback)'}`);
  console.log(`   SUBMAGIC_API_KEY:     ${result.config.submagicApiKey ? '✅ Set' : '❌ MISSING'}`);
  console.log(`   BASE_URL:             ${result.config.baseUrl}`);

  // Log errors
  if (result.errors.length > 0) {
    console.log('\n❌ ERRORS (will cause failures):');
    result.errors.forEach(err => console.log(`   • ${err}`));
  }

  // Log warnings
  if (result.warnings.length > 0) {
    console.log('\n⚠️  WARNINGS (using fallbacks):');
    result.warnings.forEach(warn => console.log(`   • ${warn}`));
  }

  // Final status
  if (result.valid) {
    console.log('\n✅ Gaza system validation PASSED');
  } else {
    console.log('\n❌ Gaza system validation FAILED - fix errors before continuing');
  }

  console.log('='.repeat(50) + '\n');
}

/**
 * Validate and throw if invalid (for use in cron jobs)
 */
export function requireValidGazaEnv(): GazaEnvValidationResult {
  const result = validateGazaEnv();
  logGazaEnvValidation(result);

  if (!result.valid) {
    throw new Error(`Gaza system configuration invalid: ${result.errors.join('; ')}`);
  }

  return result;
}

/**
 * Quick check for specific env vars (for use in generators)
 */
export function checkGazaCriticalEnv(): { valid: boolean; missing: string[] } {
  const missing: string[] = [];

  if (!process.env.HEYGEN_API_KEY) missing.push('HEYGEN_API_KEY');
  if (!process.env.LATE_GAZA_PROFILE_ID) missing.push('LATE_GAZA_PROFILE_ID');
  if (!process.env.SUBMAGIC_API_KEY) missing.push('SUBMAGIC_API_KEY');

  return {
    valid: missing.length === 0,
    missing,
  };
}
