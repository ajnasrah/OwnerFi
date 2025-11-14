#!/bin/bash
set -a
source .env.local
set +a
node scripts/register-heygen-webhooks.mjs
