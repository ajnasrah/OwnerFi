#!/bin/bash

# Load environment variables from .env.local
set -a
source .env.local
set +a

# Run the completion script
node complete-submagic-workflows.mjs
