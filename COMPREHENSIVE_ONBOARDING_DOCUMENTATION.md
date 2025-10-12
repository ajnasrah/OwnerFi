# OwnerFi Next.js Application - Comprehensive Deep Scan & Onboarding Documentation

## Executive Summary

OwnerFi is a Next.js 15.5.2 application built with React 19.1.0 and TypeScript that connects home buyers with owner-financed properties. The platform operates as a two-sided marketplace where buyers can browse properties for free, and real estate agents can purchase qualified leads through a credit-based system.

**Technology Stack:**
- **Framework:** Next.js 15.5.2 (App Router)
- **Runtime:** React 19.1.0
- **Language:** TypeScript 5.x
- **Database:** Firebase Firestore
- **Authentication:** NextAuth.js 4.24.11
- **Payments:** Stripe 18.5.0
- **AI:** OpenAI API (GPT-4)
- **Styling:** Tailwind CSS 4.x
- **Animation:** Framer Motion 12.x

---

## 1. Application Architecture Overview

### 1.1 Project Structure

```
/Users/abdullahabunasrah/Desktop/ownerfi/
├── src/
│   ├── app/                          # Next.js 13+ App Router pages
│   │   ├── layout.tsx               # Root layout with providers
│   │   ├── page.tsx                 # Homepage
│   │   ├── api/                     # API routes (52 endpoints)
│   │   ├── dashboard/               # Buyer dashboard
│   │   ├── realtor-dashboard/       # Realtor dashboard
│   │   ├── admin/                   # Admin dashboard
│   │   ├── auth/                    # Authentication pages
│   │   ├── [location]/              # Dynamic location pages
│   │   └── [state-pages]/           # 50 state-specific pages
│   ├── components/                  # Reusable components
│   │   ├── ui/                      # UI components (15 files)
│   │   ├── dashboard/               # Dashboard components
│   │   └── SEO/                     # SEO components (9 files)
│   ├── lib/                         # Utilities & business logic (33 files)
│   │   ├── firebase.ts              # Client Firebase setup
│   │   ├── firebase-admin.ts        # Server Firebase setup
│   │   ├── firebase-models.ts       # Data models (SSOT)
│   │   ├── auth.ts                  # NextAuth configuration
│   │   └── [other utilities]
│   └── types/                       # TypeScript type definitions
├── public/                          # Static assets
├── scripts/                         # Python/Node scripts (32 files)
├── next.config.js                   # Next.js configuration
├── tsconfig.json                    # TypeScript configuration
├── tailwind.config.js               # Tailwind CSS configuration
└── package.json                     # Dependencies
```

### 1.2 Key Design Patterns

1. **Server Components by Default** - Most pages are server components for SEO
2. **Client Components for Interactivity** - 'use client' directive for interactive features
3. **API Routes as Backend** - All business logic in /api routes
4. **Firestore as Database** - NoSQL document database
5. **Role-Based Access Control** - Buyer, Realtor, Admin roles
6. **Credit-Based Lead System** - Realtors purchase leads with credits

---

## 2. Page Components Documentation

### 2.1 Public Pages (88 total pages)

#### Homepage (`/src/app/page.tsx`)
- **Purpose:** Main landing page with SEO optimization
- **Type:** Server Component
- **Features:**
  - Structured data (Organization, Website, Service schemas)
  - Hero section with CTAs
  - Trust signals (500+ properties, 50 states)
  - Benefits of owner financing
  - State and city navigation
  - Links to featured states (TX, FL, GA)
- **Data Fetching:** Server-side session check via NextAuth
- **SEO:** Full metadata, Open Graph, Twitter cards

#### State-Specific Pages (50 pages)
**Examples:**
- `/src/app/owner-financing-texas/page.tsx`
- `/src/app/owner-financing-florida/page.tsx`
- `/src/app/owner-financing-california/page.tsx`

**Pattern:** Each state page follows identical structure:
- Server component for SEO
- Dynamic metadata generation
- Breadcrumb schema
- Local market statistics
- City listings within state
- FAQ section
- Internal linking to cities

#### City-Specific Pages (10 major cities)
**Examples:**
- `/src/app/houston-owner-financing/page.tsx`
- `/src/app/los-angeles-owner-financing/page.tsx`
- `/src/app/chicago-owner-financing/page.tsx`

**Features:**
- City-specific SEO optimization
- Local market data
- Neighborhood information
- Property statistics

#### Dynamic Location Page (`/src/app/[location]/page.tsx`)
- **Purpose:** Catch-all for any city/state searches
- **Type:** Server Component with dynamic routes
- **Features:**
  - Auto-generates metadata based on location
  - Breadcrumb navigation
  - Property search integration
  - Falls back to 404 for invalid locations

### 2.2 Authentication Pages

#### Sign In (`/src/app/auth/signin/page.tsx`)
- NextAuth credentials provider
- Email/password authentication
- Redirect based on user role

#### Sign Up (`/src/app/signup/page.tsx`)
- Buyer registration flow
- Creates user + buyer profile
- Redirects to dashboard/setup

#### Realtor Sign Up (`/src/app/realtor-signup/page.tsx`)
- Separate realtor registration
- Additional fields: license, brokerage, service areas
- Creates user + realtor profile

#### Password Reset Flow
- `/src/app/auth/forgot-password/page.tsx` - Request reset
- `/src/app/auth/reset-password/page.tsx` - Set new password

### 2.3 Buyer Dashboard

#### Main Dashboard (`/src/app/dashboard/page.tsx`)
- **Type:** Client Component ('use client')
- **Features:**
  - Tinder-style property swiping UI
  - Touch gestures for mobile
  - Property matching based on budget/location
  - Like/pass functionality
  - Real-time property updates
  - Tutorial overlay for new users
- **Data Sources:**
  - `/api/buyer/profile` - User preferences
  - `/api/buyer/properties` - Matched properties
  - `/api/buyer/like-property` - Like/unlike actions

#### Setup Page (`/src/app/dashboard/setup/page.tsx`)
- First-time buyer onboarding
- Collects search criteria:
  - Location (city, state, radius)
  - Budget (monthly payment, down payment)
  - Property requirements (beds, baths, sqft)

#### Settings (`/src/app/dashboard/settings/page.tsx`)
- Update search preferences
- Account settings
- Notification preferences

#### Liked Properties (`/src/app/dashboard/liked/page.tsx`)
- View all liked properties
- Contact realtors
- Remove from favorites

### 2.4 Realtor Dashboard

#### Main Dashboard (`/src/app/realtor-dashboard/page.tsx`)
- **Features:**
  - Available buyer leads by location
  - Credit balance display
  - Lead purchase functionality
  - Purchase history
  - Lead quality filtering
- **API Endpoints:**
  - `/api/realtor/dashboard` - Lead listings
  - `/api/realtor/purchase-lead` - Buy lead
  - `/api/realtor/dispute-lead` - File dispute

#### Settings (`/src/app/realtor-dashboard/settings/page.tsx`)
- Service area management
- Profile updates
- Subscription management
- Stripe billing portal integration

### 2.5 Admin Dashboard

#### Overview (`/src/app/admin/page.tsx`)
- **Type:** Client Component with extensive state management
- **Features:**
  - System statistics dashboard
  - Property management (CRUD)
  - CSV upload for bulk properties
  - Buyer management
  - Realtor management
  - Dispute resolution
  - Contact form submissions
  - System logs viewer
- **Tabs:**
  1. Overview - Stats and quick actions
  2. Properties - Full CRUD with pagination
  3. Upload - CSV import
  4. Buyers - User metrics
  5. Realtors - Credit management
  6. Disputes - Lead dispute resolution
  7. Contacts - Form submissions
  8. Logs - System activity

#### Dedicated Pages:
- `/src/app/admin/buyers/page.tsx` - Buyer list
- `/src/app/admin/realtors/page.tsx` - Realtor list
- `/src/app/admin/logs/page.tsx` - System logs
- `/src/app/admin/add-credits-manual/page.tsx` - Manual credit adjustment

### 2.6 Informational Pages

- `/src/app/how-owner-finance-works/page.tsx` - Educational content
- `/src/app/rent-to-own-homes/page.tsx` - Rent-to-own information
- `/src/app/bad-credit-home-buying/page.tsx` - Bad credit solutions
- `/src/app/no-credit-check-homes/page.tsx` - No credit check options
- `/src/app/about/page.tsx` - About company
- `/src/app/privacy/page.tsx` - Privacy policy
- `/src/app/terms/page.tsx` - Terms of service
- `/src/app/tcpa-compliance/page.tsx` - TCPA compliance

---

## 3. Component Architecture

### 3.1 UI Components (`/src/components/ui/`)

#### Core Components (15 total)

1. **Header.tsx**
   - Navigation bar
   - Auth state display
   - Mobile responsive

2. **Footer.tsx**
   - Site navigation
   - Legal links
   - Social media

3. **LegalFooter.tsx**
   - Compliance disclaimers
   - Investment warnings
   - State-specific notices

4. **Hero.tsx**
   - Landing page hero section
   - CTA buttons
   - Value proposition

5. **Card.tsx**
   - Property display card
   - Reusable card component

6. **Button.tsx**
   - Primary/secondary styles
   - Loading states
   - Disabled states

7. **Input.tsx**
   - Form input wrapper
   - Validation states
   - Error messages

8. **CityAutocomplete.tsx**
   - City search with autocomplete
   - Uses Firebase city data

9. **GoogleCityAutocomplete.tsx**
   - Google Places API integration
   - Location suggestions

10. **GooglePlacesAutocomplete.tsx**
    - Advanced Google Places integration
    - Address validation

11. **PropertySwiper.tsx**
    - Tinder-style swipe component
    - Touch gesture support
    - Animation transitions

12. **Chatbot.tsx**
    - AI chatbot interface
    - OpenAI GPT-4 integration
    - Conversation history

13. **ChatbotiPhone.tsx**
    - Mobile-optimized chatbot
    - iOS-specific styling

14. **FloatingChatbotButton.tsx**
    - Persistent chat trigger
    - Unread message indicator

15. **LegalDisclaimers.tsx**
    - Compliance text
    - Terms acceptance

**Component Props:** Most components use TypeScript interfaces for type safety. Common patterns:
```typescript
interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}
```

### 3.2 Dashboard Components

#### Tutorial.tsx (`/src/components/dashboard/Tutorial.tsx`)
- **Purpose:** Onboarding tutorial overlay
- **Features:**
  - Multi-step walkthrough
  - Interactive tooltips
  - Skip/complete tracking
  - localStorage persistence

### 3.3 SEO Components (`/src/components/SEO/`)

1. **JsonLd.tsx** - JSON-LD structured data wrapper
2. **MetaTags.tsx** - Meta tag generator
3. **BreadcrumbSchema.tsx** - Breadcrumb navigation schema
4. **OrganizationSchema.tsx** - Organization structured data
5. **PropertySchema.tsx** - Property listing schema
6. **StructuredData.tsx** - Generic schema component
7. **SEOOptimizer.tsx** - Page-level SEO optimizer
8. **InternalLinks.tsx** - Internal linking suggestions
9. **index.ts** - Exports barrel file

**Usage Example:**
```tsx
import { OrganizationSchema, BreadcrumbSchema } from '@/components/SEO';

<OrganizationSchema
  name="OwnerFi"
  url="https://ownerfi.ai"
  logo="https://ownerfi.ai/logo.png"
/>
```

---

## 4. API Routes Documentation (52 endpoints)

### 4.1 Authentication (`/src/app/api/auth/`)

#### NextAuth Route Handler
**File:** `/src/app/api/auth/[...nextauth]/route.ts`
- Handles all NextAuth operations
- Credentials provider (email/password)
- JWT session strategy
- Custom callbacks for role-based auth

#### Sign Up
**Endpoint:** `POST /api/auth/signup/route.ts`
- Creates user account
- Hashes password with bcrypt
- Generates Firestore user document
- Returns session data

#### Password Reset
- `POST /api/auth/forgot-password/route.ts` - Sends reset email
- `POST /api/auth/reset-password/route.ts` - Updates password

### 4.2 Buyer APIs (`/src/app/api/buyer/`)

#### Profile Management
**Endpoint:** `GET/PUT /api/buyer/profile/route.ts`
- Get buyer profile
- Update preferences
- Returns: `{ profile: BuyerProfile }`

#### Property Matching
**Endpoint:** `GET /api/buyer/properties/route.ts`
**Query Params:**
- `city` - Search city
- `state` - Search state
- `maxMonthlyPayment` - Budget limit
- `maxDownPayment` - Down payment limit
**Returns:**
```typescript
{
  properties: Property[],
  matches: {
    direct: Property[],
    nearby: Property[],
    liked: Property[]
  }
}
```

#### Like Property
**Endpoint:** `POST /api/buyer/like-property/route.ts`
**Body:**
```json
{
  "propertyId": "string",
  "action": "like" | "unlike"
}
```

#### Liked Properties
**Endpoint:** `GET /api/buyer/liked-properties/route.ts`
**Returns:** All properties buyer has liked

#### Nearby Properties
**Endpoint:** `GET /api/buyer/properties-nearby/route.ts`
- Finds properties within search radius
- Uses geospatial queries

### 4.3 Realtor APIs (`/src/app/api/realtor/`)

#### Dashboard
**Endpoint:** `GET /api/realtor/dashboard/route.ts`
**Returns:**
```typescript
{
  availableLeads: BuyerProfile[],
  credits: number,
  purchaseHistory: LeadPurchase[]
}
```

#### Purchase Lead
**Endpoint:** `POST /api/realtor/purchase-lead/route.ts`
**Body:**
```json
{
  "buyerId": "string"
}
```
**Process:**
1. Check realtor credits
2. Verify lead availability
3. Deduct credits
4. Mark buyer as purchased
5. Create transaction record

#### Dispute Lead
**Endpoint:** `POST /api/realtor/dispute-lead/route.ts`
**Body:**
```json
{
  "transactionId": "string",
  "reason": "no_response" | "invalid_contact" | "not_qualified",
  "explanation": "string"
}
```

#### Buyer Liked Properties
**Endpoint:** `GET /api/realtor/buyer-liked-properties/route.ts`
**Query:** `buyerId`
**Returns:** Properties a specific buyer has liked

#### Sign Up
**Endpoint:** `POST /api/realtor/signup/route.ts`
- Creates realtor account
- Trial credits (10)
- Trial period (14 days)

#### Profile
**Endpoint:** `GET/PUT /api/realtor/profile/route.ts`
- Get/update realtor profile
- Service areas management

### 4.4 Property APIs (`/src/app/api/properties/`)

#### Search
**Endpoint:** `GET /api/properties/route.ts`
**Query Params:**
- `city`, `state`, `zipCode` - Location filters
- `minPrice`, `maxPrice` - Price range
- `bedrooms`, `bathrooms` - Property specs
- `limit`, `offset` - Pagination

#### Property Details
**Endpoint:** `GET /api/properties/details/route.ts`
**Query:** `id`
**Returns:** Full property object

#### Similar Properties
**Endpoint:** `GET /api/properties/similar/route.ts`
**Query:** `propertyId`
**Algorithm:**
- Same city/state
- Similar price range (±20%)
- Similar bedrooms

#### Search with Nearby
**Endpoint:** `GET /api/properties/search-with-nearby/route.ts`
- Enhanced search with radius
- Returns direct matches + nearby

#### Optimized Search
**Endpoint:** `GET /api/properties/search-optimized/route.ts`
- Cached/optimized queries
- Better performance for large datasets

#### Sync Matches
**Endpoint:** `POST /api/properties/sync-matches/route.ts`
- Recalculates buyer-property matches
- Background job trigger

### 4.5 Admin APIs (`/src/app/api/admin/`)

#### Property Management
**Endpoint:** `GET/POST /api/admin/properties/route.ts`
- List all properties (paginated)
- Create new property
**Endpoint:** `GET/PUT/DELETE /api/admin/properties/[id]/route.ts`
- Get/update/delete specific property

#### Upload Properties
**Endpoint:** `POST /api/admin/upload-properties-v4/route.ts`
**Content-Type:** `multipart/form-data`
**Process:**
1. Parse CSV file
2. Validate required fields
3. Geocode addresses
4. Calculate financial metrics
5. Insert into Firestore
**Returns:**
```typescript
{
  success: boolean,
  summary: {
    totalRows: number,
    successfulInserts: number,
    failedRows: string[]
  }
}
```

#### Buyer Management
**Endpoint:** `GET /api/admin/buyers/route.ts`
**Returns:** All buyer profiles with stats

#### Realtor Management
**Endpoint:** `GET /api/admin/realtors/route.ts`
**Returns:** All realtor profiles with metrics

#### Add Credits (Manual)
**Endpoint:** `POST /api/admin/add-credits/route.ts`
**Body:**
```json
{
  "realtorId": "string",
  "credits": number,
  "reason": "string"
}
```

#### Disputes
**Endpoint:** `GET /api/admin/disputes/route.ts`
- Get pending disputes
**Endpoint:** `POST /api/admin/disputes/route.ts`
**Body:**
```json
{
  "disputeId": "string",
  "action": "approve" | "deny",
  "refundCredits": number
}
```

#### Contacts
**Endpoint:** `GET /api/admin/contacts/route.ts`
- Contact form submissions

#### System Health
**Endpoint:** `GET /api/admin/system-health/route.ts`
**Returns:**
```typescript
{
  status: 'healthy' | 'degraded' | 'down',
  checks: {
    firebase: boolean,
    stripe: boolean,
    openai: boolean
  }
}
```

#### Check Session
**Endpoint:** `GET /api/admin/check-session/route.ts`
- Validate admin session
- Used for auth checks

#### Clean Database
**Endpoint:** `POST /api/admin/clean-database/route.ts`
- Remove orphaned records
- Deduplicate data
- Admin maintenance

#### Activate Subscription
**Endpoint:** `POST /api/admin/activate-subscription/route.ts`
- Manually activate realtor subscription

#### Update Plan
**Endpoint:** `POST /api/admin/update-plan/route.ts`
- Change realtor plan

#### Check Credits
**Endpoint:** `POST /api/admin/check-credits/route.ts`
- Verify realtor credit balance

### 4.6 Stripe APIs (`/src/app/api/stripe/`)

#### Checkout
**Endpoint:** `POST /api/stripe/checkout/route.ts`
**Body:**
```json
{
  "priceId": "string",
  "realtorId": "string"
}
```
**Returns:** Stripe checkout session URL

#### Simple Checkout
**Endpoint:** `POST /api/stripe/simple-checkout/route.ts`
- Simplified checkout flow
- Credit packages

#### One-Time Purchase
**Endpoint:** `POST /api/stripe/one-time-purchase/route.ts`
- Non-subscription credit purchase

#### Webhook
**Endpoint:** `POST /api/stripe/webhook/route.ts`
**Events Handled:**
- `checkout.session.completed` - Process payment
- `customer.subscription.created` - New subscription
- `customer.subscription.updated` - Update subscription
- `customer.subscription.deleted` - Cancel subscription
- `invoice.payment_succeeded` - Add monthly credits
- `invoice.payment_failed` - Mark payment failed

**Security:** Webhook signature verification required

#### Billing Portal
**Endpoint:** `POST /api/stripe/billing-portal/route.ts`
- Creates Stripe customer portal session
- Returns portal URL for subscription management

#### Cancel Subscription
**Endpoint:** `POST /api/stripe/cancel-subscription/route.ts`
- Cancel realtor subscription

### 4.7 City APIs (`/src/app/api/cities/`)

#### Search
**Endpoint:** `GET /api/cities/search/route.ts`
**Query:** `q` - Search term
**Returns:** Matching cities with state

#### List
**Endpoint:** `GET /api/cities/list/route.ts`
**Query:** `state` - Filter by state
**Returns:** All cities in state

#### Coordinates
**Endpoint:** `GET /api/cities/coordinates/route.ts`
**Query:** `city`, `state`
**Returns:** `{ lat: number, lng: number }`

#### Nearby
**Endpoint:** `GET /api/cities/nearby/route.ts`
**Query:** `lat`, `lng`, `radiusMiles`
**Returns:** Cities within radius

#### Within Radius
**Endpoint:** `GET /api/cities/within-radius/route.ts`
- Similar to nearby but different algorithm

### 4.8 Chatbot API

**Endpoint:** `POST /api/chatbot/route.ts`
**Body:**
```json
{
  "message": "string",
  "conversationHistory": []
}
```
**AI Model:** GPT-4 (OpenAI)
**Context:** Owner financing knowledge base
**Returns:**
```typescript
{
  reply: string,
  conversationHistory: ChatMessage[]
}
```

### 4.9 Property Actions

**Endpoint:** `POST /api/property-actions/route.ts`
- Generic property action handler
- Future extensibility

### 4.10 Property Matching

**Endpoint:** `POST /api/property-matching/calculate/route.ts`
- Calculate match scores
- Batch matching algorithm

### 4.11 GoHighLevel Webhooks (`/src/app/api/gohighlevel/webhook/`)

#### Save Property
**Endpoint:** `POST /api/gohighlevel/webhook/save-property/route.ts`
- Receives property data from GoHighLevel CRM
- Validates and saves to Firestore

#### Delete Property
**Endpoint:** `POST /api/gohighlevel/webhook/delete-property/route.ts`
- Removes property from listings

#### List Properties
**Endpoint:** `GET /api/gohighlevel/webhook/list-properties/route.ts`
- Returns property list for sync

### 4.12 User Management

**Endpoint:** `GET/PUT/DELETE /api/users/[id]/route.ts`
- Generic user CRUD operations

---

## 5. Database Analysis

### 5.1 Firebase Setup

**Client-Side:** `/src/lib/firebase.ts`
```typescript
// Lazy initialization - only when config available
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
```

**Server-Side:** `/src/lib/firebase-admin.ts`
```typescript
// Dynamic import to avoid build-time initialization
async function initializeAdminSDK() {
  const { initializeApp, cert } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');

  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    })
  });
}
```

### 5.2 Data Models (Source of Truth: `/src/lib/firebase-models.ts`)

#### User Model
```typescript
interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: 'buyer' | 'realtor' | 'admin' | 'pending';
  password: string; // Hashed with bcrypt
  stripeCustomerId?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

#### BuyerProfile Model
```typescript
interface BuyerProfile {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;

  // Location
  preferredCity: string;
  preferredState: string;
  searchRadius: number; // miles

  // Budget
  maxMonthlyPayment: number;
  maxDownPayment: number;

  // Requirements
  minBedrooms?: number;
  minBathrooms?: number;
  minSquareFeet?: number;
  minPrice?: number;
  maxPrice?: number;

  // Preferences
  languages: string[];
  emailNotifications: boolean;
  smsNotifications: boolean;

  // System
  profileComplete: boolean;
  isActive: boolean;

  // Interactions
  matchedPropertyIds: string[];
  likedPropertyIds: string[];
  passedPropertyIds: string[];

  // Lead Selling
  isAvailableForPurchase: boolean;
  purchasedBy?: string;
  purchasedAt?: Timestamp;
  leadPrice: number;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

#### RealtorProfile Model
```typescript
interface RealtorProfile {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  licenseNumber?: string;
  licenseState?: string;
  primaryCity: string;
  primaryState: string;
  serviceRadius: number; // miles
  serviceStates: string[]; // Full names
  serviceCities: string[]; // "City, ST" format
  languages: string[];

  // Credits & Billing
  credits: number;
  isOnTrial: boolean;
  trialStartDate: Timestamp;
  trialEndDate: Timestamp;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;

  // System
  profileComplete: boolean;
  isActive: boolean;

  // Metrics
  avgResponseTimeHours?: number;
  successRate?: number;
  specializations?: string[];

  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

#### PropertyListing Model (from `/src/lib/property-schema.ts`)
```typescript
interface PropertyListing {
  id: string;
  address: string;
  city: string;
  state: string;
  zipCode?: string;

  // Property Details
  bedrooms: number;
  bathrooms: number;
  squareFeet?: number;
  lotSize?: number;
  yearBuilt?: number;
  propertyType?: string;

  // Financial
  listPrice?: number;
  monthlyPayment?: number;
  downPaymentAmount?: number;
  downPaymentPercent?: number;
  interestRate?: number;
  termYears?: number;
  balloonPayment?: number;
  balloonYears?: number;

  // Location
  latitude?: number;
  longitude?: number;

  // Media
  imageUrls?: string[];
  zillowImageUrl?: string;
  virtualTourUrl?: string;

  // Status
  status: 'active' | 'pending' | 'sold' | 'withdrawn';
  isActive: boolean;

  // Metadata
  description?: string;
  features?: string[];
  source?: 'manual' | 'csv' | 'api' | 'gohighlevel';
  externalId?: string;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

#### LeadPurchase Model
```typescript
interface LeadPurchase {
  id: string;
  realtorId: string;
  buyerId: string;
  creditsCost: number;
  purchasePrice: number;
  status: 'purchased' | 'contacted' | 'converted' | 'refunded';
  notes?: string;
  purchasedAt: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

#### LeadDispute Model
```typescript
interface LeadDispute {
  id: string;
  transactionId: string;
  realtorId: string;
  realtorName: string;
  realtorEmail: string;
  buyerName: string;
  buyerPhone?: string;
  buyerEmail?: string;
  buyerCity?: string;
  buyerState?: string;
  reason: 'no_response' | 'invalid_contact' | 'not_qualified' | 'already_working' | 'other';
  explanation: string;
  status: 'pending' | 'approved' | 'denied' | 'refunded';
  adminNotes?: string;
  refundAmount?: number;
  submittedAt: Timestamp;
  resolvedAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### 5.3 Firestore Collections

**Collection Names:** (from `firebase-models.ts`)
```typescript
const COLLECTIONS = {
  USERS: 'users',
  BUYER_PROFILES: 'buyerProfiles',
  REALTOR_PROFILES: 'realtors',
  PROPERTIES: 'properties',
  LEAD_PURCHASES: 'buyerLeadPurchases',
  LEAD_DISPUTES: 'leadDisputes',
  PROPERTY_MATCHES: 'propertyMatches',
  REALTOR_SUBSCRIPTIONS: 'realtorSubscriptions',
  TRANSACTIONS: 'transactions',
  SYSTEM_LOGS: 'systemLogs'
};
```

### 5.4 Database Operations

**Unified DB Layer:** `/src/lib/firebase-db.ts` or `/src/lib/unified-db.ts`

Common operations:
```typescript
// Create
await FirebaseDB.createDocument('properties', propertyData);

// Read
const property = await FirebaseDB.getDocument('properties', id);

// Query
const buyers = await FirebaseDB.queryDocuments('buyerProfiles', [
  { field: 'city', operator: '==', value: 'Austin' },
  { field: 'isAvailableForPurchase', operator: '==', value: true }
]);

// Update
await FirebaseDB.updateDocument('users', userId, { credits: 10 });

// Delete
await FirebaseDB.deleteDocument('properties', propertyId);
```

---

## 6. Utility Functions & Helpers

### 6.1 Core Libraries (`/src/lib/`)

1. **auth.ts** - NextAuth configuration
2. **auth-utils.ts** - Auth helper functions
3. **validation.ts** - Input validation (Zod schemas)
4. **logger.ts** - Winston logging
5. **calculations.ts** - Financial calculations
6. **property-calculations.ts** - Property-specific math
7. **matching.ts** - Property-buyer matching algorithm
8. **matching-module.ts** - Enhanced matching
9. **cities.ts** - City data management
10. **cities-service.ts** - City search/filtering
11. **cities-service-v2.ts** - Enhanced city service
12. **comprehensive-cities.ts** - Full US city database
13. **comprehensive-city-finder.ts** - Advanced city search
14. **comprehensive-us-cities.ts** - Complete city dataset
15. **google-maps-service.ts** - Google Maps API integration
16. **google-places-service.ts** - Google Places API
17. **property-schema.ts** - Property validation schemas
18. **property-system.ts** - Property business logic
19. **property-enhancement.ts** - Property data enrichment
20. **property-search-optimized.ts** - Optimized search
21. **firebase.ts** - Client Firebase init
22. **firebase-admin.ts** - Server Firebase init
23. **firebase-models.ts** - Data models (SSOT)
24. **firebase-db.ts** - Database operations
25. **firestore.ts** - Additional Firestore utilities
26. **unified-db.ts** - Unified database layer
27. **batch-operations.ts** - Batch Firestore operations
28. **database-cleanup.ts** - DB maintenance
29. **realtor-models.ts** - Realtor-specific models
30. **consolidated-lead-system.ts** - Lead management
31. **background-jobs.ts** - Async job processing
32. **system-validator.ts** - System health checks
33. **firebase-safe.ts** - Safe Firebase operations

### 6.2 Key Utility Functions

#### Financial Calculations
```typescript
// /src/lib/property-calculations.ts
function calculateMonthlyPayment(
  principal: number,
  interestRate: number,
  termYears: number
): number {
  const monthlyRate = interestRate / 100 / 12;
  const numPayments = termYears * 12;
  return (principal * monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
         (Math.pow(1 + monthlyRate, numPayments) - 1);
}

function calculateDownPayment(
  listPrice: number,
  downPaymentPercent: number
): number {
  return listPrice * (downPaymentPercent / 100);
}
```

#### Property Matching Algorithm
```typescript
// /src/lib/matching.ts
function calculateMatchScore(
  property: Property,
  buyer: BuyerProfile
): number {
  let score = 100;

  // Budget match
  if (property.monthlyPayment > buyer.maxMonthlyPayment) score -= 50;
  if (property.downPaymentAmount > buyer.maxDownPayment) score -= 50;

  // Location match
  const distance = calculateDistance(
    property.latitude, property.longitude,
    buyer.latitude, buyer.longitude
  );
  if (distance > buyer.searchRadius) score -= 30;

  // Property requirements
  if (property.bedrooms < (buyer.minBedrooms || 0)) score -= 20;
  if (property.bathrooms < (buyer.minBathrooms || 0)) score -= 10;

  return Math.max(0, score);
}
```

#### Geospatial Calculations
```typescript
// /src/lib/cities.ts
function calculateDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  // Haversine formula
  const R = 3958.8; // Earth radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}
```

#### State Normalization
```typescript
// /src/lib/firebase-models.ts
const STATE_MAPPINGS = {
  'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ',
  // ... all 50 states
};

function normalizeState(state: string): string {
  return STATE_MAPPINGS[state] || state.toUpperCase();
}
```

---

## 7. Configuration

### 7.1 Environment Variables

**Required Variables:** (from `.env.example`)
```bash
# Database
DATABASE_URL="file:./dev.db"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-nextauth-secret-here"

# GoHighLevel
GHL_API_KEY=""
GHL_LOCATION_ID=""
GHL_WEBHOOK_SECRET=""

# Stripe
STRIPE_PUBLIC_KEY="pk_test_..."
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_test_..."

# Firebase
NEXT_PUBLIC_FIREBASE_API_KEY="..."
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="..."
NEXT_PUBLIC_FIREBASE_PROJECT_ID="..."
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="..."
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="..."
NEXT_PUBLIC_FIREBASE_APP_ID="..."

# Firebase Admin (Server-side)
FIREBASE_PROJECT_ID="..."
FIREBASE_PRIVATE_KEY="..."
FIREBASE_CLIENT_EMAIL="..."

# OpenAI
OPENAI_API_KEY="sk-proj-..."

# App Settings
NODE_ENV="development"
```

### 7.2 Next.js Configuration

**File:** `/next.config.js`

**Key Features:**
- Compression enabled
- Image optimization (WebP, AVIF)
- Remote image patterns (Zillow, Google Drive, etc.)
- Security headers (CSP, X-Frame-Options, etc.)
- Webpack optimization for production
- ESLint disabled during builds
- Permanent redirects for all 50 states
- SEO-friendly URL structure

**Example Redirect:**
```javascript
{
  source: '/texas',
  destination: '/owner-financing-texas',
  permanent: true
}
```

### 7.3 TypeScript Configuration

**File:** `/tsconfig.json`

**Settings:**
- `strict: false` - **WARNING: Type safety disabled**
- `target: ES2017`
- `module: esnext`
- `moduleResolution: bundler`
- Path alias: `@/*` → `./src/*`

### 7.4 Tailwind Configuration

**File:** `/tailwind.config.js`

**Custom Theme:**
- Uses Tailwind v4
- Default theme extends
- No custom colors/utilities defined
- PostCSS integration

---

## 8. Third-Party Integrations

### 8.1 Stripe Payment Processing

**Implementation:** Multiple API routes in `/src/app/api/stripe/`

**Credit Packages:**
```typescript
const CREDIT_PACKAGES = {
  '1_credit': { credits: 1, price: 300, recurring: false },
  '4_credits': { credits: 4, price: 500, recurring: true },
  '10_credits': { credits: 10, price: 1000, recurring: true },
  '60_credits': { credits: 60, price: 3000, recurring: false },
};
```

**Subscription Flow:**
1. Realtor clicks "Buy Credits"
2. `POST /api/stripe/checkout` creates Stripe session
3. Redirects to Stripe Checkout
4. Payment processed
5. Webhook `checkout.session.completed` triggers
6. Credits added to realtor account
7. Transaction recorded

**Webhook Events:**
- `checkout.session.completed` - Initial purchase
- `invoice.payment_succeeded` - Recurring billing
- `invoice.payment_failed` - Failed payment
- `customer.subscription.deleted` - Cancellation

### 8.2 OpenAI ChatGPT Integration

**Implementation:** `/src/app/api/chatbot/route.ts`

**Configuration:**
- Model: GPT-4
- Max tokens: 80 (very concise responses)
- Temperature: 0.7
- System context: Owner financing knowledge base

**Knowledge Base Topics:**
- Owner financing types (Seller Finance, Subject-To, Contract for Deed, Lease-to-Own)
- Interest rates, balloon payments
- Platform information
- Buyer protection tips

**Usage:**
```typescript
const completion = await openai.chat.completions.create({
  model: 'gpt-4',
  messages: [
    { role: 'system', content: OWNERFI_CONTEXT },
    ...conversationHistory,
    { role: 'user', content: message }
  ],
  max_tokens: 80,
  temperature: 0.7,
});
```

### 8.3 Google Maps & Places API

**Files:**
- `/src/lib/google-maps-service.ts`
- `/src/lib/google-places-service.ts`
- `/src/components/ui/GoogleCityAutocomplete.tsx`
- `/src/components/ui/GooglePlacesAutocomplete.tsx`

**Features:**
- Address autocomplete
- Geocoding
- Reverse geocoding
- Place details
- City suggestions

**Initialization:** Loaded dynamically in root layout
```javascript
// In layout.tsx head section
<script src="https://maps.googleapis.com/maps/api/js?key={API_KEY}&libraries=places&callback=initGoogleMaps" />
```

### 8.4 GoHighLevel CRM Integration

**Webhooks:** `/src/app/api/gohighlevel/webhook/`

**Endpoints:**
- `POST /save-property` - Receive new listings
- `POST /delete-property` - Remove listings
- `GET /list-properties` - Sync properties

**Security:** Webhook secret verification

**Use Case:** CRM sends property data to platform automatically

### 8.5 Firebase Services

**Used Services:**
1. **Firestore** - Primary database
2. **Authentication** - (Currently using NextAuth instead)
3. **Storage** - File uploads (images, documents)

**Security Rules:**
- `/firestore.rules` - Database security
- `/storage.rules` - File storage security

---

## 9. CRITICAL ISSUES & TECHNICAL DEBT

### 9.1 CRITICAL SEVERITY Issues

#### 1. **TypeScript Strict Mode Disabled**
**Location:** `/tsconfig.json:5`
```json
{
  "compilerOptions": {
    "strict": false  // ⚠️ CRITICAL SECURITY/QUALITY ISSUE
  }
}
```
**Impact:**
- No type checking at compile time
- Runtime errors not caught
- Developer experience degraded
- Maintenance nightmare

**Recommendation:** Enable `strict: true` and fix type errors incrementally

---

#### 2. **Hardcoded Secrets Risk**
**Files Found:** 9 files reference environment variables directly
**Potential Issue:** No validation if secrets exist before use

**Example from `/src/app/api/stripe/webhook/route.ts`:**
```typescript
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-08-27.basil',
});
```
**Issue:** Non-null assertion (`!`) without validation

**Recommendation:**
```typescript
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not configured');
}
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {...});
```

---

#### 3. **No Error Boundaries**
**Issue:** No React Error Boundaries implemented
**Impact:** Single component error crashes entire app

**Recommendation:** Add error boundaries to:
- Root layout
- Dashboard pages
- Admin panel
- Each major section

**Example:**
```tsx
class ErrorBoundary extends React.Component {
  componentDidCatch(error, errorInfo) {
    // Log to monitoring service
  }
  render() {
    if (this.state.hasError) {
      return <ErrorFallback />;
    }
    return this.props.children;
  }
}
```

---

#### 4. **Missing Input Validation**
**Location:** Multiple API routes
**Example:** `/src/app/api/buyer/properties/route.ts`
```typescript
// No validation on query params
const city = searchParams.get('city');
const maxMonthlyPayment = parseFloat(searchParams.get('maxMonthlyPayment') || '0');
```

**Recommendation:** Use Zod for validation:
```typescript
import { z } from 'zod';

const querySchema = z.object({
  city: z.string().min(1),
  maxMonthlyPayment: z.number().positive(),
  maxDownPayment: z.number().positive()
});

const params = querySchema.parse({
  city: searchParams.get('city'),
  maxMonthlyPayment: parseFloat(searchParams.get('maxMonthlyPayment')),
  // ...
});
```

---

#### 5. **No Rate Limiting**
**Issue:** API routes have no rate limiting
**Impact:** Vulnerable to:
- DDoS attacks
- Brute force attempts
- Resource exhaustion
- OpenAI/Stripe API cost explosion

**Critical Endpoints:**
- `/api/auth/signin` - Brute force risk
- `/api/chatbot` - OpenAI cost risk
- `/api/stripe/*` - Financial risk
- `/api/buyer/properties` - Performance risk

**Recommendation:** Implement rate limiting middleware:
```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
```

---

### 9.2 HIGH SEVERITY Issues

#### 6. **Excessive Console Logs**
**Found:** 43 console.log/error/warn statements across 27 files
**Issue:**
- Production logs expose sensitive data
- Performance impact
- No structured logging
- Debugging left in production code

**Files with most logs:**
- `/src/app/admin/page.tsx` - 6 occurrences
- `/src/app/api/admin/*` - Multiple files
- Property search pages - 1 per file

**Recommendation:**
1. Remove all `console.log` statements
2. Use Winston logger (`/src/lib/logger.ts`) consistently
3. Configure log levels by environment
4. Implement log rotation

---

#### 7. **Missing Error Handling**
**Pattern:** Empty catch blocks throughout codebase

**Example from `/src/app/api/stripe/webhook/route.ts`:**
```typescript
try {
  await handleCheckoutCompleted(session);
} catch {
  // Silent failure - no logging or error handling
}
```

**Impact:**
- Silent failures
- No error monitoring
- Difficult debugging
- Lost Stripe webhooks

**Recommendation:**
```typescript
try {
  await handleCheckoutCompleted(session);
} catch (error) {
  logger.error('Stripe webhook error', { error, session });
  // Optionally re-throw or return error response
}
```

---

#### 8. **Inconsistent Authentication Checks**
**Issue:** Some routes check auth, others don't

**Examples:**
- ✅ `/src/app/dashboard/page.tsx` - Checks session
- ❌ `/src/app/api/buyer/properties/route.ts` - No auth check
- ❌ `/src/app/api/properties/route.ts` - Public but should validate

**Recommendation:**
1. Create auth middleware
2. Apply to all protected routes
3. Use role-based guards
4. Centralize auth logic

**Middleware Example:**
```typescript
export async function requireAuth(request: NextRequest, role?: string) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return new NextResponse('Unauthorized', { status: 401 });
  }
  if (role && session.user.role !== role) {
    return new NextResponse('Forbidden', { status: 403 });
  }
  return session;
}
```

---

#### 9. **No Database Indexes Documented**
**File:** `/firestore.indexes.json` exists but only has 1 basic index

**Missing Critical Indexes:**
- `realtorData.stripeSubscriptionId` (used in webhook queries)
- `buyerProfiles.city` + `buyerProfiles.isAvailableForPurchase`
- `properties.city` + `properties.state` + `properties.isActive`
- `properties.latitude` + `properties.longitude` (geoqueries)

**Impact:**
- Slow queries
- High Firestore costs
- Timeout errors
- Poor user experience

**Recommendation:** Create composite indexes for common queries

---

#### 10. **Duplicate Code & Logic**
**Examples:**

1. **City Services:** 3 separate implementations
   - `cities-service.ts`
   - `cities-service-v2.ts`
   - `comprehensive-city-finder.ts`

2. **Database Operations:** Multiple DB layers
   - `firebase-db.ts`
   - `firestore.ts`
   - `unified-db.ts`

3. **State Pages:** 50 nearly identical page files
   - `/src/app/owner-financing-texas/page.tsx`
   - `/src/app/owner-financing-florida/page.tsx`
   - etc.

**Recommendation:**
1. Consolidate city services into one
2. Use single database layer
3. Generate state pages dynamically from single template

---

### 9.3 MEDIUM SEVERITY Issues

#### 11. **Missing Tests**
**Found:** ZERO test files in codebase
**Impact:**
- No confidence in refactoring
- Regression bugs
- Difficult onboarding
- Manual testing overhead

**Recommendation:** Add tests for:
1. API routes (unit tests)
2. Utility functions (unit tests)
3. Components (integration tests)
4. Critical user flows (E2E tests)

**Framework Suggestion:** Jest + React Testing Library + Playwright

---

#### 12. **Outdated Dependencies**
**Potential Issues:**
- Next.js 15.5.2 - Very new, may have bugs
- React 19.1.0 - Very new, breaking changes
- Stripe API version `2025-08-27.basil` - Non-standard

**Recommendation:**
- Review compatibility
- Test thoroughly
- Pin versions
- Set up Dependabot

---

#### 13. **No API Documentation**
**Issue:** 52 API endpoints with no OpenAPI/Swagger docs
**Impact:**
- Poor developer experience
- Integration difficulties
- Maintenance challenges

**Recommendation:** Generate OpenAPI spec

---

#### 14. **SEO Duplication**
**Issue:** 88 pages with similar SEO content
**Example:** All state pages have nearly identical:
- Meta descriptions
- H1 tags
- Content structure
- Schema markup

**Risk:** Google may see as duplicate content

**Recommendation:**
1. Unique content per page
2. Vary meta descriptions
3. Add city-specific statistics
4. Use canonical tags

---

#### 15. **Accessibility Issues**
**Found Issues:**
1. Missing ARIA labels on interactive elements
2. No keyboard navigation testing
3. Color contrast not validated
4. Focus management in modals unclear
5. Screen reader support untested

**Examples:**
- `/src/app/dashboard/page.tsx:1` - Swipe gestures only (no keyboard alternative)
- `/src/app/admin/page.tsx:1` - Complex table with no ARIA grid

**Recommendation:**
- Run axe DevTools audit
- Add ARIA attributes
- Test with screen readers
- Implement keyboard navigation
- Use semantic HTML

---

#### 16. **Performance Issues**

1. **Large Bundle Size**
   - Next.js build output not analyzed
   - No bundle size monitoring
   - Potential for code splitting improvements

2. **Unoptimized Images**
   - External images (Zillow, Google Drive) not cached
   - No lazy loading on property lists
   - Missing `priority` on above-fold images

3. **API Over-fetching**
   - `/api/buyer/properties` returns full property objects
   - `/api/admin/properties` loads all properties at once
   - No pagination on some endpoints

**Recommendation:**
- Implement virtual scrolling for property lists
- Add image lazy loading
- Use Next.js Image component everywhere
- Implement cursor-based pagination
- Add Redis caching layer

---

#### 17. **Security Headers**
**Status:** Partially implemented in `next.config.js`

**Issues:**
1. CSP policy allows `unsafe-inline` and `unsafe-eval`
2. No Permissions-Policy header
3. No HSTS header
4. No X-XSS-Protection header

**Current CSP:**
```javascript
value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' ..."
```

**Recommendation:** Tighten CSP:
```javascript
value: "default-src 'self'; script-src 'self' 'nonce-{random}'; ..."
```

---

#### 18. **Environment-Specific Issues**

1. **`.env.local` Committed** - Contains actual secrets (should be in `.gitignore`)
2. **No `.env.production` template**
3. **No environment validation on startup**

**Recommendation:**
```typescript
// /src/lib/env-validation.ts
const envSchema = z.object({
  STRIPE_SECRET_KEY: z.string().startsWith('sk_'),
  OPENAI_API_KEY: z.string().startsWith('sk-'),
  // ... all required vars
});

envSchema.parse(process.env); // Throws if invalid
```

---

### 9.4 LOW SEVERITY Issues

#### 19. **Backup Files in Codebase**
**Found:** 71 `.bak` files in `/src/lib/`
**Example:**
- `auth-utils.ts.bak`
- `firebase.ts.bak`
- `cities.ts.bak`

**Impact:**
- Code duplication
- Confusion
- Version control pollution
- Increased deploy size

**Recommendation:** Delete all `.bak` files, use git for version history

---

#### 20. **Inconsistent Code Style**
**Issues:**
1. Mix of `interface` and `type` for TypeScript
2. Inconsistent naming (camelCase, PascalCase, kebab-case)
3. No Prettier configuration
4. ESLint disabled during builds

**Recommendation:**
- Add Prettier
- Configure ESLint properly
- Set up pre-commit hooks
- Run formatter on entire codebase

---

#### 21. **Magic Numbers**
**Examples:**
```typescript
// /src/app/dashboard/page.tsx
const swipeThreshold = 100; // What does 100 mean?
const velocityThreshold = 0.5; // Why 0.5?

// /src/app/api/chatbot/route.ts
max_tokens: 80, // Why 80?
temperature: 0.7, // Why 0.7?
```

**Recommendation:** Extract to named constants:
```typescript
const SWIPE_DISTANCE_THRESHOLD_PX = 100;
const SWIPE_VELOCITY_THRESHOLD = 0.5;
const CHATBOT_MAX_TOKENS = 80;
const CHATBOT_TEMPERATURE = 0.7;
```

---

#### 22. **Commented-Out Code**
**Found:** Multiple instances of commented code throughout

**Examples:**
- `/src/app/api/stripe/webhook/route.ts` - Commented logs
- Admin routes - Commented console statements

**Recommendation:** Remove commented code, use git history

---

#### 23. **TODO Comments**
**Found:** Several TODO comments in webhook handlers

**Example:**
```typescript
// TODO: Add Firestore index on 'realtorData.stripeSubscriptionId' for scale
```

**Recommendation:** Convert to GitHub Issues or Jira tickets

---

#### 24. **No Monitoring/Observability**
**Missing:**
- Error tracking (Sentry, Rollbar)
- Performance monitoring (New Relic, DataDog)
- User analytics (Google Analytics, Mixpanel)
- Uptime monitoring
- Log aggregation

**Recommendation:**
1. Add Sentry for error tracking
2. Add Vercel Analytics
3. Implement custom event tracking
4. Set up alerts for critical errors

---

#### 25. **Documentation Gaps**

**Missing:**
1. API documentation
2. Component Storybook
3. Database schema diagram
4. Architecture diagram
5. Deployment guide
6. Contributing guidelines
7. Code of conduct

**Found:** Multiple `.md` files but inconsistent:
- `README.md` - Minimal
- `CHATBOT_OPTIMIZATION_REPORT.md` - Outdated?
- `SEO_IMPLEMENTATION_GUIDE.md` - Helpful
- `CSV_SCRIPTS_README.md` - Useful

**Recommendation:** Create comprehensive docs in `/docs` folder

---

## 10. Recommendations & Best Practices

### 10.1 Immediate Actions (Critical)

1. **Enable TypeScript Strict Mode**
   ```bash
   # In tsconfig.json
   "strict": true
   ```
   Then fix type errors one file at a time

2. **Add Environment Validation**
   ```typescript
   // /src/lib/env.ts
   import { z } from 'zod';

   const envSchema = z.object({
     STRIPE_SECRET_KEY: z.string().min(1),
     OPENAI_API_KEY: z.string().min(1),
     NEXT_PUBLIC_FIREBASE_API_KEY: z.string().min(1),
     // ... all required vars
   });

   export const env = envSchema.parse(process.env);
   ```

3. **Implement Rate Limiting**
   Use `express-rate-limit` or Vercel Edge Middleware

4. **Add Error Boundaries**
   Wrap dashboard and admin in error boundaries

5. **Fix Error Handling**
   Replace empty `catch {}` blocks with proper logging

### 10.2 Short-Term (High Priority)

1. **Add Unit Tests**
   - Start with utility functions
   - Add API route tests
   - Test critical business logic

2. **Consolidate Code**
   - Remove duplicate city services
   - Single database layer
   - Reusable state page template

3. **Improve Security**
   - Tighten CSP headers
   - Add request validation
   - Implement authentication middleware

4. **Create Firestore Indexes**
   - Document needed indexes
   - Add to `firestore.indexes.json`
   - Deploy indexes

5. **Add Monitoring**
   - Sentry for errors
   - Vercel Analytics
   - Custom metrics

### 10.3 Medium-Term (Recommended)

1. **Refactor Database Layer**
   - Single source of truth
   - Type-safe queries
   - Centralized error handling

2. **Improve SEO**
   - Unique content per page
   - Better internal linking
   - Structured data validation

3. **Performance Optimization**
   - Bundle analysis
   - Code splitting
   - Image optimization
   - Caching strategy

4. **Add Integration Tests**
   - Critical user flows
   - Stripe webhook testing
   - Auth flow testing

5. **Documentation**
   - API documentation (OpenAPI)
   - Component documentation (Storybook)
   - Architecture diagrams
   - Deployment guide

### 10.4 Long-Term (Strategic)

1. **Migrate to App Router Best Practices**
   - Server Actions for mutations
   - Streaming for long queries
   - Partial Prerendering

2. **Add Real-Time Features**
   - Live property updates
   - Chat between buyer/realtor
   - Notifications

3. **Mobile App**
   - React Native app exists in `/ownerfi-mobile`
   - Complete and launch

4. **Internationalization**
   - Spanish translation (planned, see `SPANISH_TRANSLATION_PLAN.md`)
   - Multi-language support

5. **Advanced Analytics**
   - User behavior tracking
   - A/B testing
   - Conversion funnel analysis

---

## 11. Code Examples

### 11.1 Creating a New API Route

```typescript
// /src/app/api/example/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { FirebaseDB } from '@/lib/firebase-db';
import { z } from 'zod';

// Request validation schema
const requestSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});

export async function POST(request: NextRequest) {
  try {
    // 1. Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2. Validate request body
    const body = await request.json();
    const validatedData = requestSchema.parse(body);

    // 3. Business logic
    const result = await FirebaseDB.createDocument('collection', {
      ...validatedData,
      userId: session.user.id,
      createdAt: new Date()
    });

    // 4. Return response
    return NextResponse.json({
      success: true,
      data: result
    });

  } catch (error) {
    // 5. Error handling
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

### 11.2 Creating a New Page Component

```typescript
// /src/app/example/page.tsx
import { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { BreadcrumbSchema } from '@/components/SEO';

// SEO metadata
export const metadata: Metadata = {
  title: 'Example Page | OwnerFi',
  description: 'This is an example page',
  openGraph: {
    title: 'Example Page',
    description: 'This is an example page',
    url: 'https://ownerfi.ai/example',
  }
};

export default async function ExamplePage() {
  // Server-side data fetching
  const session = await getServerSession(authOptions);

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* SEO Components */}
      <BreadcrumbSchema
        items={[
          { name: 'Home', url: '/' },
          { name: 'Example', url: '/example' }
        ]}
      />

      {/* Page Content */}
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold mb-4">
          Example Page
        </h1>
        {session ? (
          <p>Welcome, {session.user.name}!</p>
        ) : (
          <p>Please sign in</p>
        )}
      </main>
    </div>
  );
}
```

### 11.3 Creating a New Component

```typescript
// /src/components/ui/ExampleCard.tsx
'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';

interface ExampleCardProps {
  title: string;
  description: string;
  onClick?: () => void;
  variant?: 'primary' | 'secondary';
}

export function ExampleCard({
  title,
  description,
  onClick,
  variant = 'primary'
}: ExampleCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div
      className={`rounded-lg p-6 cursor-pointer ${
        variant === 'primary'
          ? 'bg-gradient-to-br from-emerald-500 to-blue-500'
          : 'bg-slate-800'
      }`}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      onClick={onClick}
    >
      <h3 className="text-xl font-bold mb-2">{title}</h3>
      <p className="text-slate-300">{description}</p>
      {isHovered && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 text-sm text-emerald-300"
        >
          Click to learn more →
        </motion.div>
      )}
    </motion.div>
  );
}
```

---

## 12. Deployment & DevOps

### 12.1 Current Setup

**Hosting:** Vercel (inferred from `vercel.json`)

**Vercel Configuration:**
```json
{
  "buildCommand": "npm run build",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "framework": "nextjs"
}
```

### 12.2 Build Process

```bash
# Development
npm run dev  # Starts Next.js dev server on :3000

# Production
npm run build  # Builds for production
npm run start  # Starts production server
```

### 12.3 Environment Setup

1. **Development:**
   - Copy `.env.example` to `.env.local`
   - Fill in all required credentials
   - Run `npm install`
   - Run `npm run dev`

2. **Production:**
   - Set environment variables in Vercel dashboard
   - Connect GitHub repository
   - Auto-deploy on push to main branch

### 12.4 CI/CD

**Current:** No CI/CD configuration found

**Recommendations:**
1. Add GitHub Actions for:
   - Linting
   - Type checking
   - Tests
   - Build verification

2. Example `.github/workflows/ci.yml`:
```yaml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run lint
      - run: npm run type-check
      - run: npm test
      - run: npm run build
```

---

## 13. Getting Started Guide

### 13.1 Prerequisites

- Node.js 18+ (recommended: 20.x)
- npm 9+
- Firebase account
- Stripe account
- OpenAI API key
- Google Maps API key

### 13.2 Local Development Setup

1. **Clone Repository:**
   ```bash
   git clone <repo-url>
   cd ownerfi
   ```

2. **Install Dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment:**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your credentials
   ```

4. **Set Up Firebase:**
   - Create Firebase project
   - Enable Firestore
   - Download service account key
   - Add credentials to `.env.local`

5. **Set Up Stripe:**
   - Create Stripe account
   - Get test API keys
   - Add to `.env.local`
   - Configure webhook endpoint

6. **Run Development Server:**
   ```bash
   npm run dev
   ```

7. **Access Application:**
   - Homepage: `http://localhost:3000`
   - Admin: `http://localhost:3000/admin`
   - API docs: (Not available - recommend adding)

### 13.3 First-Time Admin Setup

1. **Create Admin User:**
   - Sign up at `/signup`
   - Manually change `role` to `admin` in Firestore
   - Or use Firebase Console

2. **Upload Properties:**
   - Go to `/admin`
   - Click "Upload" tab
   - Upload CSV file (see format below)

3. **Configure Stripe Webhooks:**
   - Stripe Dashboard → Webhooks
   - Add endpoint: `https://yourdomain.com/api/stripe/webhook`
   - Select events: All subscription & invoice events
   - Copy webhook secret to `.env.local`

### 13.4 CSV Upload Format

```csv
address,city,state,zipCode,bedrooms,bathrooms,squareFeet,listPrice,monthlyPayment,downPaymentAmount,imageUrl
"123 Main St","Austin","TX","78701",3,2,1500,250000,1800,25000,"https://example.com/image.jpg"
```

Required fields:
- `address`
- `city`
- `state`
- `bedrooms`
- `bathrooms`
- `listPrice`

Optional but recommended:
- `zipCode`
- `squareFeet`
- `monthlyPayment`
- `downPaymentAmount`
- `imageUrl`

---

## 14. Summary

### 14.1 Application Strengths

✅ **Well-Structured Architecture**
- Clean separation of concerns
- Organized file structure
- Logical data models

✅ **Modern Tech Stack**
- Latest Next.js with App Router
- React 19 for performance
- TypeScript for type safety (when strict mode enabled)

✅ **Comprehensive Feature Set**
- Buyer marketplace
- Realtor lead system
- Admin management
- Payment processing
- AI chatbot

✅ **SEO Optimized**
- Server-side rendering
- Structured data
- Meta tags
- 88 pages for coverage

✅ **Third-Party Integrations**
- Stripe payments
- OpenAI chatbot
- Google Maps
- Firebase backend

### 14.2 Critical Areas for Improvement

⚠️ **Type Safety**
- Enable TypeScript strict mode
- Add proper type annotations
- Remove `any` types

⚠️ **Error Handling**
- Replace empty catch blocks
- Implement proper logging
- Add error monitoring

⚠️ **Security**
- Add rate limiting
- Implement request validation
- Tighten CSP headers
- Add authentication middleware

⚠️ **Testing**
- Add unit tests
- Add integration tests
- Add E2E tests
- Set up CI/CD

⚠️ **Performance**
- Add database indexes
- Implement caching
- Optimize images
- Add lazy loading

### 14.3 Technical Debt Scorecard

| Category | Score | Priority |
|----------|-------|----------|
| Type Safety | 2/10 | CRITICAL |
| Error Handling | 3/10 | CRITICAL |
| Security | 4/10 | CRITICAL |
| Testing | 0/10 | HIGH |
| Performance | 5/10 | HIGH |
| Documentation | 4/10 | MEDIUM |
| Code Quality | 6/10 | MEDIUM |
| SEO | 8/10 | LOW |
| Accessibility | 5/10 | MEDIUM |

**Overall Technical Health:** 4.1/10 ⚠️

### 14.4 Estimated Effort to Fix Issues

| Issue Category | Estimated Time | Resources Needed |
|----------------|----------------|------------------|
| Enable TypeScript Strict | 2-3 weeks | 1 senior dev |
| Add Comprehensive Tests | 3-4 weeks | 1-2 devs |
| Security Improvements | 1-2 weeks | 1 security-focused dev |
| Performance Optimization | 2-3 weeks | 1 performance expert |
| Code Consolidation | 1-2 weeks | 1 senior dev |
| Documentation | 1 week | 1 tech writer + dev |
| **TOTAL** | **10-15 weeks** | **2-3 developers** |

---

**End of Comprehensive Deep Scan Documentation**

**Document Generated:** 2025-10-08
**Codebase Analyzed:** OwnerFi Next.js Application
**Total Files Analyzed:** 200+ files
**Total Lines of Code:** ~50,000+ LOC
**Issues Identified:** 25 major issues across 4 severity levels

This documentation should serve as a complete onboarding guide for new developers and a roadmap for technical improvements.
