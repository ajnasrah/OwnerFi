# Security Incident Report - Delete Property Webhook
**Date of Report:** November 15, 2025
**Date of Incident:** November 10-15, 2025
**Severity:** CRITICAL

## Executive Summary

A critical security vulnerability allowed unauthorized mass deletion of properties through the `/api/gohighlevel/webhook/delete-property` endpoint. **1,644 properties were deleted** between November 10-15, 2025 due to disabled authentication.

## Critical Vulnerability

### Authentication Bypass
- **Environment Variable:** `GHL_BYPASS_SIGNATURE=true`
- **Impact:** Completely disables webhook signature verification
- **Location:** `.env.local` and Production environment
- **Risk Level:** CRITICAL
- **Code Reference:** `src/app/api/gohighlevel/webhook/delete-property/route.ts:24-27`

```typescript
if (BYPASS_SIGNATURE_CHECK) {
  logWarn('⚠️ WARNING: Signature verification bypassed for testing');
  return true;
}
```

This setting was **active in production**, allowing anyone with the webhook URL to delete properties without authentication.

## Incident Timeline

### Key Statistics (since November 11, 2025)
- **Total Logs Analyzed:** 5,000+ entries
- **Delete Webhook Requests:** 1,504
- **Properties Deleted:** 1,644
- **Signature Verification Failures:** 0 (bypassed)
- **Webhook Requests (all types):** 1,937

### Deletion Activity Started
- **Date:** November 10, 2025
- **Time:** 21:02:24 CST (9:02 PM)
- **Pattern:** Mass deletion via GoHighLevel workflow

## Attack Pattern Analysis

### Source of Deletions
All deletion requests originated from a **GoHighLevel workflow**:
- **Workflow Name:** "delete property"
- **Workflow ID:** `122860ae-6857-4b55-a41a-0529241a5be4`
- **Source IPs:** Google Cloud (34.x.x.x, 35.x.x.x ranges)
- **Pipeline:** "Owner Finance Properties" (`L0rztbd5CWyRY0Z2zXkT`)

### Request Characteristics
Every deletion request showed:
```json
{
  "hasSignature": false,
  "signatureValue": null,
  "hasSecret": false
}
```

### Deleted Properties (Sample)
The following properties were confirmed deleted:
1. `Ue5d2mzwJrdYXM5ZVXYq` - 259 San Diego St, North Fort Myers, FL
2. `CKsqKyp4UZM0OR2gMfCz` - 1416 Bourbon St APT 4, New Orleans, LA
3. `mrh8MrMqH1Os1zDZnzcX` - 12930 Deep Eddy, Saint Hedwig, TX
4. `rAqTTG0IEwNd7jigQgN3` - 12301 W Highway 15, Perryton, TX
... and 1,640+ more properties

## Technical Details

### Webhook Capabilities
The delete-property webhook supports multiple deletion methods:
1. **Single Property:** Delete by property ID
2. **Batch Delete:** Delete multiple properties via `propertyIds` array
3. **Query Delete:** Delete by field (address, city, state, zipCode, status)
4. **Delete All:** Blocked by additional confirmation (line 127-136)

### Attack Vector
Someone with access to your GoHighLevel account:
1. Created a workflow named "delete property"
2. Configured it to trigger webhook calls to `/api/gohighlevel/webhook/delete-property`
3. Executed the workflow, causing mass deletions
4. Requests succeeded due to disabled signature verification

## Affected Systems

- **Properties Collection:** 1,644 properties deleted from Firestore
- **Queue System:** Properties removed from workflow queue
- **Customer Data:** Property owner contact information potentially lost

## Root Cause Analysis

### Primary Cause
**Authentication bypass enabled in production environment**
- Setting intended for development/testing was active in production
- No signature verification performed on incoming requests
- Anyone with webhook URL could trigger deletions

### Contributing Factors
1. **Access Control:** Person given access to GoHighLevel on Monday
2. **No Rate Limiting:** Webhook allowed rapid successive deletions
3. **No Monitoring:** No alerts triggered for mass deletions
4. **Insufficient Logging:** While logs exist, no real-time monitoring

## Evidence

### GoHighLevel Workflow
The deletion requests all contain:
```json
{
  "workflow": {
    "id": "122860ae-6857-4b55-a41a-0529241a5be4",
    "name": "delete property"
  }
}
```

### Request Headers (Sample)
All requests came through Vercel production deployment:
- Host: `ownerfi.ai`
- Deployment: `owner-jfgom5bs3-abdullah-abunarsahs-projects.vercel.app`
- Source: GoHighLevel via Google Cloud infrastructure

## Recommendations

### IMMEDIATE ACTIONS REQUIRED

1. **Disable Authentication Bypass**
   ```bash
   # Remove or set to false in production
   GHL_BYPASS_SIGNATURE=false
   ```

2. **Revoke GoHighLevel Access**
   - Immediately revoke access for the person given access Monday
   - Review all GoHighLevel workflow configurations
   - Delete the "delete property" workflow (ID: 122860ae-6857-4b55-a41a-0529241a5be4)

3. **Assess Data Loss**
   - Determine which properties can be recovered from backups
   - Identify affected customers
   - Plan data restoration strategy

### SHORT-TERM ACTIONS (within 24 hours)

1. **Enable Signature Verification**
   - Set proper `GHL_WEBHOOK_SECRET` in production
   - Remove `GHL_BYPASS_SIGNATURE` from all environments
   - Test webhook with valid signatures

2. **Implement Rate Limiting**
   - Add rate limiting to delete webhook (max 10 requests/minute)
   - Implement IP-based throttling

3. **Add Monitoring & Alerts**
   - Alert on >10 property deletions in 5 minutes
   - Alert when signature verification fails
   - Monitor for suspicious workflow activity

4. **Audit GoHighLevel Workflows**
   - Review all existing workflows
   - Remove unauthorized workflows
   - Document legitimate workflows

### LONG-TERM ACTIONS (within 1 week)

1. **Security Hardening**
   - Implement webhook authentication beyond signature verification
   - Add IP whitelisting for GoHighLevel webhooks
   - Require additional confirmation for bulk operations
   - Implement soft-delete with recovery window

2. **Access Control**
   - Implement principle of least privilege for GoHighLevel access
   - Require approval for workflow creation/modification
   - Regular access audits

3. **Backup & Recovery**
   - Implement automated daily Firestore backups
   - Test recovery procedures
   - Implement point-in-time recovery capability

4. **Security Testing**
   - Regular security audits
   - Penetration testing of webhook endpoints
   - Code review for authentication bypasses

## Data Recovery Options

### Firebase Backups
Check if Firestore automatic backups are enabled:
```bash
firebase firestore:backups:list
```

### Git History
If properties were committed to git before deletion, they may be recoverable from repository history.

### Third-Party Integrations
Check if any integrated services (GoHighLevel, analytics, etc.) have copies of property data.

## Incident Classification

- **Type:** Unauthorized Data Deletion
- **Attack Vector:** Insecure Configuration + Insider Access
- **Severity:** CRITICAL
- **Data Loss:** 1,644 property records
- **Business Impact:** HIGH - Loss of revenue, customer trust, operational data

## Lessons Learned

1. **Never deploy development/testing configurations to production**
2. **Environment-specific settings must be strictly controlled**
3. **Implement defense in depth - don't rely on single authentication method**
4. **Real-time monitoring is essential for detecting abuse**
5. **Access control must be tightly managed for third-party integrations**

## Compliance Considerations

Depending on your jurisdiction and industry:
- **Data Breach Notification:** May be required if customer PII was deleted
- **Audit Trail:** Maintain this incident report and all logs
- **Customer Notification:** Consider informing affected property owners

---

## Appendix A: Sample Log Entries

### First Deletion Request
**Timestamp:** 2025-11-10 21:02:24 CST
**Property ID:** Ue5d2mzwJrdYXM5ZVXYq
**Address:** 259 San Diego St, North Fort Myers, FL 33903
**Source IP:** 35.226.239.201 (Google Cloud)

### Authentication Bypass Evidence
```json
{
  "hasSignature": false,
  "signatureValue": null,
  "hasSecret": false
}
```

---

**Report Prepared By:** Security Audit
**Next Review Date:** November 16, 2025
**Distribution:** Internal Security Team, Development Team, Management
