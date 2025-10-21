#!/bin/bash

# Load environment variables from .env.local
set -a
source .env.local
set +a

# Run the script
node fix-failed-workflows.mjs
