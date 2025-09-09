#!/bin/bash

# Local Development Server for Voice Interview AI
# Serves the frontend with a simple HTTP server

cd "$(dirname "$0")"

echo "🌐 Starting Voice Interview AI Development Server..."
echo "📁 Serving from: $(pwd)/frontend"
echo "🔗 URL: http://localhost:8000"
echo
echo "⚠️  Note: Update the API URLs in voice-interview.js before testing:"
echo "   - API_BASE: Your API Gateway URL"
echo "   - WS_URL: Your WebSocket API URL"
echo
echo "Press Ctrl+C to stop the server"
echo

cd frontend
python3 -m http.server 8000
