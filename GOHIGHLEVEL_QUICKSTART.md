# 🚀 GoHighLevel SMS Quick Start

## Step 1: Add Environment Variable (2 minutes)

```bash
# Your GoHighLevel webhook URL
GOHIGHLEVEL_WEBHOOK_URL=https://services.leadconnectorhq.com/hooks/U2B5lSlWrVBgVxHNq5AH/webhook-trigger/a80182b1-b415-4af4-a30d-897c9d081079
```

### Development
Add to `.env.local`:
```bash
echo 'GOHIGHLEVEL_WEBHOOK_URL=https://services.leadconnectorhq.com/hooks/U2B5lSlWrVBgVxHNq5AH/webhook-trigger/a80182b1-b415-4af4-a30d-897c9d081079' >> .env.local
```

### Production (Vercel)
```bash
vercel env add GOHIGHLEVEL_WEBHOOK_URL production
# Paste the URL when prompted
```

---

## Step 2: Set Up GoHighLevel Workflow (5 minutes)

1. **Go to GoHighLevel** → Automation → Workflows → Create Workflow
2. **Name:** "Property Match SMS Notification"
3. **Add Trigger:** Webhook (URL already provided)
4. **Add Action:** Send SMS
   - **To:** `{{webhook.phone}}`
   - **Message:** `{{webhook.message}}`
5. **Activate** workflow

---

## Step 3: Test It (1 minute)

1. Go to: `https://yourdomain.com/admin/ghl-logs`
2. Select a buyer and property from dropdowns
3. Click "📱 Send Test SMS"
4. Check if SMS received and log shows ✅ "sent"

---

## ✅ You're Done!

Now when you add properties, matching buyers automatically get SMS notifications with:
- Property address, city, state
- Monthly payment, down payment, price
- Their name, email, phone, budget preferences

**View logs:** `/admin/ghl-logs`

**Full docs:** `docs/GOHIGHLEVEL_SMS_SETUP.md`

**Flow diagram:** `docs/WEBHOOK_FLOW_CONFIRMATION.md`

---

## 🐛 Troubleshooting

**No SMS received?**
1. Check workflow is "Active" in GoHighLevel
2. Verify `GOHIGHLEVEL_WEBHOOK_URL` is set: `echo $GOHIGHLEVEL_WEBHOOK_URL`
3. Check buyer has `smsNotifications: true` and valid phone number
4. View logs at `/admin/ghl-logs` for error messages

**Webhook URL not configured error?**
```bash
# Verify environment variable is set
vercel env pull
cat .env.local | grep GOHIGHLEVEL

# If missing, add it:
vercel env add GOHIGHLEVEL_WEBHOOK_URL production
```

---

## 📊 Available Buyer Data in GoHighLevel

Use these in your workflow with `{{webhook.fieldName}}`:

```
{{webhook.buyerFirstName}}         - "John"
{{webhook.buyerLastName}}          - "Doe"
{{webhook.buyerEmail}}             - "john@example.com"
{{webhook.buyerPhone}}             - "+15551234567"
{{webhook.buyerCity}}              - "Houston"
{{webhook.buyerState}}             - "TX"
{{webhook.buyerMaxMonthlyPayment}} - 2000
{{webhook.buyerMaxDownPayment}}    - 50000
```

**Example custom SMS:**
```
Hi {{webhook.buyerFirstName}}!

New property in {{webhook.buyerCity}}:
📍 {{webhook.propertyAddress}}
💵 ${{webhook.monthlyPayment}}/mo

Your budget: ${{webhook.buyerMaxMonthlyPayment}}/mo
Your email: {{webhook.buyerEmail}}

View now: {{webhook.dashboardUrl}}
```
