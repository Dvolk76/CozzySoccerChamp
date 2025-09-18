#!/bin/bash

# Build script for Cloudflare Pages
set -e

echo "🔧 Building frontend for Cloudflare Pages..."

# Install client dependencies
echo "📦 Installing client dependencies..."
cd client
npm ci

# Build frontend
echo "🔨 Building frontend..."
npm run build

echo "✅ Frontend build completed!"
echo "📁 Output directory: client/dist"

# List build output for debugging
echo "📋 Build contents:"
ls -la dist/

cd ..
