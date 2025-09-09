# Phase 2: Voice Processing Pipeline & AI Integration

## Overview
Implement the voice interaction system using OpenAI Whisper for speech-to-text, Claude 3.5 Sonnet for AI responses, and OpenAI TTS for text-to-speech. This phase creates the intelligent interview assistant.

## 1. WebSocket Voice Handler

### Lambda Function for Real-time Audio

```javascript
// voice-processor/index.js
const AWS = require('aws-sdk');
const WebSocket = require('ws');

exports.handler = async (event, context) => {
    const { requestContext, body } = event;
    const { connectionId, routeKey } = requestContext;
    
    try {
        switch (routeKey) {
            case '$connect':
                return await handleConnect(connectionId);
            case '$disconnect':
                return await handleDisconnect(connectionId);
            case '$default':
                return await handleMessage(connectionId, JSON.parse(body));
        }
    } catch (error) {
        console.error('Voice processor error:', error);
        return { statusCode: 500 };
    }
};

async function handleMessage(connectionId, message) {
    const { type, data, sessionId } = message;
    
    switch (type) {
        case 'audio-chunk':
            return await processAudioChunk(connectionId, sessionId, data);
        case 'voice-command':
            return await processVoiceCommand(connectionId, sessionId, data);
        case 'start-recording':
            return await startRecording(connectionId, sessionId);
        case 'stop-recording':
            return await stopRecording(connectionId, sessionId);
    }
}
```

### Audio Chunk Processing

```javascript
// Audio buffer management
class AudioBuffer {
    constructor(sessionId) {
        this.sessionId = sessionId;
        this.chunks = [];
        this.totalDuration = 0;
        this.isProcessing = false;
    }
    
    addChunk(audioData) {
        this.chunks.push(audioData);
        this.totalDuration += this.calculateDuration(audioData);
        
        // Auto-process when buffer reaches threshold
        if (this.totalDuration >= 3000 && !this.isProcessing) { // 3 seconds
            this.processBuffer();
        }
    }
    
    async processBuffer() {
        this.isProcessing = true;
        const audioBlob = this.combineChunks();
        
        try {
            // Send to OpenAI Whisper
            const transcript = await transcribeAudio(audioBlob);
            if (transcript.trim()) {
                await processTranscript(this.sessionId, transcript);
            }
        } finally {
            this.clearBuffer();
            this.isProcessing = false;
        }
    }
}
```

## 2. OpenAI Whisper Integration

### Speech-to-Text Service

```javascript
// whisper-service.js
const OpenAI = require('openai');

class WhisperService {
    constructor() {
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });
    }
    
    async transcribeAudio(audioBuffer, language = 'en') {
        try {
            const response = await this.openai.audio.transcriptions.create({
                file: audioBuffer,
                model: "whisper-1",
                language: language,
                response_format: "json",
                temperature: 0.2
            });
            
            return {
                text: response.text,
                language: response.language,
                confidence: response.confidence || 0.9
            };
        } catch (error) {
            console.error('Whisper transcription error:', error);
            throw new Error('Failed to transcribe audio');
        }
    }
}
```

## 3. Claude 3.5 Sonnet Integration

### AI Interview Assistant

```javascript
// claude-service.js
const Anthropic = require('@anthropic-ai/sdk');

class ClaudeInterviewAssistant {
    constructor() {
        this.anthropic = new Anthropic({
            apiKey: process.env.ANTHROPIC_API_KEY
        });
        this.conversationHistory = new Map();
    }
    
    async processInterviewInteraction(sessionId, transcript, context) {
        const systemPrompt = this.buildSystemPrompt(context);
        const conversation = this.getConversation(sessionId);
        
        try {
            const response = await this.anthropic.messages.create({
                model: "claude-3-5-sonnet-20241022",
                max_tokens: 1000,
                temperature: 0.7,
                system: systemPrompt,
                messages: [
                    ...conversation,
                    {
                        role: "user",
                        content: transcript
                    }
                ]
            });
            
            const aiResponse = response.content[0].text;
            const parsedResponse = this.parseResponse(aiResponse);
            
            // Update conversation history
            this.updateConversation(sessionId, transcript, aiResponse);
            
            return parsedResponse;
        } catch (error) {
            console.error('Claude processing error:', error);
            throw new Error('Failed to process with Claude');
        }
    }
    
    buildSystemPrompt(context) {
        const { sessionId, currentFile, fileList, interviewType, problemStatement } = context;
        
        return `You are an AI technical interview assistant conducting a coding interview.

CONTEXT:
- Session ID: ${sessionId}
- Interview Type: ${interviewType}
- Current File: ${currentFile || 'None'}
- Available Files: ${fileList.join(', ')}
- Problem: ${problemStatement}

ROLE & BEHAVIOR:
- Act as a professional, encouraging technical interviewer
- Guide the candidate through the coding problem step by step
- Provide hints and feedback without giving away the solution
- Ask clarifying questions about approach and complexity
- Review code for bugs, optimization opportunities, and edge cases
- Maintain a conversational, supportive tone

CAPABILITIES:
- Create, edit, and delete files
- Execute code and analyze results
- Switch between files in the workspace
- Provide coding suggestions and debugging help
- Ask follow-up questions about implementation choices

RESPONSE FORMAT:
Always respond with valid JSON in this format:
{
  "speech": "What to say to the candidate (natural conversational response)",
  "actions": [
    {"type": "create_file", "path": "/solution.py", "content": "# Your solution here\\n"},
    {"type": "execute_code", "file": "/solution.py", "test_cases": ["test1", "test2"]},
    {"type": "switch_file", "path": "/helper.py"},
    {"type": "analysis", "target": "current_code", "focus": "bug_detection"}
  ],
  "feedback": {
    "type": "positive|constructive|question",
    "focus": "algorithm|implementation|testing|optimization",
    "message": "Specific feedback about their approach"
  }
}

GUIDELINES:
- Keep responses concise but informative
- Always be encouraging and constructive
- If code has bugs, guide them to find it rather than stating it directly
- Ask about time/space complexity when appropriate
- Suggest test cases and edge cases to consider`;
    }
}
```

### Interview Flow Management

```javascript
// interview-flow.js
class InterviewFlowManager {
    constructor() {
        this.phases = {
            INTRODUCTION: 'introduction',
            PROBLEM_EXPLANATION: 'problem_explanation', 
            CLARIFICATION: 'clarification',
            CODING: 'coding',
            TESTING: 'testing',
            OPTIMIZATION: 'optimization',
            WRAP_UP: 'wrap_up'
        };
    }
    
    async manageFlow(sessionId, transcript, currentPhase) {
        switch (currentPhase) {
            case this.phases.INTRODUCTION:
                return await this.handleIntroduction(sessionId, transcript);
            case this.phases.PROBLEM_EXPLANATION:
                return await this.handleProblemExplanation(sessionId, transcript);
            case this.phases.CODING:
                return await this.handleCoding(sessionId, transcript);
            case this.phases.TESTING:
                return await this.handleTesting(sessionId, transcript);
            // ... other phases
        }
    }
    
    async handleCoding(sessionId, transcript) {
        // Analyze if they're asking for help, coding, or stuck
        const intent = await this.analyzeIntent(transcript);
        
        if (intent.type === 'help_request') {
            return await this.provideHint(sessionId, intent.topic);
        } else if (intent.type === 'code_review') {
            return await this.reviewCode(sessionId);
        } else if (intent.type === 'execution_request') {
            return await this.executeAndFeedback(sessionId);
        }
    }
}
```

## 4. OpenAI TTS Integration

### Text-to-Speech Service

```javascript
// tts-service.js
class TTSService {
    constructor() {
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });
    }
    
    async generateSpeech(text, voice = 'alloy', speed = 1.0) {
        try {
            const response = await this.openai.audio.speech.create({
                model: "tts-1",
                voice: voice, // alloy, echo, fable, onyx, nova, shimmer
                input: text,
                speed: speed,
                response_format: "mp3"
            });
            
            const audioBuffer = Buffer.from(await response.arrayBuffer());
            return audioBuffer;
        } catch (error) {
            console.error('TTS generation error:', error);
            throw new Error('Failed to generate speech');
        }
    }
    
    async generateWithEmphasis(text, emotions = {}) {
        // Add SSML-like processing for emotional context
        let processedText = text;
        
        if (emotions.encouraging) {
            processedText = `Great work! ${processedText}`;
        }
        if (emotions.questioning) {
            processedText = `${processedText}?`;
        }
        
        return await this.generateSpeech(processedText);
    }
}
```

## 5. Complete Voice Processing Pipeline

### Main Processing Function

```javascript
// voice-pipeline.js
class VoiceProcessingPipeline {
    constructor() {
        this.whisper = new WhisperService();
        this.claude = new ClaudeInterviewAssistant();
        this.tts = new TTSService();
        this.flowManager = new InterviewFlowManager();
    }
    
    async processVoiceInput(sessionId, audioBuffer) {
        try {
            // 1. Speech to Text
            const transcription = await this.whisper.transcribeAudio(audioBuffer);
            
            // 2. Get session context
            const context = await this.getSessionContext(sessionId);
            
            // 3. Process with Claude
            const aiResponse = await this.claude.processInterviewInteraction(
                sessionId, 
                transcription.text, 
                context
            );
            
            // 4. Execute any file operations
            if (aiResponse.actions) {
                await this.executeActions(sessionId, aiResponse.actions);
            }
            
            // 5. Generate speech response
            const speechAudio = await this.tts.generateSpeech(aiResponse.speech);
            
            // 6. Send response back via WebSocket
            await this.sendResponse(sessionId, {
                transcript: transcription.text,
                response: aiResponse.speech,
                actions: aiResponse.actions,
                audio: speechAudio.toString('base64'),
                feedback: aiResponse.feedback
            });
            
            return {
                success: true,
                processingTime: Date.now() - startTime
            };
            
        } catch (error) {
            console.error('Voice processing pipeline error:', error);
            await this.handleError(sessionId, error);
        }
    }
}
```

## 6. Interview Templates & Problem Sets

### Template System

```javascript
// interview-templates.js
const INTERVIEW_TEMPLATES = {
    'two-sum': {
        title: 'Two Sum Problem',
        difficulty: 'Easy',
        description: `Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.`,
        starterCode: {
            python: `def two_sum(nums, target):\n    # Your solution here\n    pass\n\n# Test cases\nprint(two_sum([2,7,11,15], 9))  # Expected: [0,1]`,
            javascript: `function twoSum(nums, target) {\n    // Your solution here\n}\n\n// Test cases\nconsole.log(twoSum([2,7,11,15], 9));  // Expected: [0,1]`
        },
        testCases: [
            { input: [[2,7,11,15], 9], expected: [0,1] },
            { input: [[3,2,4], 6], expected: [1,2] }
        ],
        hints: [
            "Think about what information you need to store as you iterate through the array",
            "Consider using a hash map to store values you've seen",
            "What's the complement of each number that you need to find?"
        ]
    },
    
    'reverse-linked-list': {
        title: 'Reverse Linked List',
        difficulty: 'Easy',
        description: `Given the head of a singly linked list, reverse the list, and return the reversed list.`,
        starterCode: {
            python: `class ListNode:\n    def __init__(self, val=0, next=None):\n        self.val = val\n        self.next = next\n\ndef reverse_list(head):\n    # Your solution here\n    pass`
        },
        followUpQuestions: [
            "Can you solve this iteratively?",
            "Can you solve this recursively?",
            "What's the time and space complexity of your solution?"
        ]
    }
};
```

## 7. Error Handling & Recovery

### Voice Processing Error Handling

```javascript
// error-handling.js
class VoiceErrorHandler {
    static async handleWhisperError(error, audioBuffer) {
        console.error('Whisper failed:', error);
        
        // Retry with different parameters
        try {
            return await this.whisper.transcribeAudio(audioBuffer, 'auto');
        } catch (retryError) {
            // Fall back to silent processing
            return { text: '', confidence: 0 };
        }
    }
    
    static async handleClaudeError(error, sessionId) {
        console.error('Claude failed:', error);
        
        // Provide fallback response
        return {
            speech: "I'm having trouble processing that. Could you please repeat or try a different approach?",
            actions: [],
            feedback: {
                type: "system",
                message: "AI assistant temporarily unavailable"
            }
        };
    }
    
    static async handleTTSError(error, text) {
        console.error('TTS failed:', error);
        
        // Return text-only response
        return {
            text: text,
            audio: null,
            fallback: true
        };
    }
}
```

## 8. WebSocket Connection Management

### Connection State Management

```javascript
// websocket-manager.js
class WebSocketManager {
    constructor() {
        this.connections = new Map();
        this.sessionConnections = new Map();
    }
    
    async handleConnection(connectionId, sessionId) {
        this.connections.set(connectionId, {
            sessionId,
            connectedAt: Date.now(),
            lastActivity: Date.now()
        });
        
        // Map session to connection
        this.sessionConnections.set(sessionId, connectionId);
        
        // Send welcome message
        await this.sendMessage(connectionId, {
            type: 'connected',
            message: 'Voice assistant ready'
        });
    }
    
    async sendMessage(connectionId, message) {
        const apiGateway = new AWS.ApiGatewayManagementApi({
            endpoint: process.env.WEBSOCKET_ENDPOINT
        });
        
        try {
            await apiGateway.postToConnection({
                ConnectionId: connectionId,
                Data: JSON.stringify(message)
            }).promise();
        } catch (error) {
            if (error.statusCode === 410) {
                // Connection is stale, remove it
                this.handleDisconnection(connectionId);
            }
            throw error;
        }
    }
}
```

## Success Criteria for Phase 2

- [ ] WebSocket voice connection established
- [ ] Audio chunks properly buffered and processed
- [ ] OpenAI Whisper integration working
- [ ] Claude 3.5 Sonnet responding with structured output
- [ ] TTS generating quality audio responses
- [ ] Interview flow management functional
- [ ] Error handling and fallbacks implemented
- [ ] Voice command actions executing correctly
- [ ] Sub-3 second response time achieved
- [ ] Interview templates loading properly

## Next Steps

Once Phase 2 is complete, move to `phase3-frontend-integration.md` to build the React frontend with Monaco Editor, file explorer, and voice interface.

## Estimated Timeline

- WebSocket & Audio Processing: 3-4 days
- OpenAI Whisper Integration: 1-2 days
- Claude 3.5 Integration: 3-4 days
- TTS Integration: 1-2 days
- Interview Flow Logic: 2-3 days
- Error Handling: 1-2 days
- Testing & Optimization: 2-3 days

**Total: 13-20 days**
