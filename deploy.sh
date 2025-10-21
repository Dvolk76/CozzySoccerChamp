#!/bin/bash

# Cloudflare Deployment Script for Cozy Soccer Champ
set -e

echo "🚀 Starting Cloudflare deployment..."

# Check if wrangler is available
echo "🔐 Checking Cloudflare authentication..."
if ! npx wrangler whoami &> /dev/null; then
    echo "⚠️  Not logged in to Cloudflare. Please run: npx wrangler login"
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm ci

# Install client dependencies
echo "📦 Installing client dependencies..."
cd client
npm ci
cd ..

# Generate Prisma client for D1
echo "🔧 Generating Prisma client for D1..."
npm run prisma:generate:d1

# Create D1 database if it doesn't exist
echo "🗄️  Setting up D1 database..."
DB_OUTPUT=$(npx wrangler d1 create cozy-soccer-champ-db 2>&1 || true)
echo "$DB_OUTPUT"

# Extract database ID from output
DB_ID=$(echo "$DB_OUTPUT" | grep -o 'database_id = "[^"]*"' | sed 's/database_id = "\(.*\)"/\1/' || echo "")

if [ ! -z "$DB_ID" ]; then
    echo "📝 Updating wrangler.toml with database ID: $DB_ID"
    sed -i.bak "s/database_id = \"YOUR_DATABASE_ID\"/database_id = \"$DB_ID\"/" wrangler.toml
    rm wrangler.toml.bak 2>/dev/null || true
fi

# Run base migrations
echo "🔄 Running D1 base migration (idempotent on create)..."
npx wrangler d1 execute cozy-soccer-champ-db --file=./migrations/0001_initial.sql || true

# Ensure safe schema updates for new features (idempotent)
echo "🛡️  Ensuring D1 schema has tournament picks and bonus columns..."

ensure_column() {
  local table=$1
  local column=$2
  local ddl=$3
  local present=$(npx wrangler d1 execute cozy-soccer-champ-db --command "PRAGMA table_info('${table}');" 2>/dev/null | grep -c "${column}")
  if [ "$present" -eq 0 ]; then
    echo "➡️  Adding column ${table}.${column}"
    npx wrangler d1 execute cozy-soccer-champ-db --command "${ddl}" || {
      echo "❌ Failed to add column ${table}.${column}"; exit 1;
    }
  else
    echo "✅ Column exists: ${table}.${column}"
  fi
}

# Add User.championPick (TEXT NULL)
ensure_column "User" "championPick" "ALTER TABLE User ADD COLUMN championPick TEXT;"
# Add User.topScorerPick (TEXT NULL)
ensure_column "User" "topScorerPick" "ALTER TABLE User ADD COLUMN topScorerPick TEXT;"
# Add Score.bonusPoints (INTEGER NOT NULL DEFAULT 0)
ensure_column "Score" "bonusPoints" "ALTER TABLE Score ADD COLUMN bonusPoints INTEGER NOT NULL DEFAULT 0;"

# Build backend
echo "🔨 Building backend..."
npm run build

# Build frontend with explicit API base
echo "🔨 Building frontend..."
API_BASE_URL="https://cozy-soccer-champ.cozzy-soccer.workers.dev"
echo "VITE_API_BASE=${API_BASE_URL}" > client/.env
cd client && npm run build && cd ..

# Deploy backend to Workers
echo "🚀 Deploying backend to Cloudflare Workers..."
npx wrangler deploy --env=""

# Get the worker URL
WORKER_URL=$(npx wrangler deploy --dry-run --env="" 2>&1 | grep -o 'https://[^[:space:]]*\.workers\.dev' | head -1 || echo "")

echo "✅ Deployment completed!"
echo ""
echo "📋 Next steps:"
echo "1. Set up Cloudflare Pages for the frontend:"
echo "   - Go to Cloudflare Dashboard > Pages"
echo "   - Connect your GitHub repository"
echo "   - Set build command: cd client && npm run build"
echo "   - Set build output directory: client/dist"
echo ""
echo "2. Set environment variables:"
echo "   npx wrangler secret put SESSION_SECRET"
echo "   npx wrangler secret put TELEGRAM_BOT_TOKEN"
echo "   npx wrangler secret put FOOTBALL_API_TOKEN"
echo ""
echo "3. Update frontend API URL to point to:"
if [ ! -z "$WORKER_URL" ]; then
    echo "   $WORKER_URL"
else
    echo "   https://cozy-soccer-champ.<your-subdomain>.workers.dev"
fi
echo ""
echo "🎉 Your app is ready for production!"
