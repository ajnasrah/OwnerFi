# 🛡️ Legal Compliance Guide - Developer Reference

## Quick Reference for Building Compliant UI

This guide helps developers maintain legal compliance when building new features or modifying property-related UI.

---

## 🎯 Golden Rules

### 1. **NEVER display financial estimates without disclaimers**
❌ Bad: `<div>${monthlyPayment}/mo</div>`
✅ Good:
```tsx
import { LEGAL_DISCLAIMERS, SAFE_UI_LABELS } from '@/lib/legal-disclaimers';

<div>
  <div className="text-xs">{SAFE_UI_LABELS.MONTHLY_PAYMENT}</div>
  <div className="text-xl">${monthlyPayment}/mo</div>
  <div className="text-[9px]">{LEGAL_DISCLAIMERS.MONTHLY_PAYMENT}</div>
</div>
```

### 2. **Always use "Illustrative" or "~" for estimates**
❌ Bad: "Est. $1,500/month"
✅ Good: "Illustrative Est. $1,500/mo" or "~$1,500/mo"

### 3. **Badge colors must be neutral (not green/blue)**
❌ Bad: `bg-emerald-500` or `bg-green-500`
✅ Good: `bg-slate-600` or use `LEGAL_COLORS.BADGE_NEUTRAL`

### 4. **Always attribute sources**
❌ Bad: "Monthly Payment: $1,500"
✅ Good: "Monthly Payment (agent-reported): $1,500"

### 5. **Add persistent disclaimers to property views**
Every property detail view must have the persistent warning:
```tsx
<div className={`${LEGAL_COLORS.WARNING_BG} border-2 ${LEGAL_COLORS.WARNING_BORDER} rounded-xl p-2`}>
  <p className={`text-[9px] ${LEGAL_COLORS.WARNING_TEXT} font-semibold text-center`}>
    {LEGAL_DISCLAIMERS.PERSISTENT_WARNING}
  </p>
</div>
```

---

## 📋 Checklist for New Property UI Components

When creating any new component that displays property information:

- [ ] Import `LEGAL_DISCLAIMERS` and `SAFE_UI_LABELS`
- [ ] Add persistent disclaimer if showing financial info
- [ ] Use neutral colors for badges (slate, not green/blue)
- [ ] Add micro-disclaimers under all financial numbers
- [ ] Use "~" or "Illustrative Est." prefixes
- [ ] Add "Agent-reported" or "Third-party data" attribution
- [ ] Include borders around financial estimate sections
- [ ] Test on mobile - disclaimers must be readable
- [ ] Verify no claims look "guaranteed"

---

## 🎨 Approved Color Palette

### For Badges/Status:
- ✅ `bg-slate-500`, `bg-slate-600`, `bg-slate-700` - Neutral, safe
- ❌ `bg-emerald-*`, `bg-green-*` - Implies verification/approval
- ❌ `bg-blue-*` - Implies authority/official

### For Disclaimers:
- ✅ `bg-amber-50` with `border-amber-300` and `text-amber-900`
- ✅ `bg-yellow-50` with `border-yellow-300` (less urgent)
- ✅ `bg-slate-50` with `text-slate-500` (informational)

### For Financial Boxes:
- ✅ Light pastels with borders: `bg-blue-50 border-blue-200`
- ✅ Neutral: `bg-slate-50 border-slate-200`

---

## 📝 Copy Patterns

### Financial Estimates:
```tsx
// Pattern 1: With label
<div>
  <div className="text-xs">{SAFE_UI_LABELS.MONTHLY_PAYMENT}</div>
  <div className="text-2xl">${amount}</div>
  <div className="text-[9px]">{LEGAL_DISCLAIMERS.MONTHLY_PAYMENT}</div>
</div>

// Pattern 2: Inline
<span className="text-lg">
  {SAFE_UI_LABELS.MONTHLY_PAYMENT} ${amount}
</span>
<span className="text-[9px] text-slate-500 ml-2">
  {LEGAL_DISCLAIMERS.MONTHLY_PAYMENT}
</span>
```

### Property Descriptions:
```tsx
<div className="border border-slate-200 rounded-lg p-4">
  <h3 className="font-bold mb-1">{SAFE_UI_LABELS.PROPERTY_DESCRIPTION}</h3>
  <p className="text-[9px] text-slate-500 italic mb-2">
    {LEGAL_DISCLAIMERS.PROPERTY_DESCRIPTION}
  </p>
  <p>{description}</p>
</div>
```

### Financial Breakdowns:
```tsx
<div className="border border-slate-200 rounded-lg p-4">
  <h3 className="font-bold mb-1">{SAFE_UI_LABELS.PAYMENT_BREAKDOWN}</h3>
  <p className="text-[9px] text-slate-500 mb-3">
    {LEGAL_DISCLAIMERS.PAYMENT_BREAKDOWN}
  </p>
  {/* breakdown items */}
</div>
```

---

## 🚫 Words/Phrases to AVOID

### Avoid Authoritative Language:
- ❌ "Monthly Payment: $1,500" → ✅ "Illustrative Est.: $1,500"
- ❌ "Down Payment Required" → ✅ "Illustrative Down Payment Example"
- ❌ "Interest Rate: 7%" → ✅ "Interest Rate (est): ~7%"
- ❌ "Owner Finance Available" → ✅ "Owner Finance Option"
- ❌ "Negotiable Terms" → ✅ "Terms May Vary"
- ❌ "Investment Potential" → ✅ "Rental Market Reference (Informational Only)"

### Avoid Definitive Statements:
- ❌ "This property offers..." → ✅ "This property may offer..."
- ❌ "Seller provides..." → ✅ "Seller may provide..."
- ❌ "You will save..." → ✅ "Potential to save..."
- ❌ "Guaranteed financing" → ✅ Never use "guaranteed"

### Avoid Unqualified Facts:
- ❌ "2% property tax" → ✅ "~2% property tax (estimated based on area averages)"
- ❌ "$200/mo insurance" → ✅ "~$200/mo insurance (generic estimate)"

---

## 🎯 Component-Specific Guidelines

### Property Cards:
```tsx
import { LEGAL_DISCLAIMERS, SAFE_UI_LABELS, LEGAL_COLORS } from '@/lib/legal-disclaimers';

function PropertyCard({ property }) {
  return (
    <div className="border rounded-lg p-4">
      {/* REQUIRED: Persistent disclaimer at top */}
      <div className={`${LEGAL_COLORS.WARNING_BG} border ${LEGAL_COLORS.WARNING_BORDER} rounded p-2 mb-3`}>
        <p className={`text-[9px] ${LEGAL_COLORS.WARNING_TEXT} font-semibold text-center`}>
          {LEGAL_DISCLAIMERS.PERSISTENT_WARNING}
        </p>
      </div>

      {/* Property details with disclaimers */}
      <div>
        <div className="text-xs">{SAFE_UI_LABELS.MONTHLY_PAYMENT}</div>
        <div className="text-2xl">${property.monthlyPayment}</div>
        <div className="text-[9px]">{LEGAL_DISCLAIMERS.MONTHLY_PAYMENT}</div>
      </div>
    </div>
  );
}
```

### List Views:
- Must show abbreviated disclaimers if space-limited
- Link to full property page for complete details
- Minimum disclaimer: "Est. only - not verified"

### Modals/Popups:
- Disclaimer must be visible without scrolling
- If content scrolls, disclaimer should be at top (always visible)

---

## 🔍 Code Review Checklist

Before submitting PR with property-related UI changes:

### Visual Check:
- [ ] No green/blue badges (only neutral slate/gray)
- [ ] Financial numbers have visible disclaimers nearby
- [ ] Disclaimers are readable on mobile (9-10px minimum)
- [ ] Warning colors used for disclaimers (amber/yellow)

### Text Check:
- [ ] No definitive language ("required", "guaranteed", "will")
- [ ] "~" or "Illustrative Est." used for all estimates
- [ ] "Agent-reported" attribution present
- [ ] "TBD by seller" instead of "Contact seller"

### Structure Check:
- [ ] Imported from `legal-disclaimers.ts`
- [ ] Persistent disclaimer present if showing financial info
- [ ] Borders around financial sections
- [ ] Property descriptions have attribution disclaimer

---

## 📚 Common Scenarios

### Scenario 1: Adding a new financial field
**Example:** You want to display "Closing Costs"

```tsx
<div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
  <div className="text-xs text-slate-600">Illustrative Closing Costs (est)</div>
  <div className="text-xl font-bold">~${closingCosts}</div>
  <div className="text-[9px] text-slate-500 mt-1">
    Based on generic area averages. Actual costs vary significantly. Verify with title company.
  </div>
</div>
```

### Scenario 2: Adding a new badge
**Example:** You want to show "Fast Closing Possible"

```tsx
// DON'T use green/blue
<div className="bg-slate-600 text-white px-3 py-1 rounded-full text-xs">
  Fast Closing May Be Possible
  <div className="text-[8px] text-white/70 mt-0.5">Agent-reported • Not guaranteed</div>
</div>
```

### Scenario 3: Displaying rental income potential
**Example:** Showing Airbnb/rental estimates

```tsx
<div className="bg-purple-50 border-2 border-purple-200 rounded-lg p-4">
  <h3 className="font-bold text-sm mb-1">
    {SAFE_UI_LABELS.INVESTMENT_SECTION}
  </h3>
  <p className="text-[9px] text-purple-700 mb-2">
    {LEGAL_DISCLAIMERS.INVESTMENT_INFO}
  </p>
  <div className="text-2xl font-bold">~${rentalIncome}/mo</div>
  <p className="text-[10px] text-purple-800 mt-2 font-semibold">
    ⚠️ {LEGAL_DISCLAIMERS.INVESTMENT_WARNING}
  </p>
</div>
```

---

## 🎓 Understanding the Legal Principles

### Why we do this:

1. **FTC Deceptive Advertising Rules**
   - Claims must be truthful and substantiated
   - Material disclaimers must be "clear and conspicuous"
   - Can't hide disclaimers or make them hard to find

2. **TILA/RESPA (Lending Regulations)**
   - Financial estimates that resemble loan disclosures trigger compliance
   - Must disclaim that these aren't official loan terms
   - Can't appear to be "offering credit"

3. **Consumer Protection Laws**
   - Users can sue for "detrimental reliance" on false info
   - Negligent misrepresentation claims if info is wrong
   - Must show good-faith effort to avoid misleading consumers

4. **Real Estate Advertising Laws**
   - Most states regulate property advertising
   - Can't make unsubstantiated claims
   - Must disclose when info isn't verified

### The Three-Layer Defense:

**Layer 1: Visual Design**
- Neutral colors = no implied approval/verification

**Layer 2: Qualifying Language**
- "Illustrative", "~", "may" = conditional, not promises

**Layer 3: Explicit Disclaimers**
- Clear statements of limitations and sources

---

## 🚨 Red Flags (DON'T DO THIS)

### 🚨 Red Flag #1: Prominent estimate without disclaimer
```tsx
// ❌ BAD
<div className="text-4xl font-black text-green-600">
  $1,500/month
</div>
```

### 🚨 Red Flag #2: Green "verified" styling without verification
```tsx
// ❌ BAD
<div className="bg-green-500 text-white">
  ✓ Owner Finance Available
</div>
```

### 🚨 Red Flag #3: Hidden/buried disclaimers
```tsx
// ❌ BAD
<div className="h-screen">
  <div className="text-4xl">$1,500/month</div>
  {/* lots of content */}
  <div className="text-[6px] text-gray-300 mt-96">
    *estimates may not be accurate
  </div>
</div>
```

### 🚨 Red Flag #4: Making guarantees
```tsx
// ❌ BAD
<div>Guaranteed financing approval!</div>
<div>You will definitely save money!</div>
<div>Seller guarantees these terms!</div>
```

---

## 💡 Pro Tips

1. **When in doubt, add a disclaimer**
   - Better to over-disclaim than under-disclaim

2. **Test on mobile first**
   - Most users are on mobile
   - Disclaimers must be readable on small screens

3. **Use the constants**
   - Don't write new disclaimer text
   - Use `LEGAL_DISCLAIMERS.*` to ensure consistency

4. **Think like a regulator**
   - Would an FTC attorney see this as misleading?
   - Would a reasonable consumer be confused?

5. **Proximity matters**
   - Disclaimer must be NEAR the claim (not on another page)
   - Ideally directly under or next to the estimate

---

## 📞 Need Help?

If you're unsure about whether something needs a disclaimer:

1. Check existing components (PropertyCard, favorites page, etc.)
2. Refer to this guide
3. Consult `legal-disclaimers.ts` for approved text
4. When in doubt, add a disclaimer and use neutral colors

**Default assumption: If it's financial or factual about a property, it needs a disclaimer.**

---

## 📅 Last Updated
This guide was created alongside the legal UI fixes implementation (2025).

Maintain this guide as legal requirements evolve or new patterns emerge.
