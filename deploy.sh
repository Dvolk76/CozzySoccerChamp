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

# Run migrations
echo "🔄 Running D1 migrations..."
npx wrangler d1 execute cozy-soccer-champ-db --file=./migrations/0001_initial.sql

# Build backend
echo "🔨 Building backend..."
npm run build

# Build frontend
echo "🔨 Building frontend..."
cd client
npm run build
cd ..

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
