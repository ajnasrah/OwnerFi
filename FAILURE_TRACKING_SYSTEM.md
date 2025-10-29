# Failure Tracking System

Complete system for monitoring and diagnosing Late posting failures and Submagic video processing issues.

## Overview

This system automatically tracks, categorizes, and provides actionable insights for:
- **Late Posting Failures**: Social media posts that fail to publish (Twitter, Bluesky, etc.)
- **Submagic Processing Issues**: Videos stuck in captioning/processing stage

## Features

### 1. Automatic Failure Logging
- All Late API failures are automatically logged to Firestore
- Captures full error details, platforms, and context
- Tracks retry attempts and resolution status

### 2. Admin Dashboards

#### Main Dashboard: `/admin/workflow-failures`
- **Summary Cards**: Quick overview of total failures
- **Late Failures Tab**: View all posting failures with error categorization
- **Submagic Tab**: Monitor stuck video processing jobs
- **One-click retry**: Retry failed posts directly from UI

#### Late Failures Detail: `/admin/late-failures`
- Filter by brand, status, and time range
- Error categorization (Auth, Rate Limit, Timeout, etc.)
- Platform-specific failure tracking
- Common error type statistics
- Bulk retry capabilities

### 3. Error Categories

The system automatically categorizes errors:

| Category | Trigger | Color Code | Severity |
|----------|---------|------------|----------|
| **Authentication (401)** | Invalid token, token refresh failed | Red | Critical |
| **Token Refresh Failed** | OAuth refresh failure | Red | Critical |
| **Missing Accounts** | Platform not connected in Late | Purple | Critical |
| **Rate Limited (429)** | API rate limit exceeded | Yellow | Warning |
| **Timeout** | Request timeout | Orange | Warning |
| **Other** | Unknown errors | Gray | Info |

## API Endpoints

### Late Failures API

#### GET `/api/admin/late-failures`
Fetch Late posting failures with filters.

**Query Parameters:**
- `brand` - Filter by brand (ownerfi, carz, podcast, vassdistro, benefit)
- `status` - Filter by status (failed, retrying, resolved, all)
- `days` - Time range in days (default: 7)
- `limit` - Max results (default: 50)

**Response:**
```json
{
  "success": true,
  "failures": [...],
  "stats": {
    "total": 10,
    "byBrand": { "ownerfi": 5, "carz": 3, "podcast": 2 },
    "byPlatform": { "twitter": 7, "bluesky": 3 },
    "byStatus": { "failed": 8, "retrying": 1, "resolved": 1 },
    "commonErrors": { "Authentication (401)": 5, "Rate Limit (429)": 3 }
  }
}
```

#### POST `/api/admin/late-failures`
Log a new failure (automatically called by Late API).

**Body:**
```json
{
  "brand": "ownerfi",
  "platforms": ["twitter", "bluesky"],
  "failedPlatforms": ["twitter", "bluesky"],
  "caption": "Post caption...",
  "videoUrl": "https://...",
  "error": "Failed to refresh access token",
  "postId": "optional-late-post-id",
  "workflowId": "optional-workflow-id"
}
```

#### PATCH `/api/admin/late-failures`
Update failure status.

**Body:**
```json
{
  "id": "failure-doc-id",
  "status": "retrying" | "resolved" | "failed",
  "retryCount": 1
}
```

### Retry API

#### POST `/api/admin/retry-late-post`
Retry a failed post.

**Body:**
```json
{
  "failureId": "failure-doc-id",
  "brand": "ownerfi",
  "platforms": ["twitter", "bluesky"],
  "caption": "Post caption...",
  "videoUrl": "https://...",
  "scheduleTime": "optional-iso-datetime"
}
```

### Submagic Status API

#### GET `/api/admin/submagic-status`
Check Submagic job status.

**Query Parameters:**
- `jobId` - Single job ID to check
- `jobIds` - Comma-separated list of job IDs
- `stuck=true` - Get stuck Submagic jobs from Firestore
- `brands` - Filter stuck jobs by brands (comma-separated)

**Example:**
```bash
# Check single job
GET /api/admin/submagic-status?jobId=abc123

# Check multiple jobs
GET /api/admin/submagic-status?jobIds=abc123,def456,ghi789

# Get stuck jobs
GET /api/admin/submagic-status?stuck=true&brands=ownerfi,carz
```

## Common Issues & Solutions

### 1. Twitter "Failed to refresh access token"

**Cause:** Twitter OAuth token expired or revoked.

**Solution:**
1. Go to Late dashboard → Settings → Connections
2. Disconnect Twitter account
3. Reconnect Twitter account
4. Retry failed posts from `/admin/late-failures`

**Prevention:**
- Late should auto-refresh tokens, but this can fail if:
  - Password was changed
  - App permissions were revoked
  - Twitter API issues

### 2. Bluesky "401 invalid token"

**Cause:** Bluesky access token expired.

**Solution:**
1. Go to Late dashboard → Settings → Connections
2. Reconnect Bluesky account
3. Retry failed posts

**Prevention:**
- Bluesky tokens expire periodically
- Late should refresh, but manual reconnection may be needed

### 3. Rate Limiting (429)

**Cause:** Too many requests to Late or social platform API.

**Solution:**
- Wait for rate limit to reset (usually 15-60 minutes)
- System will auto-retry with exponential backoff
- Check `/admin/late-failures` for retry status

**Prevention:**
- Use queue scheduling to spread posts over time
- Avoid posting too many videos simultaneously

### 4. Stuck Submagic Jobs

**Cause:** Submagic video processing timeout or failure.

**Solution:**
1. Check `/admin/workflow-failures` → Submagic tab
2. Click "Retry Submagic" for stuck jobs
3. If still failing, check video format/size

**Prevention:**
- Ensure videos meet Submagic requirements
- Monitor processing time (normal: 3-10 minutes)

## Firestore Collections

### `late_failures`
```typescript
{
  id: string;
  postId?: string;           // Late post ID
  brand: string;             // ownerfi, carz, etc.
  profileId?: string;        // Late profile ID
  platforms: string[];       // All requested platforms
  failedPlatforms?: string[]; // Platforms that failed
  caption: string;
  videoUrl: string;
  error: string;             // Error message
  timestamp: Date;
  retryCount: number;
  lastRetryAt?: Date;
  status: 'failed' | 'retrying' | 'resolved';
  workflowId?: string;       // Optional workflow reference
  resolvedAt?: Date;
  resolvedPostId?: string;
}
```

## Integration

### Automatic Logging

The Late API (`src/lib/late-api.ts`) automatically logs failures:

```typescript
// In postToLate() catch block
await logLateFailure({
  brand: request.brand,
  profileId: profileId,
  platforms: request.platforms,
  caption: fullCaption,
  videoUrl: request.videoUrl,
  error: errorMessage,
});
```

### Manual Logging

If needed, you can manually log failures:

```typescript
const response = await fetch('/api/admin/late-failures', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    brand: 'ownerfi',
    platforms: ['twitter'],
    error: 'Custom error message',
    caption: 'Post caption',
    videoUrl: 'https://...',
  }),
});
```

## Monitoring Best Practices

1. **Daily Check**: Review `/admin/workflow-failures` daily
2. **Auth Issues**: Fix immediately - critical for all future posts
3. **Rate Limits**: Monitor patterns to optimize posting schedule
4. **Stuck Jobs**: Check Submagic jobs older than 30 minutes
5. **Retry**: Use retry button for transient failures only

## Files Added

### API Routes
- `src/app/api/admin/late-failures/route.ts` - Late failure tracking API
- `src/app/api/admin/retry-late-post/route.ts` - Retry failed posts
- `src/app/api/admin/submagic-status/route.ts` - Submagic status checking

### UI Pages
- `src/app/admin/late-failures/page.tsx` - Detailed Late failures view
- `src/app/admin/workflow-failures/page.tsx` - Main failures dashboard

### Libraries
- `src/lib/submagic-client.ts` - Submagic API client

### Updates
- `src/lib/late-api.ts` - Added automatic failure logging

## Next Steps

1. **Deploy**: Push changes and deploy to production
2. **Test**: Create a test failure to verify logging
3. **Monitor**: Check dashboards after deployment
4. **Reconnect**: If seeing auth errors, reconnect social accounts in Late

## Support

If failures persist:
1. Check error logs in `/admin/workflow-failures`
2. Verify API credentials in environment variables
3. Contact Late support for platform-specific issues
4. Review Submagic job status via API
