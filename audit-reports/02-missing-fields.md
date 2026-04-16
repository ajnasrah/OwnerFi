# Audit 02 — Critical Field Completeness

- Generated: 2026-04-16T19:08:34.957Z
- Total docs: 10580
- Active docs: 5346
- Inactive docs: 5234

## Missing-field counts (active docs)

| Field | Missing | % of active |
|---|---:|---:|
| latlng | 42 | 0.79% |
| zipCode | 6 | 0.11% |
| address_or_streetAddress | 0 | 0.00% |
| city | 0 | 0.00% |
| state | 0 | 0.00% |
| price | 0 | 0.00% |
| url_or_hdpUrl | 0 | 0.00% |
| homeType | 0 | 0.00% |
| zpid | 0 | 0.00% |
| dealTypes | 0 | 0.00% |

## By source

| Source | Active | Missing any | % | addr | city | state | zip | price | latlng | url | homeType | zpid | dealTypes |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| scraper-v2 | 3098 | 6 | 0.2% | 0 | 0 | 0 | 4 | 0 | 2 | 0 | 0 | 0 | 0 |
| apify-rebuild | 1194 | 8 | 0.7% | 0 | 0 | 0 | 2 | 0 | 6 | 0 | 0 | 0 | 0 |
| backfill-blast | 921 | 0 | 0.0% | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| agent_outreach | 81 | 34 | 42.0% | 0 | 0 | 0 | 0 | 0 | 34 | 0 | 0 | 0 | 0 |
| agent_outreach_system | 51 | 0 | 0.0% | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| manual-add-v2 | 1 | 0 | 0.0% | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

## Active but terminal homeStatus (should be inactive)

Total: 0

| Source | Count |
|---|---:|

### Sample (up to 25)

| id | source | homeStatus |
|---|---|---|

## Top 3 priority gaps

1. **latlng** — 42 active docs missing
2. **zipCode** — 6 active docs missing
3. **address_or_streetAddress** — 0 active docs missing
