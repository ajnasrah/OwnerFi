# How to Add Test Phone Numbers in Firebase Console

## Step-by-Step Instructions

### 1. Open Firebase Console
Go to: https://console.firebase.google.com/project/ownerfi-95aa0/authentication/providers

### 2. Click on Phone Provider
- In the "Sign-in providers" list, find **Phone**
- Click on it to open settings

### 3. Scroll to "Phone numbers for testing"
- Scroll down past the "Enable" toggle
- Find the section called **"Phone numbers for testing"**

### 4. Add Test Number - IMPORTANT FORMAT!

**Click "Add phone number"** and enter:

```
Phone number: +15555551111
Verification code: 111111
```

**CRITICAL: Format Rules**
- Phone MUST include country code with `+` (e.g., `+1` for US)
- Phone MUST be E.164 format: `+1XXXXXXXXXX` (no spaces, no dashes, no parentheses)
- Code must be 6 digits exactly

### 5. Click Save

### 6. Add More Test Numbers (Recommended)

Add these additional test numbers so you don't get rate limited:

```
+15555552222  →  222222
+15555553333  →  333333
+19018319661  →  123456  (your personal number for testing)
```

## Common Errors and Fixes

### Error: "Invalid phone number"
- ✅ Fix: Make sure you include `+1` at the start
- ✅ Fix: Remove all spaces, dashes, parentheses
- ✅ Fix: Format should be exactly: `+15555551111`

### Error: "Invalid verification code"
- ✅ Fix: Must be exactly 6 digits
- ✅ Fix: No letters, only numbers

### Error: "Phone number already exists"
- ✅ This is OK - it means it's already added
- ✅ Just use it for testing

## How to Use Test Numbers

### In Your App:

1. Go to `http://localhost:3001/auth`
2. Enter phone: `555-555-1111` (app will format it)
3. Click "Send Verification Code"
4. **NO SMS IS SENT** - it's instant
5. Enter code: `111111`
6. Sign in successfully

### Benefits:
- ✅ No SMS costs
- ✅ No rate limiting
- ✅ Instant testing
- ✅ Unlimited uses

## Alternative: Use Firebase CLI

If the console doesn't work, you can add via Firebase CLI:

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login
firebase login

# Add test phone
firebase auth:testPhoneNumbers:add +15555551111 111111
```

## Verify It Works

After adding, test immediately:
1. Go to your app's `/auth` page
2. Enter the test phone number
3. Should instantly show "verification code sent"
4. Enter the test code
5. Should sign in without SMS

## Current Firebase Plan Check

Your SMS quota:
- Go to: https://console.firebase.google.com/project/ownerfi-95aa0/usage
- Check "Authentication" section
- See SMS usage and limits

If you're on **Spark (free) plan**: Only 10 SMS/day
Consider upgrading to **Blaze (pay-as-go)**: 10,000 SMS/month free

## Need Help?

Firebase Phone Auth Docs:
https://firebase.google.com/docs/auth/web/phone-auth#test-with-whitelisted-phone-numbers
