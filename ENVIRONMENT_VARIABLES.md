i13996 Godbold Rd # Environment Variables Documentation

## 📋 Complete Environment Variables Reference

This document lists all environment variables required for the OwnerFi platform with brand-specific webhook isolation.

---

## Required Variables

### Base Configuration

```bash
# Environment
NODE_ENV=production # or development

# Base URLs
NEXT_PUBLIC_BASE_URL=https://ownerfi.ai
VERCEL_URL=<auto-set-by-vercel>
```

### Firebase Configuration

```bash
# Firebase Admin (Server-side)
FIREBASE_SERVICE_ACCOUNT_KEY=<base64-encoded-service-account-json>
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Firebase Client (Public)
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

### External API Keys

```bash
# HeyGen API
HEYGEN_API_KEY=your_heygen_api_key

# Submagic API
SUBMAGIC_API_KEY=your_submagic_api_key

# OpenAI API
OPENAI_API_KEY=your_openai_api_key
```

### Late API (Social Media Publishing)

```bash
# Late API Key
LATE_API_KEY=your_late_api_key

# Brand-Specific Profile IDs
LATE_OWNERFI_PROFILE_ID=ownerfi_profile_id
LATE_CARZ_PROFILE_ID=carz_profile_id
LATE_PODCAST_PROFILE_ID=podcast_profile_id
```

### Cloudflare R2 Storage

```bash
# R2 Configuration
CLOUDFLARE_ACCOUNT_ID=your_account_id
R2_ACCOUNT_ID=your_account_id # Same as above
R2_ACCESS_KEY_ID=your_access_key_id
R2_SECRET_ACCESS_KEY=your_secret_access_key
R2_BUCKET_NAME=ownerfi-podcast-videos
R2_PUBLIC_URL=https://pub-<account-id>.r2.dev # Optional custom domain
```

### Webhook Secrets (Brand-Specific)

**⚠️ IMPORTANT**: These are generated when you register webhooks with HeyGen.

```bash
# HeyGen Webhook Secrets (one per brand)
HEYGEN_WEBHOOK_SECRET_CARZ=abc123... # From heygen-webhook-secrets.json
HEYGEN_WEBHOOK_SECRET_OWNERFI=def456...
HEYGEN_WEBHOOK_SECRET_PODCAST=ghi789...
```

### Authentication & Security

```bash
# Cron Job Authentication
CRON_SECRET=your_random_secret_string

# NextAuth (if using)
NEXTAUTH_SECRET=your_nextauth_secret
NEXTAUTH_URL=https://ownerfi.ai
```

### Stripe (Optional - for Realtor Platform)

```bash
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### GoHighLevel Integration (OwnerFi Only)

```bash
# GoHighLevel API (if using)
GHL_API_KEY=your_ghl_api_key
GHL_BYPASS_SIGNATURE=false # Set to true only in development
```

---

## Optional Variables

### Legacy Metricool (Backwards Compatibility)

**Note**: Metricool is being replaced by Late API. These are optional.

```bash
METRICOOL_API_KEY=your_metricool_api_key
METRICOOL_USER_ID=your_user_id
METRICOOL_CARZ_BRAND_ID=carz_brand_id
METRICOOL_OWNERFI_BRAND_ID=ownerfi_brand_id
METRICOOL_PODCAST_BRAND_ID=3738036
```

### Feature Flags

```bash
# Enable/Disable Features
ENABLE_AUTO_POSTING=true
ENABLE_VIDEO_CLEANUP=true
DISABLE_WEBHOOK_VERIFICATION=false # Only set to true in development
```

### Error Monitoring

```bash
# Slack Notifications
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...

# Discord Notifications
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...

# Sentry Error Tracking
SENTRY_DSN=https://...@sentry.io/...
```

---

## Environment-Specific Examples

### `.env.local` (Development)

```bash
NODE_ENV=development
NEXT_PUBLIC_BASE_URL=http://localhost:3000

# Firebase
FIREBASE_SERVICE_ACCOUNT_KEY=<base64-encoded-json>

# APIs
HEYGEN_API_KEY=...
SUBMAGIC_API_KEY=...
OPENAI_API_KEY=...
LATE_API_KEY=...

# Late Profile IDs
LATE_OWNERFI_PROFILE_ID=...
LATE_CARZ_PROFILE_ID=...
LATE_PODCAST_PROFILE_ID=...

# R2 Storage
CLOUDFLARE_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=ownerfi-podcast-videos

# Cron Secret
CRON_SECRET=dev_secret_123

# Development: Bypass webhook verification
DISABLE_WEBHOOK_VERIFICATION=true

# Webhook Secrets (from heygen-webhook-secrets.json)
HEYGEN_WEBHOOK_SECRET_CARZ=...
HEYGEN_WEBHOOK_SECRET_OWNERFI=...
HEYGEN_WEBHOOK_SECRET_PODCAST=...
```

### `.env.production` (Vercel)

```bash
NODE_ENV=production
NEXT_PUBLIC_BASE_URL=https://ownerfi.ai

# All the same variables as development
# But with production values and secrets

# IMPORTANT: NEVER set DISABLE_WEBHOOK_VERIFICATION=true in production
```

---

## How to Get Each Variable

### HeyGen API Key
1. Log into https://app.heygen.com
2. Go to Settings → API Keys
3. Create new API key or copy existing one

### Submagic API Key
1. Log into Submagic dashboard
2. Navigate to API settings
3. Generate API key

### Late API Credentials
1. Log into https://getlate.dev
2. Go to Settings → API
3. Copy API key
4. Get profile IDs from Settings → Profiles

### Cloudflare R2
1. Log into Cloudflare dashboard
2. Navigate to R2
3. Create bucket
4. Generate API tokens with R2 access

### HeyGen Webhook Secrets
**IMPORTANT**: These are generated automatically when you run:
```bash
node scripts/register-heygen-webhooks.mjs
```

The secrets will be saved to `heygen-webhook-secrets.json`.

---

## Setting Environment Variables

### Vercel (Production)
1. Go to your Vercel project dashboard
2. Click Settings → Environment Variables
3. Add each variable with appropriate scope (Production, Preview, Development)
4. Redeploy your application

### Local Development
1. Create `.env.local` in project root
2. Copy template above
3. Fill in your values
4. **NEVER commit `.env.local` to git**

### GitHub Actions (CI/CD)
1. Go to Repository → Settings → Secrets
2. Add secrets for GitHub Actions
3. Use in workflows with `${{ secrets.VARIABLE_NAME }}`

---

## Validation

### Check if all required variables are set:

```bash
# Start your app in development
npm run dev

# You should see:
# ✅ Environment variables validated successfully

# If you see errors:
# ❌ Environment variable validation failed:
#    HEYGEN_API_KEY: HeyGen API key is required
```

### Programmatic Check

```typescript
import { checkEnv } from '@/lib/env';

const { valid, errors } = checkEnv();

if (!valid) {
  console.error('Missing environment variables:');
  errors.forEach(error => console.error(`  - ${error}`));
}
```

---

## Security Best Practices

1. ✅ **NEVER** commit `.env.local` or `.env.production` to git
2. ✅ Add `.env.local` to `.gitignore`
3. ✅ Use different values for development and production
4. ✅ Rotate API keys regularly
5. ✅ Use environment-specific secrets in Vercel
6. ✅ Enable webhook signature verification in production
7. ✅ Store sensitive values in Vercel/GitHub secrets, not in code

---

## Troubleshooting

### "Environment variable validation failed"
- Check that all required variables are set
- Ensure there are no typos in variable names
- Verify values are properly formatted (e.g., URLs include https://)

### "Webhook verification failed"
- Ensure `HEYGEN_WEBHOOK_SECRET_*` variables are set correctly
- Check that secrets match what's registered with HeyGen
- Verify you're not bypassing verification in production

### "Firebase Admin credentials not configured"
- Ensure `FIREBASE_SERVICE_ACCOUNT_KEY` is properly base64-encoded
- Check that private key has correct newline characters (`\n`)

### "R2 credentials not configured"
- Verify all R2 variables are set
- Check that API tokens have correct permissions
- Ensure bucket name is correct

---

## Migration Guide

If you're migrating from an older version:

### Adding Webhook Secrets

1. Run webhook registration script:
   ```bash
   node scripts/register-heygen-webhooks.mjs
   ```

2. Copy output to `.env.local`:
   ```bash
   HEYGEN_WEBHOOK_SECRET_CARZ=...
   HEYGEN_WEBHOOK_SECRET_OWNERFI=...
   HEYGEN_WEBHOOK_SECRET_PODCAST=...
   ```

3. Add to Vercel environment variables

4. Redeploy application

### Switching from Metricool to Late

1. Get Late API credentials
2. Add `LATE_*` variables
3. Test with one brand first
4. Once working, remove `METRICOOL_*` variables

---

## Quick Reference

### Minimum Required for Development
```bash
HEYGEN_API_KEY
SUBMAGIC_API_KEY
OPENAI_API_KEY
LATE_API_KEY
LATE_OWNERFI_PROFILE_ID
LATE_CARZ_PROFILE_ID
LATE_PODCAST_PROFILE_ID
FIREBASE_SERVICE_ACCOUNT_KEY
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET_NAME
CRON_SECRET
```

### Additional for Production
```bash
HEYGEN_WEBHOOK_SECRET_CARZ
HEYGEN_WEBHOOK_SECRET_OWNERFI
HEYGEN_WEBHOOK_SECRET_PODCAST
NEXT_PUBLIC_BASE_URL
```

---

**Last Updated**: 2025-10-18
**Version**: 2.0 (Brand Isolation Update)
