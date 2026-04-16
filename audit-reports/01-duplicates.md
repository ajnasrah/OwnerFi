# Audit #01 — Duplicates

**Input:** `/Users/abdullahabunasrah/Desktop/ownerfi/audit-reports/dump-properties.json`
**Docs analyzed:** 10580
**Unique zpids:** 10580
**Docs without usable zpid:** 0

## Counts

| Category | Groups | Affected Docs |
|---|---:|---:|
| Same normalized zpid, >1 doc | 0 | 0 |
| Same Firestore doc ID (should be 0) | 0 | — |
| Same address, DIFFERENT zpids | 8 | 17 |
| Same lat/lng (5dp), DIFFERENT zpids | 147 | 409 |
| Same `url` across multiple docs | 0 | — |
| Same `hdpUrl` across multiple docs | 0 | — |

## Source distribution (all docs)

| Source | Count |
|---|---:|
| scraper-v2 | 5196 |
| apify-rebuild | 4257 |
| backfill-blast | 923 |
| agent_outreach | 102 |
| agent_outreach_system | 100 |
| manual-add-v2 | 2 |

## Source distribution (docs in same-zpid dupe groups)

| Source | Count |
|---|---:|

## Top 20 — Same zpid, multiple docs

_None found._

## Top 20 — Same Firestore doc ID (should be zero)

_None found._

## Top 20 — Same normalized address, DIFFERENT zpids (most dangerous)

### 1. key = `undisclosed address little rock ar 72204`  (count=3)

| Doc ID | zpid | Source | Active | Price | City/State | Created | LastScraped |
|---|---|---|---|---:|---|---|---|
| `zpid_313599` | 313599 | apify-rebuild | false | 59500 | Little Rock, AR 72204 | 2025-12-20T03:02:11.000Z | 2026-02-09T06:01:49.000Z |
| `zpid_314206` | 314206 | apify-rebuild | false | 65000 | Little Rock, AR 72204 | 2025-12-20T03:02:11.000Z | 2026-01-25T09:02:21.000Z |
| `zpid_350910` | 350910 | apify-rebuild | true | 99000 | Little Rock, AR 72204 | 2025-12-20T03:02:11.000Z | 2026-04-16T15:32:11.000Z |

### 2. key = `12517 e mile 2 weslaco tx 78596 weslaco tx 78596`  (count=2)

| Doc ID | zpid | Source | Active | Price | City/State | Created | LastScraped |
|---|---|---|---|---:|---|---|---|
| `zpid_2055285424` | 2055285424 | scraper-v2 | false | 299000 | Weslaco, TX 78596 | 2026-02-08T18:04:45.000Z | 2026-02-08T18:31:44.000Z |
| `zpid_460396298` | 460396298 | scraper-v2 | true | 299000 | Weslaco, TX 78596 | 2026-02-14T21:48:59.000Z | 2026-04-16T03:02:16.000Z |

### 3. key = `undisclosed address jacksonville ar 72076 jacksonville ar 72076`  (count=2)

| Doc ID | zpid | Source | Active | Price | City/State | Created | LastScraped |
|---|---|---|---|---:|---|---|---|
| `zpid_271792` | 271792 | scraper-v2 | false | 126000 | Jacksonville, AR 72076 | 2026-02-14T21:48:59.000Z | 2026-02-22T12:01:44.000Z |
| `zpid_82831601` | 82831601 | scraper-v2 | true | 224000 | Jacksonville, AR 72076 | 2026-02-10T18:05:37.000Z | 2026-04-14T14:31:21.000Z |

### 4. key = `undisclosed address n little rock ar 72116`  (count=2)

| Doc ID | zpid | Source | Active | Price | City/State | Created | LastScraped |
|---|---|---|---|---:|---|---|---|
| `zpid_294367` | 294367 | apify-rebuild | true | 124000 | N Little Rock, AR 72116 | 2025-12-20T03:02:11.000Z | 2026-04-16T13:32:20.000Z |
| `zpid_301965` | 301965 | apify-rebuild | false | 190000 | N Little Rock, AR 72116 | 2025-12-20T03:02:11.000Z | 2026-01-17T19:32:29.000Z |

### 5. key = `undisclosed address little rock ar 72202`  (count=2)

| Doc ID | zpid | Source | Active | Price | City/State | Created | LastScraped |
|---|---|---|---|---:|---|---|---|
| `zpid_314977` | 314977 | agent_outreach_system | true | 70000 | Little Rock, AR 72202 | 2026-03-25T14:00:40.000Z | 2026-04-16T17:32:00.000Z |
| `zpid_315562` | 315562 | agent_outreach_system | true | 70000 | Little Rock, AR 72202 | 2026-03-19T12:00:23.000Z | 2026-04-13T10:31:00.000Z |

### 6. key = `3300 15th st w space 383 rosamond ca 93560 rosamond ca 93560`  (count=2)

| Doc ID | zpid | Source | Active | Price | City/State | Created | LastScraped |
|---|---|---|---|---:|---|---|---|
| `zpid_340043120` | 340043120 | scraper-v2 | true | 119900 | Rosamond, CA 93560 | 2026-03-17T18:04:51.000Z | 2026-04-16T02:02:37.000Z |
| `zpid_401787067` | 401787067 | scraper-v2 | true | 119900 | Rosamond, CA 93560 | 2026-03-24T18:06:08.000Z | 2026-04-15T22:02:03.000Z |

### 7. key = `concrete edgar rd cuero tx 77954 cuero tx 77954`  (count=2)

| Doc ID | zpid | Source | Active | Price | City/State | Created | LastScraped |
|---|---|---|---|---:|---|---|---|
| `zpid_461459240` | 461459240 | scraper-v2 | true | 287498 | Cuero, TX 77954 | 2026-04-05T18:06:15.000Z | 2026-04-15T18:32:01.000Z |
| `zpid_461459391` | 461459391 | scraper-v2 | true | 169999 | Cuero, TX 77954 | 2026-04-05T18:06:15.000Z | 2026-04-15T18:32:01.000Z |

### 8. key = `n nelson peach springs az 86434 peach springs az 86434`  (count=2)

| Doc ID | zpid | Source | Active | Price | City/State | Created | LastScraped |
|---|---|---|---|---:|---|---|---|
| `zpid_461469641` | 461469641 | scraper-v2 | true | 19900 | Peach Springs, AZ 86434 | 2026-04-05T18:06:16.000Z | 2026-04-15T18:32:01.000Z |
| `zpid_461472183` | 461472183 | scraper-v2 | true | 19900 | Peach Springs, AZ 86434 | 2026-04-05T18:06:15.000Z | 2026-04-15T18:32:01.000Z |

## Top 20 — Same lat/lng (5dp), DIFFERENT zpids

### 1. key = `26.22478,-98.19447`  (count=16)

| Doc ID | zpid | Source | Active | Price | City/State | Created | LastScraped |
|---|---|---|---|---:|---|---|---|
| `zpid_2060494029` | 2060494029 | apify-rebuild | true | 150000 | Pharr, TX 78577 | 2025-12-20T03:02:47.000Z | 2026-04-16T06:02:50.000Z |
| `zpid_2060494030` | 2060494030 | apify-rebuild | true | 150000 | Pharr, TX 78577 | 2025-12-20T03:02:47.000Z | 2026-04-16T06:02:51.000Z |
| `zpid_2065500355` | 2065500355 | apify-rebuild | true | 150000 | Pharr, TX 78577 | 2025-12-20T03:02:47.000Z | 2026-04-16T06:31:55.000Z |
| `zpid_2098203082` | 2098203082 | apify-rebuild | true | 145000 | Pharr, TX 78577 | 2025-12-20T03:02:47.000Z | 2026-04-16T07:32:00.000Z |
| `zpid_2098987141` | 2098987141 | apify-rebuild | true | 147500 | Pharr, TX 78577 | 2025-12-20T03:02:47.000Z | 2026-04-16T07:32:00.000Z |
| `zpid_2098987142` | 2098987142 | apify-rebuild | true | 150000 | Pharr, TX 78577 | 2025-12-20T03:02:47.000Z | 2026-04-16T07:32:01.000Z |
| `zpid_2098987146` | 2098987146 | apify-rebuild | true | 145000 | Pharr, TX 78577 | 2025-12-20T03:02:47.000Z | 2026-04-16T07:32:01.000Z |
| `zpid_2098987149` | 2098987149 | apify-rebuild | true | 150000 | Pharr, TX 78577 | 2025-12-20T03:02:47.000Z | 2026-04-16T07:32:01.000Z |
| `zpid_2098996482` | 2098996482 | apify-rebuild | true | 140000 | Pharr, TX 78577 | 2025-12-20T03:02:47.000Z | 2026-04-16T07:32:01.000Z |
| `zpid_2098997284` | 2098997284 | apify-rebuild | true | 150000 | Pharr, TX 78577 | 2025-12-20T03:02:47.000Z | 2026-04-16T07:32:01.000Z |
| `zpid_2098997362` | 2098997362 | apify-rebuild | true | 150000 | Pharr, TX 78577 | 2025-12-20T03:02:47.000Z | 2026-04-16T07:32:01.000Z |
| `zpid_2098998311` | 2098998311 | apify-rebuild | true | 140000 | Pharr, TX 78577 | 2025-12-20T03:02:47.000Z | 2026-04-16T07:32:01.000Z |
| `zpid_2101500490` | 2101500490 | apify-rebuild | true | 150000 | Pharr, TX 78577 | 2025-12-20T03:02:47.000Z | 2026-04-16T08:02:10.000Z |
| `zpid_2101500492` | 2101500492 | apify-rebuild | true | 150000 | Pharr, TX 78577 | 2025-12-20T03:02:47.000Z | 2026-04-16T08:02:10.000Z |
| `zpid_2101500493` | 2101500493 | apify-rebuild | true | 145000 | Pharr, TX 78577 | 2025-12-20T03:02:47.000Z | 2026-04-16T08:02:10.000Z |
| `zpid_2101500494` | 2101500494 | apify-rebuild | true | 137500 | Pharr, TX 78577 | 2025-12-20T03:02:47.000Z | 2026-04-16T08:02:10.000Z |

### 2. key = `28.61372,-100.44273`  (count=15)

| Doc ID | zpid | Source | Active | Price | City/State | Created | LastScraped |
|---|---|---|---|---:|---|---|---|
| `zpid_450293865` | 450293865 | apify-rebuild | false | 198000 | Eagle Pass, TX 78852 | 2025-12-20T03:02:22.000Z | 2026-01-11T21:01:38.000Z |
| `zpid_458051956` | 458051956 | scraper-v2 | true | 220000 | Eagle Pass, TX 78852 | 2026-01-23T18:06:22.000Z | 2026-04-16T05:03:12.000Z |
| `zpid_458051957` | 458051957 | scraper-v2 | true | 220000 | Eagle Pass, TX 78852 | 2026-01-23T18:06:23.000Z | 2026-04-16T05:03:13.000Z |
| `zpid_458051958` | 458051958 | scraper-v2 | true | 199000 | Eagle Pass, TX 78852 | 2026-01-23T18:06:22.000Z | 2026-04-16T05:03:13.000Z |
| `zpid_458051959` | 458051959 | scraper-v2 | true | 199000 | Eagle Pass, TX 78852 | 2026-01-23T18:06:23.000Z | 2026-04-16T05:03:13.000Z |
| `zpid_458051961` | 458051961 | scraper-v2 | true | 199000 | Eagle Pass, TX 78852 | 2026-01-23T18:06:22.000Z | 2026-04-16T05:03:13.000Z |
| `zpid_458051993` | 458051993 | scraper-v2 | true | 199000 | Eagle Pass, TX 78852 | 2026-01-23T18:06:22.000Z | 2026-04-16T05:03:13.000Z |
| `zpid_458051997` | 458051997 | scraper-v2 | false | 199000 | Eagle Pass, TX 78852 | 2026-01-23T18:06:24.000Z | 2026-03-25T03:02:33.000Z |
| `zpid_458051998` | 458051998 | scraper-v2 | true | 199000 | Eagle Pass, TX 78852 | 2026-01-23T18:06:24.000Z | 2026-04-16T05:03:13.000Z |
| `zpid_458051999` | 458051999 | scraper-v2 | true | 199000 | Eagle Pass, TX 78852 | 2026-01-23T18:06:24.000Z | 2026-04-16T05:03:13.000Z |
| `zpid_458052000` | 458052000 | scraper-v2 | true | 199000 | Eagle Pass, TX 78852 | 2026-01-23T18:06:22.000Z | 2026-04-16T05:03:13.000Z |
| `zpid_458052002` | 458052002 | scraper-v2 | true | 199000 | Eagle Pass, TX 78852 | 2026-01-23T18:06:22.000Z | 2026-04-16T05:03:13.000Z |
| `zpid_458052004` | 458052004 | scraper-v2 | true | 199000 | Eagle Pass, TX 78852 | 2026-01-23T18:06:23.000Z | 2026-04-16T05:03:13.000Z |
| `zpid_458052012` | 458052012 | scraper-v2 | true | 199000 | Eagle Pass, TX 78852 | 2026-01-23T18:06:23.000Z | 2026-04-16T05:03:13.000Z |
| `zpid_459904244` | 459904244 | scraper-v2 | true | 199000 | Eagle Pass, TX 78852 | 2026-01-23T18:06:22.000Z | 2026-04-16T05:32:03.000Z |

### 3. key = `26.16641,-98.11752`  (count=9)

| Doc ID | zpid | Source | Active | Price | City/State | Created | LastScraped |
|---|---|---|---|---:|---|---|---|
| `zpid_461610238` | 461610238 | scraper-v2 | true | 52000 | Alamo, TX 78516 | 2026-04-11T18:05:47.000Z | 2026-04-15T10:01:34.000Z |
| `zpid_461610239` | 461610239 | scraper-v2 | true | 48000 | Alamo, TX 78516 | 2026-04-11T18:05:47.000Z | 2026-04-15T10:01:34.000Z |
| `zpid_461610307` | 461610307 | scraper-v2 | true | 48000 | Alamo, TX 78516 | 2026-04-11T18:05:47.000Z | 2026-04-15T10:01:34.000Z |
| `zpid_461610481` | 461610481 | scraper-v2 | true | 48000 | Alamo, TX 78516 | 2026-04-11T18:05:46.000Z | 2026-04-15T10:01:34.000Z |
| `zpid_461610549` | 461610549 | scraper-v2 | true | 48000 | Alamo, TX 78516 | 2026-04-11T18:05:47.000Z | 2026-04-15T10:01:34.000Z |
| `zpid_461610577` | 461610577 | scraper-v2 | true | 48000 | Alamo, TX 78516 | 2026-04-11T18:05:47.000Z | 2026-04-15T10:01:34.000Z |
| `zpid_461610584` | 461610584 | scraper-v2 | true | 48000 | Alamo, TX 78516 | 2026-04-11T18:05:47.000Z | 2026-04-15T10:01:34.000Z |
| `zpid_461610591` | 461610591 | scraper-v2 | true | 48000 | Alamo, TX 78516 | 2026-04-11T18:05:47.000Z | 2026-04-15T10:01:34.000Z |
| `zpid_461610602` | 461610602 | scraper-v2 | true | 48000 | Alamo, TX 78516 | 2026-04-11T18:05:47.000Z | 2026-04-15T10:01:34.000Z |

### 4. key = `26.16305,-98.11955`  (count=9)

| Doc ID | zpid | Source | Active | Price | City/State | Created | LastScraped |
|---|---|---|---|---:|---|---|---|
| `zpid_461610737` | 461610737 | scraper-v2 | true | 48000 | Alamo, TX 78516 | 2026-04-11T18:05:47.000Z | 2026-04-15T10:01:34.000Z |
| `zpid_461610738` | 461610738 | scraper-v2 | true | 48000 | Alamo, TX 78516 | 2026-04-11T18:05:47.000Z | 2026-04-15T10:01:34.000Z |
| `zpid_461610739` | 461610739 | scraper-v2 | true | 48000 | Alamo, TX 78516 | 2026-04-11T18:05:47.000Z | 2026-04-15T10:01:34.000Z |
| `zpid_461610740` | 461610740 | scraper-v2 | true | 48000 | Alamo, TX 78516 | 2026-04-11T18:05:47.000Z | 2026-04-15T10:01:34.000Z |
| `zpid_461610748` | 461610748 | scraper-v2 | true | 48000 | Alamo, TX 78516 | 2026-04-11T18:05:47.000Z | 2026-04-15T10:01:34.000Z |
| `zpid_461610757` | 461610757 | scraper-v2 | true | 48000 | Alamo, TX 78516 | 2026-04-11T18:05:47.000Z | 2026-04-15T10:01:34.000Z |
| `zpid_461610758` | 461610758 | scraper-v2 | true | 48000 | Alamo, TX 78516 | 2026-04-11T18:05:47.000Z | 2026-04-15T10:01:34.000Z |
| `zpid_461610769` | 461610769 | scraper-v2 | true | 48000 | Alamo, TX 78516 | 2026-04-11T18:05:47.000Z | 2026-04-15T10:01:34.000Z |
| `zpid_461617229` | 461617229 | scraper-v2 | true | 48000 | Alamo, TX 78516 | 2026-04-11T18:05:49.000Z | 2026-04-15T10:01:34.000Z |

### 5. key = `35.47000,-88.52040`  (count=8)

| Doc ID | zpid | Source | Active | Price | City/State | Created | LastScraped |
|---|---|---|---|---:|---|---|---|
| `zpid_461139591` | 461139591 | scraper-v2 | true | 58000 | Jacks Creek, TN 38347 | 2026-03-19T08:37:03.000Z | 2026-04-16T17:01:53.000Z |
| `zpid_461140501` | 461140501 | scraper-v2 | true | 28000 | Jacks Creek, TN 38347 | 2026-03-19T08:37:04.000Z | 2026-04-16T17:01:53.000Z |
| `zpid_461140853` | 461140853 | scraper-v2 | true | 60000 | Jacks Creek, TN 38347 | 2026-03-19T08:37:04.000Z | 2026-04-16T17:01:54.000Z |
| `zpid_461141429` | 461141429 | scraper-v2 | true | 46000 | Jacks Creek, TN 38347 | 2026-03-19T08:37:03.000Z | 2026-04-16T17:01:54.000Z |
| `zpid_461141696` | 461141696 | scraper-v2 | true | 68000 | Jacks Creek, TN 38347 | 2026-03-19T08:37:04.000Z | 2026-04-16T17:31:58.000Z |
| `zpid_461141910` | 461141910 | scraper-v2 | true | 105000 | Jacks Creek, TN 38347 | 2026-03-19T08:37:03.000Z | 2026-04-16T17:31:59.000Z |
| `zpid_461142120` | 461142120 | scraper-v2 | true | 52000 | Jacks Creek, TN 38347 | 2026-03-19T08:37:04.000Z | 2026-04-16T17:31:59.000Z |
| `zpid_461143071` | 461143071 | scraper-v2 | true | 90000 | Jacks Creek, TN 38347 | 2026-03-19T08:37:02.000Z | 2026-04-16T17:31:59.000Z |

### 6. key = `34.64085,-86.49198`  (count=7)

| Doc ID | zpid | Source | Active | Price | City/State | Created | LastScraped |
|---|---|---|---|---:|---|---|---|
| `zpid_109235026` | 109235026 | backfill-blast | true | 100000 | Owens Cross Roads, AL 35763 | 2026-04-14T18:37:01.000Z | 2026-04-14T21:01:31.000Z |
| `zpid_109237642` | 109237642 | backfill-blast | true | 100000 | Owens Cross Roads, AL 35763 | 2026-04-14T18:37:01.000Z | 2026-04-14T21:01:31.000Z |
| `zpid_109312801` | 109312801 | backfill-blast | true | 100000 | Owens Cross Roads, AL 35763 | 2026-04-14T18:37:01.000Z | 2026-04-14T21:01:31.000Z |
| `zpid_109374451` | 109374451 | backfill-blast | true | 100000 | Owens Cross Roads, AL 35763 | 2026-04-14T18:37:01.000Z | 2026-04-14T21:01:31.000Z |
| `zpid_109414715` | 109414715 | backfill-blast | true | 100000 | Owens Cross Roads, AL 35763 | 2026-04-14T18:37:01.000Z | 2026-04-14T21:01:31.000Z |
| `zpid_109458594` | 109458594 | backfill-blast | true | 100000 | Owens Cross Roads, AL 35763 | 2026-04-14T18:37:17.000Z | 2026-04-14T21:01:31.000Z |
| `zpid_109505925` | 109505925 | backfill-blast | true | 100000 | Owens Cross Roads, AL 35763 | 2026-04-14T18:37:17.000Z | 2026-04-14T21:01:31.000Z |

### 7. key = `46.87765,-96.78725`  (count=7)

| Doc ID | zpid | Source | Active | Price | City/State | Created | LastScraped |
|---|---|---|---|---:|---|---|---|
| `zpid_2072160506` | 2072160506 | apify-rebuild | true | 450000 | Fargo, ND 58102 | 2025-12-20T03:02:31.000Z | 2026-04-16T07:02:26.000Z |
| `zpid_2078187382` | 2078187382 | apify-rebuild | false | 290000 | Fargo, ND 58102 | 2025-12-20T03:02:31.000Z | 2025-12-24T22:01:04.000Z |
| `zpid_2079525849` | 2079525849 | apify-rebuild | true | 190000 | Fargo, ND 58102 | 2025-12-20T03:02:31.000Z | 2026-04-16T07:31:58.000Z |
| `zpid_2081802974` | 2081802974 | apify-rebuild | true | 350000 | Fargo, ND 58102 | 2025-12-20T03:02:31.000Z | 2026-04-16T07:31:59.000Z |
| `zpid_2081802978` | 2081802978 | apify-rebuild | true | 290000 | Fargo, ND 58102 | 2025-12-20T03:02:31.000Z | 2026-04-16T07:31:59.000Z |
| `zpid_2081802980` | 2081802980 | apify-rebuild | true | 199000 | Fargo, ND 58102 | 2025-12-20T03:02:26.000Z | 2026-04-16T07:31:59.000Z |
| `zpid_2081802981` | 2081802981 | apify-rebuild | true | 275000 | Fargo, ND 58102 | 2025-12-20T03:02:26.000Z | 2026-04-16T07:31:59.000Z |

### 8. key = `34.62338,-86.50218`  (count=6)

| Doc ID | zpid | Source | Active | Price | City/State | Created | LastScraped |
|---|---|---|---|---:|---|---|---|
| `zpid_2065657011` | 2065657011 | backfill-blast | true | 93391 | Owens Cross Roads, AL 35763 | 2026-04-14T18:37:01.000Z | 2026-04-14T23:01:10.000Z |
| `zpid_2065663022` | 2065663022 | backfill-blast | true | 107600 | Owens Cross Roads, AL 35763 | 2026-04-14T18:37:01.000Z | 2026-04-14T23:01:10.000Z |
| `zpid_2065663023` | 2065663023 | backfill-blast | true | 99707 | Owens Cross Roads, AL 35763 | 2026-04-14T18:37:01.000Z | 2026-04-14T23:01:10.000Z |
| `zpid_2065663024` | 2065663024 | backfill-blast | true | 98957 | Owens Cross Roads, AL 35763 | 2026-04-14T18:37:01.000Z | 2026-04-14T23:01:10.000Z |
| `zpid_352337481` | 352337481 | backfill-blast | true | 98332 | Owens Cross Roads, AL 35763 | 2026-04-14T18:37:01.000Z | 2026-04-15T00:32:51.000Z |
| `zpid_455556140` | 455556140 | backfill-blast | true | 87500 | Owens Cross Roads, AL 35763 | 2026-04-14T18:37:01.000Z | 2026-04-15T01:31:29.000Z |

### 9. key = `33.56002,-95.35114`  (count=6)

| Doc ID | zpid | Source | Active | Price | City/State | Created | LastScraped |
|---|---|---|---|---:|---|---|---|
| `zpid_461463285` | 461463285 | scraper-v2 | true | 27900 | Pattonville, TX 75468 | 2026-04-05T18:06:14.000Z | 2026-04-15T18:32:01.000Z |
| `zpid_461464128` | 461464128 | scraper-v2 | true | 27900 | Pattonville, TX 75468 | 2026-04-05T18:06:14.000Z | 2026-04-15T18:32:01.000Z |
| `zpid_461464435` | 461464435 | scraper-v2 | true | 27900 | Pattonville, TX 75468 | 2026-04-05T18:06:14.000Z | 2026-04-15T18:32:01.000Z |
| `zpid_461464861` | 461464861 | scraper-v2 | true | 38900 | Pattonville, TX 75468 | 2026-04-05T18:06:16.000Z | 2026-04-15T18:32:01.000Z |
| `zpid_461521706` | 461521706 | scraper-v2 | true | 49900 | Pattonville, TX 75468 | 2026-04-08T18:06:01.000Z | 2026-04-15T14:02:04.000Z |
| `zpid_461522519` | 461522519 | scraper-v2 | true | 69900 | Pattonville, TX 75468 | 2026-04-08T18:05:59.000Z | 2026-04-15T14:02:04.000Z |

### 10. key = `45.61112,-91.58835`  (count=5)

| Doc ID | zpid | Source | Active | Price | City/State | Created | LastScraped |
|---|---|---|---|---:|---|---|---|
| `zpid_299227465` | 299227465 | apify-rebuild | false | 295950 | Birchwood, WI 54817 | 2025-12-20T03:02:31.000Z | 2026-03-25T09:01:42.000Z |
| `zpid_299227468` | 299227468 | apify-rebuild | false | 249950 | Birchwood, WI 54817 | 2025-12-20T03:02:26.000Z | 2026-03-25T09:01:42.000Z |
| `zpid_299234771` | 299234771 | apify-rebuild | false | 249950 | Birchwood, WI 54817 | 2025-12-20T03:02:31.000Z | 2026-03-25T09:01:42.000Z |
| `zpid_299234772` | 299234772 | apify-rebuild | false | 249950 | Birchwood, WI 54817 | 2025-12-20T03:02:26.000Z | 2026-03-25T09:01:42.000Z |
| `zpid_351178658` | 351178658 | apify-rebuild | false | 295950 | Birchwood, WI 54817 | 2025-12-20T03:02:31.000Z | 2026-03-25T11:01:47.000Z |

### 11. key = `38.88012,-76.99524`  (count=5)

| Doc ID | zpid | Source | Active | Price | City/State | Created | LastScraped |
|---|---|---|---|---:|---|---|---|
| `zpid_420409611` | 420409611 | apify-rebuild | true | 585000 | Washington, DC 20003 | 2025-12-20T03:02:26.000Z | 2026-04-16T17:01:51.000Z |
| `zpid_439639782` | 439639782 | apify-rebuild | true | 299000 | Washington, DC 20003 | 2025-12-20T03:02:26.000Z | 2026-04-13T10:01:06.000Z |
| `zpid_440048762` | 440048762 | apify-rebuild | false | 518000 | Washington, DC 20003 | 2025-12-20T03:02:31.000Z | 2026-02-17T21:02:21.000Z |
| `zpid_448352488` | 448352488 | apify-rebuild | true | 615000 | Washington, DC 20003 | 2025-12-20T03:02:26.000Z | 2026-04-14T14:01:29.000Z |
| `zpid_453524733` | 453524733 | apify-rebuild | false | 620000 | Washington, DC 20003 | 2025-12-20T03:02:26.000Z | 2026-03-30T08:02:34.000Z |

### 12. key = `35.47040,-88.52080`  (count=5)

| Doc ID | zpid | Source | Active | Price | City/State | Created | LastScraped |
|---|---|---|---|---:|---|---|---|
| `zpid_461140621` | 461140621 | scraper-v2 | true | 29000 | Jacks Creek, TN 38347 | 2026-03-19T08:37:03.000Z | 2026-04-16T17:01:53.000Z |
| `zpid_461141214` | 461141214 | scraper-v2 | true | 42000 | Jacks Creek, TN 38347 | 2026-03-19T08:37:03.000Z | 2026-04-16T17:01:54.000Z |
| `zpid_461141560` | 461141560 | scraper-v2 | true | 60000 | Jacks Creek, TN 38347 | 2026-03-19T08:37:03.000Z | 2026-04-16T17:01:54.000Z |
| `zpid_461141788` | 461141788 | scraper-v2 | true | 150000 | Jacks Creek, TN 38347 | 2026-03-19T08:37:03.000Z | 2026-04-16T17:31:59.000Z |
| `zpid_461142240` | 461142240 | scraper-v2 | true | 55000 | Jacks Creek, TN 38347 | 2026-03-19T08:37:04.000Z | 2026-04-16T17:31:59.000Z |

### 13. key = `34.62339,-86.50118`  (count=4)

| Doc ID | zpid | Source | Active | Price | City/State | Created | LastScraped |
|---|---|---|---|---:|---|---|---|
| `zpid_2058807798` | 2058807798 | backfill-blast | true | 82900 | Owens Cross Roads, AL 35763 | 2026-04-14T18:37:01.000Z | 2026-04-14T23:01:10.000Z |
| `zpid_456268126` | 456268126 | backfill-blast | true | 89900 | Owens Cross Roads, AL 35763 | 2026-04-14T18:37:01.000Z | 2026-04-15T01:31:29.000Z |
| `zpid_456268127` | 456268127 | backfill-blast | true | 98500 | Owens Cross Roads, AL 35763 | 2026-04-14T18:37:17.000Z | 2026-04-15T01:31:29.000Z |
| `zpid_456305462` | 456305462 | backfill-blast | true | 84900 | Owens Cross Roads, AL 35763 | 2026-04-14T18:37:17.000Z | 2026-04-15T01:31:29.000Z |

### 14. key = `47.00934,-124.16713`  (count=4)

| Doc ID | zpid | Source | Active | Price | City/State | Created | LastScraped |
|---|---|---|---|---:|---|---|---|
| `zpid_2103391489` | 2103391489 | apify-rebuild | false | 159900 | Ocean Shores, WA 98569 | 2025-12-20T03:02:22.000Z | 2026-01-31T09:32:25.000Z |
| `zpid_2109762429` | 2109762429 | apify-rebuild | false | 159900 | Ocean Shores, WA 98569 | 2025-12-20T03:02:26.000Z | 2026-01-31T10:01:58.000Z |
| `zpid_2113373562` | 2113373562 | apify-rebuild | false | 154900 | Ocean Shores, WA 98569 | 2025-12-20T03:02:22.000Z | 2026-01-31T10:01:58.000Z |
| `zpid_459688026` | 459688026 | scraper-v2 | false | 165000 | Ocean Shores, WA 98569 | 2026-01-11T18:04:51.000Z | 2026-02-03T00:02:34.000Z |

### 15. key = `35.70800,-83.55967`  (count=4)

| Doc ID | zpid | Source | Active | Price | City/State | Created | LastScraped |
|---|---|---|---|---:|---|---|---|
| `zpid_214909817` | 214909817 | apify-rebuild | true | 199899 | Gatlinburg, TN 37738 | 2025-12-20T03:02:39.000Z | 2026-04-16T09:02:16.000Z |
| `zpid_214909841` | 214909841 | apify-rebuild | true | 229999 | Gatlinburg, TN 37738 | 2025-12-20T03:02:39.000Z | 2026-04-16T09:02:16.000Z |
| `zpid_214909843` | 214909843 | apify-rebuild | true | 249299 | Gatlinburg, TN 37738 | 2025-12-20T03:02:39.000Z | 2026-04-16T09:02:16.000Z |
| `zpid_214909856` | 214909856 | apify-rebuild | true | 259999 | Gatlinburg, TN 37738 | 2025-12-20T03:02:39.000Z | 2026-04-16T09:02:16.000Z |

### 16. key = `29.42193,-98.52206`  (count=4)

| Doc ID | zpid | Source | Active | Price | City/State | Created | LastScraped |
|---|---|---|---|---:|---|---|---|
| `zpid_26214778` | 26214778 | scraper-v2 | true | 150000 | San Antonio, TX 78207 | 2026-04-05T18:06:14.000Z | 2026-04-15T17:31:46.000Z |
| `zpid_26217494` | 26217494 | scraper-v2 | true | 99000 | San Antonio, TX 78207 | 2026-03-21T18:04:44.000Z | 2026-04-15T23:01:42.000Z |
| `zpid_26222350` | 26222350 | scraper-v2 | false | 160000 | San Antonio, TX 78207 | 2026-03-01T18:04:24.000Z | 2026-03-16T06:53:24.000Z |
| `zpid_26229307` | 26229307 | scraper-v2 | true | 153000 | San Antonio, TX 78207 | 2026-02-25T18:05:32.000Z | 2026-04-14T13:31:39.000Z |

### 17. key = `29.41995,-98.57191`  (count=4)

| Doc ID | zpid | Source | Active | Price | City/State | Created | LastScraped |
|---|---|---|---|---:|---|---|---|
| `zpid_26236925` | 26236925 | scraper-v2 | true | 165000 | San Antonio, TX 78237 | 2026-04-10T18:05:34.000Z | 2026-04-13T20:31:05.000Z |
| `zpid_26251277` | 26251277 | scraper-v2 | false | 150000 | San Antonio, TX 78237 | 2026-02-25T18:05:34.000Z | 2026-02-25T18:32:10.000Z |
| `zpid_26256669` | 26256669 | scraper-v2 | true | 150000 | San Antonio, TX 78237 | 2026-04-11T18:05:49.000Z | 2026-04-15T09:31:25.000Z |
| `zpid_26325050` | 26325050 | scraper-v2 | true | 152500 | San Antonio, TX 78237 | 2026-04-05T18:06:16.000Z | 2026-04-15T17:31:46.000Z |

### 18. key = `26.16818,-97.89528`  (count=4)

| Doc ID | zpid | Source | Active | Price | City/State | Created | LastScraped |
|---|---|---|---|---:|---|---|---|
| `zpid_341681552` | 341681552 | apify-rebuild | true | 209900 | Mercedes, TX 78570 | 2025-12-20T03:02:11.000Z | 2026-04-16T15:01:57.000Z |
| `zpid_448727785` | 448727785 | apify-rebuild | false | 209900 | Mercedes, TX 78570 | 2025-12-20T03:02:11.000Z | 2026-03-08T09:02:02.000Z |
| `zpid_448729453` | 448729453 | apify-rebuild | false | 209900 | Mercedes, TX 78570 | 2025-12-20T03:02:11.000Z | 2026-01-11T20:01:27.000Z |
| `zpid_448812753` | 448812753 | apify-rebuild | false | 219900 | Mercedes, TX 78570 | 2025-12-20T03:02:11.000Z |  |

### 19. key = `35.54404,-88.81619`  (count=4)

| Doc ID | zpid | Source | Active | Price | City/State | Created | LastScraped |
|---|---|---|---|---:|---|---|---|
| `zpid_343948909` | 343948909 | scraper-v2 | true | 47000 | Pinson, TN 38366 | 2026-01-10T18:05:48.000Z | 2026-04-16T16:32:03.000Z |
| `zpid_343949303` | 343949303 | scraper-v2 | true | 47000 | Pinson, TN 38366 | 2026-01-10T18:05:48.000Z | 2026-04-16T16:32:03.000Z |
| `zpid_343949727` | 343949727 | scraper-v2 | true | 47000 | Pinson, TN 38366 | 2026-01-10T18:05:48.000Z | 2026-04-16T16:32:04.000Z |
| `zpid_343956649` | 343956649 | scraper-v2 | true | 110000 | Pinson, TN 38366 | 2026-01-10T18:05:48.000Z | 2026-04-16T16:32:04.000Z |

### 20. key = `29.94855,-90.07344`  (count=4)

| Doc ID | zpid | Source | Active | Price | City/State | Created | LastScraped |
|---|---|---|---|---:|---|---|---|
| `zpid_459799941` | 459799941 | scraper-v2 | true | 599000 | New Orleans, LA 70113 | 2026-01-16T18:06:06.000Z | 2026-04-16T09:32:20.000Z |
| `zpid_459929176` | 459929176 | scraper-v2 | true | 699000 | New Orleans, LA 70113 | 2026-01-23T18:06:22.000Z | 2026-04-16T05:32:04.000Z |
| `zpid_460971407` | 460971407 | scraper-v2 | true | 599000 | New Orleans, LA 70113 | 2026-03-12T18:06:42.000Z | 2026-04-16T11:31:35.000Z |
| `zpid_460998107` | 460998107 | scraper-v2 | true | 679000 | New Orleans, LA 70113 | 2026-03-13T18:05:47.000Z | 2026-04-16T19:02:09.000Z |

## Top 20 — Same `url`

_None found._

## Top 20 — Same `hdpUrl`

_None found._
