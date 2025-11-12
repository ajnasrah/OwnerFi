# API Refactoring Guide

This guide shows how to refactor existing API routes to use the new standardized utilities.

---

## New Utilities Created

1. **`/src/lib/api-error-handler.ts`** - Standardized error responses
2. **`/src/lib/fetch-with-timeout.ts`** - Timeout handling for external APIs
3. **`/src/lib/audit-logger.ts`** - Audit logging for admin actions
4. **`/src/lib/auth-helpers.ts`** - Standardized authentication/authorization

---

## Example 1: Basic API Route Refactoring

### BEFORE (Inconsistent error handling)

```typescript
// src/app/api/buyer/profile/route.ts
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions as any) as ExtendedSession | null;

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = getAdminDb();
    if (!db) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 });
    }

    const doc = await db.collection('buyers').doc(session.user.id).get();

    if (!doc.exists) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    return NextResponse.json({ profile: doc.data() });
  } catch (error) {
    // Missing error logging!
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
  }
}
```

### AFTER (Standardized)

```typescript
// src/app/api/buyer/profile/route.ts
import { requireRole } from '@/lib/auth-helpers';
import { ErrorResponses, createSuccessResponse, logError } from '@/lib/api-error-handler';
import { getAdminDb } from '@/lib/firebase-admin-init';

export async function GET(request: Request) {
  // Standardized auth check
  const authResult = await requireRole(request, 'buyer');
  if ('error' in authResult) return authResult.error;
  const { session } = authResult;

  try {
    const db = getAdminDb();
    if (!db) {
      return ErrorResponses.serviceUnavailable('Database not available');
    }

    const doc = await db.collection('buyers').doc(session.user.id).get();

    if (!doc.exists) {
      return ErrorResponses.notFound('Profile');
    }

    // Standardized success response
    return createSuccessResponse({ profile: doc.data() });

  } catch (error) {
    // Standardized error logging
    logError('GET /api/buyer/profile', error, { userId: session.user.id });
    return ErrorResponses.databaseError('Failed to fetch profile', error);
  }
}
```

---

## Example 2: External API Call with Timeout

### BEFORE (No timeout)

```typescript
// src/app/api/heygen/generate-video/route.ts
const response = await fetch(HEYGEN_API_URL, {
  method: 'POST',
  headers: {
    'accept': 'application/json',
    'content-type': 'application/json',
    'x-api-key': HEYGEN_API_KEY,
  },
  body: JSON.stringify(heygenRequest)
});

if (!response.ok) {
  const errorData = await response.json().catch(() => ({}));
  console.error('HeyGen API error:', errorData);
  return NextResponse.json(
    { error: 'Failed to generate video', details: errorData },
    { status: response.status }
  );
}
```

### AFTER (With timeout and retry)

```typescript
// src/app/api/heygen/generate-video/route.ts
import { fetchWithTimeout, ServiceTimeouts } from '@/lib/fetch-with-timeout';
import { ErrorResponses, logError } from '@/lib/api-error-handler';

try {
  const response = await fetchWithTimeout(HEYGEN_API_URL, {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'content-type': 'application/json',
      'x-api-key': HEYGEN_API_KEY,
    },
    body: JSON.stringify(heygenRequest),
    timeout: ServiceTimeouts.HEYGEN,
    retries: 2, // Retry up to 2 times
    retryDelay: 1000, // Start with 1s delay
    onRetry: (attempt, error) => {
      console.warn(`[HeyGen] Retry attempt ${attempt}:`, error.message);
    }
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    logError('HeyGen API request failed', new Error(`Status ${response.status}`), {
      status: response.status,
      errorData
    });
    return ErrorResponses.externalApiError('HeyGen', errorData);
  }

  const data = await response.json();
  return createSuccessResponse(data);

} catch (error) {
  logError('HeyGen API request exception', error);

  if (error instanceof TimeoutError) {
    return ErrorResponses.timeout('HeyGen video generation');
  }

  return ErrorResponses.externalApiError('HeyGen', error);
}
```

---

## Example 3: Admin Endpoint with Audit Logging

### BEFORE (No audit trail)

```typescript
// src/app/api/admin/add-credits/route.ts
export async function POST(request: Request) {
  const session = await getServerSession(authOptions as any) as ExtendedSession | null;

  if (!session?.user || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const { realtorEmail, credits } = await request.json();

  const db = getAdminDb();
  const snapshot = await db.collection('realtors')
    .where('email', '==', realtorEmail)
    .limit(1)
    .get();

  const doc = snapshot.docs[0];
  await doc.ref.update({
    'realtorData.credits': (doc.data().realtorData?.credits || 0) + credits
  });

  return NextResponse.json({ success: true });
}
```

### AFTER (With audit logging)

```typescript
// src/app/api/admin/add-credits/route.ts
import { requireRole, extractActorFromRequest } from '@/lib/auth-helpers';
import { parseRequestBody, ErrorResponses, createSuccessResponse, logError } from '@/lib/api-error-handler';
import { AuditHelpers } from '@/lib/audit-logger';
import { getAdminDb } from '@/lib/firebase-admin-init';

export async function POST(request: Request) {
  // Standardized auth
  const authResult = await requireRole(request, 'admin');
  if ('error' in authResult) return authResult.error;
  const { session } = authResult;

  // Standardized body parsing
  const bodyResult = await parseRequestBody<{ realtorEmail: string; credits: number }>(request);
  if (!bodyResult.success) return bodyResult.response;
  const { realtorEmail, credits } = bodyResult.data;

  // Validation
  if (!realtorEmail || typeof credits !== 'number' || credits <= 0) {
    return ErrorResponses.validationError('Invalid realtorEmail or credits amount');
  }

  try {
    const db = getAdminDb();
    if (!db) {
      return ErrorResponses.serviceUnavailable('Database not available');
    }

    const snapshot = await db.collection('realtors')
      .where('email', '==', realtorEmail)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return ErrorResponses.notFound('Realtor');
    }

    const doc = snapshot.docs[0];
    const currentCredits = doc.data().realtorData?.credits || 0;

    await doc.ref.update({
      'realtorData.credits': currentCredits + credits
    });

    // AUDIT LOGGING
    await AuditHelpers.logCreditsAdded(
      extractActorFromRequest(request, session),
      doc.id,
      realtorEmail,
      credits
    );

    return createSuccessResponse({
      realtorId: doc.id,
      newBalance: currentCredits + credits
    });

  } catch (error) {
    logError('POST /api/admin/add-credits', error, {
      adminId: session.user.id,
      realtorEmail,
      credits
    });
    return ErrorResponses.databaseError('Failed to add credits', error);
  }
}
```

---

## Example 4: Cron Job Authentication

### BEFORE (Insecure User-Agent check)

```typescript
// src/app/api/cron/generate-video/route.ts
export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');
  const userAgent = request.headers.get('user-agent');
  const isVercelCron = userAgent === 'vercel-cron/1.0';

  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}` && !isVercelCron) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ... cron job logic
}
```

### AFTER (Secure authentication)

```typescript
// src/app/api/cron/generate-video/route.ts
import { requireCronAuth } from '@/lib/auth-helpers';
import { ErrorResponses, createSuccessResponse, logError } from '@/lib/api-error-handler';

export async function POST(request: Request) {
  // Standardized cron auth
  const authResult = requireCronAuth(request);
  if ('error' in authResult) return authResult.error;

  try {
    // ... cron job logic

    return createSuccessResponse({ processed: count });

  } catch (error) {
    logError('POST /api/cron/generate-video', error);
    return ErrorResponses.internalError('Cron job failed', error);
  }
}

// If you need backward compatibility temporarily, use:
// import { requireCronAuthFlexible } from '@/lib/auth-helpers';
// const authResult = requireCronAuthFlexible(request);
```

---

## Example 5: Request Body Parsing

### BEFORE (No error handling)

```typescript
const body = await request.json(); // Can throw!
const { propertyId, action } = body;
```

### AFTER (Safe parsing)

```typescript
import { parseRequestBody, ErrorResponses } from '@/lib/api-error-handler';

const bodyResult = await parseRequestBody<{ propertyId: string; action: string }>(request);
if (!bodyResult.success) return bodyResult.response;

const { propertyId, action } = bodyResult.data;

// Additional validation
if (!propertyId || !action) {
  return ErrorResponses.validationError('Missing propertyId or action');
}
```

---

## Checklist for Refactoring Each Route

- [ ] Replace manual session check with `requireRole()` or `requireAuth()`
- [ ] Replace `NextResponse.json({ error: ... })` with `ErrorResponses.*`
- [ ] Replace `NextResponse.json({ success: true, ... })` with `createSuccessResponse()`
- [ ] Add `logError()` to all catch blocks
- [ ] Wrap external `fetch()` calls with `fetchWithTimeout()`
- [ ] Add audit logging for admin actions using `AuditHelpers`
- [ ] Use `parseRequestBody()` instead of raw `request.json()`
- [ ] Remove `as any` type casts
- [ ] Add proper validation before database operations

---

## Priority Routes to Refactor

### High Priority (User-facing, high traffic):
1. `/api/buyer/profile` - ✅ Example above
2. `/api/buyer/properties`
3. `/api/buyer/like-property`
4. `/api/realtor/profile`
5. `/api/property-matching/calculate`

### Critical (Admin/Security):
6. `/api/admin/add-credits` - ✅ Example above
7. `/api/admin/clean-database`
8. `/api/admin/properties/[id]` (DELETE)
9. All `/api/cron/*` routes

### External API Routes:
10. `/api/heygen/generate-video` - ✅ Example above
11. `/api/webhooks/submagic/[brand]`
12. `/api/webhooks/heygen/[brand]`
13. `/api/gohighlevel/webhook/*`

---

## Testing After Refactoring

### Manual Testing
```bash
# Test auth rejection
curl http://localhost:3000/api/buyer/profile
# Should return: { "success": false, "error": { "code": "AUTHENTICATION_ERROR", ... } }

# Test with auth
curl http://localhost:3000/api/buyer/profile \
  -H "Cookie: next-auth.session-token=..."
# Should return: { "success": true, "data": { ... } }

# Test timeout
# Should timeout after configured duration and return TIMEOUT_ERROR
```

### Check Audit Logs
```typescript
import { getAuditLogs } from '@/lib/audit-logger';

// Get recent admin actions
const logs = await getAuditLogs({ limit: 10 });
console.log(logs);
```

---

## Migration Steps

1. **Week 1**: Refactor 5 high-priority routes
2. **Week 2**: Refactor all admin routes (add audit logging)
3. **Week 3**: Refactor all external API routes (add timeouts)
4. **Week 4**: Refactor remaining routes, remove old patterns

---

## Common Patterns to Replace

### Pattern: Manual auth check
```typescript
// REPLACE THIS:
const session = await getServerSession(authOptions as any) as ExtendedSession | null;
if (!session?.user || session.user.role !== 'admin') {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
}

// WITH THIS:
const authResult = await requireRole(request, 'admin');
if ('error' in authResult) return authResult.error;
const { session } = authResult;
```

### Pattern: Generic error response
```typescript
// REPLACE THIS:
catch (error) {
  return NextResponse.json({ error: 'Failed to...' }, { status: 500 });
}

// WITH THIS:
catch (error) {
  logError('Route context', error, { additionalInfo });
  return ErrorResponses.databaseError('Failed to...', error);
}
```

### Pattern: External fetch without timeout
```typescript
// REPLACE THIS:
const response = await fetch(url, options);

// WITH THIS:
import { fetchWithTimeout, ServiceTimeouts } from '@/lib/fetch-with-timeout';
const response = await fetchWithTimeout(url, {
  ...options,
  timeout: ServiceTimeouts.SERVICE_NAME,
  retries: 2
});
```

---

## Next Steps

After refactoring is complete:
1. Enable ESLint rules to prevent old patterns
2. Document the new patterns in team wiki
3. Update PR templates to check for new patterns
4. Monitor audit logs and error logs
5. Gradually increase timeout strictness
6. Enable TypeScript strict mode

