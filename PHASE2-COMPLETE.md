# Voice Interview AI Platform - Phase 2 Complete! 🎉

## 🚀 What's New in Phase 2

Phase 2 adds the complete **voice processing pipeline** with real-time communication:

### 🎤 Voice Processing Features
- **Speech-to-Text**: OpenAI Whisper for accurate voice transcription
- **AI Responses**: Claude 3.5 Sonnet for intelligent interview conversations  
- **Text-to-Speech**: OpenAI TTS for natural voice responses
- **Real-time Communication**: WebSocket support for live interactions

### 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Voice Interview AI                        │
│                      Phase 2 Complete                       │
└─────────────────────────────────────────────────────────────┘

Frontend (React-like JS)          Backend (AWS Lambda)
┌─────────────────────┐          ┌─────────────────────┐
│ 🎙️  Voice Interface  │────────▶│ 🗣️  Speech-to-Text   │
│ 💬 Chat Interface   │◀────────│ 🤖 AI Response      │
│ 💻 Code Editor      │────────▶│ 🔊 Text-to-Speech   │
│ 🔌 WebSocket Client │◀────────│ 📡 WebSocket Handler │
└─────────────────────┘          │ ⚡ Code Executor    │
                                 │ 📁 File Operations  │
                                 │ 🗂️  Session Manager  │
                                 └─────────────────────┘
                                          │
                        ┌─────────────────┴─────────────────┐
                        │           AWS Services            │
                        │ 🪣 S3  📊 DynamoDB  🌐 API Gateway │
                        └───────────────────────────────────┘
```

## 📂 Project Structure

```
voice-interview-ai/
├── 📁 frontend/                    # Voice Interface Frontend
│   ├── index.html                  # Main UI with voice controls
│   └── voice-interview.js          # Voice processing logic
├── 📁 backend/lambda-functions/    # AWS Lambda Functions  
│   ├── speech-to-text/            # OpenAI Whisper STT
│   ├── ai-response/               # Claude 3.5 Sonnet AI
│   ├── text-to-speech/            # OpenAI TTS
│   ├── websocket-handler/         # Real-time communication
│   ├── code-executor/             # Secure Docker execution
│   ├── file-operations/           # File management
│   └── session-manager/           # Session handling
├── 📁 infrastructure/             # Terraform AWS setup
│   ├── main.tf                   # Complete infrastructure
│   └── terraform.tfvars          # API keys & configuration
├── 📁 docker-executors/          # Secure code execution
│   ├── python-executor/          # Python runtime
│   └── javascript-executor/      # Node.js runtime
├── deploy-phase2.sh              # 🚀 One-click deployment
├── start-dev-server.sh           # 🌐 Local development
└── .env                          # Environment configuration
```

## 🎯 Core Features

### 🎙️ Voice Interview Experience
- **Real-time voice recording** with visual feedback
- **Automatic speech transcription** using OpenAI Whisper
- **AI-powered responses** from Claude 3.5 Sonnet
- **Natural voice synthesis** with OpenAI TTS
- **Live conversation flow** with WebSocket communication

### 💻 Technical Interview Tools
- **Integrated code editor** with syntax highlighting
- **Secure Docker-based execution** (Python & JavaScript)
- **Built-in problem templates** (Two Sum, Reverse Linked List)
- **Performance analysis** and code quality metrics
- **Session recording** and conversation history

### 🔧 Professional Features
- **Multiple interview types**: Technical, Behavioral, System Design
- **Adjustable difficulty levels**: Easy, Medium, Hard
- **Session management** with persistent storage
- **Real-time typing indicators** and voice status
- **Export capabilities** for interview data

## 🚀 Quick Start Guide

### 1. Deploy to AWS (One Command!)

```bash
# Deploy complete infrastructure
./deploy-phase2.sh
```

This will:
- ✅ Build all 7 Lambda functions
- ✅ Create AWS infrastructure (DynamoDB, S3, API Gateway)
- ✅ Configure WebSocket API for real-time communication
- ✅ Set up security policies and CORS
- ✅ Display your API URLs for frontend configuration

### 2. Configure Frontend

Update `frontend/voice-interview.js` with your deployed URLs:

```javascript
// Replace with your actual API Gateway URL
this.API_BASE = 'https://your-api-id.execute-api.us-east-1.amazonaws.com/dev';

// Replace with your actual WebSocket URL  
this.WS_URL = 'wss://your-ws-id.execute-api.us-east-1.amazonaws.com/dev';
```

### 3. Start Development Server

```bash
# Start local frontend server
./start-dev-server.sh

# Open in browser
open http://localhost:8000
```

### 4. Test Voice Interview

1. **Click "Start Recording"** to begin voice input
2. **Speak your response** (e.g., "I would solve this using a hash map")
3. **Watch transcription** appear in real-time
4. **Hear AI response** with natural voice synthesis
5. **Use code editor** to implement your solution
6. **Run code** to test your implementation

## 🛠️ API Endpoints

### REST API Endpoints
- `POST /sessions` - Create/manage interview sessions
- `POST /speech-to-text` - Convert voice to text (Whisper)
- `POST /ai-response` - Get AI interview responses (Claude)
- `POST /text-to-speech` - Convert text to voice (OpenAI TTS)
- `POST /execute-code` - Run code securely (Docker)

### WebSocket Events
- `join-session` - Join an interview session
- `voice-status` - Voice recording status updates  
- `chat-message` - Real-time text messages
- `typing-indicator` - Show when user is typing
- `session-update` - Live session state changes

## 🔐 Security Features

### 🛡️ Code Execution Security
- **Docker containers** with resource limits (128MB RAM, 0.5 CPU)
- **Network isolation** (no internet access)
- **Read-only filesystems** with temporary execution directories
- **30-second timeout** protection
- **Input sanitization** and output filtering

### 🔒 AWS Security
- **IAM least privilege** access policies
- **API Gateway authentication** ready
- **S3 server-side encryption** enabled
- **DynamoDB encryption** at rest
- **VPC isolation** for Lambda functions

## 🎛️ Configuration Options

### Interview Settings
```javascript
// Interview types
interviewType: 'technical' | 'behavioral' | 'system-design'

// Difficulty levels  
difficulty: 'easy' | 'medium' | 'hard'

// Voice settings
voice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer'
autoTTS: true | false
voiceDetection: true | false
```

### Environment Variables
```bash
# Voice Processing
OPENAI_API_KEY=sk-proj-...          # Speech & TTS
ANTHROPIC_API_KEY=sk-ant-...        # AI responses

# AWS Resources (auto-configured)
S3_BUCKET=voice-interview-ai-storage-dev
SESSIONS_TABLE=voice-interview-ai-sessions-dev
FILES_TABLE=voice-interview-ai-files-dev
CONNECTIONS_TABLE=voice-interview-ai-connections-dev
```

## 📊 Monitoring & Analytics

### Built-in Metrics
- **Voice processing latency** (STT/TTS response times)
- **AI response quality** (confidence scores)
- **Code execution performance** (runtime, memory usage)
- **Session engagement** (duration, interaction count)
- **WebSocket connection health** (active connections, message throughput)

### AWS CloudWatch Integration
- **Lambda function metrics** (invocations, errors, duration)
- **API Gateway analytics** (request count, latency, error rates)
- **DynamoDB performance** (read/write capacity, throttling)
- **S3 storage metrics** (object count, storage size)

## 🧪 Testing & Development

### Local Testing
```bash
# Test individual Lambda functions
cd backend/lambda-functions/speech-to-text
npm test

# Test Docker containers
cd docker-executors/python-executor
docker build -t interview-executor:python .
docker run --rm interview-executor:python

# Frontend development
./start-dev-server.sh
```

### Production Deployment
```bash
# Full deployment
./deploy-phase2.sh

# Update specific function
cd infrastructure
terraform apply -target=aws_lambda_function.speech_to_text

# View deployment status
terraform show
```

## 🎯 Use Cases

### 👨‍💼 For Interviewers
- **Standardized technical assessments** with consistent AI evaluation
- **Real-time candidate analysis** with voice and code quality metrics
- **Automated session recording** and transcript generation
- **Custom problem sets** and difficulty adjustment
- **Remote interview capabilities** with full voice interaction

### 👩‍💻 For Candidates  
- **Natural conversation experience** with voice-first interface
- **Immediate feedback** on code submissions
- **Practice mode** with AI-powered mock interviews
- **Accessibility features** with voice and text input options
- **Performance insights** and improvement suggestions

### 🏢 For Companies
- **Scalable interview process** handling multiple concurrent sessions
- **Consistent evaluation criteria** with AI-powered assessment
- **Cost-effective screening** reducing manual interview overhead
- **Data-driven hiring** with comprehensive candidate analytics
- **Integration ready** with existing HR systems via APIs

## 🔮 What's Next?

### Phase 3 Roadmap (Advanced Features)
- 🎥 **Video integration** with facial expression analysis
- 🧠 **Advanced AI models** (GPT-4o, Claude 3.5 Opus)
- 📈 **Analytics dashboard** with interview insights
- 🔐 **Enterprise SSO** authentication
- 📱 **Mobile app** for on-the-go interviews
- 🌍 **Multi-language support** (Spanish, Chinese, etc.)
- 🎯 **Industry-specific templates** (Frontend, Backend, DevOps)

### Potential Enhancements
- **Screen sharing** for system design interviews  
- **Whiteboard collaboration** with real-time drawing
- **AI interview coaching** with personalized feedback
- **Candidate ranking** with ML-powered scoring
- **Integration APIs** for popular ATS systems

## 🆘 Troubleshooting

### Common Issues

**Voice recording not working**
- Check microphone permissions in browser
- Ensure HTTPS connection for production
- Verify Web Audio API support

**API calls failing**
- Update API URLs in `voice-interview.js`
- Check AWS credentials and region
- Verify Lambda function deployment

**WebSocket connection issues**
- Confirm WebSocket URL configuration
- Check API Gateway WebSocket routes
- Monitor CloudWatch logs for errors

**Docker execution timeout**
- Review resource limits in Lambda
- Check Docker container build logs
- Verify network isolation settings

### Debug Commands
```bash
# Check deployment status
cd infrastructure && terraform output

# View Lambda logs
aws logs describe-log-groups --log-group-name-prefix /aws/lambda/voice-interview-ai

# Test API endpoints
curl -X POST https://your-api-url/dev/sessions -d '{"type":"test"}'

# Monitor WebSocket connections
aws dynamodb scan --table-name voice-interview-ai-connections-dev
```

## 📞 Support

- 📚 **Documentation**: Check this README and inline code comments
- 🐛 **Bug Reports**: Create detailed issue descriptions with logs
- 💡 **Feature Requests**: Describe use case and expected behavior
- ⚡ **Performance Issues**: Include timing metrics and AWS region

---

## 🎉 Congratulations!

You've successfully deployed a **production-ready voice interview AI platform** with:

✅ **7 Lambda functions** processing voice and AI interactions  
✅ **3 databases** storing sessions, files, and connections  
✅ **2 APIs** handling REST and WebSocket communication  
✅ **1 beautiful frontend** with voice controls and code editor  
✅ **Security-first architecture** with Docker isolation and AWS best practices  

**Your voice interview AI is ready to conduct professional technical interviews!** 🚀

---

*Built with ❤️ using AWS Lambda, OpenAI APIs, Claude 3.5 Sonnet, Docker, and modern web technologies.*
