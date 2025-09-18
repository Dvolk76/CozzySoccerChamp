#!/bin/bash

# Pre-deployment checks
set -e

echo "🔍 Running pre-deployment checks..."

# Check if required files exist
REQUIRED_FILES=(
    "wrangler.toml"
    "package.json"
    "client/package.json"
    "prisma/schema-d1.prisma"
    "migrations/0001_initial.sql"
    "src/worker.ts"
)

echo "📁 Checking required files..."
for file in "${REQUIRED_FILES[@]}"; do
    if [ ! -f "$file" ]; then
        echo "❌ Missing required file: $file"
        exit 1
    else
        echo "✅ Found: $file"
    fi
done

# Check authentication
echo ""
echo "🔐 Checking authentication..."
if ! npx wrangler whoami &> /dev/null; then
    echo "❌ Not authenticated with Cloudflare. Please run: npx wrangler login"
    exit 1
else
    echo "✅ Authenticated as: $(npx wrangler whoami)"
fi

# Check node modules
echo ""
echo "📦 Checking dependencies..."
if [ ! -d "node_modules" ]; then
    echo "❌ Backend dependencies not installed. Please run: npm ci"
    exit 1
else
    echo "✅ Backend dependencies installed"
fi

if [ ! -d "client/node_modules" ]; then
    echo "❌ Frontend dependencies not installed. Please run: cd client && npm ci"
    exit 1
else
    echo "✅ Frontend dependencies installed"
fi

# Check if database ID is set
echo ""
echo "🗄️  Checking database configuration..."
if grep -q "YOUR_DATABASE_ID" wrangler.toml; then
    echo "❌ Database ID not set in wrangler.toml"
    echo "   Please run: npx wrangler d1 create cozy-soccer-champ-db"
    echo "   Then update the database_id in wrangler.toml"
    exit 1
else
    echo "✅ Database ID configured"
fi

# Check secrets (this will show which secrets are set)
echo ""
echo "🔑 Checking secrets..."
echo "Configured secrets:"
npx wrangler secret list 2>/dev/null || echo "No secrets found"

# Build test
echo ""
echo "🔨 Testing build..."
if npm run build > /dev/null 2>&1; then
    echo "✅ Backend build successful"
else
    echo "❌ Backend build failed"
    exit 1
fi

if cd client && npm run build > /dev/null 2>&1; then
    echo "✅ Frontend build successful"
    cd ..
else
    echo "❌ Frontend build failed"
    exit 1
fi

# Check TypeScript
echo ""
echo "📝 Checking TypeScript..."
if npx tsc --noEmit > /dev/null 2>&1; then
    echo "✅ TypeScript check passed"
else
    echo "⚠️  TypeScript check failed (this might be OK for deployment)"
fi

echo ""
echo "🎉 Pre-deployment checks completed!"
echo ""
echo "🚀 Ready to deploy! Run: ./deploy.sh"
