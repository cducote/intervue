class VoiceInterviewPlatform {
    constructor() {
        this.sessionId = null;
        this.isRecording = false;
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.websocket = null;
        this.audioContext = null;
        this.analyser = null;
        this.microphone = null;
        this.sessionStartTime = null;
        this.durationInterval = null;
        
        // API endpoints (deployed infrastructure)
        this.API_BASE = 'https://vhab3b0ok2.execute-api.us-east-1.amazonaws.com/dev';
        this.WS_URL = 'wss://1xzu7tiz0b.execute-api.us-east-1.amazonaws.com/dev';
        
        this.init();
    }
    
    async init() {
        this.setupEventListeners();
        this.initializeWebSocket();
        this.generateSessionId();
        this.startSessionTimer();
        
        // Request microphone permission
        try {
            await navigator.mediaDevices.getUserMedia({ audio: true });
            this.updateConnectionStatus('connected', 'Connected');
        } catch (error) {
            console.error('Microphone permission denied:', error);
            this.showError('Microphone access is required for voice interviews');
        }
    }
    
    setupEventListeners() {
        // Sidebar toggle
        document.getElementById('sidebar-toggle').addEventListener('click', () => {
            this.toggleSidebar();
        });
        
        // Recording controls
        document.getElementById('record-btn').addEventListener('click', () => {
            this.toggleRecording();
        });
        
        document.getElementById('stop-btn').addEventListener('click', () => {
            this.stopRecording();
        });
        
        document.getElementById('mute-btn').addEventListener('click', () => {
            this.toggleMute();
        });
        
        // Text input
        document.getElementById('text-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendTextMessage();
            }
        });
        
        document.getElementById('send-btn').addEventListener('click', () => {
            this.sendTextMessage();
        });
        
        // Settings
        document.getElementById('settings-btn').addEventListener('click', () => {
            this.openSettings();
        });
        
        document.getElementById('close-settings-btn').addEventListener('click', () => {
            this.closeSettings();
        });
        
        document.getElementById('settings-save-btn').addEventListener('click', () => {
            this.saveSettings();
        });
        
        document.getElementById('settings-cancel-btn').addEventListener('click', () => {
            this.closeSettings();
        });
        
        // Session controls
        document.getElementById('new-session-btn').addEventListener('click', () => {
            this.startNewSession();
        });
        
        // Chat controls
        document.getElementById('clear-chat-btn').addEventListener('click', () => {
            this.clearChat();
        });
        
        document.getElementById('export-chat-btn').addEventListener('click', () => {
            this.exportChat();
        });
        
        // Code editor
        document.getElementById('run-code-btn').addEventListener('click', () => {
            this.runCode();
        });
        
        document.getElementById('close-code-btn').addEventListener('click', () => {
            this.closeCodeEditor();
        });
        
        // Quick actions
        this.setupQuickActions();
    }
    
    setupQuickActions() {
        const quickActions = document.querySelectorAll('.p-6:last-child button');
        quickActions.forEach(button => {
            button.addEventListener('click', (e) => {
                const icon = e.target.querySelector('i');
                if (icon) {
                    if (icon.classList.contains('fa-lightbulb')) {
                        this.requestHint();
                    } else if (icon.classList.contains('fa-question-circle')) {
                        this.askQuestion();
                    } else if (icon.classList.contains('fa-play')) {
                        this.showCodeEditor();
                    } else if (icon.classList.contains('fa-check')) {
                        this.submitSolution();
                    }
                }
            });
        });
    }
    
    initializeWebSocket() {
        try {
            this.websocket = new WebSocket(this.WS_URL);
            
            this.websocket.onopen = () => {
                console.log('WebSocket connected');
                this.updateConnectionStatus('connected', 'Connected');
                if (this.sessionId) {
                    this.joinSession();
                }
            };
            
            this.websocket.onmessage = (event) => {
                const data = JSON.parse(event.data);
                this.handleWebSocketMessage(data);
            };
            
            this.websocket.onclose = () => {
                console.log('WebSocket disconnected');
                this.updateConnectionStatus('disconnected', 'Disconnected');
                // Attempt to reconnect after 3 seconds
                setTimeout(() => this.initializeWebSocket(), 3000);
            };
            
            this.websocket.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.updateConnectionStatus('error', 'Connection Error');
            };
        } catch (error) {
            console.error('Failed to initialize WebSocket:', error);
            this.updateConnectionStatus('error', 'Connection Failed');
        }
    }
    
    handleWebSocketMessage(data) {
        switch (data.type) {
            case 'session-joined':
                console.log('Successfully joined session:', data.sessionId);
                break;
            case 'chat-message':
                this.displayChatMessage(data.text, 'ai', data.timestamp);
                if (document.getElementById('auto-tts').checked) {
                    this.playTextToSpeech(data.text);
                }
                break;
            case 'voice-status-update':
                this.handleVoiceStatusUpdate(data);
                break;
            case 'typing-indicator':
                this.showTypingIndicator(data.isTyping);
                break;
            case 'session-update':
                this.handleSessionUpdate(data);
                break;
            case 'error':
                this.showError(data.message);
                break;
        }
    }
    
    async toggleRecording() {
        if (this.isRecording) {
            await this.stopRecording();
        } else {
            await this.startRecording();
        }
    }
    
    async startRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });
            
            this.mediaRecorder = new MediaRecorder(stream, {
                mimeType: 'audio/webm;codecs=opus'
            });
            
            this.audioChunks = [];
            
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            };
            
            this.mediaRecorder.onstop = () => {
                this.processRecording();
            };
            
            this.mediaRecorder.start(1000); // Collect data every second
            this.isRecording = true;
            
            // Update UI
            document.getElementById('record-btn').classList.add('recording-pulse', 'bg-red-600');
            document.getElementById('record-icon').className = 'fas fa-stop text-xl mr-3';
            document.getElementById('record-text').textContent = 'Stop Recording';
            document.getElementById('voice-visualizer').classList.remove('hidden');
            document.getElementById('stop-btn').disabled = false;
            
            // Start voice visualization
            this.startVoiceVisualization(stream);
            
            // Send voice status to WebSocket
            this.sendWebSocketMessage({
                action: 'voice-status',
                sessionId: this.sessionId,
                data: { status: 'speaking' }
            });
            
        } catch (error) {
            console.error('Error starting recording:', error);
            this.showError('Failed to start recording. Please check microphone permissions.');
        }
    }
    
    async stopRecording() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.isRecording = false;
            
            // Stop all audio tracks
            if (this.mediaRecorder.stream) {
                this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
            }
            
            // Update UI
            document.getElementById('record-btn').classList.remove('recording-pulse', 'bg-red-600');
            document.getElementById('record-btn').classList.add('bg-blue-600');
            document.getElementById('record-icon').className = 'fas fa-microphone text-xl mr-3';
            document.getElementById('record-text').textContent = 'Start Recording';
            document.getElementById('voice-visualizer').classList.add('hidden');
            document.getElementById('stop-btn').disabled = true;
            
            // Stop voice visualization
            this.stopVoiceVisualization();
            
            // Send voice status to WebSocket
            this.sendWebSocketMessage({
                action: 'voice-status',
                sessionId: this.sessionId,
                data: { status: 'listening' }
            });
        }
    }
    
    async processRecording() {
        if (this.audioChunks.length === 0) return;
        
        try {
            this.showLoading('Processing voice...');
            
            // Create blob from audio chunks
            const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
            
            // Convert to base64
            const audioBase64 = await this.blobToBase64(audioBlob);
            
            // Send to speech-to-text API
            const transcription = await this.speechToText(audioBase64);
            
            if (transcription.success && transcription.transcription) {
                // Display user message
                this.displayChatMessage(transcription.transcription, 'user');
                
                // Get AI response
                const aiResponse = await this.getAIResponse(transcription.transcription);
                
                if (aiResponse.success && aiResponse.response) {
                    // Display AI response
                    this.displayChatMessage(aiResponse.response, 'ai');
                    
                    // Play TTS if enabled
                    if (document.getElementById('auto-tts').checked) {
                        await this.playTextToSpeech(aiResponse.response);
                    }
                }
            }
            
        } catch (error) {
            console.error('Error processing recording:', error);
            this.showError('Failed to process voice recording');
        } finally {
            this.hideLoading();
        }
    }
    
    startVoiceVisualization(stream) {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.analyser = this.audioContext.createAnalyser();
            this.microphone = this.audioContext.createMediaStreamSource(stream);
            
            this.analyser.fftSize = 256;
            this.microphone.connect(this.analyser);
            
            const bufferLength = this.analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            
            const visualize = () => {
                if (!this.isRecording) return;
                
                this.analyser.getByteFrequencyData(dataArray);
                
                // Calculate average volume
                const average = dataArray.reduce((a, b) => a + b) / bufferLength;
                const scale = Math.min(average / 128, 1);
                
                // Update visualization
                const waveElement = document.getElementById('voice-wave');
                if (waveElement) {
                    waveElement.style.transform = `scaleY(${scale})`;
                }
                
                requestAnimationFrame(visualize);
            };
            
            visualize();
        } catch (error) {
            console.error('Error starting voice visualization:', error);
        }
    }
    
    stopVoiceVisualization() {
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
        if (this.analyser) {
            this.analyser = null;
        }
        if (this.microphone) {
            this.microphone = null;
        }
    }
    
    async speechToText(audioBase64) {
        const response = await fetch(`${this.API_BASE}/speech-to-text`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                audioData: audioBase64,
                sessionId: this.sessionId,
                format: 'webm',
                language: 'en'
            })
        });
        
        return await response.json();
    }
    
    async getAIResponse(userMessage) {
        const response = await fetch(`${this.API_BASE}/ai-response`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                sessionId: this.sessionId,
                userMessage: userMessage,
                context: this.getConversationContext(),
                interviewType: document.getElementById('interview-type').textContent.toLowerCase(),
                difficulty: document.getElementById('interview-difficulty').textContent.toLowerCase()
            })
        });
        
        return await response.json();
    }
    
    async playTextToSpeech(text) {
        try {
            const response = await fetch(`${this.API_BASE}/text-to-speech`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    text: text,
                    sessionId: this.sessionId,
                    voice: 'nova',
                    speed: 1.0
                })
            });
            
            const result = await response.json();
            
            if (result.success && result.audioUrl) {
                const audio = new Audio(result.audioUrl);
                audio.play();
            }
        } catch (error) {
            console.error('Error playing text-to-speech:', error);
        }
    }
    
    sendTextMessage() {
        const input = document.getElementById('text-input');
        const message = input.value.trim();
        
        if (message) {
            this.displayChatMessage(message, 'user');
            input.value = '';
            
            // Send to AI
            this.getAIResponse(message).then(response => {
                if (response.success && response.response) {
                    this.displayChatMessage(response.response, 'ai');
                    
                    if (document.getElementById('auto-tts').checked) {
                        this.playTextToSpeech(response.response);
                    }
                }
            });
        }
    }
    
    displayChatMessage(message, sender, timestamp = null) {
        const chatContainer = document.getElementById('chat-container');
        const messageElement = document.createElement('div');
        messageElement.className = 'chat-message';
        
        const isUser = sender === 'user';
        const senderName = isUser ? 'You' : 'AI Interviewer';
        const senderIcon = isUser ? 'fa-user' : 'fa-robot';
        const bgColor = isUser ? 'bg-gray-100' : 'bg-blue-50';
        const iconBg = isUser ? 'bg-gray-600' : 'bg-blue-600';
        
        const timeStr = timestamp ? new Date(timestamp).toLocaleTimeString() : new Date().toLocaleTimeString();
        
        messageElement.innerHTML = `
            <div class=\"flex items-start space-x-3\">
                <div class=\"flex-shrink-0\">
                    <div class=\"w-8 h-8 ${iconBg} rounded-full flex items-center justify-center\">
                        <i class=\"fas ${senderIcon} text-white text-sm\"></i>
                    </div>
                </div>
                <div class=\"flex-1 min-w-0\">
                    <div class=\"${bgColor} rounded-lg p-3\">
                        <p class=\"text-sm text-gray-900\">${this.escapeHtml(message)}</p>
                    </div>
                    <div class=\"mt-1 text-xs text-gray-500\">${senderName} • ${timeStr}</div>
                </div>
            </div>
        `;
        
        chatContainer.appendChild(messageElement);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }
    
    showTypingIndicator(show) {
        const indicator = document.getElementById('typing-indicator');
        if (show) {
            indicator.classList.remove('hidden');
        } else {
            indicator.classList.add('hidden');
        }
    }
    
    // Utility methods
    async blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const base64 = reader.result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    generateSessionId() {
        this.sessionId = 'session_' + Math.random().toString(36).substr(2, 9);
        document.getElementById('session-id').textContent = this.sessionId;
    }
    
    startSessionTimer() {
        this.sessionStartTime = new Date();
        this.durationInterval = setInterval(() => {
            const duration = new Date() - this.sessionStartTime;
            const minutes = Math.floor(duration / 60000);
            const seconds = Math.floor((duration % 60000) / 1000);
            document.getElementById('session-duration').textContent = 
                `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }, 1000);
    }
    
    getConversationContext() {
        const messages = Array.from(document.querySelectorAll('.chat-message')).slice(-10);
        return {
            conversationHistory: messages.map(msg => ({
                role: msg.querySelector('.fa-user') ? 'user' : 'assistant',
                content: msg.querySelector('p').textContent,
                timestamp: new Date().toISOString()
            }))
        };
    }
    
    sendWebSocketMessage(message) {
        if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
            this.websocket.send(JSON.stringify(message));
        }
    }
    
    joinSession() {
        this.sendWebSocketMessage({
            action: 'join-session',
            sessionId: this.sessionId
        });
    }
    
    updateConnectionStatus(status, text) {
        const statusElement = document.getElementById('connection-status');
        const dot = statusElement.querySelector('div');
        const span = statusElement.querySelector('span');
        
        dot.className = 'w-3 h-3 rounded-full mr-2';
        
        switch (status) {
            case 'connected':
                dot.classList.add('bg-green-500');
                break;
            case 'disconnected':
                dot.classList.add('bg-red-500');
                break;
            case 'connecting':
                dot.classList.add('bg-yellow-500');
                break;
            default:
                dot.classList.add('bg-gray-400');
        }
        
        span.textContent = text;
    }
    
    showLoading(text = 'Loading...') {
        document.getElementById('loading-text').textContent = text;
        document.getElementById('loading-overlay').classList.remove('hidden');
    }
    
    hideLoading() {
        document.getElementById('loading-overlay').classList.add('hidden');
    }
    
    showError(message) {
        alert(`Error: ${message}`); // Replace with better error handling
    }
    
    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        const mainContent = document.getElementById('main-content');
        
        sidebar.classList.toggle('sidebar-closed');
        mainContent.classList.toggle('main-expanded');
    }
    
    openSettings() {
        document.getElementById('settings-modal').classList.remove('hidden');
    }
    
    closeSettings() {
        document.getElementById('settings-modal').classList.add('hidden');
    }
    
    saveSettings() {
        // Save settings logic here
        this.closeSettings();
    }
    
    startNewSession() {
        this.generateSessionId();
        this.clearChat();
        this.startSessionTimer();
        this.joinSession();
    }
    
    clearChat() {
        const chatContainer = document.getElementById('chat-container');
        const welcomeMessage = chatContainer.querySelector('.chat-message');
        chatContainer.innerHTML = '';
        if (welcomeMessage) {
            chatContainer.appendChild(welcomeMessage.cloneNode(true));
        }
    }
    
    exportChat() {
        const messages = Array.from(document.querySelectorAll('.chat-message'));
        const chatData = messages.map(msg => ({
            sender: msg.querySelector('.fa-user') ? 'User' : 'AI',
            message: msg.querySelector('p').textContent,
            timestamp: msg.querySelector('.text-xs').textContent
        }));
        
        const blob = new Blob([JSON.stringify(chatData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `interview-${this.sessionId}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }
    
    showCodeEditor() {
        document.getElementById('code-panel').classList.remove('hidden');
    }
    
    closeCodeEditor() {
        document.getElementById('code-panel').classList.add('hidden');
    }
    
    async runCode() {
        const code = document.getElementById('code-editor').value;
        const language = document.getElementById('language-select').value;
        
        if (!code.trim()) {
            this.showError('Please enter some code to run');
            return;
        }
        
        try {
            this.showLoading('Running code...');
            
            const response = await fetch(`${this.API_BASE}/execute-code`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    sessionId: this.sessionId,
                    code: code,
                    language: language
                })
            });
            
            const result = await response.json();
            
            const outputElement = document.getElementById('code-output');
            if (result.success) {
                outputElement.innerHTML = `
                    <div class=\"text-green-400\">✓ Execution successful</div>
                    <div class=\"mt-2 text-white\">${this.escapeHtml(result.output || 'No output')}</div>
                    ${result.executionTime ? `<div class=\"mt-1 text-gray-400\">Execution time: ${result.executionTime}ms</div>` : ''}
                `;
            } else {
                outputElement.innerHTML = `
                    <div class=\"text-red-400\">✗ Execution failed</div>
                    <div class=\"mt-2 text-red-300\">${this.escapeHtml(result.error || 'Unknown error')}</div>
                `;
            }
        } catch (error) {
            console.error('Error running code:', error);
            const outputElement = document.getElementById('code-output');
            outputElement.innerHTML = `<div class=\"text-red-400\">✗ Failed to execute code</div>`;
        } finally {
            this.hideLoading();
        }
    }
    
    requestHint() {
        this.sendTextMessage = () => {
            document.getElementById('text-input').value = 'Can you give me a hint for this problem?';
            this.sendTextMessage();
        };
        this.sendTextMessage();
    }
    
    askQuestion() {
        document.getElementById('text-input').focus();
        document.getElementById('text-input').placeholder = 'Ask your question...';
    }
    
    submitSolution() {
        const code = document.getElementById('code-editor').value;
        if (code.trim()) {
            this.runCode();
        } else {
            this.showError('Please write your solution in the code editor first');
        }
    }
    
    toggleMute() {
        // Implement mute functionality
        const muteBtn = document.getElementById('mute-btn');
        const icon = muteBtn.querySelector('i');
        
        if (icon.classList.contains('fa-volume-up')) {
            icon.className = 'fas fa-volume-mute';
            muteBtn.title = 'Unmute';
        } else {
            icon.className = 'fas fa-volume-up';
            muteBtn.title = 'Mute';
        }
    }
    
    handleVoiceStatusUpdate(data) {
        // Handle voice status updates from other participants
        console.log('Voice status update:', data);
    }
    
    handleSessionUpdate(data) {
        // Handle session updates
        console.log('Session update:', data);
        if (data.updateType === 'problem-change') {
            this.updateCurrentProblem(data.data);
        }
    }
    
    updateCurrentProblem(problemData) {
        const problemElement = document.getElementById('current-problem');
        if (problemData) {
            problemElement.innerHTML = `
                <p class=\"font-medium\">${problemData.title || 'New Problem'}</p>
                <p class=\"mt-1\">${problemData.description || 'Problem description will appear here'}</p>
                <div class=\"mt-2\">
                    <span class=\"inline-block bg-${problemData.difficulty === 'easy' ? 'green' : problemData.difficulty === 'medium' ? 'yellow' : 'red'}-100 text-${problemData.difficulty === 'easy' ? 'green' : problemData.difficulty === 'medium' ? 'yellow' : 'red'}-800 text-xs px-2 py-1 rounded\">
                        ${(problemData.difficulty || 'Medium').charAt(0).toUpperCase() + (problemData.difficulty || 'medium').slice(1)}
                    </span>
                </div>
            `;
        }
    }
}

// Initialize the application when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new VoiceInterviewPlatform();
});
