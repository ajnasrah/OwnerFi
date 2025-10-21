#!/bin/bash

# Load environment variables from .env.local
set -a
source .env.local
set +a

# Run the simple retry script
node retry-workflows-simple.mjs
