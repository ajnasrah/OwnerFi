# Audit 09 — Lifecycle / Active Status

Generated: 2026-04-16T19:09:45.544Z
Reference date: 2026-04-16

## Totals
- Total docs: **10580**
- isActive === true: **5346**
- isActive === false: **5234**
- isActive neither (null/undefined/other): **0**

## isActive distribution

| value | count |
|---|---|
| true | 5346 |
| false | 5234 |

## homeStatus frequency

| homeStatus | count |
|---|---|
| FOR_SALE | 6180 |
| PENDING | 2109 |
| OTHER | 2009 |
| RECENTLY_SOLD | 163 |
| PRE_FORECLOSURE | 79 |
| FORECLOSED | 33 |
| SOLD | 7 |

## isActive === true by homeStatus

| homeStatus | count |
|---|---|
| FOR_SALE | 5236 |
| PRE_FORECLOSURE | 78 |
| FORECLOSED | 32 |

## Issue categories

### 1. isActive=true but homeStatus in {SOLD,RECENTLY_SOLD,RECENT_SALE,OFF_MARKET}
- Count: **0**

### 2. isActive=true but deletedAt is set
- Count: **0**

### 3. isActive!=false but lastScrapedAt > 30d (and <=90d)
- Count: **0**

### 4. isActive!=false but lastScrapedAt > 90d
- Count: **0**

### 5. isActive!=false but lastScrapedAt missing
- Count: **0**

### 7. createdAt in future or before 2023
- Count: **0**

### 8. soldAt set but isActive=true
- Count: **0**

### 9. homeStatus=PENDING older than 60d
- Count: **773**
- First 20 IDs:
  - `zpid_102561405`
  - `zpid_102567621`
  - `zpid_102587556`
  - `zpid_102687497`
  - `zpid_103037424`
  - `zpid_103118438`
  - `zpid_103125609`
  - `zpid_103145385`
  - `zpid_103387134`
  - `zpid_105388995`
  - `zpid_105575445`
  - `zpid_106821635`
  - `zpid_107112497`
  - `zpid_1071202`
  - `zpid_107204324`
  - `zpid_108087599`
  - `zpid_108848986`
  - `zpid_109180810`
  - `zpid_109287417`
  - `zpid_1093009`

### 10. isActive is not strictly true/false
- Count: **0**
