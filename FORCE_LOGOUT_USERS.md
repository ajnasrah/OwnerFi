# Force Logout All Users - Guide

## Problem
Need to force logout all users from the application (for security, major updates, etc.)

## Solutions

### ✅ Option 1: Change NEXTAUTH_SECRET (RECOMMENDED - Instant)

This is the **fastest and most effective** method. Changing the JWT secret will immediately invalidate all existing session tokens.

#### Steps:

1. **Generate a new secret:**
   ```bash
   openssl rand -base64 32
   ```

2. **Update `.env.local`:**
   Replace the current `NEXTAUTH_SECRET` with the new value:
   ```bash
   NEXTAUTH_SECRET="<your-new-secret-here>"
   ```

3. **Update production environment:**
   If deployed on Vercel:
   ```bash
   vercel env add NEXTAUTH_SECRET
   # Paste the new secret when prompted
   # Select Production environment
   ```

4. **Restart your application:**
   - Local: Restart dev server (`npm run dev`)
   - Production: Redeploy or restart the service

**Effect:** All users will be logged out immediately. Their existing session tokens will become invalid.

---

### Option 2: Add Global Token Invalidation (More Control)

This allows you to invalidate all tokens issued before a specific timestamp without changing secrets.

#### Implementation:

1. **Add invalidation timestamp to environment:**
   Add to `.env.local`:
   ```
   NEXTAUTH_TOKEN_INVALIDATION_DATE="2025-11-23T00:00:00Z"
   ```

2. **Update `src/lib/auth.ts`:**

   Add this to the JWT callback:
   ```typescript
   async jwt({ token, user }: { token: JWT; user?: ExtendedUser }) {
     if (user) {
       token.role = user.role;
       token.phone = user.phone;
       token.createdAt = Date.now(); // Add creation timestamp
     }

     // Check if token should be invalidated
     const invalidationDate = process.env.NEXTAUTH_TOKEN_INVALIDATION_DATE;
     if (invalidationDate && token.createdAt) {
       const invalidationTimestamp = new Date(invalidationDate).getTime();
       if (token.createdAt < invalidationTimestamp) {
         return null; // Invalidate token
       }
     }

     return token;
   }
   ```

3. **Redeploy the application**

**Effect:** All tokens created before the specified date will be invalid. Users will need to sign in again.

---

### Option 3: Firebase Session Revocation (For Phone Auth Users)

If you want to specifically target Firebase Authentication sessions:

#### Using Firebase Admin SDK:

```typescript
// Create a new API route: src/app/api/admin/revoke-sessions/route.ts
import { NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { adminDb } from '@/lib/firebase-admin';

export async function POST(request: Request) {
  try {
    const auth = getAuth();

    // Get all users
    const listUsersResult = await auth.listUsers();

    // Revoke refresh tokens for all users
    const promises = listUsersResult.users.map(async (user) => {
      await auth.revokeRefreshTokens(user.uid);
      return user.uid;
    });

    await Promise.all(promises);

    return NextResponse.json({
      success: true,
      message: 'All Firebase sessions revoked',
      count: listUsersResult.users.length
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to revoke sessions' }, { status: 500 });
  }
}
```

Then call it:
```bash
curl -X POST https://your-domain.com/api/admin/revoke-sessions
```

---

## Comparison

| Method | Speed | Complexity | Reversible | Notes |
|--------|-------|------------|------------|-------|
| **Option 1: Change Secret** | ⚡ Instant | ✅ Very Easy | ❌ No | Best for immediate logout |
| **Option 2: Timestamp Check** | ⚡ Instant | 🟡 Medium | ✅ Yes | Best for scheduled/planned logouts |
| **Option 3: Firebase Revoke** | 🐌 Gradual | 🔴 Complex | ❌ No | Only affects Firebase sessions |

---

## ⚡ QUICK FIX (Option 1 - Recommended)

**To force logout all users RIGHT NOW:**

```bash
# 1. Generate new secret
NEW_SECRET=$(openssl rand -base64 32)

# 2. Update .env.local
sed -i.bak "s/NEXTAUTH_SECRET=.*/NEXTAUTH_SECRET=\"$NEW_SECRET\"/" .env.local

# 3. Restart dev server
# Kill existing process and run: npm run dev
```

**For production (Vercel):**
```bash
# Generate new secret
openssl rand -base64 32

# Copy the output and run:
vercel env add NEXTAUTH_SECRET production

# Then redeploy:
vercel --prod
```

---

## Notes

- **Option 1** is recommended for most cases - it's simple, instant, and effective
- After forcing logout, consider notifying users via email/in-app message
- Make sure to update the secret in ALL environments (local, staging, production)
- Keep a backup of the old secret in case you need to rollback

## Current NEXTAUTH_SECRET Location
- File: `.env.local`
- Current value: `Kx8vN2mP7wR9tY5uI3oL6jH1sA4dG8fK2nB7cX9zQ5vM3pW6yE0rT8uI5oL2jH1s`
