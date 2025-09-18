#!/bin/bash

# Cloudflare Setup Script
set -e

echo "🔧 Setting up Cloudflare for Cozy Soccer Champ..."

# Login check
echo "🔐 Checking Cloudflare authentication..."
if ! npx wrangler whoami &> /dev/null; then
    echo "🔑 Logging in to Cloudflare..."
    npx wrangler login
fi

# Show current user
echo "👤 Logged in as: $(npx wrangler whoami)"

# Create D1 database
echo "🗄️  Creating D1 database..."
DB_OUTPUT=$(npx wrangler d1 create cozy-soccer-champ-db 2>&1)
echo "$DB_OUTPUT"

# Extract database ID
DB_ID=$(echo "$DB_OUTPUT" | grep -o 'database_id = "[^"]*"' | sed 's/database_id = "\(.*\)"/\1/')

if [ ! -z "$DB_ID" ]; then
    echo "📝 Database ID: $DB_ID"
    echo "🔧 Please update wrangler.toml with this database_id"
    
    # Auto-update wrangler.toml if possible
    if [ -f "wrangler.toml" ]; then
        sed -i.bak "s/database_id = \"YOUR_DATABASE_ID\"/database_id = \"$DB_ID\"/" wrangler.toml
        rm -f wrangler.toml.bak
        echo "✅ Updated wrangler.toml automatically"
    fi
else
    echo "⚠️  Could not extract database ID. Please check output above."
fi

# Setup secrets
echo ""
echo "🔐 Setting up environment variables..."
echo "Please set the following secrets:"
echo ""
echo "npx wrangler secret put SESSION_SECRET"
echo "npx wrangler secret put TELEGRAM_BOT_TOKEN"  
echo "npx wrangler secret put FOOTBALL_API_TOKEN"
echo ""
echo "Optional (for development):"
echo "npx wrangler secret put TG_INIT_BYPASS"
echo ""

read -p "Do you want to set these secrets now? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🔑 Setting SESSION_SECRET..."
    npx wrangler secret put SESSION_SECRET
    
    echo "🔑 Setting TELEGRAM_BOT_TOKEN..."
    npx wrangler secret put TELEGRAM_BOT_TOKEN
    
    echo "🔑 Setting FOOTBALL_API_TOKEN..."
    npx wrangler secret put FOOTBALL_API_TOKEN
    
    read -p "Set TG_INIT_BYPASS for development? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "🔑 Setting TG_INIT_BYPASS..."
        npx wrangler secret put TG_INIT_BYPASS
    fi
fi

echo ""
echo "✅ Cloudflare setup completed!"
echo ""
echo "📋 Next steps:"
echo "1. Run 'npm ci' to install dependencies"
echo "2. Run './deploy.sh' to deploy the application"
echo "3. Set up Cloudflare Pages for the frontend"
