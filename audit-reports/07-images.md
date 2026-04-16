# Audit #7: Image / Media Integrity

Total docs scanned: **10580**  
Active docs scanned: **5346**

## Counts

| # | Category | Count |
|---|----------|------:|
| c1 | No primary image | 1213 |
| c2 | `images` is non-array when set | 0 |
| c3 | `imageCount` mismatch vs `images.length` | 0 |
| c4 | Cross-doc dupe image URLs | 0 |
| c5 | Malformed URL (no http/https) | 0 |
| c6 | Placeholder/default image URL | 0 |
| c7 | Suspicious host on primary | 0 |
| c8a | static.zillowstatic primaries | 0 |
| c8b | photos.zillowstatic primaries | 3979 |
| c10 | r2Images set but primary still Zillow | 0 |

## c9 — Primary Image Host Frequency

| Host | Count |
|------|------:|
| `photos.zillowstatic.com` | 3979 |
| `maps.googleapis.com` | 154 |

### c1 — No primary image — 1213

First 20 IDs:

- `zpid_101317013`
- `zpid_101344699`
- `zpid_101699765`
- `zpid_102457484`
- `zpid_10262091`
- `zpid_10300456`
- `zpid_103044669`
- `zpid_103122018`
- `zpid_103145980`
- `zpid_103170082`
- `zpid_103172919`
- `zpid_103227897`
- `zpid_103286166`
- `zpid_103403156`
- `zpid_103411497`
- `zpid_103800897`
- `zpid_10406337`
- `zpid_104088721`
- `zpid_104259529`
- `zpid_104655421`

### c2 — images non-array — 0


### c3 — imageCount mismatch — 0


### c4 — Cross-doc dupe image URLs — 0


### c5 — Malformed URLs — 0


### c6 — Placeholder URLs — 0


### c7 — Suspicious host — 0


### c8a — static.zillowstatic primaries — 0


### c8b — photos.zillowstatic primaries — 3979

- `zpid_102146876`
- `zpid_102166400`
- `zpid_102351903`
- `zpid_102440373`
- `zpid_1024575`
- `zpid_102511019`
- `zpid_102511484`
- `zpid_102574956`
- `zpid_102617232`
- `zpid_102669529`
- `zpid_1027124`
- `zpid_1027215`
- `zpid_1027292`
- `zpid_1027415`
- `zpid_1027523`
- `zpid_1028406`
- `zpid_1028450`
- `zpid_1028462`
- `zpid_102983133`
- `zpid_103182431`

### c10 — r2Images set but primary still Zillow — 0

_none_
