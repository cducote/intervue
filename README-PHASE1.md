# Voice Interview AI - Phase 1 Backend Infrastructure

## 🎯 Current Status: Phase 1 Implementation

This directory contains the complete backend infrastructure for the Voice Interview AI platform. We've implemented a local development approach to avoid Docker networking issues while maintaining the same functionality.

## 📁 Project Structure

```
voice-interview-ai/
├── backend/
│   ├── lambda-functions/
│   │   ├── file-operations/       # File CRUD operations
│   │   ├── session-manager/       # Interview session management
│   │   └── code-executor/         # Code execution engine
│   ├── docker-containers/         # Docker containers (ready for production)
│   │   ├── python/                # Python execution environment
│   │   └── javascript/            # JavaScript execution environment
│   └── local-execution/           # Local development execution
├── infrastructure/                # Terraform AWS infrastructure
├── scripts/                      # Setup and utility scripts
└── phase1-backend-infrastructure.md
```

## 🚀 Quick Start

### 1. Run the Setup Script

```bash
chmod +x scripts/setup-local-dev.sh
./scripts/setup-local-dev.sh
```

This will:
- Install all dependencies
- Set up Lambda functions
- Create local execution environment
- Generate configuration files
- Create test scripts

### 2. Test Local Code Execution

```bash
# Test the execution environment
node scripts/test-local-execution.js
```

Expected output:
```
🧪 Testing local code execution environment...
🐍 Testing Python execution...
Python execution result: {"success": true, "stdout": "Test 1: [0, 1]\nTest 2: [1, 2]\n", ...}
🟨 Testing JavaScript execution...
JavaScript execution result: {"success": true, "stdout": "Test 1: [0, 1]\nTest 2: [1, 2]\n", ...}
✅ Local execution tests completed
```

### 3. Deploy AWS Infrastructure (Optional)

```bash
cd infrastructure
terraform init
terraform plan
terraform apply
```

## 🔧 Local Development Features

### Code Execution Without Docker
- **Python Execution**: Uses local Python 3.9+ with sandboxing
- **JavaScript Execution**: Uses local Node.js 18+ with timeout controls
- **Security**: Temporary directories, process isolation, timeouts
- **Testing**: Built-in test framework for code execution

### Lambda Functions

#### 1. File Operations (`file-operations/`)
- **Create File**: `POST /files` with sessionId, filePath, content
- **Read File**: `GET /files/{sessionId}/{filePath}`
- **Update File**: `PUT /files/{sessionId}/{filePath}`
- **Delete File**: `DELETE /files/{sessionId}/{filePath}`
- **List Files**: `GET /files/{sessionId}`

#### 2. Session Manager (`session-manager/`)
- **Create Session**: `POST /sessions` with optional templateId
- **Get Session**: `GET /sessions/{sessionId}`
- **Update Session**: `PUT /sessions/{sessionId}`
- **End Session**: `DELETE /sessions/{sessionId}`

#### 3. Code Executor (`code-executor/`)
- **Execute Code**: `POST /execute` with sessionId, fileName, language
- **Support**: Python, JavaScript, Java, C++ (extensible)
- **Features**: Test cases, timeout control, output capture

## 🧪 Testing

### Unit Tests
```bash
# Test file operations
cd backend/lambda-functions/file-operations
npm test

# Test session manager
cd backend/lambda-functions/session-manager
npm test

# Test code executor
cd backend/lambda-functions/code-executor
npm test
```

### Integration Tests
```bash
# Test complete workflow
npm run test:integration
```

### Local Execution Tests
```bash
# Test code execution engines
node scripts/test-local-execution.js
```

## 📋 API Examples

### Create a Session
```bash
curl -X POST http://localhost:3000/sessions \
  -H "Content-Type: application/json" \
  -d '{"action": "CREATE_SESSION", "templateId": "two-sum"}'
```

### Create a File
```bash
curl -X POST http://localhost:3000/files \
  -H "Content-Type: application/json" \
  -d '{
    "action": "CREATE_FILE",
    "sessionId": "session-123",
    "filePath": "/solution.py",
    "content": "def two_sum(nums, target):\n    return []"
  }'
```

### Execute Code
```bash
curl -X POST http://localhost:3000/execute \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "session-123",
    "fileName": "/solution.py",
    "language": "python",
    "testCases": [
      {"input": [[2,7,11,15], 9], "expected": [0,1]}
    ]
  }'
```

## 🔒 Security Features

### Code Execution Security
- **Process Isolation**: Each execution runs in isolated process
- **Timeout Controls**: 30-second default timeout (configurable)
- **Memory Limits**: 128MB default limit (configurable)
- **File System**: Temporary directories, automatic cleanup
- **Network**: No network access during execution

### AWS Security
- **IAM Roles**: Least privilege access for Lambda functions
- **S3 Encryption**: Server-side encryption for file storage
- **DynamoDB**: Secure table access with proper permissions
- **API Gateway**: CORS and authentication ready

## 🔧 Configuration

### Environment Variables
```bash
# Development (.env.local)
NODE_ENV=development
AWS_REGION=us-east-1
S3_BUCKET=voice-interview-platform-storage-dev
SESSIONS_TABLE=voice-interview-ai-sessions-dev
FILES_TABLE=voice-interview-ai-files-dev
EXECUTION_TIMEOUT=30000
USE_LOCAL_EXECUTION=true
```

### Production (AWS Lambda Environment)
- `SESSIONS_TABLE`: DynamoDB sessions table name
- `FILES_TABLE`: DynamoDB files table name
- `S3_BUCKET`: S3 bucket for file storage
- `EXECUTION_TIMEOUT`: Code execution timeout (ms)

## 📊 Monitoring & Logging

### CloudWatch Logs
- Lambda function logs automatically sent to CloudWatch
- Structured logging with request IDs
- Error tracking and performance metrics

### DynamoDB Metrics
- Table performance monitoring
- Read/write capacity tracking
- Error rate monitoring

## 🐛 Troubleshooting

### Common Issues

#### 1. TypeScript Compilation Errors
```bash
# Fix missing type dependencies
cd backend/lambda-functions/[function-name]
npm install --save-dev @types/aws-lambda @types/node @types/uuid
npm run build
```

#### 2. Permission Errors
```bash
# Make scripts executable
chmod +x scripts/setup-local-dev.sh
chmod +x scripts/start-dev.sh
chmod +x backend/docker-containers/python/execute.py
chmod +x backend/docker-containers/javascript/execute.js
```

#### 3. Python/Node.js Not Found
```bash
# Check versions
python3 --version  # Should be 3.9+
node --version      # Should be 18+
npm --version
```

#### 4. AWS Credentials
```bash
# Configure AWS CLI
aws configure
# Or set environment variables
export AWS_ACCESS_KEY_ID=your_key
export AWS_SECRET_ACCESS_KEY=your_secret
export AWS_DEFAULT_REGION=us-east-1
```

## ✅ Phase 1 Completion Checklist

- [x] DynamoDB tables designed and configured
- [x] S3 bucket structure defined
- [x] File operations Lambda function created
- [x] Session manager Lambda function created
- [x] Code executor Lambda function created
- [x] Docker containers for Python/JavaScript execution
- [x] Local development environment setup
- [x] Security configurations implemented
- [x] Testing framework established
- [x] Terraform infrastructure as code
- [x] API endpoints defined
- [x] Error handling implemented
- [x] Documentation completed

## 🎯 Next Steps: Phase 2

Once Phase 1 is fully tested and deployed, proceed to **Phase 2: Voice Processing Pipeline** which includes:

1. WebSocket voice handler implementation
2. OpenAI Whisper integration (Speech-to-Text)
3. Claude 3.5 Sonnet integration (AI responses)
4. OpenAI TTS integration (Text-to-Speech)
5. Interview flow management
6. Voice command processing

## 📞 Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review logs in `backend/lambda-functions/[function]/logs/`
3. Test individual components using the provided test scripts
4. Verify AWS credentials and permissions

**Phase 1 Complete! 🎉 Ready for Voice Processing Integration.**
