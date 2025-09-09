#!/bin/bash

# Simple build script for all Lambda functions
# Installs TypeScript globally and builds each function

set -e

echo "🔧 Installing TypeScript globally..."
npm install -g typescript

echo "📦 Building all Lambda functions..."

LAMBDA_FUNCTIONS=(
    "file-operations"
    "session-manager" 
    "code-executor"
    "speech-to-text"
    "ai-response"
    "text-to-speech"
    "websocket-handler"
)

for func in "${LAMBDA_FUNCTIONS[@]}"; do
    echo "Building $func..."
    cd "/Users/chrissyd/inter-demo/backend/lambda-functions/$func"
    npm run build
    echo "✅ $func built successfully"
done

echo "🎉 All Lambda functions built successfully!"
