# 🚀 Quick Deploy to Railway (5 Minutes)

## Step-by-Step Deployment

### 1. Push to GitHub (if not already)

```bash
git add .
git commit -m "Add automated video system"
git push
```

### 2. Deploy to Railway

1. **Go to**: https://railway.app/
2. **Sign up/Login** with GitHub
3. **Click**: "New Project"
4. **Select**: "Deploy from GitHub repo"
5. **Choose**: `ownerfi` repository
6. **Railway auto-deploys** ✅

### 3. Add Environment Variables

Click on your project → Variables → Raw Editor, paste:

```env
NODE_ENV=production
NEXT_PUBLIC_BASE_URL=${{RAILWAY_PUBLIC_DOMAIN}}
NEXTAUTH_URL=${{RAILWAY_PUBLIC_DOMAIN}}
NEXTAUTH_SECRET=Kx8vN2mP7wR9tY5uI3oL6jH1sA4dG8fK2nB7cX9zQ5vM3pW6yE0rT8uI5oL2jH1s

OPENAI_API_KEY=sk-proj-your_openai_api_key_here
HEYGEN_API_KEY=your_heygen_api_key_here
SUBMAGIC_API_KEY=your_submagic_api_key_here

METRICOOL_API_KEY=your_metricool_api_key_here
METRICOOL_USER_ID=your_metricool_user_id_here
METRICOOL_AUTO_POST=true
METRICOOL_PLATFORMS=instagram,facebook,tiktok,youtube,linkedin,threads
METRICOOL_SCHEDULE_DELAY=immediate

USE_REDIS=false
DATABASE_URL=file:./prod.db

NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=1:your_sender_id:web:13376f1c0bd9fa95700b07
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@your-project-id.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQCW1Bhco++NI1cD\neryzTlfxNP85reRL9r6fTLgSjrmOFBJQFZmbdu4aX8iMI/zh37NQmKukZI38eSYL\nD/XqZkM64aLJ9/UDZvQhRF92sTskavrWT3xHiWZS6yLwmhfmgpXqt8mQyK/nABEk\nMNbzOk/XDUTgpID9JUaKL0eJ4vm1ME+QdJ4eyqOgden56whKQYRb1ZM6bHQ7ljO7\nIARo2GThOTai2mKDAGLqh+tqV8c4bxgNvMLcd4wSi/TpP3mhC4mtbpPRx0p1gAMb\n7E9//sDe+YvF0LjLdk0aZa1MWkVb6T0ujBdqQtyf5GmLfUQl75OmMg55B4ztkDNm\nrxLnRSr/AgMBAAECggEARLdIihxeLS0mnX0zr3VH96qvhPXGhx1ZZ3Yqfrnrq+FV\nHotYuk2K2RU+ZyqWMcobBeMof/MYBSikvnF9FleU1aSq591CEVS8cNOXspm4WjUr\nJqx78JOWvLxH5NovfWONLayh9oaYLWQIazadF58/dLik4rvP0IVFB/vWWenA3lz6\nu7OTWNgUF/nifBWX1zp7iqe9VtQhgF6J2mMmHKBclnbBASKOINMS8cVc9AFgRkvq\ngGA4FCafbxSZpufi8WVtEAo98ntdwCcW+xD8Qtt6YRTnX0iz0aztDMjJqSLUFlxs\nAR+ifZt9qbzKO+Q9yFzqfu20Xxy/edd4pkHOoIG1kQKBgQDTZtuqKDWd8Eu9JMDt\nvCeejmqvAx6Wqj/5Aazk5wi6bs4PxJZFcfJyufP4OdrgGne8IDD+LgCnFddjizZZ\nfQboqA8pom0e1zJSOw0EAVCMV6m2D+5YFTnZYfl9U5Gdg/6+IQLCAtNApidUIcNo\nkz7m9B859XFbjtLmCG5rPsk9cwKBgQC2pd1735McW2ubeIOZUmyGxsmZV/4S5Khm\nX/a2FYkkvPuk3xfK7w6gSm8pYcj8PvlkkWMoh7ixvBvyIwRKiUo+yR8GWBWPVk9G\npXAqYjwGOYBKasJNR7ZDlsNHBOcz3MgYOKHOj1s1qTnECmoN8rqqFyiHNF8KVihM\n7LZ8vAM5RQKBgQCTYoPFVvFCorR7MvObC3Hn1kzEpX0e96VQOn3KvNRV/kiFr75A\nvleU6tYP+m4BjhJqQ1tE6tejpdOb4APNUiCN9hVUJpzDQq8fq3HAmBYLMlbsyqCW\nIn5Jc0gYuzmrQspIzgT5NDUKPozu1/c/omDZbduTce5NMf8RR1GMTaLJxwKBgD0A\n3x3diaQCAMnXkZSnC+pkALd/xTOIPZqb2KnuPXUQzbe+b5LvD2KIGeKnb1qYqfFm\nAclqs0xhuK/B9E/01OBtijgzOVg7ipTc8r6lOskVcXzpdWYcWorukuBoidQvnIFC\ngQCdrugYUlvg4pUwChp/S6EE4+1u41z1/ulgXm9FAoGBALfD2q+Mx1MZWvpxX8LO\ny1c7LegS3+pD4yFAph784sW/VJ31NxjcZYMakyTnJ4Rw0wdQZHhi7q51i2SL2bc2\n3+lkRLFIUsS1oKWctqSpGaGtzWoEWmdlf5bUuPniLEPI1NwShtNBxae9sTukd8U3\nU3YBtxZbKvIScxtSrrTeNqfx\n-----END PRIVATE KEY-----\n"

GOOGLE_MAPS_API_KEY=your_google_maps_key
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_key

STRIPE_PUBLIC_KEY=pk_test_your_stripe_public_key_here
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_stripe_webhook_secret_here
```

**Click "Add"** and Railway will redeploy.

### 4. Get Your Public URL

Once deployed, Railway gives you a URL like:
```
https://ownerfi-production-xxxx.up.railway.app
```

### 5. Update Webhook URLs

Update in HeyGen & Submagic dashboards:

**HeyGen**: `https://your-railway-url.up.railway.app/api/webhooks/heygen`
**Submagic**: `https://your-railway-url.up.railway.app/api/webhooks/submagic?workflow_id={workflow_id}`

### 6. Initialize Scheduler

Visit:
```
https://your-railway-url.up.railway.app/api/startup
```

Should return: `{"success": true, "schedulerStarted": true}`

### 7. Test It!

Generate a test video:
```bash
curl -X POST https://your-railway-url.up.railway.app/api/workflow/viral-video-webhook \
  -H "Content-Type: application/json" \
  -d '{"article_content": "Test", "auto_generate_script": true, ...}'
```

---

## ✅ Done!

Your system is now running 24/7 in the cloud!

**Monitor**: https://railway.app/dashboard
**Cost**: ~$5/month

The scheduler will:
- Check RSS feeds every 15 minutes
- Generate 5 Carz + 5 OwnerFi videos per day
- Auto-post to all 6 social platforms

🎉 Fully automated!
