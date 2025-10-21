# Import Scripts Guide

## Two Scripts - Different Use Cases

### 🚀 `import-json-to-firebase.ts` (FAST - Use This!)

**When to use:**
- You already have scraped Apify JSON data
- You want to import quickly (seconds, not minutes)

**Speed:** **50 properties in ~3 seconds** ⚡

**What it does:**
1. Reads your Apify JSON file
2. Validates & transforms data
3. Imports directly to Firebase
4. **NO API calls, NO delays**

**Usage:**
```bash
npx tsx scripts/import-json-to-firebase.ts /path/to/apify-data.json
```

**Example:**
```bash
npx tsx scripts/import-json-to-firebase.ts ~/Downloads/dataset_zillow-detail-scraper_2025-10-21_15-41-24-538.json
```

---

### 🐌 `import-to-firebase.ts` (SLOW - Don't Use)

**When to use:**
- You have a CSV/Excel with Zillow URLs (not scraped data)
- You need to scrape the data first

**Speed:** **Minutes per batch** (calls Apify API + delays)

**What it does:**
1. Reads URLs from CSV/Excel
2. **Sends URLs to Apify to scrape** (SLOW!)
3. Waits for Apify to finish
4. Then imports to Firebase

**Usage:**
```bash
npx tsx scripts/import-to-firebase.ts
```

---

## Which One Should You Use?

### ✅ Use `import-json-to-firebase.ts` if:
- You downloaded JSON from Apify ✅
- You ran Apify scraper and have results ✅
- You want it FAST ✅

### ❌ Use `import-to-firebase.ts` if:
- You only have a list of URLs (no scraped data)
- You need to scrape first
- You have time to wait

---

## Performance Comparison

| Script | Speed | Use Case |
|--------|-------|----------|
| **import-json-to-firebase.ts** | ⚡ 3 seconds for 50 | Already have Apify JSON |
| **import-to-firebase.ts** | 🐌 5+ minutes for 50 | Only have URLs, need to scrape |

---

## Your Typical Workflow

1. **Scrape with Apify:**
   - Go to Apify dashboard
   - Run the zillow-detail-scraper
   - Download the JSON results

2. **Import to Firebase (FAST):**
   ```bash
   npx tsx scripts/import-json-to-firebase.ts ~/Downloads/your-apify-data.json
   ```

3. **Export to GHL:**
   - Admin dashboard → "Export to GHL Format"
   - Get Excel with all 42 fields

---

## Features (Both Scripts)

Both scripts include:
- ✅ Phone validation (agent OR broker required)
- ✅ Broker phone fallback
- ✅ All 42 fields extracted
- ✅ Tax amount (actual paid)
- ✅ Agent/broker info
- ✅ Images
- ✅ Location data (lat/long)

---

## Stop the Import

For the SLOW script only (you won't need to stop the FAST one):
```bash
touch .stop-scraper
```
