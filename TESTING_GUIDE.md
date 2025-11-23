# Testing Guide: Old Account Migration

## Test Environment
- **Server**: http://localhost:3001
- **Status**: ✅ Running
- **Old Accounts Found**: 105 email/password accounts

---

## Test Account for Manual Testing

### Recommended Test Account
```
Account ID: 3aizTiYN2EXayb2LD3RJ
Email: johndoe@yopmail.com
Name: John Doe
Phone: 1234567890
Role: buyer
Has Password: ✓ YES (old account)
Created: Mon Nov 17 2025 09:06:06
```

**Why this account?**
- Uses yopmail.com (disposable email - safe to test)
- Created recently (Nov 17)
- Is a buyer account (simple profile)
- Won't disrupt real users

---

## Manual Testing Steps

### Step 1: Prepare
1. Open browser to http://localhost:3001/auth
2. Open browser console (F12 → Console tab)
3. Filter console for: `SIGNUP-PHONE` and `CLEANUP-OLD-ACCOUNT`

### Step 2: Start Phone Auth
1. Enter any phone number (e.g., your phone or test number)
2. Click "Send Verification Code"
3. **WAIT** for SMS code (or use Firebase test phone if configured)

### Step 3: Verify Code
1. Enter the 6-digit code from SMS
2. Click "Verify & Continue"
3. You should be redirected to `/auth/setup`

### Step 4: Complete Signup (CRITICAL - Use Old Account Email)
1. **First Name**: John
2. **Last Name**: Test
3. **Email**: `johndoe@yopmail.com` ← **MUST USE THIS EMAIL**
4. **Are you a realtor?**: No
5. Check "I agree to terms..."
6. Click "Continue →"

### Step 5: Watch Console Logs
You should see these messages in order:

```javascript
🔄 [SIGNUP-PHONE] Email exists on old email/password account - will delete after signup: 3aizTiYN2EXayb2LD3RJ

✅ [SIGNUP-PHONE] Created new buyer account

🗑️ [SETUP] Cleaning up old account: 3aizTiYN2EXayb2LD3RJ

🗑️ [CLEANUP-OLD-ACCOUNT] Starting cleanup: {...}

✅ [CLEANUP-OLD-ACCOUNT] Deleted buyer profile: buyer_xxxxx

✅ [CLEANUP-OLD-ACCOUNT] Deleted old user document: 3aizTiYN2EXayb2LD3RJ

✅ [SETUP] Old account cleaned up successfully
```

### Step 6: Verify Success
1. You should be at `/dashboard/settings`
2. You should be signed in
3. Old account should be deleted from database

---

## Verification Script

After testing, run this to verify old account was deleted:

```bash
npx dotenv-cli -e .env.local -- npx tsx scripts/test-old-account-migration.ts
```

The account `johndoe@yopmail.com` should **NOT** appear in the list anymore.

---

## Alternative: Use Firebase Test Phone

If you don't want to use real SMS:

### Setup Firebase Test Phone
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select project: `ownerfi-95aa0`
3. Go to **Authentication** → **Sign-in method** → **Phone**
4. Scroll to "Phone numbers for testing"
5. Add: `+15551234567` with code `123456`
6. Save

### Test with Test Phone
1. In app, enter: `(555) 123-4567`
2. When prompted for code, enter: `123456`
3. Continue with steps above

---

## What to Test

### ✅ Happy Path (Main Scenario)
- [x] Old account with email/password exists
- [ ] User signs up with phone auth
- [ ] Uses SAME email as old account
- [ ] New account created
- [ ] Old account deleted
- [ ] User signed in to new account
- [ ] Redirected to dashboard

### ✅ Edge Cases

#### Test 1: New User (No Conflict)
**Email**: `newuser@test.com` (doesn't exist)

**Expected**:
- Normal signup flow
- No cleanup messages
- Account created successfully

---

#### Test 2: Phone-Only Account Exists
**Setup**: Create account with phone auth first, then try again

**Expected**:
- Error: "Account already exists. Please sign in instead."
- Signup blocked
- No new account created

---

#### Test 3: Different Email (Old Account Untouched)
**Old Account**: `johndoe@yopmail.com`
**New Signup**: `johndoe2@yopmail.com`

**Expected**:
- Normal signup (no conflict)
- Old account NOT deleted
- New account created
- User has access to new account

---

#### Test 4: Same Phone, Same Email
**Old Account**: `johndoe@yopmail.com` / `1234567890`
**New Signup**: Same email, same phone

**Expected**:
- Phone cleared from old account
- New account created with phone
- Old account deleted
- Success

---

#### Test 5: Cleanup Fails (Simulate)
To test error handling, temporarily break the cleanup endpoint:

1. Comment out deletion logic in `/api/auth/cleanup-old-account`
2. Sign up with old email
3. **Expected**: User still gets signed in and redirected
4. Console shows warning: "Failed to cleanup old account, but continuing anyway"

---

## Database Verification

### Before Test
```bash
# Count old accounts
npx dotenv-cli -e .env.local -- npx tsx scripts/test-old-account-migration.ts | grep "Found"

# Should show: "Found 105 old email/password account(s)"
```

### After Test
```bash
# Count again
npx dotenv-cli -e .env.local -- npx tsx scripts/test-old-account-migration.ts | grep "Found"

# Should show: "Found 104 old email/password account(s)"
# (One less because johndoe@yopmail.com was deleted)
```

### Manual Database Check
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select `ownerfi-95aa0`
3. Go to **Firestore Database**
4. Open `users` collection
5. Search for document ID: `3aizTiYN2EXayb2LD3RJ`
6. **Should NOT exist** after successful test

---

## Troubleshooting

### Issue: "Email already exists" error
**Cause**: Email exists on phone-only account (not old account)

**Fix**: The old account doesn't have a password, so it's already migrated. Use different email.

---

### Issue: No cleanup logs in console
**Cause**: `oldAccountToDelete` not passed from API

**Check**:
1. Open Network tab
2. Find POST to `/api/auth/signup-phone`
3. Check response body
4. Should contain: `"oldAccountToDelete": "3aizTiYN2EXayb2LD3RJ"`

---

### Issue: Cleanup fails silently
**Cause**: Cleanup endpoint returning error

**Check**:
1. Open Network tab
2. Find POST to `/api/auth/cleanup-old-account`
3. Check response status (should be 200)
4. Check response body for error messages

---

### Issue: Server logs show errors
**Check server terminal**:
```bash
# In the terminal where you ran npm run dev
# Look for these patterns:

❌ [CLEANUP-OLD-ACCOUNT] Error deleting buyer profile
❌ [CLEANUP-OLD-ACCOUNT] Error deleting user document
⚠️ [SETUP] Failed to cleanup old account
```

---

## Success Criteria

### ✅ Test Passes If:
1. New account created with phone number
2. User signed in successfully
3. Redirected to `/dashboard/settings`
4. Console shows cleanup messages
5. Old account deleted from database
6. Old buyer profile deleted
7. No errors in console or server logs

### ❌ Test Fails If:
1. Signup blocked with error
2. Old account still exists after signup
3. User can't sign in
4. Console shows errors
5. Database has duplicate accounts

---

## Production Testing Checklist

Before deploying to production:

- [ ] Test with real phone number
- [ ] Test with real email account
- [ ] Verify SMS delivery works
- [ ] Test on mobile device
- [ ] Test on different browsers
- [ ] Check Firebase quota not exceeded
- [ ] Verify logs in production
- [ ] Monitor error rates
- [ ] Test rollback procedure

---

## Monitoring in Production

### Key Metrics to Track
1. **Cleanup Success Rate**:
   - Count: `cleanup_old_account_success` logs
   - Should be ~100%

2. **Migration Rate**:
   - Count: Old accounts detected during signup
   - Shows how many users are returning

3. **Error Rate**:
   - Count: `cleanup_old_account_error` logs
   - Should be near 0%

### Queries for Logs
```javascript
// Successful migrations
action == 'cleanup_old_account_success'

// Failed cleanups
action == 'cleanup_old_account_error'

// Old accounts detected
"Email exists on old email/password account"
```

---

## Next Steps After Testing

1. ✅ Verify test passes with `johndoe@yopmail.com`
2. Run cleanup verification script
3. Check database manually
4. Test with different scenarios (edge cases)
5. Deploy to production
6. Monitor logs for 24 hours
7. Check for any user complaints

---

## Support

### If Migration Fails
1. Check server logs for error messages
2. Verify Firebase permissions
3. Check database rules
4. Review console logs
5. Contact support with:
   - User email
   - Timestamp of attempt
   - Error messages from console
   - Network request/response data
