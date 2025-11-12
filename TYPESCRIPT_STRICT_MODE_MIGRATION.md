# TypeScript Strict Mode Migration Guide

## Current Status

TypeScript strict mode is currently **DISABLED** in `tsconfig.json`:
```json
{
  "strict": false
}
```

This has resulted in:
- 703 explicit 'any' type errors
- Weak type safety throughout the codebase
- Potential runtime errors from null/undefined access

## Migration Strategy

**DO NOT enable strict mode all at once!** Instead, enable strict checks incrementally:

### Phase 1: Enable Individual Strict Checks (Current Phase)

Instead of `"strict": true`, enable checks one at a time:

```json
{
  "compilerOptions": {
    "strict": false,

    // Phase 1: Enable these first (low impact)
    "noImplicitAny": false,              // TODO: Enable after fixing 'any' types
    "strictNullChecks": false,           // TODO: Enable after null checks
    "strictFunctionTypes": true,         // ✅ Enable now (low impact)
    "strictBindCallApply": true,         // ✅ Enable now (low impact)
    "strictPropertyInitialization": true, // ✅ Enable now (low impact)
    "noImplicitThis": true,              // ✅ Enable now (low impact)
    "alwaysStrict": true,                // ✅ Enable now (adds 'use strict')

    // Phase 2: Enable these next
    "noUnusedLocals": true,              // Warn about unused variables
    "noUnusedParameters": true,          // Warn about unused params
    "noImplicitReturns": true,           // All code paths must return
    "noFallthroughCasesInSwitch": true,  // Prevent switch fallthrough bugs
  }
}
```

### Phase 2: Fix Critical 'any' Types (Prioritized)

Fix these files in order of criticality:

#### High Priority (API Routes)
1. `src/app/api/buyer/properties/route.ts` - Session type casting
2. `src/app/api/properties/route.ts` - Document type inference
3. `src/lib/firebase-admin.ts` - Admin SDK types
4. `src/lib/unified-db.ts` - Database types

#### Medium Priority (Library Files)
5. `src/lib/matching.ts` - Buyer/property matching logic
6. `src/lib/property-calculations.ts` - Financial calculations
7. `src/lib/firebase.ts` - Firebase client types

#### Low Priority (Utilities)
8. Archive scripts (can stay as 'any' - not production code)
9. Test files
10. One-off maintenance scripts

### Phase 3: Enable strictNullChecks

After fixing explicit 'any' types:

```json
{
  "strictNullChecks": true
}
```

Then fix:
1. Add null checks to all `.data()` calls
2. Add null checks to optional chaining
3. Add default values or guards

### Phase 4: Enable noImplicitAny

This is the final step:

```json
{
  "noImplicitAny": true
}
```

Then fix remaining implicit 'any' types.

### Phase 5: Full Strict Mode

After all above checks pass:

```json
{
  "strict": true
}
```

## Quick Wins (Do These Now)

### 1. Fix Auth Type Casting

**Before:**
```typescript
const session = await // eslint-disable-next-line @typescript-eslint/no-explicit-any
getServerSession(authOptions as any) as ExtendedSession | null;
```

**After:**
```typescript
import { AuthOptions } from 'next-auth';

// In auth.ts, properly type authOptions
export const authOptions: AuthOptions = { ... };

// In API routes
const session = await getServerSession(authOptions) as ExtendedSession | null;
```

### 2. Type Firestore Documents

**Before:**
```typescript
const data = doc.data();
const property = data.address; // No type safety!
```

**After:**
```typescript
import { DocumentData } from 'firebase/firestore';

interface PropertyDocument extends DocumentData {
  address: string;
  city: string;
  state: string;
  price: number;
  // ... other fields
}

const data = doc.data() as PropertyDocument;
const property = data.address; // Type safe!
```

### 3. Type Error Objects

**Before:**
```typescript
} catch (error) {  // implicit 'any'
  console.error(error.message); // Unsafe!
}
```

**After:**
```typescript
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  console.error(errorMessage);
}
```

### 4. Type Array Operations

**Before:**
```typescript
.sort((a: any, b: any) => { ... })
```

**After:**
```typescript
.sort((a: PropertyListing, b: PropertyListing) => { ... })
```

## Testing Strategy

1. **After Each Phase**: Run full build
   ```bash
   npm run build
   ```

2. **Check for New Errors**:
   ```bash
   npx tsc --noEmit
   ```

3. **Test in Development**:
   ```bash
   npm run dev
   ```

4. **Test Critical Flows**:
   - User login
   - Property listing
   - Property search
   - Buyer matching

## Rollback Plan

If strict mode causes issues:

1. **Immediate Rollback**:
   ```json
   {
     "strict": false,
     // Disable the problematic check
   }
   ```

2. **Fix the Issue**: Address the type errors

3. **Re-enable**: Turn the check back on

## Progress Tracking

- [ ] Phase 1: Enable low-impact strict checks
- [ ] Phase 2: Fix critical 'any' types (API routes)
- [ ] Phase 2: Fix medium priority 'any' types (libraries)
- [ ] Phase 3: Enable strictNullChecks
- [ ] Phase 4: Enable noImplicitAny
- [ ] Phase 5: Enable full strict mode

## Estimated Timeline

- **Phase 1**: 1 hour (low-impact checks)
- **Phase 2**: 2-3 days (fix 'any' types)
- **Phase 3**: 1-2 days (null checks)
- **Phase 4**: 2-3 days (implicit any)
- **Phase 5**: 1 day (final cleanup)

**Total**: 1-2 weeks of dedicated work

## Benefits After Migration

1. **Catch Bugs at Compile Time**: Prevent null reference errors
2. **Better Autocomplete**: IDE suggestions work correctly
3. **Safer Refactoring**: TypeScript catches breaking changes
4. **Documentation**: Types serve as inline documentation
5. **Confidence**: Deploy with confidence knowing types are checked

## Next Steps

1. ✅ Read this guide
2. ⏭️ Enable Phase 1 strict checks (see below)
3. ⏭️ Fix auth type casting
4. ⏭️ Type Firestore documents
5. ⏭️ Continue with Phase 2

## Phase 1: Safe to Enable Now

You can enable these NOW without breaking anything:

```bash
# Edit tsconfig.json and add:
"strictFunctionTypes": true,
"strictBindCallApply": true,
"strictPropertyInitialization": true,
"noImplicitThis": true,
"alwaysStrict": true,
"noUnusedLocals": true,
"noUnusedParameters": true,
"noImplicitReturns": true,
"noFallthroughCasesInSwitch": true
```

Then run:
```bash
npm run build
```

If there are any errors, they're likely legitimate bugs that should be fixed!
