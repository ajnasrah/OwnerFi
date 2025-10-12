# Social Media Content Generation System

This folder contains all the components for the automated social media content generation system with Metricool integration, RSS feed monitoring, and video automation.

## Directory Structure

```
social-media/
├── docs/           # Documentation files
├── tests/          # Test scripts
├── scripts/        # Utility scripts
├── utils/          # Manual workflow utilities
└── README.md       # This file
```

## Documentation (`docs/`)

- **METRICOOL_SETUP.md** - Complete guide for setting up Metricool API integration
- **METRICOOL_QUICKSTART.md** - Quick start guide for Metricool
- **VIRAL_VIDEO_SUMMARY.md** - Overview of the video generation workflow
- **RSS_SYSTEM_README.md** - Documentation for RSS feed system

## Test Scripts (`tests/`)

- **test_auto_workflow.js** - Test automated workflow
- **test_complete_workflow.js** - Test complete end-to-end workflow
- **test_viral_video.js** - Test viral video generation
- **test_viral_video_webhook.js** - Test video webhook handling
- **test_simple_video.js** - Test simple video creation
- **test_video_now.js** - Test immediate video generation
- **test_rss_scheduler.js** - Test RSS scheduling
- **test_rss_ai.js** - Test RSS AI filtering
- **test_posting_schedule.js** - Test posting schedule
- **test_top_articles.js** - Test top articles fetching

## Scripts (`scripts/`)

- **get-metricool-userid.js** - Retrieve Metricool user ID for API configuration

## Utilities (`utils/`)

- **post_to_social_now.js** - Manually trigger social media posting
- **complete_workflow_manual.js** - Manually run the complete workflow

## Core System Components

The actual implementation lives in the main codebase:

### API Routes
- `/src/app/api/workflow/` - Workflow management endpoints
- `/src/app/api/webhooks/` - Webhook handlers for HeyGen and Submagic
- `/src/app/api/scheduler/` - Content scheduling endpoint
- `/src/app/api/startup/` - System initialization

### Libraries
- `/src/lib/metricool-api.ts` - Metricool API client
- `/src/lib/video-scheduler.ts` - Video scheduling logic
- `/src/lib/workflow-store.ts` - Workflow state management
- `/src/lib/rss-fetcher.ts` - RSS feed aggregation
- `/src/lib/article-quality-filter.ts` - AI content filtering
- `/src/lib/copyright-safety.ts` - Copyright compliance

## Quick Start

1. **Setup Metricool**: Follow `docs/METRICOOL_SETUP.md`
2. **Configure Environment**: Add Metricool API credentials to `.env`
3. **Test Connection**: Run `node scripts/get-metricool-userid.js`
4. **Run Tests**: Execute test scripts in `tests/` folder
5. **Deploy**: Use Railway or Heroku with included Procfile

## Features

- Automated RSS feed monitoring from multiple sources
- AI-powered content quality filtering
- HeyGen video generation with webhook support
- Submagic video enhancement integration
- Metricool multi-platform scheduling
- Workflow status tracking and monitoring
- Copyright safety checks
- Intelligent posting schedules

## Environment Variables Required

```
METRICOOL_API_KEY=your_api_key
METRICOOL_USER_ID=your_user_id
HEYGEN_API_KEY=your_heygen_key
OPENAI_API_KEY=your_openai_key
```

## Support

For detailed documentation, check the files in the `docs/` directory.
