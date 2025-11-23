# End-to-End Migration Test Instructions

## ✅ Automated Tests: PASSED

All automated tests passed successfully:
- ✅ Old buyer account detection
- ✅ Old realtor account detection
- ✅ Email reuse allowed
- ✅ Cleanup logic verified

---

## 🧪 Manual End-to-End Test

Now let's test the complete flow with real phone authentication.

### Test Configuration
- **Test Phone**: `555-555-1234`
- **Test Code**: `123456`
- **Test Email**: `johndoe@yopmail.com`
- **Old Account ID**: `3aizTiYN2EXayb2LD3RJ`
- **URL**: http://localhost:3001/auth

---

## Step-by-Step Test Procedure

### 1. Open the App
```
URL: http://localhost:3001/auth
```

### 2. Open Browser Console
Press `F12` → Go to **Console** tab

Filter for: `SIGNUP` or `CLEANUP`

---

### 3. Enter Phone Number

**In the app:**
1. You'll see "Phone Number" field
2. Enter: `555-555-1234`
3. Click: "Send Verification Code"

**Expected:**
- ✅ No errors
- ✅ Button shows "Sending code..."
- ✅ Then changes to code entry form

**Console should show:**
```
reCAPTCHA verified
```

---

### 4. Enter Verification Code

**In the app:**
1. You'll see "Verification Code" field
2. Enter: `123456`
3. Click: "Verify & Continue"

**Expected:**
- ✅ Code accepted
- ✅ Redirected to `/auth/setup`
- ✅ Form shows: "Set Up Your Profile"

**Console should show:**
```
Code verification error: (none)
```

---

### 5. Complete Setup Form (CRITICAL STEP)

**In the app:**
1. **First Name**: `John`
2. **Last Name**: `TestMigration`
3. **Email**: `johndoe@yopmail.com` ← **USE THIS EXACT EMAIL**
4. **Are you a realtor?**: Select "No"
5. Check: "I agree to the Terms..."
6. Click: "Continue →"

**Expected:**
- ✅ Form submits
- ✅ Loading indicator shows
- ✅ Redirected to `/dashboard/settings`

---

### 6. Watch Console Logs (IMPORTANT)

During step 5, you should see these logs in order:

```javascript
// 1. Account creation
POST /api/auth/signup-phone

// Console log:
🔄 [SIGNUP-PHONE] Email exists on old email/password account - will delete after signup: 3aizTiYN2EXayb2LD3RJ

// 2. Sign in
POST /api/auth/signin

// 3. Cleanup trigger
🗑️ [SETUP] Cleaning up old account: 3aizTiYN2EXayb2LD3RJ

// 4. Cleanup execution
POST /api/auth/cleanup-old-account

// Console log:
🗑️ [CLEANUP-OLD-ACCOUNT] Starting cleanup: {...}
✅ [CLEANUP-OLD-ACCOUNT] Deleted buyer profile: buyer_1763391966151_h0i52k85m
✅ [CLEANUP-OLD-ACCOUNT] Deleted old user document: 3aizTiYN2EXayb2LD3RJ

// 5. Success
✅ [SETUP] Old account cleaned up successfully
```

---

### 7. Verify Success

**Check #1: You're signed in**
- ✅ You should be at `/dashboard/settings`
- ✅ You should see your name in header
- ✅ Form should be empty (new account)

**Check #2: Console has no errors**
- ✅ No red errors in console
- ✅ All cleanup logs show ✅

---

### 8. Verify Database Changes

Run this command in terminal:

```bash
npx dotenv-cli -e .env.local -- npx tsx scripts/test-old-account-migration.ts
```

**Expected:**
- Old account count should be **104** (one less)
- `johndoe@yopmail.com` should **NOT** be in the list

---

## What Success Looks Like

### ✅ Success Criteria

1. **Phone auth worked**
   - ✅ SMS code accepted (123456)
   - ✅ No verification errors

2. **Email reuse allowed**
   - ✅ Used `johndoe@yopmail.com` (same as old account)
   - ✅ No "email already exists" error
   - ✅ Form submitted successfully

3. **Account created**
   - ✅ New phone-only account created
   - ✅ Signed in to new account
   - ✅ Redirected to dashboard

4. **Old account deleted**
   - ✅ Console shows cleanup logs
   - ✅ Old user document deleted
   - ✅ Old buyer profile deleted
   - ✅ Database count decreased by 1

5. **User experience**
   - ✅ Seamless transition
   - ✅ No errors shown to user
   - ✅ User can continue using app

---

## Troubleshooting

### Issue: "Invalid phone number format"
**Cause**: Phone number not formatted correctly

**Fix**:
- Use exact format: `555-555-1234`
- Or try: `(555) 555-1234`

---

### Issue: "Invalid verification code"
**Cause**: Code doesn't match or expired

**Fix**:
- Use exact code: `123456`
- Make sure test phone is configured in Firebase
- Click "Try again" to resend

---

### Issue: "Email already exists"
**Cause**: Account exists but has NO password (already phone-only)

**Fix**:
- Use different test email
- Or check if account was already migrated

---

### Issue: No cleanup logs in console
**Cause**: `oldAccountToDelete` not returned from API

**Fix**:
1. Open DevTools → Network tab
2. Find POST to `/api/auth/signup-phone`
3. Check Response tab
4. Look for: `"oldAccountToDelete": "3aizTiYN2EXayb2LD3RJ"`
5. If missing, check server logs for errors

---

### Issue: Cleanup fails with error
**Cause**: Database permissions or network issue

**Fix**:
1. Check server terminal for errors
2. Look for: `❌ [CLEANUP-OLD-ACCOUNT]`
3. Check Firebase permissions
4. Verify `.env.local` has correct credentials

---

## Alternative Test: Use Different Old Account

If you don't want to use `johndoe@yopmail.com`, pick another from the list:

### Other Test Accounts:
1. `johnrealtor@yopmail.com` (realtor)
2. `test123@email.com` (realtor)
3. `realtor@realtor.com` (realtor)

All are test accounts safe to migrate.

---

## After Successful Test

1. ✅ Mark test as passed
2. ✅ Document results
3. ✅ Deploy to production
4. ✅ Monitor for 24 hours
5. ✅ Notify users they can use phone auth

---

## Quick Test Checklist

- [ ] Open http://localhost:3001/auth
- [ ] Open browser console (F12)
- [ ] Enter phone: `555-555-1234`
- [ ] Enter code: `123456`
- [ ] Enter email: `johndoe@yopmail.com`
- [ ] Complete form and submit
- [ ] Check console for cleanup logs
- [ ] Verify at `/dashboard/settings`
- [ ] Run database check script
- [ ] Confirm old account deleted

---

## Test Results Template

```
✅ END-TO-END TEST: OLD ACCOUNT MIGRATION

Date: [DATE]
Tester: [YOUR NAME]
Test Account: johndoe@yopmail.com
Old Account ID: 3aizTiYN2EXayb2LD3RJ

Results:
✅ Phone auth successful
✅ Email reuse allowed
✅ New account created
✅ Old account deleted
✅ User signed in
✅ Redirected to dashboard
✅ No errors

Status: PASSED
Ready for production: YES
```

---

## Next Steps

After this test passes:

1. **Deploy to production**
   ```bash
   vercel --prod
   ```

2. **Monitor logs**
   - Watch for `cleanup_old_account_success`
   - Watch for `cleanup_old_account_error`

3. **Notify users**
   - Send email about new phone auth
   - Mention they can use same email

4. **Track metrics**
   - Migration success rate
   - User adoption rate
   - Error rate

---

## Support

If test fails:
1. Screenshot console errors
2. Copy server logs
3. Note exact step where it failed
4. Check troubleshooting section
5. Review code implementation

Good luck! 🚀
