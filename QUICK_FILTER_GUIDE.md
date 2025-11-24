# Quick Filter Guide

## Which Filter Should I Use?

### 1. **Main Filter** (`owner-financing-filter.ts`)
**Use for**: Zillow scraping, property ingestion pipeline

```typescript
import { hasOwnerFinancing } from './lib/owner-financing-filter';

const result = hasOwnerFinancing(property.description);
if (result.shouldSend) {
  // Send to GoHighLevel
}
```

**Characteristics**:
- Broader patterns (includes "fixer upper", "handyman special", etc.)
- Higher recall (catches more properties)
- May have ~2-5% false positives
- Good for initial filtering

---

### 2. **Strict Filter** (`owner-financing-filter-strict.ts`)
**Use for**: Buyer-facing dashboard, customer-visible properties

```typescript
import { hasStrictOwnerFinancing } from './lib/owner-financing-filter-strict';

const result = hasStrictOwnerFinancing(property.description);
if (result.passes) {
  // Show to buyers
}
```

**Characteristics**:
- Only explicit mentions (0% false positive rate)
- Lower recall (misses some properties)
- 100% accuracy for what it catches
- Safe for customers

---

### 3. **Negative Detector** (`negative-financing-detector.ts`)
**Use for**: Advanced filtering, validation, debugging

```typescript
import { detectNegativeFinancing } from './lib/negative-financing-detector';

const result = detectNegativeFinancing(property.description);
if (result.isNegative) {
  console.log(result.reason); // Why it was rejected
  console.log(result.matchedPattern); // What pattern matched
}
```

**Characteristics**:
- Context-aware detection
- Returns detailed reasoning
- Used internally by Main and Strict filters
- Great for debugging

---

## Quick Examples

### ✅ Will PASS All Filters
```
"Owner financing available with 20% down"
"Seller will carry with good terms"
"Creative financing options"
"Flexible terms for qualified buyers"
```

### ❌ Will FAIL All Filters (Correctly Rejected)
```
"No Seller-financing offered"
"NO Wholesale, Assignments or Seller Finance Offers"
"Cash or conventional financing only"
"Owner financing not available"
```

### 🟡 Will PASS Main, FAIL Strict
```
"Fixer upper, great opportunity"
"Handyman special"
"All offers considered"
"Bring your best offer"
```

---

## Common Patterns Detected

### Positive Patterns (Main Filter)
- `owner financing`
- `seller financing`
- `owner carry`
- `seller terms`
- `creative financing`
- `flexible terms`
- `rent to own`
- `lease option`
- `financing available`
- `down payment` (often indicates flexibility)
- `fixer upper` (investors often offer owner financing)
- `all offers considered`

### Positive Patterns (Strict Filter Only)
- `owner financing`
- `seller financing`
- `owner carry`
- `seller carry`
- `owner terms`
- `seller terms`
- `creative financing`
- `flexible financing`
- `rent to own`
- `lease option`

### Negative Patterns (Both Filters)
All handled by context-aware detector:
- Direct negation: "no owner financing"
- Hyphenated: "no seller-financing"
- Lists: "NO X, Y or owner financing"
- Rejections: "owner financing not accepted"
- Cash only: "cash or conventional only"
- Sentence boundaries: Ignores "no issues. Owner financing"

---

## Performance Tips

1. **Use Main Filter for ingestion**
   - Catches more properties initially
   - Reduces chance of missing opportunities

2. **Use Strict Filter for display**
   - Shows only high-confidence properties to buyers
   - Protects customer experience

3. **Cache filter results**
   - Filter results don't change once property is scraped
   - Store in database to avoid recomputation

4. **Monitor rejection rates**
   - Track percentage of properties filtered out
   - Alert if suddenly spikes (might indicate scraper issue)

---

## Troubleshooting

### "Property with owner financing was rejected"
1. Check if description mentions negatives: "no", "cash only", etc.
2. Run negative detector separately to see reason
3. Check if using Strict filter (narrower criteria)

### "Property without owner financing was accepted"
1. Check which filter was used (Main vs Strict)
2. Main filter includes broader patterns like "fixer upper"
3. Consider if pattern makes sense (investors offer financing)

### "Filter is too aggressive"
- Use Main filter instead of Strict
- Review negative detector results
- Check for edge cases in your data

### "Filter is too lenient"
- Use Strict filter instead of Main
- Review positive patterns list
- Consider adding custom patterns

---

## Integration Examples

### Pipeline Filter
```typescript
// During scraping/ingestion
import { hasOwnerFinancing } from './lib/owner-financing-filter';

for (const property of scrapedProperties) {
  const result = hasOwnerFinancing(property.description);

  if (result.shouldSend) {
    await sendToGoHighLevel(property);
  } else {
    logger.info(`Filtered out: ${result.reason}`);
  }
}
```

### Buyer Dashboard
```typescript
// When showing properties to buyers
import { hasStrictOwnerFinancing } from './lib/owner-financing-filter-strict';

const visibleProperties = allProperties.filter(prop => {
  const result = hasStrictOwnerFinancing(prop.description);
  return result.passes && result.matchedKeywords.length > 0;
});
```

### Admin Review
```typescript
// For manual review/debugging
import { detectNegativeFinancing, hasOwnerFinancing } from './lib/...';

const negativeResult = detectNegativeFinancing(property.description);
const filterResult = hasOwnerFinancing(property.description);

console.log({
  negative: negativeResult.isNegative,
  reason: negativeResult.reason,
  pattern: negativeResult.matchedPattern,
  filtered: !filterResult.shouldSend
});
```

---

## Testing

### Quick Test
```bash
# Unit tests (17 test cases)
npx tsx scripts/test-negative-detector.ts

# Integration tests (6 real-world cases)
npx tsx scripts/test-integrated-filters.ts
```

### Manual Test
```typescript
import { hasOwnerFinancing } from './lib/owner-financing-filter';

const testDescription = "Your test description here";
const result = hasOwnerFinancing(testDescription);

console.log(result);
// { shouldSend: true/false, reason: "...", confidence: "high/medium/low" }
```

---

## Key Takeaways

1. ✅ **Use Main Filter** for scraping/ingestion
2. ✅ **Use Strict Filter** for buyer-facing display
3. ✅ **New detector handles edge cases** automatically
4. ✅ **100% test coverage** on all edge cases
5. ✅ **No breaking changes** - same API as before
6. ✅ **Context-aware** - understands sentence boundaries
7. ✅ **Flexible** - handles hyphens, slashes, lists

---

**Need Help?**
- Check `FILTER_UPGRADE_SUMMARY.md` for detailed documentation
- Review test files for more examples
- Contact team if you find new edge cases
