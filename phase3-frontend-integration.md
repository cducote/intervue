# Phase 3: Frontend Integration & User Interface

## Overview
Build the React/TypeScript frontend with Monaco Editor for code editing, file explorer, voice interface, and real-time WebSocket integration. This phase brings everything together into a complete user experience.

## 1. Project Setup & Structure

### Frontend Project Structure

```
frontend/
├── public/
│   ├── index.html
│   └── favicon.ico
├── src/
│   ├── components/
│   │   ├── CodeEditor/
│   │   │   ├── MonacoEditor.tsx
│   │   │   ├── EditorToolbar.tsx
│   │   │   └── ExecutionPanel.tsx
│   │   ├── FileExplorer/
│   │   │   ├── FileTree.tsx
│   │   │   ├── FileNode.tsx
│   │   │   └── FileActions.tsx
│   │   ├── VoiceInterface/
│   │   │   ├── VoiceRecorder.tsx
│   │   │   ├── AudioVisualizer.tsx
│   │   │   └── VoiceControls.tsx
│   │   ├── Interview/
│   │   │   ├── InterviewSession.tsx
│   │   │   ├── ProblemStatement.tsx
│   │   │   └── InterviewProgress.tsx
│   │   └── Common/
│   │       ├── Layout.tsx
│   │       ├── Header.tsx
│   │       └── LoadingSpinner.tsx
│   ├── services/
│   │   ├── websocket.ts
│   │   ├── api.ts
│   │   ├── voice.ts
│   │   └── file.ts
│   ├── hooks/
│   │   ├── useWebSocket.ts
│   │   ├── useVoiceRecording.ts
│   │   ├── useFileSystem.ts
│   │   └── useInterview.ts
│   ├── types/
│   │   ├── interview.ts
│   │   ├── file.ts
│   │   └── voice.ts
│   ├── utils/
│   │   ├── audio.ts
│   │   ├── constants.ts
│   │   └── helpers.ts
│   ├── App.tsx
│   ├── index.tsx
│   └── index.css
├── package.json
├── tsconfig.json
└── webpack.config.js
```

### Initial Setup

```bash
# Create React TypeScript project
npx create-react-app voice-interview-frontend --template typescript
cd voice-interview-frontend

# Install dependencies
npm install @monaco-editor/react
npm install ws @types/ws
npm install @anthropic-ai/sdk
npm install react-icons
npm install styled-components @types/styled-components
npm install react-hotkeys-hook
npm install wavesurfer.js
npm install uuid @types/uuid
```

## 2. Monaco Editor Integration

### Monaco Editor Component

```typescript
// src/components/CodeEditor/MonacoEditor.tsx
import React, { useRef, useEffect, useState } from 'react';
import { Editor } from '@monaco-editor/react';
import { useFileSystem } from '../../hooks/useFileSystem';
import { useInterview } from '../../hooks/useInterview';

interface MonacoEditorProps {
  sessionId: string;
}

export const MonacoEditor: React.FC<MonacoEditorProps> = ({ sessionId }) => {
  const editorRef = useRef<any>(null);
  const { currentFile, updateFile, files } = useFileSystem(sessionId);
  const { executeCode, executionResult } = useInterview(sessionId);
  const [isExecuting, setIsExecuting] = useState(false);

  const handleEditorDidMount = (editor: any, monaco: any) => {
    editorRef.current = editor;
    
    // Configure editor settings
    editor.updateOptions({
      fontSize: 14,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      automaticLayout: true,
      suggestOnTriggerCharacters: true,
      wordWrap: 'on'
    });

    // Add keyboard shortcuts
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      handleRunCode();
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      handleSaveFile();
    });
  };

  const handleEditorChange = (value: string | undefined) => {
    if (currentFile && value !== undefined) {
      updateFile(currentFile.path, value);
    }
  };

  const handleRunCode = async () => {
    if (!currentFile) return;
    
    setIsExecuting(true);
    try {
      await executeCode(currentFile.path, getLanguageFromFile(currentFile.path));
    } finally {
      setIsExecuting(false);
    }
  };

  const handleSaveFile = () => {
    if (currentFile) {
      // Auto-save is handled by updateFile
      console.log('File saved:', currentFile.path);
    }
  };

  const getLanguageFromFile = (filePath: string): string => {
    const extension = filePath.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'py': return 'python';
      case 'js': return 'javascript';
      case 'ts': return 'typescript';
      case 'java': return 'java';
      case 'cpp': return 'cpp';
      default: return 'plaintext';
    }
  };

  if (!currentFile) {
    return (
      <div className="editor-placeholder">
        <h3>No file selected</h3>
        <p>Select a file from the explorer or create a new one</p>
      </div>
    );
  }

  return (
    <div className="monaco-editor-container">
      <div className="editor-header">
        <span className="file-path">{currentFile.path}</span>
        <div className="editor-actions">
          <button 
            onClick={handleRunCode}
            disabled={isExecuting}
            className="run-button"
          >
            {isExecuting ? 'Running...' : 'Run Code (Ctrl+Enter)'}
          </button>
        </div>
      </div>
      
      <Editor
        height="calc(100vh - 200px)"
        language={getLanguageFromFile(currentFile.path)}
        value={currentFile.content}
        onChange={handleEditorChange}
        onMount={handleEditorDidMount}
        theme="vs-dark"
        options={{
          selectOnLineNumbers: true,
          automaticLayout: true,
        }}
      />
    </div>
  );
};
```

### Execution Panel Component

```typescript
// src/components/CodeEditor/ExecutionPanel.tsx
import React from 'react';
import { ExecutionResult } from '../../types/interview';

interface ExecutionPanelProps {
  result: ExecutionResult | null;
  isExecuting: boolean;
}

export const ExecutionPanel: React.FC<ExecutionPanelProps> = ({ result, isExecuting }) => {
  if (isExecuting) {
    return (
      <div className="execution-panel executing">
        <div className="execution-header">
          <span>⏳ Executing code...</span>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="execution-panel empty">
        <div className="execution-header">
          <span>💻 Output</span>
        </div>
        <div className="execution-content">
          <p>Run your code to see output here</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`execution-panel ${result.success ? 'success' : 'error'}`}>
      <div className="execution-header">
        <span>{result.success ? '✅ Success' : '❌ Error'}</span>
        <span className="execution-time">{result.executionTime}ms</span>
      </div>
      
      <div className="execution-content">
        {result.output && (
          <div className="output-section">
            <h4>Output:</h4>
            <pre>{result.output}</pre>
          </div>
        )}
        
        {result.errors && (
          <div className="error-section">
            <h4>Errors:</h4>
            <pre className="error-text">{result.errors}</pre>
          </div>
        )}
        
        {result.testResults && (
          <div className="test-section">
            <h4>Test Results:</h4>
            {result.testResults.map((test, index) => (
              <div key={index} className={`test-case ${test.passed ? 'passed' : 'failed'}`}>
                <span>{test.name}: {test.passed ? '✅ PASS' : '❌ FAIL'}</span>
                {!test.passed && <div className="test-error">{test.error}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
```

## 3. File Explorer Component

### File Tree Component

```typescript
// src/components/FileExplorer/FileTree.tsx
import React, { useState } from 'react';
import { FileNode } from './FileNode';
import { useFileSystem } from '../../hooks/useFileSystem';
import { FileItem } from '../../types/file';

interface FileTreeProps {
  sessionId: string;
}

export const FileTree: React.FC<FileTreeProps> = ({ sessionId }) => {
  const { files, createFile, createFolder, deleteFile, currentFile, setCurrentFile } = useFileSystem(sessionId);
  const [showNewFileDialog, setShowNewFileDialog] = useState(false);
  const [newFileName, setNewFileName] = useState('');

  const handleCreateFile = async () => {
    if (newFileName.trim()) {
      await createFile(newFileName.trim(), '// New file\n');
      setNewFileName('');
      setShowNewFileDialog(false);
    }
  };

  const buildFileTree = (files: FileItem[]): FileItem[] => {
    const tree: FileItem[] = [];
    const pathMap = new Map<string, FileItem>();

    // Sort files by path depth and name
    const sortedFiles = [...files].sort((a, b) => {
      const aDepth = a.path.split('/').length;
      const bDepth = b.path.split('/').length;
      if (aDepth !== bDepth) return aDepth - bDepth;
      return a.path.localeCompare(b.path);
    });

    for (const file of sortedFiles) {
      const pathParts = file.path.split('/').filter(part => part);
      let currentPath = '';
      
      for (let i = 0; i < pathParts.length; i++) {
        const part = pathParts[i];
        const parentPath = currentPath;
        currentPath = currentPath ? `${currentPath}/${part}` : part;
        
        if (!pathMap.has(currentPath)) {
          const isFile = i === pathParts.length - 1;
          const item: FileItem = {
            path: `/${currentPath}`,
            name: part,
            type: isFile ? 'file' : 'folder',
            content: isFile ? file.content : '',
            children: isFile ? undefined : [],
            lastModified: file.lastModified
          };
          
          pathMap.set(currentPath, item);
          
          if (parentPath) {
            const parent = pathMap.get(parentPath);
            if (parent && parent.children) {
              parent.children.push(item);
            }
          } else {
            tree.push(item);
          }
        }
      }
    }

    return tree;
  };

  const fileTree = buildFileTree(files);

  return (
    <div className="file-tree">
      <div className="file-tree-header">
        <h3>Files</h3>
        <div className="file-actions">
          <button 
            onClick={() => setShowNewFileDialog(true)}
            className="new-file-btn"
            title="New File"
          >
            📄+
          </button>
          <button 
            onClick={() => createFolder('/new-folder')}
            className="new-folder-btn"
            title="New Folder"
          >
            📁+
          </button>
        </div>
      </div>

      <div className="file-tree-content">
        {fileTree.map(file => (
          <FileNode
            key={file.path}
            file={file}
            currentFile={currentFile}
            onFileSelect={setCurrentFile}
            onFileDelete={deleteFile}
            depth={0}
          />
        ))}
      </div>

      {showNewFileDialog && (
        <div className="new-file-dialog">
          <input
            type="text"
            value={newFileName}
            onChange={(e) => setNewFileName(e.target.value)}
            placeholder="Enter file name (e.g., solution.py)"
            onKeyPress={(e) => e.key === 'Enter' && handleCreateFile()}
            autoFocus
          />
          <div className="dialog-actions">
            <button onClick={handleCreateFile}>Create</button>
            <button onClick={() => setShowNewFileDialog(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
};
```

### File Node Component

```typescript
// src/components/FileExplorer/FileNode.tsx
import React, { useState } from 'react';
import { FileItem } from '../../types/file';

interface FileNodeProps {
  file: FileItem;
  currentFile: FileItem | null;
  onFileSelect: (file: FileItem) => void;
  onFileDelete: (path: string) => void;
  depth: number;
}

export const FileNode: React.FC<FileNodeProps> = ({
  file,
  currentFile,
  onFileSelect,
  onFileDelete,
  depth
}) => {
  const [isExpanded, setIsExpanded] = useState(depth === 0);
  const [showContextMenu, setShowContextMenu] = useState(false);

  const handleClick = () => {
    if (file.type === 'file') {
      onFileSelect(file);
    } else {
      setIsExpanded(!isExpanded);
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setShowContextMenu(true);
  };

  const handleDelete = () => {
    if (confirm(`Delete ${file.name}?`)) {
      onFileDelete(file.path);
    }
    setShowContextMenu(false);
  };

  const getFileIcon = (fileName: string, type: string) => {
    if (type === 'folder') return isExpanded ? '📂' : '📁';
    
    const extension = fileName.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'py': return '🐍';
      case 'js': return '🟨';
      case 'ts': return '🔷';
      case 'java': return '☕';
      case 'cpp': case 'c': return '⚡';
      case 'html': return '🌐';
      case 'css': return '🎨';
      case 'json': return '📋';
      case 'md': return '📝';
      default: return '📄';
    }
  };

  const isSelected = currentFile?.path === file.path;

  return (
    <div className="file-node">
      <div
        className={`file-node-content ${isSelected ? 'selected' : ''}`}
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
      >
        <span className="file-icon">
          {getFileIcon(file.name, file.type)}
        </span>
        <span className="file-name">{file.name}</span>
        {file.type === 'folder' && (
          <span className="folder-arrow">
            {isExpanded ? '▼' : '▶'}
          </span>
        )}
      </div>

      {file.type === 'folder' && isExpanded && file.children && (
        <div className="file-children">
          {file.children.map(child => (
            <FileNode
              key={child.path}
              file={child}
              currentFile={currentFile}
              onFileSelect={onFileSelect}
              onFileDelete={onFileDelete}
              depth={depth + 1}
            />
          ))}
        </div>
      )}

      {showContextMenu && (
        <div className="context-menu">
          <button onClick={() => setShowContextMenu(false)}>Rename</button>
          <button onClick={handleDelete} className="danger">Delete</button>
          <button onClick={() => setShowContextMenu(false)}>Cancel</button>
        </div>
      )}
    </div>
  );
};
```

## 4. Voice Interface Components

### Voice Recorder Component

```typescript
// src/components/VoiceInterface/VoiceRecorder.tsx
import React, { useState, useRef, useEffect } from 'react';
import { useVoiceRecording } from '../../hooks/useVoiceRecording';
import { AudioVisualizer } from './AudioVisualizer';

interface VoiceRecorderProps {
  sessionId: string;
  onTranscript: (text: string) => void;
  onAIResponse: (response: any) => void;
}

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({
  sessionId,
  onTranscript,
  onAIResponse
}) => {
  const {
    isRecording,
    isProcessing,
    startRecording,
    stopRecording,
    audioLevel,
    transcript,
    aiResponse
  } = useVoiceRecording(sessionId);

  const [isListening, setIsListening] = useState(false);

  useEffect(() => {
    if (transcript) {
      onTranscript(transcript);
    }
  }, [transcript, onTranscript]);

  useEffect(() => {
    if (aiResponse) {
      onAIResponse(aiResponse);
    }
  }, [aiResponse, onAIResponse]);

  const handleToggleRecording = async () => {
    if (isRecording) {
      await stopRecording();
      setIsListening(false);
    } else {
      await startRecording();
      setIsListening(true);
    }
  };

  const getRecordingStatus = () => {
    if (isProcessing) return 'Processing...';
    if (isRecording) return 'Listening...';
    return 'Click to start talking';
  };

  const getRecordingIcon = () => {
    if (isProcessing) return '🤔';
    if (isRecording) return '🎤';
    return '🎤';
  };

  return (
    <div className="voice-recorder">
      <div className="voice-controls">
        <button
          className={`record-button ${isRecording ? 'recording' : ''} ${isProcessing ? 'processing' : ''}`}
          onClick={handleToggleRecording}
          disabled={isProcessing}
        >
          <span className="record-icon">{getRecordingIcon()}</span>
          <span className="record-text">{getRecordingStatus()}</span>
        </button>
      </div>

      {(isRecording || isProcessing) && (
        <AudioVisualizer 
          audioLevel={audioLevel}
          isProcessing={isProcessing}
        />
      )}

      {transcript && (
        <div className="transcript-display">
          <h4>You said:</h4>
          <p>"{transcript}"</p>
        </div>
      )}

      {aiResponse && (
        <div className="ai-response-display">
          <h4>AI Interviewer:</h4>
          <p>{aiResponse.speech}</p>
          {aiResponse.actions && aiResponse.actions.length > 0 && (
            <div className="ai-actions">
              <small>Actions: {aiResponse.actions.map(a => a.type).join(', ')}</small>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
```

### Audio Visualizer Component

```typescript
// src/components/VoiceInterface/AudioVisualizer.tsx
import React, { useEffect, useRef } from 'react';

interface AudioVisualizerProps {
  audioLevel: number;
  isProcessing: boolean;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  audioLevel,
  isProcessing
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      
      if (isProcessing) {
        // Draw processing animation
        const time = Date.now() * 0.01;
        for (let i = 0; i < 3; i++) {
          const radius = 20 + Math.sin(time + i * 2) * 10;
          ctx.beginPath();
          ctx.arc(centerX + (i - 1) * 40, centerY, radius, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(74, 144, 226, ${0.3 + Math.sin(time + i) * 0.2})`;
          ctx.fill();
        }
      } else {
        // Draw audio level bars
        const barCount = 20;
        const barWidth = canvas.width / barCount;
        const maxHeight = canvas.height * 0.8;
        
        for (let i = 0; i < barCount; i++) {
          const height = (Math.random() * 0.3 + audioLevel * 0.7) * maxHeight;
          const x = i * barWidth;
          const y = centerY - height / 2;
          
          ctx.fillStyle = `rgba(74, 144, 226, ${0.5 + audioLevel * 0.5})`;
          ctx.fillRect(x, y, barWidth - 2, height);
        }
      }
      
      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [audioLevel, isProcessing]);

  return (
    <div className="audio-visualizer">
      <canvas
        ref={canvasRef}
        width={300}
        height={100}
        className="visualizer-canvas"
      />
    </div>
  );
};
```

## 5. Custom Hooks

### WebSocket Hook

```typescript
// src/hooks/useWebSocket.ts
import { useEffect, useRef, useState } from 'react';

export const useWebSocket = (url: string) => {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<any>(null);
  const ws = useRef<WebSocket | null>(null);
  const messageQueue = useRef<string[]>([]);

  useEffect(() => {
    const connect = () => {
      ws.current = new WebSocket(url);
      
      ws.current.onopen = () => {
        setIsConnected(true);
        // Send queued messages
        while (messageQueue.current.length > 0) {
          const message = messageQueue.current.shift();
          if (message) {
            ws.current?.send(message);
          }
        }
      };

      ws.current.onmessage = (event) => {
        const message = JSON.parse(event.data);
        setLastMessage(message);
      };

      ws.current.onclose = () => {
        setIsConnected(false);
        // Reconnect after delay
        setTimeout(connect, 3000);
      };

      ws.current.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
    };

    connect();

    return () => {
      ws.current?.close();
    };
  }, [url]);

  const sendMessage = (message: any) => {
    const messageStr = JSON.stringify(message);
    
    if (isConnected && ws.current) {
      ws.current.send(messageStr);
    } else {
      messageQueue.current.push(messageStr);
    }
  };

  return { isConnected, lastMessage, sendMessage };
};
```

### Voice Recording Hook

```typescript
// src/hooks/useVoiceRecording.ts
import { useState, useRef, useCallback } from 'react';
import { useWebSocket } from './useWebSocket';

export const useVoiceRecording = (sessionId: string) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [aiResponse, setAIResponse] = useState<any>(null);

  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioContext = useRef<AudioContext | null>(null);
  const analyser = useRef<AnalyserNode | null>(null);

  const { isConnected, sendMessage, lastMessage } = useWebSocket(
    `${process.env.REACT_APP_WEBSOCKET_URL}?sessionId=${sessionId}`
  );

  // Handle incoming WebSocket messages
  useEffect(() => {
    if (lastMessage) {
      switch (lastMessage.type) {
        case 'transcript':
          setTranscript(lastMessage.text);
          setIsProcessing(false);
          break;
        case 'ai-response':
          setAIResponse(lastMessage);
          setIsProcessing(false);
          break;
        case 'error':
          console.error('Voice processing error:', lastMessage.error);
          setIsProcessing(false);
          break;
      }
    }
  }, [lastMessage]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000
        } 
      });

      // Set up audio analysis
      audioContext.current = new AudioContext();
      analyser.current = audioContext.current.createAnalyser();
      const source = audioContext.current.createMediaStreamSource(stream);
      source.connect(analyser.current);

      // Start audio level monitoring
      const updateAudioLevel = () => {
        if (!analyser.current) return;
        
        const dataArray = new Uint8Array(analyser.current.frequencyBinCount);
        analyser.current.getByteFrequencyData(dataArray);
        
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        setAudioLevel(average / 255);
        
        if (isRecording) {
          requestAnimationFrame(updateAudioLevel);
        }
      };
      updateAudioLevel();

      // Set up media recorder
      mediaRecorder.current = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      mediaRecorder.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          // Convert to base64 and send via WebSocket
          const reader = new FileReader();
          reader.onload = () => {
            const base64 = (reader.result as string).split(',')[1];
            sendMessage({
              type: 'audio-chunk',
              sessionId,
              data: base64
            });
          };
          reader.readAsDataURL(event.data);
        }
      };

      mediaRecorder.current.start(100); // Collect data every 100ms
      setIsRecording(true);

    } catch (error) {
      console.error('Error starting recording:', error);
    }
  }, [sessionId, sendMessage, isRecording]);

  const stopRecording = useCallback(() => {
    if (mediaRecorder.current && isRecording) {
      mediaRecorder.current.stop();
      mediaRecorder.current.stream.getTracks().forEach(track => track.stop());
      
      if (audioContext.current) {
        audioContext.current.close();
      }
      
      setIsRecording(false);
      setIsProcessing(true);
      setAudioLevel(0);

      // Send stop signal
      sendMessage({
        type: 'stop-recording',
        sessionId
      });
    }
  }, [sessionId, sendMessage, isRecording]);

  return {
    isRecording,
    isProcessing,
    startRecording,
    stopRecording,
    audioLevel,
    transcript,
    aiResponse,
    isConnected
  };
};
```

## 6. Main Application Component

### Interview Session Component

```typescript
// src/components/Interview/InterviewSession.tsx
import React, { useState, useEffect } from 'react';
import { MonacoEditor } from '../CodeEditor/MonacoEditor';
import { ExecutionPanel } from '../CodeEditor/ExecutionPanel';
import { FileTree } from '../FileExplorer/FileTree';
import { VoiceRecorder } from '../VoiceInterface/VoiceRecorder';
import { ProblemStatement } from './ProblemStatement';
import { useInterview } from '../../hooks/useInterview';

interface InterviewSessionProps {
  sessionId: string;
}

export const InterviewSession: React.FC<InterviewSessionProps> = ({ sessionId }) => {
  const {
    session,
    problem,
    executionResult,
    isExecuting,
    initializeSession,
    loadProblem
  } = useInterview(sessionId);

  const [showVoice, setShowVoice] = useState(true);
  const [transcript, setTranscript] = useState('');
  const [aiResponse, setAIResponse] = useState<any>(null);

  useEffect(() => {
    initializeSession();
    loadProblem('two-sum'); // Default problem
  }, [sessionId]);

  const handleTranscript = (text: string) => {
    setTranscript(text);
  };

  const handleAIResponse = (response: any) => {
    setAIResponse(response);
    
    // Execute any actions from AI response
    if (response.actions) {
      response.actions.forEach((action: any) => {
        switch (action.type) {
          case 'create_file':
            // Handle file creation
            break;
          case 'execute_code':
            // Handle code execution
            break;
          case 'switch_file':
            // Handle file switching
            break;
        }
      });
    }
  };

  return (
    <div className="interview-session">
      <div className="session-header">
        <h1>Technical Interview Session</h1>
        <div className="session-controls">
          <button 
            onClick={() => setShowVoice(!showVoice)}
            className={`voice-toggle ${showVoice ? 'active' : ''}`}
          >
            🎤 Voice {showVoice ? 'On' : 'Off'}
          </button>
        </div>
      </div>

      <div className="session-content">
        <div className="left-panel">
          <FileTree sessionId={sessionId} />
          
          {problem && (
            <ProblemStatement 
              title={problem.title}
              description={problem.description}
              difficulty={problem.difficulty}
              examples={problem.examples}
            />
          )}
        </div>

        <div className="center-panel">
          <MonacoEditor sessionId={sessionId} />
          
          <ExecutionPanel 
            result={executionResult}
            isExecuting={isExecuting}
          />
        </div>

        <div className="right-panel">
          {showVoice && (
            <VoiceRecorder
              sessionId={sessionId}
              onTranscript={handleTranscript}
              onAIResponse={handleAIResponse}
            />
          )}

          <div className="interaction-log">
            <h3>Interview Log</h3>
            {transcript && (
              <div className="log-entry candidate">
                <strong>You:</strong> {transcript}
              </div>
            )}
            {aiResponse && (
              <div className="log-entry interviewer">
                <strong>AI Interviewer:</strong> {aiResponse.speech}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
```

## 7. Styling & CSS

### Main Styles

```css
/* src/index.css */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
  background-color: #1e1e1e;
  color: #d4d4d4;
  height: 100vh;
  overflow: hidden;
}

.interview-session {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.session-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 20px;
  background-color: #2d2d30;
  border-bottom: 1px solid #3e3e42;
}

.session-content {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.left-panel {
  width: 300px;
  background-color: #252526;
  border-right: 1px solid #3e3e42;
  display: flex;
  flex-direction: column;
}

.center-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.right-panel {
  width: 350px;
  background-color: #252526;
  border-left: 1px solid #3e3e42;
  display: flex;
  flex-direction: column;
  padding: 15px;
}

/* Monaco Editor Styles */
.monaco-editor-container {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 15px;
  background-color: #2d2d30;
  border-bottom: 1px solid #3e3e42;
}

.run-button {
  background-color: #0e639c;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.run-button:hover {
  background-color: #1177bb;
}

.run-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* File Explorer Styles */
.file-tree {
  flex: 1;
  padding: 10px;
}

.file-tree-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.file-node-content {
  display: flex;
  align-items: center;
  padding: 4px 8px;
  cursor: pointer;
  border-radius: 3px;
  margin: 1px 0;
}

.file-node-content:hover {
  background-color: #2a2d2e;
}

.file-node-content.selected {
  background-color: #094771;
}

.file-icon {
  margin-right: 8px;
  font-size: 16px;
}

.file-name {
  flex: 1;
  font-size: 14px;
}

/* Voice Interface Styles */
.voice-recorder {
  margin-bottom: 20px;
}

.record-button {
  width: 100%;
  padding: 15px;
  background-color: #2d2d30;
  border: 2px solid #3e3e42;
  border-radius: 8px;
  color: #d4d4d4;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  font-size: 14px;
  transition: all 0.2s;
}

.record-button.recording {
  background-color: #722f37;
  border-color: #f14c4c;
  animation: pulse 1s infinite;
}

.record-button.processing {
  background-color: #1f3d5c;
  border-color: #4a90e2;
}

@keyframes pulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.05); }
  100% { transform: scale(1); }
}

.transcript-display,
.ai-response-display {
  margin: 15px 0;
  padding: 10px;
  background-color: #2d2d30;
  border-radius: 6px;
  border-left: 3px solid #4a90e2;
}

.interaction-log {
  flex: 1;
  overflow-y: auto;
}

.log-entry {
  margin: 10px 0;
  padding: 8px;
  border-radius: 4px;
}

.log-entry.candidate {
  background-color: #2d2d30;
  border-left: 3px solid #4a90e2;
}

.log-entry.interviewer {
  background-color: #2d3230;
  border-left: 3px solid #4caf50;
}

/* Execution Panel Styles */
.execution-panel {
  height: 200px;
  background-color: #1e1e1e;
  border-top: 1px solid #3e3e42;
  display: flex;
  flex-direction: column;
}

.execution-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 15px;
  background-color: #2d2d30;
  border-bottom: 1px solid #3e3e42;
  font-size: 14px;
}

.execution-content {
  flex: 1;
  padding: 10px;
  overflow-y: auto;
  font-family: 'Monaco', 'Consolas', monospace;
  font-size: 12px;
}

.execution-panel.success .execution-header {
  color: #4caf50;
}

.execution-panel.error .execution-header {
  color: #f44336;
}

.error-text {
  color: #f44336;
}

.test-case.passed {
  color: #4caf50;
}

.test-case.failed {
  color: #f44336;
}
```

## Success Criteria for Phase 3

- [ ] React TypeScript project setup complete
- [ ] Monaco Editor integrated with syntax highlighting
- [ ] File explorer with create/delete/rename functionality
- [ ] Voice recording and WebSocket integration working
- [ ] Audio visualization during recording
- [ ] Real-time transcript display
- [ ] AI response handling and display
- [ ] Code execution results showing properly
- [ ] Interview session management functional
- [ ] Responsive design working on different screen sizes
- [ ] Keyboard shortcuts implemented
- [ ] Error handling and loading states

## Final Integration & Testing

### End-to-End Testing

```bash
# Install testing dependencies
npm install --save-dev @testing-library/react @testing-library/jest-dom
npm install --save-dev cypress

# Run unit tests
npm test

# Run E2E tests
npx cypress open
```

### Production Build

```bash
# Build for production
npm run build

# Deploy to S3/CloudFront
aws s3 sync build/ s3://voice-interview-frontend --delete
aws cloudfront create-invalidation --distribution-id YOUR_DISTRIBUTION_ID --paths "/*"
```

## Estimated Timeline

- Project Setup & Structure: 1-2 days
- Monaco Editor Integration: 2-3 days
- File Explorer Component: 2-3 days
- Voice Interface Components: 3-4 days
- WebSocket Integration: 2-3 days
- Interview Session Management: 2-3 days
- Styling & Polish: 2-3 days
- Testing & Bug Fixes: 2-3 days

**Total: 16-24 days**

## Final Deployment Checklist

- [ ] All AWS services configured and deployed
- [ ] Frontend build and deployed to CloudFront
- [ ] WebSocket connections working end-to-end
- [ ] Voice processing pipeline functional
- [ ] Code execution sandboxing secure
- [ ] Interview templates loaded
- [ ] Error handling robust
- [ ] Performance optimized (sub-3s response time)
- [ ] Security audit completed
- [ ] Load testing passed
- [ ] Demo scenarios working perfectly

**Total Project Timeline: 30-40 days**

This completes the full implementation plan split into manageable phases. Each phase can be tackled independently while building toward the complete voice interview AI platform!
