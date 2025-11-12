# Manual Workflow Retry Instructions

## Failed Workflows to Retry

After the deployment completes (wait 2-3 minutes), retry these workflows from your UI:

### 1. Seattle median list price at $850K
- **Age:** 49m ago
- **HeyGen ID:** ea2b1c305ed5...
- **Action:** Click "Retry Submagic" or "Use HeyGen Video"

### 2. Trump Proposes 50-Year Mortgages
- **Age:** 19m ago
- **HeyGen ID:** 8c3562e8a4ac...
- **Action:** Click "Retry Submagic" or "Use HeyGen Video"

### 3. 1298 Gideons Dr Sw Atlanta, GA
- **Age:** 39m ago
- **HeyGen ID:** 581591dc4861...
- **Action:** Click "Retry Submagic" or "Use HeyGen Video"

### 4. BAT Pauses Vuse One Vape Launch
- **Age:** 19m ago
- **HeyGen ID:** 4c846d03bddb...
- **Action:** Click "Retry Submagic" or "Use HeyGen Video"

### 5. From Broke to CEO (first)
- **Age:** 4h ago
- **HeyGen ID:** 6e8190ccffbf...
- **Action:** Click "Use HeyGen Video"

### 6. From Broke to CEO (second)
- **Age:** 5h ago
- **HeyGen ID:** 0af331590948...
- **Action:** Click "Use HeyGen Video"

## What Will Happen

With the new Cloud Tasks architecture:
1. When you click retry, it creates a Cloud Task (or uses fallback fetch)
2. The task is queued and processed asynchronously
3. Worker endpoint handles download → upload → posting with automatic retries
4. You'll see the status update in real-time as it progresses
5. No more timeout errors!

## Alternative: Automatic Retry

If you don't want to click buttons, just wait - the cron job will automatically pick up and retry failed workflows within the next hour.
