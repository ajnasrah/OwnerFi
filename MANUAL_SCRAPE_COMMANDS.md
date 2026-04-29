# Manual Scrape Commands - ALL Properties (No Age Filter)

Run these commands to scrape ALL properties in your target zip codes without the days-on-market filter.

## 1. Set your API Key
```bash
export APIFY_KEY=$(grep APIFY_API_KEY .env.local | cut -d '=' -f 2)
```

## 2. Run Search for Each City

### Knoxville, TN (10 zips)
```bash
curl -X POST "https://api.apify.com/v2/acts/api-ninja~zillow-search-scraper/runs?token=$APIFY_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "searchUrls": [
      "https://www.zillow.com/knoxville-tn-37923/?searchQueryState=%7B%22filterState%22%3A%7B%22price%22%3A%7B%22min%22%3A0%2C%22max%22%3A300000%7D%2C%22mp%22%3A%7B%22max%22%3A55000%7D%2C%22built%22%3A%7B%22min%22%3A1970%7D%2C%22land%22%3A%7B%22value%22%3Afalse%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22hoa%22%3A%7B%22max%22%3A200%7D%7D%7D",
      "https://www.zillow.com/knoxville-tn-37934/?searchQueryState=%7B%22filterState%22%3A%7B%22price%22%3A%7B%22min%22%3A0%2C%22max%22%3A300000%7D%2C%22mp%22%3A%7B%22max%22%3A55000%7D%2C%22built%22%3A%7B%22min%22%3A1970%7D%2C%22land%22%3A%7B%22value%22%3Afalse%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22hoa%22%3A%7B%22max%22%3A200%7D%7D%7D",
      "https://www.zillow.com/knoxville-tn-37922/?searchQueryState=%7B%22filterState%22%3A%7B%22price%22%3A%7B%22min%22%3A0%2C%22max%22%3A300000%7D%2C%22mp%22%3A%7B%22max%22%3A55000%7D%2C%22built%22%3A%7B%22min%22%3A1970%7D%2C%22land%22%3A%7B%22value%22%3Afalse%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22hoa%22%3A%7B%22max%22%3A200%7D%7D%7D",
      "https://www.zillow.com/knoxville-tn-37919/?searchQueryState=%7B%22filterState%22%3A%7B%22price%22%3A%7B%22min%22%3A0%2C%22max%22%3A300000%7D%2C%22mp%22%3A%7B%22max%22%3A55000%7D%2C%22built%22%3A%7B%22min%22%3A1970%7D%2C%22land%22%3A%7B%22value%22%3Afalse%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22hoa%22%3A%7B%22max%22%3A200%7D%7D%7D",
      "https://www.zillow.com/knoxville-tn-37921/?searchQueryState=%7B%22filterState%22%3A%7B%22price%22%3A%7B%22min%22%3A0%2C%22max%22%3A300000%7D%2C%22mp%22%3A%7B%22max%22%3A55000%7D%2C%22built%22%3A%7B%22min%22%3A1970%7D%2C%22land%22%3A%7B%22value%22%3Afalse%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22hoa%22%3A%7B%22max%22%3A200%7D%7D%7D",
      "https://www.zillow.com/knoxville-tn-37931/?searchQueryState=%7B%22filterState%22%3A%7B%22price%22%3A%7B%22min%22%3A0%2C%22max%22%3A300000%7D%2C%22mp%22%3A%7B%22max%22%3A55000%7D%2C%22built%22%3A%7B%22min%22%3A1970%7D%2C%22land%22%3A%7B%22value%22%3Afalse%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22hoa%22%3A%7B%22max%22%3A200%7D%7D%7D",
      "https://www.zillow.com/knoxville-tn-37924/?searchQueryState=%7B%22filterState%22%3A%7B%22price%22%3A%7B%22min%22%3A0%2C%22max%22%3A300000%7D%2C%22mp%22%3A%7B%22max%22%3A55000%7D%2C%22built%22%3A%7B%22min%22%3A1970%7D%2C%22land%22%3A%7B%22value%22%3Afalse%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22hoa%22%3A%7B%22max%22%3A200%7D%7D%7D",
      "https://www.zillow.com/knoxville-tn-37918/?searchQueryState=%7B%22filterState%22%3A%7B%22price%22%3A%7B%22min%22%3A0%2C%22max%22%3A300000%7D%2C%22mp%22%3A%7B%22max%22%3A55000%7D%2C%22built%22%3A%7B%22min%22%3A1970%7D%2C%22land%22%3A%7B%22value%22%3Afalse%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22hoa%22%3A%7B%22max%22%3A200%7D%7D%7D",
      "https://www.zillow.com/knoxville-tn-37912/?searchQueryState=%7B%22filterState%22%3A%7B%22price%22%3A%7B%22min%22%3A0%2C%22max%22%3A300000%7D%2C%22mp%22%3A%7B%22max%22%3A55000%7D%2C%22built%22%3A%7B%22min%22%3A1970%7D%2C%22land%22%3A%7B%22value%22%3Afalse%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22hoa%22%3A%7B%22max%22%3A200%7D%7D%7D",
      "https://www.zillow.com/knoxville-tn-37917/?searchQueryState=%7B%22filterState%22%3A%7B%22price%22%3A%7B%22min%22%3A0%2C%22max%22%3A300000%7D%2C%22mp%22%3A%7B%22max%22%3A55000%7D%2C%22built%22%3A%7B%22min%22%3A1970%7D%2C%22land%22%3A%7B%22value%22%3Afalse%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22hoa%22%3A%7B%22max%22%3A200%7D%7D%7D"
    ],
    "homesPerUrl": 1000
  }'
```

### Athens, GA (10 zips)
```bash
curl -X POST "https://api.apify.com/v2/acts/api-ninja~zillow-search-scraper/runs?token=$APIFY_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "searchUrls": [
      "https://www.zillow.com/athens-ga-30605/?searchQueryState=%7B%22filterState%22%3A%7B%22price%22%3A%7B%22min%22%3A0%2C%22max%22%3A300000%7D%2C%22mp%22%3A%7B%22max%22%3A55000%7D%2C%22built%22%3A%7B%22min%22%3A1970%7D%2C%22land%22%3A%7B%22value%22%3Afalse%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22hoa%22%3A%7B%22max%22%3A200%7D%7D%7D",
      "https://www.zillow.com/athens-ga-30606/?searchQueryState=%7B%22filterState%22%3A%7B%22price%22%3A%7B%22min%22%3A0%2C%22max%22%3A300000%7D%2C%22mp%22%3A%7B%22max%22%3A55000%7D%2C%22built%22%3A%7B%22min%22%3A1970%7D%2C%22land%22%3A%7B%22value%22%3Afalse%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22hoa%22%3A%7B%22max%22%3A200%7D%7D%7D",
      "https://www.zillow.com/athens-ga-30609/?searchQueryState=%7B%22filterState%22%3A%7B%22price%22%3A%7B%22min%22%3A0%2C%22max%22%3A300000%7D%2C%22mp%22%3A%7B%22max%22%3A55000%7D%2C%22built%22%3A%7B%22min%22%3A1970%7D%2C%22land%22%3A%7B%22value%22%3Afalse%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22hoa%22%3A%7B%22max%22%3A200%7D%7D%7D",
      "https://www.zillow.com/athens-ga-30602/?searchQueryState=%7B%22filterState%22%3A%7B%22price%22%3A%7B%22min%22%3A0%2C%22max%22%3A300000%7D%2C%22mp%22%3A%7B%22max%22%3A55000%7D%2C%22built%22%3A%7B%22min%22%3A1970%7D%2C%22land%22%3A%7B%22value%22%3Afalse%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22hoa%22%3A%7B%22max%22%3A200%7D%7D%7D",
      "https://www.zillow.com/athens-ga-30607/?searchQueryState=%7B%22filterState%22%3A%7B%22price%22%3A%7B%22min%22%3A0%2C%22max%22%3A300000%7D%2C%22mp%22%3A%7B%22max%22%3A55000%7D%2C%22built%22%3A%7B%22min%22%3A1970%7D%2C%22land%22%3A%7B%22value%22%3Afalse%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22hoa%22%3A%7B%22max%22%3A200%7D%7D%7D",
      "https://www.zillow.com/athens-ga-30601/?searchQueryState=%7B%22filterState%22%3A%7B%22price%22%3A%7B%22min%22%3A0%2C%22max%22%3A300000%7D%2C%22mp%22%3A%7B%22max%22%3A55000%7D%2C%22built%22%3A%7B%22min%22%3A1970%7D%2C%22land%22%3A%7B%22value%22%3Afalse%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22hoa%22%3A%7B%22max%22%3A200%7D%7D%7D",
      "https://www.zillow.com/athens-ga-30608/?searchQueryState=%7B%22filterState%22%3A%7B%22price%22%3A%7B%22min%22%3A0%2C%22max%22%3A300000%7D%2C%22mp%22%3A%7B%22max%22%3A55000%7D%2C%22built%22%3A%7B%22min%22%3A1970%7D%2C%22land%22%3A%7B%22value%22%3Afalse%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22hoa%22%3A%7B%22max%22%3A200%7D%7D%7D",
      "https://www.zillow.com/athens-ga-30622/?searchQueryState=%7B%22filterState%22%3A%7B%22price%22%3A%7B%22min%22%3A0%2C%22max%22%3A300000%7D%2C%22mp%22%3A%7B%22max%22%3A55000%7D%2C%22built%22%3A%7B%22min%22%3A1970%7D%2C%22land%22%3A%7B%22value%22%3Afalse%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22hoa%22%3A%7B%22max%22%3A200%7D%7D%7D",
      "https://www.zillow.com/athens-ga-30677/?searchQueryState=%7B%22filterState%22%3A%7B%22price%22%3A%7B%22min%22%3A0%2C%22max%22%3A300000%7D%2C%22mp%22%3A%7B%22max%22%3A55000%7D%2C%22built%22%3A%7B%22min%22%3A1970%7D%2C%22land%22%3A%7B%22value%22%3Afalse%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22hoa%22%3A%7B%22max%22%3A200%7D%7D%7D",
      "https://www.zillow.com/athens-ga-30506/?searchQueryState=%7B%22filterState%22%3A%7B%22price%22%3A%7B%22min%22%3A0%2C%22max%22%3A300000%7D%2C%22mp%22%3A%7B%22max%22%3A55000%7D%2C%22built%22%3A%7B%22min%22%3A1970%7D%2C%22land%22%3A%7B%22value%22%3Afalse%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22hoa%22%3A%7B%22max%22%3A200%7D%7D%7D"
    ],
    "homesPerUrl": 1000
  }'
```

### Columbus, OH (10 zips)
```bash
curl -X POST "https://api.apify.com/v2/acts/api-ninja~zillow-search-scraper/runs?token=$APIFY_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "searchUrls": [
      "https://www.zillow.com/columbus-oh-43235/?searchQueryState=%7B%22filterState%22%3A%7B%22price%22%3A%7B%22min%22%3A0%2C%22max%22%3A300000%7D%2C%22mp%22%3A%7B%22max%22%3A55000%7D%2C%22built%22%3A%7B%22min%22%3A1970%7D%2C%22land%22%3A%7B%22value%22%3Afalse%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22hoa%22%3A%7B%22max%22%3A200%7D%7D%7D",
      "https://www.zillow.com/columbus-oh-43017/?searchQueryState=%7B%22filterState%22%3A%7B%22price%22%3A%7B%22min%22%3A0%2C%22max%22%3A300000%7D%2C%22mp%22%3A%7B%22max%22%3A55000%7D%2C%22built%22%3A%7B%22min%22%3A1970%7D%2C%22land%22%3A%7B%22value%22%3Afalse%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22hoa%22%3A%7B%22max%22%3A200%7D%7D%7D",
      "https://www.zillow.com/columbus-oh-43240/?searchQueryState=%7B%22filterState%22%3A%7B%22price%22%3A%7B%22min%22%3A0%2C%22max%22%3A300000%7D%2C%22mp%22%3A%7B%22max%22%3A55000%7D%2C%22built%22%3A%7B%22min%22%3A1970%7D%2C%22land%22%3A%7B%22value%22%3Afalse%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22hoa%22%3A%7B%22max%22%3A200%7D%7D%7D",
      "https://www.zillow.com/columbus-oh-43229/?searchQueryState=%7B%22filterState%22%3A%7B%22price%22%3A%7B%22min%22%3A0%2C%22max%22%3A300000%7D%2C%22mp%22%3A%7B%22max%22%3A55000%7D%2C%22built%22%3A%7B%22min%22%3A1970%7D%2C%22land%22%3A%7B%22value%22%3Afalse%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22hoa%22%3A%7B%22max%22%3A200%7D%7D%7D",
      "https://www.zillow.com/columbus-oh-43202/?searchQueryState=%7B%22filterState%22%3A%7B%22price%22%3A%7B%22min%22%3A0%2C%22max%22%3A300000%7D%2C%22mp%22%3A%7B%22max%22%3A55000%7D%2C%22built%22%3A%7B%22min%22%3A1970%7D%2C%22land%22%3A%7B%22value%22%3Afalse%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22hoa%22%3A%7B%22max%22%3A200%7D%7D%7D",
      "https://www.zillow.com/columbus-oh-43210/?searchQueryState=%7B%22filterState%22%3A%7B%22price%22%3A%7B%22min%22%3A0%2C%22max%22%3A300000%7D%2C%22mp%22%3A%7B%22max%22%3A55000%7D%2C%22built%22%3A%7B%22min%22%3A1970%7D%2C%22land%22%3A%7B%22value%22%3Afalse%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22hoa%22%3A%7B%22max%22%3A200%7D%7D%7D",
      "https://www.zillow.com/columbus-oh-43201/?searchQueryState=%7B%22filterState%22%3A%7B%22price%22%3A%7B%22min%22%3A0%2C%22max%22%3A300000%7D%2C%22mp%22%3A%7B%22max%22%3A55000%7D%2C%22built%22%3A%7B%22min%22%3A1970%7D%2C%22land%22%3A%7B%22value%22%3Afalse%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22hoa%22%3A%7B%22max%22%3A200%7D%7D%7D",
      "https://www.zillow.com/columbus-oh-43214/?searchQueryState=%7B%22filterState%22%3A%7B%22price%22%3A%7B%22min%22%3A0%2C%22max%22%3A300000%7D%2C%22mp%22%3A%7B%22max%22%3A55000%7D%2C%22built%22%3A%7B%22min%22%3A1970%7D%2C%22land%22%3A%7B%22value%22%3Afalse%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22hoa%22%3A%7B%22max%22%3A200%7D%7D%7D",
      "https://www.zillow.com/columbus-oh-43228/?searchQueryState=%7B%22filterState%22%3A%7B%22price%22%3A%7B%22min%22%3A0%2C%22max%22%3A300000%7D%2C%22mp%22%3A%7B%22max%22%3A55000%7D%2C%22built%22%3A%7B%22min%22%3A1970%7D%2C%22land%22%3A%7B%22value%22%3Afalse%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22hoa%22%3A%7B%22max%22%3A200%7D%7D%7D",
      "https://www.zillow.com/columbus-oh-43223/?searchQueryState=%7B%22filterState%22%3A%7B%22price%22%3A%7B%22min%22%3A0%2C%22max%22%3A300000%7D%2C%22mp%22%3A%7B%22max%22%3A55000%7D%2C%22built%22%3A%7B%22min%22%3A1970%7D%2C%22land%22%3A%7B%22value%22%3Afalse%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22hoa%22%3A%7B%22max%22%3A200%7D%7D%7D"
    ],
    "homesPerUrl": 1000
  }'
```

## 3. Check Run Status

After starting a run, you'll get a run ID. Use it to check status:

```bash
# Replace RUN_ID with actual ID from response
curl "https://api.apify.com/v2/acts/api-ninja~zillow-search-scraper/runs/RUN_ID?token=$APIFY_KEY"
```

## 4. Get Results

Once the run is SUCCEEDED, get the results:

```bash
# Replace RUN_ID with actual ID
curl "https://api.apify.com/v2/acts/api-ninja~zillow-search-scraper/runs/RUN_ID/dataset/items?token=$APIFY_KEY" > results.json
```

## Alternative: Use Apify Console

1. Go to https://console.apify.com
2. Find "api-ninja/zillow-search-scraper"  
3. Click "Run"
4. Paste the searchUrls array from above
5. Set homesPerUrl to 1000
6. Click "Start"

## What These URLs Do

- **NO days-on-market filter** - Gets ALL active listings
- **1970+ built homes only**
- **$0-$300,000 price range**
- **Max $55,000 monthly payment**
- **Max $200 HOA**
- **Excludes**: land, apartments, manufactured homes, 55+ communities

Each run will return ALL properties matching these criteria in your 30 target zip codes.