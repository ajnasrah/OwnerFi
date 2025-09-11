# OwnerFi - Owner Financed Properties Platform

A Next.js application connecting buyers with owner-financed properties and real estate agents.

## 🚨 PRODUCTION READINESS STATUS

✅ **SECURITY FIXES COMPLETED**:
- Removed live production Stripe keys
- Generated secure NextAuth secret
- Added comprehensive input validation
- Cleaned up database inconsistencies
- Removed test files and development artifacts

✅ **DEPLOYMENT READY**:
- GitHub Actions CI/CD configured
- Vercel deployment configuration added
- Environment variables properly configured
- Production build succeeds

⚠️ **REMAINING CONSIDERATIONS**:
- Some TypeScript 'any' types still present (non-blocking)
- Consider adding comprehensive test suite
- Monitor performance in production
- Set up error tracking (Sentry recommended)

## Features

- **Buyer Profiles**: Search and match with owner-financed properties
- **Realtor Dashboard**: Purchase leads and manage client relationships  
- **Property Management**: Automated property scraping and matching
- **Payment Processing**: Stripe integration for lead purchases
- **Authentication**: Secure NextAuth.js implementation

## Tech Stack

- **Frontend**: Next.js 15, React 19, TailwindCSS
- **Backend**: Next.js API routes, Firebase Firestore
- **Authentication**: NextAuth.js with Firebase
- **Payments**: Stripe
- **Validation**: Zod schemas
- **Deployment**: Vercel via GitHub Actions

## Getting Started

### Prerequisites

- Node.js 18+
- Firebase project
- Stripe account (test mode for development)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd ownerfi
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

4. Configure your environment variables in `.env.local`:
   - Add your Firebase configuration
   - Add Stripe test keys
   - Set NEXTAUTH_SECRET to a secure random string

5. Run the development server:
```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Environment Variables

Required environment variables (see `.env.example`):

- `NEXTAUTH_URL` - Your app URL
- `NEXTAUTH_SECRET` - Secure random string for JWT signing
- `NEXT_PUBLIC_FIREBASE_*` - Firebase configuration
- `STRIPE_PUBLIC_KEY` - Stripe publishable key
- `STRIPE_SECRET_KEY` - Stripe secret key
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook endpoint secret

## Deployment

### GitHub Actions + Vercel (Configured)

1. Push to GitHub repository
2. Configure these secrets in GitHub repository settings:
   - `VERCEL_TOKEN` - Your Vercel token
   - `ORG_ID` - Your Vercel organization ID
   - `PROJECT_ID` - Your Vercel project ID
   - All environment variables listed above

3. Push to main branch triggers automatic deployment

### Manual Vercel Deployment

1. Connect repository to Vercel
2. Configure environment variables in Vercel dashboard
3. Deploy automatically on push

## License

ISC License

---

## Production Deployment Checklist

- [x] Security vulnerabilities fixed
- [x] Environment variables configured
- [x] Database properly set up
- [x] Build process works
- [x] CI/CD pipeline configured
- [ ] DNS and domain configured (post-deployment)
- [ ] SSL certificate (handled by Vercel)
- [ ] Error monitoring set up (recommended: Sentry)
- [ ] Performance monitoring (recommended: Vercel Analytics)
# Force deployment Wed Sep 10 15:14:50 CDT 2025
