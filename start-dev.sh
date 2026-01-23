#!/bin/bash

echo "🚀 Starting Tree-D Development Environment..."

# Start backend services
echo "📦 Starting backend (Docker)..."
docker-compose -f docker-compose.backend.yml up -d

# Wait for services to be healthy
echo "⏳ Waiting for services to start..."
sleep 5

# Show status
docker-compose -f docker-compose.backend.yml ps

echo ""
echo "✅ Backend is running!"
echo "📊 API Health: http://localhost:3000/health"
echo "🗄️  Database: localhost:5432"
echo ""
echo "📱 Starting Expo (mobile app)..."
echo ""

# Start Expo locally (this will show the QR code!)
npx expo start --tunnel
