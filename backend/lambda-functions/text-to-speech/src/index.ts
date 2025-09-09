import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { S3 } from 'aws-sdk';
import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';

const s3 = new S3();
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

interface TTSRequest {
  text: string;
  sessionId: string;
  voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
  speed?: number; // 0.25 to 4.0
  format?: 'mp3' | 'opus' | 'aac' | 'flac';
}

interface TTSResponse {
  success: boolean;
  audioUrl?: string;
  audioKey?: string;
  sessionId: string;
  duration?: number;
  format?: string;
  error?: string;
}

export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  console.log('Text-to-Speech Lambda triggered:', JSON.stringify(event, null, 2));

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

    const request: TTSRequest = JSON.parse(event.body);
    
    if (!request.text || !request.sessionId) {
      throw new Error('text and sessionId are required');
    }

    // Validate API key
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OpenAI API key not configured');
    }

    // Validate text length (OpenAI TTS has a 4096 character limit)
    if (request.text.length > 4096) {
      throw new Error('Text exceeds maximum length of 4096 characters');
    }

    console.log(`Generating speech for text: "${request.text.substring(0, 100)}..."`);

    // Generate speech using OpenAI TTS
    const mp3 = await openai.audio.speech.create({
      model: 'tts-1',
      voice: request.voice || 'nova',
      input: request.text,
      speed: request.speed || 1.0,
      response_format: request.format || 'mp3'
    });

    // Convert response to buffer
    const buffer = Buffer.from(await mp3.arrayBuffer());
    
    // Generate unique file key for audio storage
    const audioKey = `audio/sessions/${request.sessionId}/tts-${uuidv4()}.${request.format || 'mp3'}`;
    const bucketName = process.env.S3_BUCKET || 'voice-interview-platform-storage-dev';

    // Store audio file in S3
    await s3.putObject({
      Bucket: bucketName,
      Key: audioKey,
      Body: buffer,
      ContentType: getContentType(request.format || 'mp3'),
      Metadata: {
        sessionId: request.sessionId,
        text: request.text.substring(0, 1000), // Store first 1000 chars for reference
        voice: request.voice || 'nova',
        speed: String(request.speed || 1.0),
        generatedAt: new Date().toISOString()
      }
    }).promise();

    // Generate presigned URL for audio access (valid for 1 hour)
    const audioUrl = s3.getSignedUrl('getObject', {
      Bucket: bucketName,
      Key: audioKey,
      Expires: 3600 // 1 hour
    });

    console.log(`Audio generated and stored: ${audioKey}, size: ${buffer.length} bytes`);

    const response: TTSResponse = {
      success: true,
      audioUrl,
      audioKey,
      sessionId: request.sessionId,
      duration: estimateAudioDuration(request.text, request.speed || 1.0),
      format: request.format || 'mp3'
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(response)
    };

  } catch (error) {
    console.error('Text-to-speech error:', error);
    
    const errorResponse: TTSResponse = {
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
    case 'mp3': return 'audio/mpeg';
    case 'opus': return 'audio/opus';
    case 'aac': return 'audio/aac';
    case 'flac': return 'audio/flac';
    default: return 'audio/mpeg';
  }
}

function estimateAudioDuration(text: string, speed: number): number {
  // Rough estimation: average person speaks ~150 words per minute
  // Adjust for speed setting
  const words = text.split(/\s+/).length;
  const baseWPM = 150;
  const adjustedWPM = baseWPM * speed;
  const durationMinutes = words / adjustedWPM;
  return Math.round(durationMinutes * 60); // Return seconds
}
