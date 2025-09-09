#!/bin/bash

# Voice Interview AI - Phase 2 Deployment Script
# Packages and deploys all Lambda functions for the voice processing pipeline

set -e

echo "🚀 Starting Voice Interview AI Phase 2 Deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ROOT="/Users/chrissyd/inter-demo"
LAMBDA_DIR="$PROJECT_ROOT/backend/lambda-functions"
INFRASTRUCTURE_DIR="$PROJECT_ROOT/infrastructure"
FRONTEND_DIR="$PROJECT_ROOT/frontend"

# Lambda functions to deploy
LAMBDA_FUNCTIONS=(
    "file-operations"
    "session-manager" 
    "code-executor"
    "speech-to-text"
    "ai-response"
    "text-to-speech"
    "websocket-handler"
)

echo -e "${BLUE}📦 Phase 1: Building and packaging Lambda functions...${NC}"

# Function to build and package a Lambda function
package_lambda() {
    local function_name=$1
    local function_dir="$LAMBDA_DIR/$function_name"
    
    echo -e "${YELLOW}Building $function_name...${NC}"
    
    if [ ! -d "$function_dir" ]; then
        echo -e "${RED}❌ Directory not found: $function_dir${NC}"
        return 1
    fi
    
    cd "$function_dir"
    
    # Install dependencies and build
    echo "  📦 Installing dependencies..."
    npm install
    
    echo "  🔨 Building TypeScript..."
    npm run build
    
    # Create deployment package
    echo "  📋 Creating deployment package..."
    cd dist
    zip -r "$INFRASTRUCTURE_DIR/$function_name.zip" . -x "*.map"
    
    # Include node_modules for dependencies
    cd ..
    if [ -d "node_modules" ]; then
        zip -r "$INFRASTRUCTURE_DIR/$function_name.zip" node_modules
    fi
    
    echo -e "${GREEN}  ✅ $function_name packaged successfully${NC}"
}

# Package all Lambda functions
for func in "${LAMBDA_FUNCTIONS[@]}"; do
    package_lambda "$func"
done

echo -e "${BLUE}🏗️  Phase 2: Preparing Terraform deployment...${NC}"

cd "$INFRASTRUCTURE_DIR"

# Check if Terraform is initialized
if [ ! -d ".terraform" ]; then
    echo "  🔧 Initializing Terraform..."
    terraform init
else
    echo "  ✅ Terraform already initialized"
fi

# Create terraform.tfvars file if it doesn't exist
if [ ! -f "terraform.tfvars" ]; then
    echo "  📝 Creating terraform.tfvars file..."
    cat > terraform.tfvars << EOF
# Voice Interview AI - Terraform Variables
aws_region = "us-east-1"
environment = "dev"
project_name = "voice-interview-ai"

# API Keys - REPLACE WITH YOUR ACTUAL KEYS
openai_api_key = "your-openai-api-key-here"
anthropic_api_key = "your-anthropic-api-key-here"
EOF
    echo -e "${RED}  ⚠️  terraform.tfvars created with placeholder API keys${NC}"
    echo -e "${YELLOW}  📝 Please edit terraform.tfvars and add your real API keys before deploying!${NC}"
fi

echo -e "${BLUE}🔍 Phase 3: Terraform plan...${NC}"
terraform plan

echo -e "${YELLOW}⚠️  Ready to deploy! This will create AWS resources.${NC}"
echo -e "${YELLOW}📊 Resources to be created:${NC}"
echo "  • 7 Lambda functions (file-ops, session-mgr, code-exec, stt, ai-response, tts, websocket)"
echo "  • 3 DynamoDB tables (sessions, files, connections)"
echo "  • 1 S3 bucket with CORS configuration"
echo "  • 1 REST API Gateway with 5 endpoints"
echo "  • 1 WebSocket API with real-time communication"
echo "  • IAM roles and policies"

read -p "🚀 Deploy to AWS? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${BLUE}🚀 Phase 4: Deploying to AWS...${NC}"
    terraform apply -auto-approve
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}🎉 Deployment successful!${NC}"
        echo
        echo -e "${BLUE}📋 Deployment Summary:${NC}"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        
        # Get outputs
        API_URL=$(terraform output -raw api_gateway_url 2>/dev/null || echo "Not available")
        WS_URL=$(terraform output -raw websocket_api_url 2>/dev/null || echo "Not available")
        S3_BUCKET=$(terraform output -raw s3_bucket_name 2>/dev/null || echo "Not available")
        
        echo "🌐 API Gateway URL: $API_URL"
        echo "🔌 WebSocket URL: $WS_URL"
        echo "🪣 S3 Bucket: $S3_BUCKET"
        echo
        echo -e "${BLUE}📁 Available Endpoints:${NC}"
        echo "  POST $API_URL/sessions           - Session management"
        echo "  POST $API_URL/speech-to-text     - Voice to text conversion"
        echo "  POST $API_URL/ai-response        - AI interview responses"
        echo "  POST $API_URL/text-to-speech     - Text to voice conversion"
        echo "  POST $API_URL/execute-code       - Code execution"
        echo
        echo -e "${BLUE}🔧 Next Steps:${NC}"
        echo "1. Update frontend/voice-interview.js with your API URLs:"
        echo "   - API_BASE: '$API_URL'"
        echo "   - WS_URL: '$WS_URL'"
        echo "2. Serve the frontend (python -m http.server 8000 in frontend/)"
        echo "3. Test the voice interview platform!"
        echo
        echo -e "${GREEN}✨ Phase 2 deployment complete! Your voice interview AI is ready.${NC}"
    else
        echo -e "${RED}❌ Deployment failed. Check the error messages above.${NC}"
        exit 1
    fi
else
    echo -e "${YELLOW}⏸️  Deployment cancelled.${NC}"
    echo "You can run this script again when ready to deploy."
fi

echo
echo -e "${BLUE}📊 Additional Commands:${NC}"
echo "  • View resources: terraform show"
echo "  • Destroy resources: terraform destroy"
echo "  • Update deployment: ./deploy-phase2.sh"
echo
echo -e "${GREEN}🎯 Happy interviewing!${NC}"
