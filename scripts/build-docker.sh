#!/bin/bash

# Voice Interview AI - Docker Container Build Script
set -e

echo "🐳 Building Docker containers for Voice Interview AI"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker Desktop and try again."
    exit 1
fi

print_status "Docker is running ✅"

# Build Python executor container
print_step "Building Python execution container..."
cd backend/docker-containers/python

# Make execute script executable
chmod +x execute.py

# Build the container
if docker build -t interview-executor:python . ; then
    print_status "✅ Python container built successfully"
else
    print_error "❌ Failed to build Python container"
    exit 1
fi

cd ../../..

# Build JavaScript executor container
print_step "Building JavaScript execution container..."
cd backend/docker-containers/javascript

# Make execute script executable
chmod +x execute.js

# Build the container
if docker build -t interview-executor:node . ; then
    print_status "✅ JavaScript container built successfully"
else
    print_error "❌ Failed to build JavaScript container"
    exit 1
fi

cd ../../..

# Test containers
print_step "Testing containers..."

# Test Python container
print_status "Testing Python container..."
TEST_CODE_PYTHON='{"code": "print(\"Hello from Python container!\")\nprint(2 + 2)", "test_cases": []}'

if echo "$TEST_CODE_PYTHON" | docker run --rm -i --network none --memory=128m --cpus=0.5 interview-executor:python; then
    print_status "✅ Python container test passed"
else
    print_warning "⚠️  Python container test had issues"
fi

# Test JavaScript container
print_status "Testing JavaScript container..."
TEST_CODE_JS='{"code": "console.log(\"Hello from Node container!\");\nconsole.log(2 + 2);", "test_cases": []}'

if echo "$TEST_CODE_JS" | docker run --rm -i --network none --memory=128m --cpus=0.5 interview-executor:node; then
    print_status "✅ JavaScript container test passed"
else
    print_warning "⚠️  JavaScript container test had issues"
fi

# Create network for containers
print_step "Creating Docker network..."
if docker network create interview-network --driver bridge --internal 2>/dev/null || true; then
    print_status "✅ Docker network ready"
fi

# List built images
print_step "Docker images built:"
docker images | grep interview-executor

print_status "🎉 Docker container setup complete!"
echo ""
print_status "Available containers:"
echo "  - interview-executor:python  (Python 3.9 + security constraints)"
echo "  - interview-executor:node    (Node.js 18 + security constraints)"
echo ""
print_status "You can now:"
echo "  1. Test containers: ./scripts/test-docker-execution.sh"
echo "  2. Use docker-compose: docker-compose up -d"
echo "  3. Run individual containers for code execution"
