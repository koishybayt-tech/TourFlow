#!/bin/sh
set -e
echo "Applying database migrations..."
node_modules/.bin/prisma migrate deploy
exec node .output/server/index.mjs
