# Phase 1: Backend Infrastructure & Core Services

## Overview
Set up the foundational AWS services, file system, and code execution engine. This phase focuses on building the backend infrastructure that powers the voice interview platform.

## 1. AWS Services Setup

### DynamoDB Tables

Create two main tables:

**Sessions Table:**
```
Table Name: interview-sessions
Partition Key: sessionId (String)
Sort Key: type (String) - values: "METADATA", "CONFIG"

Attributes:
- sessionId: Unique session identifier
- type: Record type (METADATA/CONFIG)
- createdAt: Timestamp
- status: active/completed/terminated
- templateId: Interview template used
- candidateName: Optional candidate identifier
```

**Files Table:**
```
Table Name: session-files
Partition Key: sessionId (String)
Sort Key: filePath (String)

Attributes:
- sessionId: Session identifier
- filePath: Full file path (e.g., /solution.py, /utils/helper.py)
- s3Key: S3 object key
- lastModified: Timestamp
- fileType: File extension/language
- content: File content (for small files)
```

### S3 Bucket Structure

```
Bucket: voice-interview-platform-storage
Structure:
interview-sessions/
  session-{uuid}/
    files/
      solution.py
      test.py
      utils/
        helper.py
    outputs/
      execution-results.json
      logs.txt
```

### Lambda Functions to Create

**1. File Operations Service**
```javascript
// file-operations/index.js
exports.handler = async (event) => {
    const { action, sessionId, filePath, content } = JSON.parse(event.body);
    
    switch(action) {
        case 'CREATE_FILE':
            return await createFile(sessionId, filePath, content);
        case 'READ_FILE':
            return await readFile(sessionId, filePath);
        case 'UPDATE_FILE':
            return await updateFile(sessionId, filePath, content);
        case 'LIST_FILES':
            return await listFiles(sessionId);
        case 'DELETE_FILE':
            return await deleteFile(sessionId, filePath);
    }
};
```

**2. Session Manager Service**
```javascript
// session-manager/index.js
exports.handler = async (event) => {
    const { action, sessionId, templateId } = JSON.parse(event.body);
    
    switch(action) {
        case 'CREATE_SESSION':
            return await createSession(templateId);
        case 'GET_SESSION':
            return await getSession(sessionId);
        case 'UPDATE_SESSION':
            return await updateSession(sessionId, updates);
        case 'END_SESSION':
            return await endSession(sessionId);
    }
};
```

## 2. Code Execution Engine

### Docker Container Setup

**Python Execution Container:**
```dockerfile
# Dockerfile.python
FROM python:3.9-alpine

# Create non-root user
RUN adduser -D -s /bin/sh coderunner

# Install security tools
RUN apk add --no-cache dumb-init

# Set working directory
WORKDIR /app

# Copy execution script
COPY execute.py /app/
RUN chmod +x /app/execute.py

# Switch to non-root user
USER coderunner

# Set resource limits and security
ENTRYPOINT ["dumb-init", "--"]
CMD ["python", "/app/execute.py"]
```

**JavaScript Execution Container:**
```dockerfile
# Dockerfile.node
FROM node:18-alpine

RUN adduser -D -s /bin/sh coderunner
RUN apk add --no-cache dumb-init

WORKDIR /app
COPY execute.js /app/
RUN chmod +x /app/execute.js

USER coderunner

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "/app/execute.js"]
```

### Code Executor Lambda

**Lambda Function:**
```javascript
// code-executor/index.js
const AWS = require('aws-sdk');
const { exec } = require('child_process');

exports.handler = async (event) => {
    const { sessionId, fileName, language, testCases } = JSON.parse(event.body);
    
    try {
        // 1. Download file from S3
        const fileContent = await downloadFromS3(sessionId, fileName);
        
        // 2. Create temporary execution environment
        const containerId = await createContainer(language);
        
        // 3. Execute code with security constraints
        const result = await executeInContainer(containerId, fileContent, testCases);
        
        // 4. Clean up container
        await removeContainer(containerId);
        
        // 5. Store results in S3
        await storeResults(sessionId, result);
        
        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                output: result.stdout,
                errors: result.stderr,
                exitCode: result.exitCode,
                executionTime: result.duration
            })
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({
                success: false,
                error: error.message
            })
        };
    }
};
```

### Security Configuration

**Container Security Settings:**
```bash
# Docker run command with security constraints
docker run \
  --rm \
  --network none \
  --memory=128m \
  --cpus=0.5 \
  --read-only \
  --tmpfs /tmp:rw,noexec,nosuid,size=50m \
  --timeout 30s \
  --user 1000:1000 \
  interview-executor:python
```

## 3. API Gateway Setup

### REST API Endpoints

```yaml
# API Gateway Configuration
/api/v1/sessions:
  POST: Create new session
  GET: List sessions

/api/v1/sessions/{sessionId}:
  GET: Get session details
  PUT: Update session
  DELETE: End session

/api/v1/sessions/{sessionId}/files:
  GET: List files in session
  POST: Create new file

/api/v1/sessions/{sessionId}/files/{filePath}:
  GET: Read file content
  PUT: Update file content
  DELETE: Delete file

/api/v1/sessions/{sessionId}/execute:
  POST: Execute code
```

### WebSocket API for Voice

```yaml
# WebSocket Routes
$connect: Handle client connection
$disconnect: Handle client disconnection
$default: Handle all messages (audio streams, commands)

# Message Types:
audio-chunk: Real-time audio data
voice-command: Processed voice commands
file-operation: File system operations
code-execution: Code execution requests
```

## 4. Environment Variables & Configuration

```bash
# Lambda Environment Variables
S3_BUCKET=voice-interview-platform-storage
DYNAMODB_SESSIONS_TABLE=interview-sessions
DYNAMODB_FILES_TABLE=session-files
DOCKER_NETWORK=interview-network
MAX_EXECUTION_TIME=30
MAX_FILE_SIZE=1048576  # 1MB
SUPPORTED_LANGUAGES=python,javascript,java
```

## 5. IAM Roles & Permissions

**Lambda Execution Role:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::voice-interview-platform-storage/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Query",
        "dynamodb:Scan"
      ],
      "Resource": [
        "arn:aws:dynamodb:*:*:table/interview-sessions",
        "arn:aws:dynamodb:*:*:table/session-files"
      ]
    }
  ]
}
```

## 6. Testing Infrastructure

### Unit Tests
```bash
# Test file operations
npm test -- file-operations.test.js

# Test code execution
npm test -- code-executor.test.js

# Test session management
npm test -- session-manager.test.js
```

### Integration Tests
```bash
# End-to-end API testing
npm run test:integration

# Load testing
npm run test:load
```

## Success Criteria for Phase 1

- [ ] DynamoDB tables created and configured
- [ ] S3 bucket with proper folder structure
- [ ] File operations Lambda working (CRUD)
- [ ] Docker containers for Python/JS execution
- [ ] Code executor Lambda with security constraints
- [ ] API Gateway endpoints responding correctly
- [ ] WebSocket connection established
- [ ] All Lambda functions deployed and tested
- [ ] IAM roles and permissions configured
- [ ] Basic integration tests passing

## Next Steps

Once Phase 1 is complete, move to `phase2-voice-processing.md` to implement the voice interaction pipeline with OpenAI Whisper, Claude 3.5, and TTS integration.

## Estimated Timeline

- AWS Setup & Configuration: 2-3 days
- Lambda Functions Development: 3-4 days
- Docker Container Setup: 2-3 days
- API Gateway & WebSocket: 2-3 days
- Testing & Security: 2-3 days

**Total: 11-16 days**
