# 🔐 Vercel Environment Variables - Brand Isolation Update

## ✅ Webhooks Registered Successfully

All HeyGen webhooks have been registered. Add these 3 new environment variables to Vercel:

---

## 📋 Copy These to Vercel Dashboard

Go to: **Vercel Dashboard → Your Project → Settings → Environment Variables**

### HeyGen Webhook Secrets (Brand-Specific)

```bash
HEYGEN_WEBHOOK_SECRET_CARZ=whsec_YEGGsiQQ-ksiwMdc2dTixQ==
```

```bash
HEYGEN_WEBHOOK_SECRET_OWNERFI=whsec_Hfmtu54It-7bFbBtGqUqdA==
```

```bash
HEYGEN_WEBHOOK_SECRET_PODCAST=whsec_SQgMq0CKxcJbFEjwbSEtqg==
```

---

## 📝 How to Add in Vercel

For **each** environment variable above:

1. **Name**: Copy the variable name (e.g., `HEYGEN_WEBHOOK_SECRET_CARZ`)
2. **Value**: Copy the value (e.g., `whsec_YEGGsiQQ-ksiwMdc2dTixQ==`)
3. **Environment**: Select all three:
   - ✅ Production
   - ✅ Preview
   - ✅ Development
4. Click **Save**

---

## 🚀 After Adding Variables

1. **Redeploy** your application:
   ```bash
   # From Vercel Dashboard
   Go to Deployments → Click "..." on latest → Redeploy
   ```

   OR

   ```bash
   # Push to trigger deployment
   git push origin main
   ```

2. **Verify deployment** includes the new endpoints:
   ```bash
   curl https://ownerfi.ai/api/admin/webhook-health
   ```

---

## ✅ Registered Webhook Details

| Brand | Endpoint ID | Webhook URL |
|-------|-------------|-------------|
| **Carz** | `f088f3c5911a43a785a1dde479bfbeae` | `https://ownerfi.ai/api/webhooks/heygen/carz` |
| **OwnerFi** | `9724769ad6da49a99be5145acf096a0a` | `https://ownerfi.ai/api/webhooks/heygen/ownerfi` |
| **Podcast** | `be286e8de21049ada75bae4410a58a9d` | `https://ownerfi.ai/api/webhooks/heygen/podcast` |

---

## 🔍 Verification

After redeployment, test each webhook endpoint:

```bash
# Test Carz
curl -X OPTIONS https://ownerfi.ai/api/webhooks/heygen/carz

# Test OwnerFi
curl -X OPTIONS https://ownerfi.ai/api/webhooks/heygen/ownerfi

# Test Podcast
curl -X OPTIONS https://ownerfi.ai/api/webhooks/heygen/podcast
```

**Expected**: All should return `200 OK`

---

## 📊 Next Steps

1. ✅ Add the 3 environment variables to Vercel (instructions above)
2. ✅ Redeploy application
3. ✅ Run test suite: `node scripts/test-brand-isolation.mjs`
4. ✅ Monitor health: `curl https://ownerfi.ai/api/admin/webhook-health`

---

**Note**: These secrets are also saved in `heygen-webhook-secrets.json` (not committed to git)
