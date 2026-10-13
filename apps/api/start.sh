#!/bin/sh
set -e

echo "Running database migrations..."
node_modules/.bin/prisma db update

echo "Starting Zarova API..."
exec node dist/main.js
