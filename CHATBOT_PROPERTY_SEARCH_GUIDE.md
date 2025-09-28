# OwnerFi Property Search - Complete Chatbot Training Guide

## Platform Overview
OwnerFi is a lead generation platform that connects buyers with owner-financed properties (seller financing), bypassing traditional bank mortgages. Licensed real estate agents help facilitate these transactions.

## User Journey: Finding Properties on OwnerFi

### 1. Getting Started - Account Creation

**URL:** `https://ownerfi.ai/signup`

**What Users Need to Provide:**
- First name and last name
- Email address
- Phone number (required for agent contact)
- Password (minimum 6 characters)

**Important Notes:**
- Users must consent to receiving marketing messages and phone calls from OwnerFi and licensed real estate agents
- This includes automated calls and texts
- Users agree to Terms of Service and Privacy Policy
- After signup, users are automatically signed in and redirected to setup

### 2. Setting Up Property Search Preferences

**URL:** `https://ownerfi.ai/dashboard/setup`

**Required Information:**
- **Search Location:** City and state (e.g., "Dallas, TX", "Austin, TX", "Houston, TX")
- **Maximum Monthly Payment:** The highest monthly payment the buyer can afford
  - This includes: principal, interest, insurance, and taxes (PITI)
  - Example: $2,000/month
- **Maximum Down Payment:** The upfront payment the buyer can make
  - Example: $50,000

**What Happens Next:**
- System saves preferences to buyer profile
- User is redirected to the main dashboard
- Properties matching criteria are automatically loaded

### 3. Browsing Properties

**URL:** `https://ownerfi.ai/dashboard`

**How Properties Are Displayed:**
- Swipeable card interface (like Tinder)
- One property shown at a time
- Users can swipe left (skip) or right (like)
- Properties are pre-filtered based on user's budget and location preferences

**Property Information Shown:**
- Full address
- City, state, and zip code
- Number of bedrooms and bathrooms
- Square footage (if available)
- **Financial Terms:**
  - Monthly payment amount
  - Down payment required
  - Balloon payment (if applicable)
  - Balloon payment due in X years
  - Interest rate
  - Term length (years)
- Property images
- Match reason (why this property was shown)

### 4. How the Search Works

**Search Algorithm Features:**

1. **Primary City Search:**
   - Searches the exact city the user specified
   - Example: User enters "Dallas, TX" → searches Dallas properties

2. **Automatic Nearby Cities Expansion:**
   - Automatically includes properties from cities within 30 miles
   - No need for users to search multiple cities manually
   - Example: Search for "Dallas, TX" also includes properties from Irving, Plano, Arlington, etc.

3. **Budget Filtering:**
   - Only shows properties within the user's budget
   - Monthly payment ≤ user's maximum monthly payment
   - Down payment ≤ user's maximum down payment

4. **Active Properties Only:**
   - Only displays properties currently available for sale
   - Filters out sold or inactive listings

5. **Optional Filters:**
   - Minimum number of bedrooms
   - Minimum number of bathrooms

### 5. Property Interaction Features

**Liking Properties:**
- Users can "like" properties they're interested in
- Liked properties are saved to their favorites list
- Can view all liked properties at: `/dashboard/liked`

**Contacting Agents:**
- Each property can connect users with licensed real estate agents
- Agents help facilitate the owner-financing transaction
- Users' phone numbers are shared with agents for follow-up

## Common User Questions & Answers

### Q: How do I start finding properties?
**A:** Sign up at ownerfi.ai/signup, then set your city and budget preferences. Properties will automatically appear based on your criteria.

### Q: What cities can I search?
**A:** You can search any city in the United States. The system automatically includes nearby cities within 30 miles of your search location.

### Q: What's my budget should be?
**A:**
- **Monthly Payment:** What you can afford each month (like rent). Include all costs: principal, interest, insurance, taxes
- **Down Payment:** The cash you have available upfront (like a deposit but larger)

### Q: Can I search multiple cities?
**A:** You set one primary city, but the system automatically searches nearby cities within 30 miles, so you get a wider selection.

### Q: How do I change my search preferences?
**A:** Go to `/dashboard/settings` to update your city, monthly payment budget, or down payment budget.

### Q: What is owner financing?
**A:** The property owner acts as the bank, providing financing directly to the buyer instead of requiring a traditional mortgage. Also called "seller financing."

### Q: What's a balloon payment?
**A:** A large payment due at the end of the loan term. Example: You pay $2,000/month for 5 years, then owe $150,000 as a final payment.

### Q: Can I search without signing up?
**A:** No, you need to create an account to search properties. This helps match you with the right properties and agents.

### Q: Are these real properties?
**A:** Yes, all properties are real homes available for owner financing. OwnerFi connects you with licensed real estate agents who facilitate the transactions.

### Q: How do I contact a seller?
**A:** When you like a property, licensed real estate agents will contact you to help facilitate the transaction. Your phone number is shared for this purpose.

## Technical Details for Advanced Users

### Search Optimization
- Uses Firestore compound indexes for fast queries
- Searches are cached for performance
- Results are paginated (20 properties at a time)
- Nearby cities are calculated using geographic coordinates

### Property Data Fields
```
- id: Unique property identifier
- address: Street address
- city: City name
- state: State code (e.g., "TX")
- zipCode: ZIP code
- bedrooms: Number of bedrooms
- bathrooms: Number of bathrooms
- squareFeet: Property size
- monthlyPayment: Monthly payment amount
- downPaymentAmount: Required down payment
- balloonPayment: Balloon payment amount (if any)
- balloonYears: When balloon payment is due
- interestRate: Annual interest rate
- termYears: Loan term in years
- isActive: Whether property is available
- imageUrls: Property photos
```

### API Endpoints Used
- `POST /api/auth/signup` - Create new account
- `POST /api/buyer/profile` - Save search preferences
- `GET /api/buyer/profile` - Get user's preferences
- `GET /api/buyer/properties` - Search properties
- `POST /api/buyer/like-property` - Like/unlike properties

## Key Differentiators
1. **No Bank Required:** Direct seller financing
2. **Automatic Nearby Search:** Expands search radius automatically
3. **Simple Interface:** Swipe through properties like dating apps
4. **Licensed Agents:** Professional help included
5. **Budget-Based Matching:** Only see what you can afford

## Important Disclaimers
- OwnerFi is a lead generation platform, not a lender
- Connects buyers with licensed real estate agents
- Information provided is not financial or legal advice
- Users consent to being contacted by agents
- All properties subject to availability and seller approval

---
*Last Updated: 2024*
*Platform: OwnerFi (https://ownerfi.ai)*
*Purpose: Chatbot training for property search assistance*