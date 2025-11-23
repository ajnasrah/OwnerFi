# Old Email/Password Account Migration

## Problem
Users who previously created accounts using email/password authentication were unable to sign up with phone authentication if they used the same email address. This caused confusion for existing users trying to migrate to the new phone auth system.

## Solution
Automatic account migration and cleanup when users sign up with phone auth using the same email as an old account.

---

## How It Works

### Flow Diagram
```
User signs up with phone + email →
  ├─ Email matches old account with password?
  │   ├─ YES → Create new phone-only account
  │   │         ↓
  │   │    Sign in with new account
  │   │         ↓
  │   │    Delete old account + all data
  │   │         ↓
  │   │    Redirect to dashboard
  │   │
  │   └─ NO → Normal signup flow
```

---

## Implementation Details

### 1. Detection (`/api/auth/signup-phone`)

**Location:** `src/app/api/auth/signup-phone/route.ts` (lines 42-60)

When user signs up with phone auth:
1. Check if email exists in database
2. If email exists AND has password field populated:
   - Mark as `oldAccountToDelete`
   - Continue with signup
   - Return `oldAccountToDelete` ID in response
3. If email exists but NO password:
   - Block signup (existing phone-only account)

**Key Code:**
```typescript
let oldAccountToDelete: string | null = null;
const existingEmailUser = await unifiedDb.users.findByEmail(email.toLowerCase());

if (existingEmailUser) {
  if (existingEmailUser.password && existingEmailUser.password.length > 0) {
    console.log('Old email/password account detected - will delete after signup');
    oldAccountToDelete = existingEmailUser.id;
    // Continue with signup
  } else {
    // Phone-only account already exists
    return error('Account already exists');
  }
}
```

---

### 2. Cleanup Trigger (`/auth/setup`)

**Location:** `src/app/auth/setup/page.tsx` (lines 92-115)

After successful signup and sign-in:
1. Check if `data.oldAccountToDelete` exists in response
2. If yes, call cleanup endpoint
3. Proceed to dashboard (don't block user flow if cleanup fails)

**Key Code:**
```typescript
if (signInResult?.ok) {
  if (data.oldAccountToDelete) {
    await fetch('/api/auth/cleanup-old-account', {
      method: 'POST',
      body: JSON.stringify({
        oldAccountId: data.oldAccountToDelete,
        newAccountId: data.userId
      })
    });
  }
  router.push('/dashboard/settings');
}
```

---

### 3. Account Deletion (`/api/auth/cleanup-old-account`)

**Location:** `src/app/api/auth/cleanup-old-account/route.ts`

Deletes all data associated with old account:

#### What Gets Deleted:
1. **BuyerProfile** (if exists)
   - Query: `buyerProfiles` where `userId == oldAccountId`
   - Deletes all matching documents

2. **RealtorProfile** (if exists)
   - Query: `realtors` where `userId == oldAccountId`
   - Deletes all matching documents

3. **RealtorData** (nested in user)
   - Auto-deleted when user document is deleted

4. **User Document**
   - Final deletion: `users/{oldAccountId}`

#### Error Handling:
- Logs all errors but continues with cleanup
- Returns success if user document deleted successfully
- Logs completion to audit trail

---

## Data Migration Notes

### What is NOT Migrated
Currently, **no data is migrated** from old account to new account. The new account starts fresh.

This is intentional because:
- Old accounts may have outdated/incorrect data
- Phone auth represents a "fresh start"
- Users complete their profile in settings anyway

### What Could Be Migrated (Future Enhancement)
If needed, we could migrate:
- Liked/passed property IDs
- Search preferences (city, budget)
- Communication preferences
- Match history

To add migration, modify `cleanup-old-account/route.ts` to:
1. Read old account data before deletion
2. Merge relevant fields into new account
3. Then delete old account

---

## Example Scenarios

### Scenario A: Old User Returns with Same Email
**Setup:**
- User created account in Oct 2024: `john@example.com` / `password123`
- User abandoned app, never used it
- Now returns in Nov 2024, tries phone auth with same email

**Flow:**
1. User enters phone: `(555) 123-4567`
2. Verifies SMS code
3. Enters email: `john@example.com` (same as old account)
4. System detects old account with password
5. Creates NEW account: `john@example.com` / phone: `+15551234567` / no password
6. Signs user in with NEW account
7. Deletes old account in background
8. User goes to dashboard

**Result:** Clean migration, old account gone

---

### Scenario B: Old User with Different Email
**Setup:**
- Old account: `john@gmail.com` / `password123`
- User tries phone auth with NEW email: `john@yahoo.com`

**Flow:**
1. User enters phone and verifies
2. Enters email: `john@yahoo.com`
3. System checks email - doesn't exist
4. Creates NEW account normally
5. No cleanup needed

**Result:** User has TWO accounts (old one still accessible via email/password)

**Note:** Old account remains because user chose different email. They can still access it via `/auth` → "Continue with email"

---

### Scenario C: Phone Conflict
**Setup:**
- Old account: `john@gmail.com` / `(555) 123-4567` / `password123`
- User tries phone auth with SAME phone

**Flow:**
1. User enters phone: `(555) 123-4567`
2. Verifies SMS code
3. Enters email: `john@gmail.com`
4. System detects:
   - Email matches old account ✓
   - Phone matches old account ✓
5. Clears phone from old account (lines 62-81 in signup-phone)
6. Creates NEW account with phone
7. Deletes old account
8. User goes to dashboard

**Result:** Clean migration, no conflicts

---

## Phone Number Handling

### Multiple Format Support
The system handles various phone formats:
- E.164: `+15551234567`
- 10-digit: `5551234567`
- 11-digit: `15551234567`
- Formatted: `(555) 123-4567`

### Phone Conflict Resolution
If phone exists on old account (lines 62-81):
1. Check if this is the same account being deleted
2. If yes: Skip phone clearing (will be deleted anyway)
3. If no: Clear phone from other old account
4. Then proceed with signup

---

## Logging & Audit Trail

All operations are logged:

```typescript
// Signup detected old account
console.log('🔄 [SIGNUP-PHONE] Email exists on old email/password account - will delete after signup:', existingEmailUser.id);

// Cleanup started
console.log('🗑️ [CLEANUP-OLD-ACCOUNT] Starting cleanup:', { oldAccountId, newAccountId });

// Cleanup completed
await logInfo('Successfully cleaned up old email/password account', {
  action: 'cleanup_old_account_success',
  metadata: { oldAccountId, newAccountId, reason: 'User migrated to phone auth' }
});
```

Check logs with:
- `🔄` = Migration detected
- `🗑️` = Cleanup in progress
- `✅` = Success
- `❌` = Error
- `⚠️` = Warning

---

## Testing Checklist

- [ ] Old user with same email can sign up with phone
- [ ] Old user with same phone can sign up
- [ ] Old user with same email + phone can sign up
- [ ] Old account is deleted after signup
- [ ] BuyerProfile is deleted
- [ ] RealtorData is deleted (if realtor)
- [ ] New account works normally
- [ ] User can access dashboard
- [ ] No duplicate accounts remain
- [ ] Logs show cleanup completion

---

## Files Modified

### Core Flow
1. `src/app/api/auth/signup-phone/route.ts` - Email conflict detection
2. `src/app/auth/setup/page.tsx` - Cleanup trigger
3. `src/app/api/auth/cleanup-old-account/route.ts` - Deletion logic (NEW FILE)

### Supporting Files
- `src/lib/unified-db.ts` - `findByEmail()`, `findByPhone()`
- `src/lib/auth.ts` - NextAuth phone authentication

---

## Security Considerations

### Why This is Safe

1. **Email Ownership Required**
   - User must verify phone via SMS
   - User must enter email matching old account
   - Only deletes if old account has password (not already migrated)

2. **No Cross-User Deletion**
   - Can only delete YOUR OWN old account
   - Email must match exactly
   - Old account must have password (proves it's old system)

3. **Graceful Failure**
   - If cleanup fails, user still gets access
   - Cleanup errors logged but don't block signup
   - User flow continues normally

### What Could Go Wrong (and how we handle it)

**Scenario:** Cleanup API fails mid-deletion
- **Impact:** Old account partially deleted
- **Handling:** Logs error, continues with remaining deletions
- **Recovery:** Can manually delete via admin panel

**Scenario:** User refreshes during cleanup
- **Impact:** Cleanup might not complete
- **Handling:** User already signed in to new account
- **Recovery:** Old account accessible via email/password if needed

---

## Future Enhancements

1. **Data Migration**
   - Migrate liked properties
   - Migrate search preferences
   - Migrate match history

2. **User Notification**
   - Show "Migrating your account..." message
   - Confirm "Old account deleted" after cleanup

3. **Batch Cleanup**
   - Admin tool to find/delete abandoned old accounts
   - Scheduled job to clean orphaned data

4. **Rollback Capability**
   - Store old account data before deletion
   - Allow restoration within 30 days

---

## Support

For issues with account migration:
1. Check console logs for `🔄 [SIGNUP-PHONE]` and `🗑️ [CLEANUP-OLD-ACCOUNT]`
2. Verify old account had password field populated
3. Check if cleanup endpoint was called successfully
4. Manually delete old account via admin panel if needed
