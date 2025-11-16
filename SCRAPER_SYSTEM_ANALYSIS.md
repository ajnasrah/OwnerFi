# Zillow Scraper System Analysis - Complete Flow

## 🟢 CURRENT ACTIVE SYSTEMS

### System 1: Owner Finance Properties (Main System)
**Purpose**: Find properties with owner financing keywords, send to GHL

**Flow**:
```
1. URL Collection (2 methods):
   a) Apify Search: /api/cron/run-search-scraper (Mon/Thu 9am)
      └─> Uses maxcopell/zillow-scraper
      └─> Adds URLs to scraper_queue

   b) Manual Bookmarklet: /api/scraper/add-to-queue
      └─> Chrome extension "Press & Hold"
      └─> Adds URLs to scraper_queue

2. Processing:
   /api/cron/process-scraper-queue (7x/day: 10am-10pm, every 2hrs)
   └─> Picks 25 pending URLs from scraper_queue
   └─> Calls maxcopell/zillow-detail-scraper (Apify)
   └─> Applies STRICT owner financing filter
   └─> Saves to zillow_imports (only if passes filter)
   └─> Sends to GHL webhook (only properties with contact info)
   └─> Also saves "needs work" properties to cash_houses
```

**Collections**:
- `scraper_queue` - Temporary queue (pending → processing → completed)
- `zillow_imports` - Verified owner finance properties
- `cash_houses` - Properties needing work (dual purpose)

**Scheduled Crons**:
- `/api/cron/run-search-scraper` - Mon/Thu 9am
- `/api/cron/process-scraper-queue` - 7x/day

---

### System 2: Cash Deals (Parallel System)
**Purpose**: Find properties priced under 80% of Zestimate

**Flow**:
```
1. URL Collection:
   Chrome Extension "Press for Cash Deals" (green button)
   └─> /api/scraper/add-to-cash-queue
   └─> Adds URLs to cash_deals_queue

2. Processing:
   /api/cron/process-cash-deals-queue (NOT SCHEDULED - triggered on demand)
   └─> Picks 25 pending URLs from cash_deals_queue
   └─> Calls maxcopell/zillow-detail-scraper (Apify)
   └─> Applies 80% Zestimate filter (price < zestimate * 0.8)
   └─> Saves to cash_houses (only if passes filter)
   └─> Does NOT send to GHL
```

**Collections**:
- `cash_deals_queue` - Temporary queue
- `cash_houses` - Cash deal properties (shared with System 1)

**Scheduled Crons**:
- None (triggered on-demand via bookmarklet)

---

## 🔴 OLD SYSTEM (TO DELETE)

### Legacy Job-Based System
**Uses**: `scraper_jobs` collection (different from `scraper_queue`)

**Files**:
1. `/api/cron/process-zillow-scraper` ❌
   - Scheduled: Sun/Wed 6am
   - Processes `scraper_jobs` collection
   - No filtering logic
   - No GHL webhook
   - Outdated transform logic

2. `/api/admin/scraper/upload` ❌
   - Accepts Excel file uploads
   - Creates jobs in `scraper_jobs`
   - Triggers `/api/cron/process-zillow-scraper`

3. `/api/admin/scraper/status` ❌
   - Checks status of jobs in `scraper_jobs`

4. `/src/app/api/cron/slow-zillow-crawler` ✅ ALREADY DELETED
   - Was running every 5 minutes (288x/day!)
   - DIY Puppeteer scraper

**Why Delete**:
- Uses different collection (`scraper_jobs` vs `scraper_queue`)
- No owner financing filter
- No GHL integration
- Duplicate functionality
- Confusing to have two systems

---

## 📊 COLLECTION USAGE MATRIX

| Collection | System 1 (Owner Finance) | System 2 (Cash Deals) | Old System | Purpose |
|------------|-------------------------|----------------------|------------|---------|
| `scraper_queue` | ✅ Active | ❌ | ❌ | Main queue for owner finance |
| `zillow_imports` | ✅ Active | ❌ | ✅ Old | Verified owner finance properties |
| `cash_deals_queue` | ❌ | ✅ Active | ❌ | Temporary queue for cash deals |
| `cash_houses` | ✅ Active (needs work) | ✅ Active (80% deals) | ❌ | Dual purpose collection |
| `scraper_jobs` | ❌ | ❌ | ✅ Old | OLD - Job-based system |

---

## 🗑️ SAFE TO DELETE

### API Endpoints
```
❌ /api/cron/process-zillow-scraper/route.ts
❌ /api/admin/scraper/upload/route.ts
❌ /api/admin/scraper/status/route.ts
```

### Vercel.json Changes
Remove lines:
```json
{
  "path": "/api/cron/process-zillow-scraper",
  "schedule": "0 6 * * 0,3"
}
```

Remove from functions config:
```json
"src/app/api/cron/process-zillow-scraper/route.ts": {
  "maxDuration": 300
}
```

### Database Collections (Consider)
- `scraper_jobs` - If confirmed no active jobs exist

---

## ✅ KEEP (ACTIVE)

### Owner Finance System
```
✅ /api/cron/run-search-scraper/route.ts
✅ /api/cron/process-scraper-queue/route.ts
✅ /api/scraper/add-to-queue/route.ts
```

### Cash Deals System
```
✅ /api/scraper/add-to-cash-queue/route.ts
✅ /api/cron/process-cash-deals-queue/route.ts
```

### Shared Libraries
```
✅ /lib/property-transform.ts
✅ /lib/property-needs-work-detector.ts
✅ /lib/owner-financing-filter-strict.ts
✅ /lib/description-sanitizer.ts
```

---

## 📋 MIGRATION CHECKLIST

- [x] Delete slow-zillow-crawler (DONE)
- [ ] Delete process-zillow-scraper endpoint
- [ ] Delete admin/scraper/upload endpoint
- [ ] Delete admin/scraper/status endpoint
- [ ] Remove from vercel.json crons
- [ ] Remove from vercel.json functions
- [ ] Archive/delete scraper_jobs collection
- [ ] Update admin UI to remove upload feature
- [ ] Document final system in README

---

## 🎯 FINAL ARCHITECTURE

### Two Clean Systems:

**Owner Finance Pipeline**:
URL Sources → scraper_queue → Apify Detail Scraper → Strict Filter → zillow_imports → GHL

**Cash Deals Pipeline**:
Chrome Extension → cash_deals_queue → Apify Detail Scraper → 80% Filter → cash_houses

**Key Difference**:
- Owner Finance = Keyword filtering + GHL webhook
- Cash Deals = Price filtering + No GHL

Both use same Apify scraper, different filters and destinations.
