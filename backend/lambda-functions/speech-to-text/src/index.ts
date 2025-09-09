import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { S3 } from 'aws-sdk';
import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';

const s3 = new S3();
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

interface TranscriptionRequest {
  audioData: string; // Base64 encoded audio
  sessionId: string;
  format?: 'webm' | 'wav' | 'mp3' | 'ogg';
  language?: string;
}

interface TranscriptionResponse {
  success: boolean;
  transcription?: string;
  sessionId: string;
  audioFileKey?: string;
  confidence?: number;
  error?: string;
}

export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  console.log('Speech-to-Text Lambda triggered:', JSON.stringify(event, null, 2));

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
    'Access-Control-Allow-Methods': 'POST,OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    if (!event.body) {
      throw new Error('Request body is required');
    }

    const request: TranscriptionRequest = JSON.parse(event.body);
    
    if (!request.audioData || !request.sessionId) {
      throw new Error('audioData and sessionId are required');
    }

    // Validate API key
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OpenAI API key not configured');
    }

    // Generate unique file key for audio storage
    const audioFileKey = `audio/sessions/${request.sessionId}/recording-${uuidv4()}.${request.format || 'webm'}`;
    const bucketName = process.env.S3_BUCKET || 'voice-interview-platform-storage-dev';

    // Convert base64 to buffer
    const audioBuffer = Buffer.from(request.audioData, 'base64');
    
    // Store audio file in S3
    await s3.putObject({
      Bucket: bucketName,
      Key: audioFileKey,
      Body: audioBuffer,
      ContentType: getContentType(request.format || 'webm'),
      Metadata: {
        sessionId: request.sessionId,
        uploadedAt: new Date().toISOString()
      }
    }).promise();

    console.log(`Audio file stored: ${audioFileKey}, size: ${audioBuffer.length} bytes`);

    // Create a readable stream from buffer for OpenAI Whisper
    const fs = require('fs');
    const path = require('path');
    const os = require('os');
    
    // Write to temporary file
    const tempDir = os.tmpdir();
    const tempFileName = `audio-${uuidv4()}.${request.format || 'webm'}`;
    const tempFilePath = path.join(tempDir, tempFileName);
    
    fs.writeFileSync(tempFilePath, audioBuffer);

    // Transcribe using OpenAI Whisper
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tempFilePath),
      model: 'whisper-1',
      language: request.language || 'en',
      response_format: 'verbose_json'
    });

    // Clean up temp file
    fs.unlinkSync(tempFilePath);

    console.log('Transcription successful:', transcription.text);

    const response: TranscriptionResponse = {
      success: true,
      transcription: transcription.text,
      sessionId: request.sessionId,
      audioFileKey,
      confidence: transcription.segments ? 
        transcription.segments.reduce((avg: number, seg: any) => avg + (seg.avg_logprob || 0), 0) / transcription.segments.length : 
        undefined
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(response)
    };

  } catch (error) {
    console.error('Speech-to-text error:', error);
    
    const errorResponse: TranscriptionResponse = {
      success: false,
      sessionId: event.body ? JSON.parse(event.body).sessionId || 'unknown' : 'unknown',
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify(errorResponse)
    };
  }
};

function getContentType(format: string): string {
  switch (format.toLowerCase()) {
    case 'wav': return 'audio/wav';
    case 'mp3': return 'audio/mpeg';
    case 'ogg': return 'audio/ogg';
    case 'webm': return 'audio/webm';
    default: return 'audio/webm';
  }
}
