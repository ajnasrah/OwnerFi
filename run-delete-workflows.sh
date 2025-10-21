#!/bin/bash

set -a
source .env.local
set +a

node delete-failed-workflows.mjs
