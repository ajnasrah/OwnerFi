# IMMEDIATE REMEDIATION STEPS
**URGENT - Execute these steps immediately**

## 1. Disable Authentication Bypass (CRITICAL - Do this NOW)

### In Local Development
Edit `.env.local`:
```bash
# Change this line:
GHL_BYPASS_SIGNATURE=true

# To:
GHL_BYPASS_SIGNATURE=false
```

### In Production (Vercel)
```bash
# Remove the bypass variable entirely
vercel env rm GHL_BYPASS_SIGNATURE production

# OR set it to false
vercel env add GHL_BYPASS_SIGNATURE production
# When prompted, enter: false
```

## 2. Delete the Malicious GoHighLevel Workflow

The workflow causing deletions:
- **Workflow ID:** `122860ae-6857-4b55-a41a-0529241a5be4`
- **Workflow Name:** "delete property"
- **Pipeline:** "Owner Finance Properties"

### Steps:
1. Log into GoHighLevel: https://app.gohighlevel.com
2. Navigate to: Automations → Workflows
3. Find workflow named "delete property"
4. **DELETE IT IMMEDIATELY**
5. Check for any other suspicious workflows

## 3. Revoke Unauthorized Access

### In GoHighLevel:
1. Go to Settings → Team Management
2. Review all users with access
3. **Remove the person you gave access to on Monday**
4. Check their recent activity if possible

## 4. Stop Any Running Deletions

Check if deletions are still happening:
```bash
# Monitor real-time logs
vercel logs --prod --follow | grep "delete"
```

If deletions are still occurring:
1. Temporarily disable the webhook endpoint
2. Deploy emergency fix

## 5. Assess Current Damage

Run this to count remaining properties:
```bash
npx tsx scripts/count-properties.ts
```

Create a backup immediately:
```bash
# Export current properties to prevent further loss
firebase firestore:export gs://your-backup-bucket/emergency-backup-$(date +%Y%m%d-%H%M%S)
```

## 6. Notify Stakeholders

- [ ] Notify management of data loss
- [ ] Identify affected customers
- [ ] Prepare customer communication
- [ ] Document incident timeline

## 7. Review GoHighLevel API Keys

```bash
# Check environment for GoHighLevel credentials
vercel env ls | grep GHL
```

Consider rotating:
- GoHighLevel API keys
- Webhook secrets
- Any other credentials the person had access to

## 8. Deploy Security Fix

Create new environment variable for webhook secret:
```bash
# Generate a strong secret
openssl rand -hex 32

# Add to Vercel production
vercel env add GHL_WEBHOOK_SECRET production
# Paste the generated secret when prompted
```

Update GoHighLevel webhook configuration with the new secret.

## Quick Verification Checklist

- [ ] `GHL_BYPASS_SIGNATURE` removed or set to `false` in production
- [ ] "delete property" workflow deleted in GoHighLevel
- [ ] Unauthorized user access revoked
- [ ] No active deletion requests in logs
- [ ] Remaining properties counted and backed up
- [ ] New webhook secret generated and configured
- [ ] GoHighLevel webhook updated with new secret
- [ ] Security incident report reviewed

## Emergency Contacts

If deletions continue:
1. Contact Vercel support to temporarily disable the endpoint
2. Consider emergency deployment with webhook disabled
3. Contact GoHighLevel support to suspend account temporarily

## Timeline

- **T+0min:** Disable bypass (Step 1)
- **T+5min:** Delete workflow (Step 2)
- **T+10min:** Revoke access (Step 3)
- **T+15min:** Verify stoppage (Step 4)
- **T+30min:** Assess damage (Step 5)
- **T+1hour:** Complete remediation (Steps 6-8)

---

**EXECUTE THESE STEPS IN ORDER - DO NOT DELAY**
