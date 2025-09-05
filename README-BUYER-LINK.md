# 🏠 Buyer Link System - Project Documentation

## 📋 Current Status: BUYER LINK SYSTEM COMPLETE! 🎉
- ✅ **Buyer Profile System** - Complete with auto-matching
- ✅ **Auto-Matching Algorithm** - Properties ↔ Buyers matching built
- ✅ **Database Schema** - All tables created with strict role separation
- ✅ **Realtor Authentication** - Signup, signin, profile setup complete
- ✅ **Role-Based Access Control** - Strict separation between buyers/realtors
- ✅ **Buyer Link Dashboard** - Complete with lead viewing and purchasing
- ✅ **Credit System** - 7-day trial, credit deduction, lead purchasing
- ✅ **Geographic Matching** - City autocomplete and radius search for both sides
- 🎯 **READY FOR TESTING** - Full system operational!

---

## 🎯 System Overview

**"Buyer Link"** is a credit-based lead system where realtors purchase qualified buyer leads.

### Core Flow:
1. **Buyer creates profile** (budget, location, preferences)
2. **System auto-matches** buyer to ALL existing properties that fit criteria  
3. **New properties** auto-match to ALL existing buyers that fit
4. **Each buyer maintains ongoing list** of ALL matching properties
5. **Buyers become "leads"** available to realtors in their service areas
6. **Realtors purchase leads** using credit system

### Key Principle:
**No complexity** - No viewing/saving/interest tracking. Just:
`Profile Created → Auto-Matched → Lead Generated → Realtor Purchase`

---

## 💰 Pricing Structure

### Trial & Plans:
- **7-day Free Trial**: 3 free credits
- **Basic**: $29/month (10 credits)  
- **Pro**: $79/month (30 credits)
- **Premium**: $149/month (60 credits)
- **Pay-per-lead**: $8 per credit

### Credit System:
- 1 credit = 1 buyer lead purchase
- Leads show: name, phone, budget, preferred city/state, property matches

---

## 🗄️ Database Schema

### Core Tables:
```sql
-- Buyer profiles with search criteria
buyerProfiles (id, userId, firstName, lastName, phone, maxMonthlyPayment, 
               maxDownPayment, preferredCity, preferredState, searchRadius, 
               minBedrooms, minBathrooms, ...)

-- Realtor profiles with service areas  
realtors (id, userId, firstName, lastName, email, phone, company,
          licenseNumber, licenseState, serviceStates, serviceCities,
          credits, isOnTrial, trialStartDate, ...)

-- Property-buyer matching system
propertyBuyerMatches (id, propertyId, buyerId, matchedOn, matchScore, 
                      isActive, matchedAt)

-- Realtor lead purchases
buyerLeadPurchases (id, realtorId, buyerId, creditsCost, purchasePrice,
                    status, contactedAt, notes, purchasedAt)

-- Subscription management
realtorSubscriptions (id, realtorId, plan, status, monthlyPrice,
                      creditsPerMonth, stripeCustomerId, ...)
```

---

## 🔧 Key Implementation Files

### Auto-Matching System:
- **`/src/lib/matching.ts`** - Core matching algorithm
  - `isPropertyMatch()` - Checks if property fits buyer criteria
  - `matchBuyerToProperties()` - Matches new buyer to all properties
  - `matchPropertyToBuyers()` - Matches new property to all buyers
  - `getBuyerMatches()` - Gets all properties for a buyer

### Buyer System:
- **`/src/app/dashboard/setup/page.tsx`** - Buyer profile creation form
- **`/src/app/api/buyer/profile/route.ts`** - Buyer profile API + auto-matching trigger

### Database:
- **`/src/lib/db/schema.ts`** - All table schemas defined

### Matching Criteria:
```typescript
// Critical matches (all must pass):
- Monthly Payment: property.monthlyPayment ≤ buyer.maxMonthlyPayment
- Down Payment: property.downPaymentAmount ≤ buyer.maxDownPayment  
- Location: property.city === buyer.preferredCity (within 25mi radius)

// Optional matches (if buyer specified):
- Bedrooms: property.bedrooms ≥ buyer.minBedrooms
- Bathrooms: property.bathrooms ≥ buyer.minBathrooms
```

---

## 🌐 URL Structure

### Buyer Side:
- `/dashboard/setup` - Buyer profile creation (triggers auto-matching)
- `/dashboard` - Buyer dashboard (future: show matched properties)

### Realtor Side (In Progress):
- `/realtor/signup` - Realtor account creation ✅ Built
- `/realtor/signin` - Realtor login (todo)
- `/realtor/setup` - Realtor profile setup (license, service areas) (todo)  
- `/realtor/dashboard` - Buyer Link dashboard (see/purchase leads) (todo)

---

## 📊 Realtor Dashboard Features (Planned)

### Two Main Sections:
1. **Available Leads** - Buyer profiles matching realtor's service area
   - Show: Name, phone, budget, preferred city, # of property matches
   - "Purchase Lead" button (costs 1 credit)

2. **My Purchased Leads** - Leads realtor has bought
   - Contact info, status tracking, notes
   - Convert status: contacted → converted → closed

### Credit Management:
- Credit balance display
- Purchase more credits (Stripe integration)
- Transaction history
- Trial status tracking

---

## 🚀 Implementation Progress

### ✅ Completed:
1. **Buyer profile system** with city search, validation, auto-formatting
2. **Auto-matching algorithm** with geographic distance calculation  
3. **Database schema** for entire Buyer Link system
4. **Integration** - Auto-matching triggers when buyer profile created
5. **Realtor signup page** with trial benefits highlighted

### 🔄 Currently Building:
1. **Realtor signup API** (`/api/realtor/signup`)
2. **Realtor signin page** (`/realtor/signin`)  
3. **Realtor profile setup** (`/realtor/setup`)

### ⏳ Next Phase:
1. **Buyer Link dashboard** (`/realtor/dashboard`)
2. **Lead purchase system** with credit deduction
3. **Credit management** and Stripe integration
4. **Trial system** (7 days, 3 free credits)

---

## 🔄 Auto-Matching Flow

### When Buyer Creates Profile:
```typescript
// In /api/buyer/profile/route.ts
await matchBuyerToProperties(newProfileId);
// → Scans ALL properties, creates matches in propertyBuyerMatches table
```

### When New Property Added (Future):
```typescript  
// In /api/properties/route.ts (to be implemented)
await matchPropertyToBuyers(newPropertyId);
// → Scans ALL buyers, creates matches in propertyBuyerMatches table
```

### Database Updates:
- Each match stored with score (0.0-1.0) and criteria matched
- Inactive matches when buyer/property deleted
- Realtor sees buyers with matches in their service area

---

## 📱 Quick Start for New Conversation

**Copy/paste this to get Claude up to speed:**

> "We're building OwnerFi's Buyer Link system - a realtor lead platform. Check /README-BUYER-LINK.md for full context. Currently building realtor signup/dashboard. Buyers auto-match to properties, realtors buy leads with credits. Status: Just built /realtor/signup page, need to finish realtor authentication and dashboard next."

---

## 🗂️ Project Structure
```
src/
├── app/
│   ├── dashboard/setup/          # Buyer profile creation ✅
│   ├── realtor/signup/           # Realtor signup ✅  
│   ├── realtor/signin/           # Realtor login (todo)
│   ├── realtor/setup/            # Realtor profile (todo)
│   ├── realtor/dashboard/        # Buyer Link dashboard (todo)
│   └── api/
│       ├── buyer/profile/        # Buyer API + auto-matching ✅
│       └── realtor/signup/       # Realtor signup API (building)
├── lib/
│   ├── matching.ts               # Auto-matching algorithm ✅
│   └── db/schema.ts              # Database tables ✅
└── README-BUYER-LINK.md          # This file ✅
```

---

*Last Updated: Building realtor authentication system*
*Next: Complete realtor dashboard with lead purchasing*