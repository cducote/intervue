import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { DynamoDB } from 'aws-sdk';
import Anthropic from '@anthropic-ai/sdk';
import { v4 as uuidv4 } from 'uuid';

const dynamodb = new DynamoDB.DocumentClient();
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

interface AIRequest {
  sessionId: string;
  userMessage: string;
  context?: {
    currentProblem?: string;
    codeSubmissions?: Array<{
      code: string;
      language: string;
      timestamp: string;
      result?: any;
    }>;
    conversationHistory?: Array<{
      role: 'user' | 'assistant';
      content: string;
      timestamp: string;
    }>;
  };
  interviewType?: 'technical' | 'behavioral' | 'system-design';
  difficulty?: 'easy' | 'medium' | 'hard';
}

interface AIResponse {
  success: boolean;
  sessionId: string;
  response?: string;
  followUpQuestions?: string[];
  codeChallenge?: {
    title: string;
    description: string;
    difficulty: string;
    expectedTime: number;
    hints?: string[];
  };
  analysis?: {
    technicalAccuracy: number;
    communicationSkills: number;
    problemSolvingApproach: number;
    codeQuality: number;
    overallScore: number;
  };
  error?: string;
}

export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  console.log('AI Response Lambda triggered:', JSON.stringify(event, null, 2));

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

    const request: AIRequest = JSON.parse(event.body);
    
    if (!request.sessionId || !request.userMessage) {
      throw new Error('sessionId and userMessage are required');
    }

    // Validate API key
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('Anthropic API key not configured');
    }

    // Get session context from DynamoDB
    const sessionData = await getSessionContext(request.sessionId);
    
    // Build conversation context
    const systemPrompt = buildSystemPrompt(request.interviewType || 'technical', request.difficulty || 'medium');
    const conversationHistory = buildConversationHistory(request, sessionData);

    // Generate AI response using Claude 3.5 Sonnet
    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1000,
      temperature: 0.7,
      system: systemPrompt,
      messages: conversationHistory
    });

    const aiResponse = message.content[0].type === 'text' ? message.content[0].text : '';
    
    // Parse structured response if needed
    const structuredResponse = parseAIResponse(aiResponse);

    // Update session with new conversation
    await updateSessionConversation(request.sessionId, request.userMessage, aiResponse);

    // Analyze performance if code was submitted
    const analysis = request.context?.codeSubmissions && request.context.codeSubmissions.length > 0 ?
      await analyzePerformance(request.context.codeSubmissions, request.userMessage) :
      undefined;

    const response: AIResponse = {
      success: true,
      sessionId: request.sessionId,
      response: structuredResponse.response || aiResponse,
      followUpQuestions: structuredResponse.followUpQuestions,
      codeChallenge: structuredResponse.codeChallenge,
      analysis
    };

    console.log('AI response generated successfully');

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(response)
    };

  } catch (error) {
    console.error('AI response error:', error);
    
    const errorResponse: AIResponse = {
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

async function getSessionContext(sessionId: string) {
  try {
    const result = await dynamodb.get({
      TableName: process.env.SESSIONS_TABLE || 'voice-interview-ai-sessions-dev',
      Key: { sessionId }
    }).promise();

    return result.Item || {};
  } catch (error) {
    console.error('Error fetching session context:', error);
    return {};
  }
}

function buildSystemPrompt(interviewType: string, difficulty: string): string {
  const basePrompt = `You are an expert technical interviewer conducting a ${difficulty} ${interviewType} interview. 

Your role:
- Ask thoughtful, progressive questions that build on previous answers
- Provide constructive feedback on code submissions
- Guide candidates through problem-solving approaches
- Maintain a professional yet encouraging tone
- Adapt difficulty based on candidate responses

Guidelines:
- Keep responses concise but thorough (2-3 sentences max unless explaining a concept)
- Always provide clear next steps or follow-up questions
- If code is submitted, analyze it for correctness, efficiency, and style
- Offer hints when candidates are stuck, but don't give away solutions
- Focus on problem-solving process, not just final answers`;

  if (interviewType === 'technical') {
    return basePrompt + `

Technical Interview Focus:
- Algorithm design and implementation
- Data structures usage and optimization
- Time/space complexity analysis
- Code quality and best practices
- Problem decomposition strategies`;
  } else if (interviewType === 'system-design') {
    return basePrompt + `

System Design Focus:
- Architecture patterns and trade-offs
- Scalability and performance considerations
- Database design and data modeling
- API design and microservices
- Infrastructure and deployment strategies`;
  } else {
    return basePrompt + `

Behavioral Interview Focus:
- Past experience and project examples
- Problem-solving and decision-making processes
- Teamwork and communication skills
- Leadership and conflict resolution
- Learning and adaptation abilities`;
  }
}

function buildConversationHistory(request: AIRequest, sessionData: any): Array<{ role: 'user' | 'assistant', content: string }> {
  const messages: Array<{ role: 'user' | 'assistant', content: string }> = [];

  // Add conversation history from session
  if (sessionData.conversationHistory) {
    messages.push(...sessionData.conversationHistory.slice(-10)); // Keep last 10 messages for context
  }

  // Add context about current problem and code submissions
  let contextMessage = `User message: ${request.userMessage}`;
  
  if (request.context?.currentProblem) {
    contextMessage += `\n\nCurrent problem: ${request.context.currentProblem}`;
  }

  if (request.context?.codeSubmissions && request.context.codeSubmissions.length > 0) {
    const latestSubmission = request.context.codeSubmissions[request.context.codeSubmissions.length - 1];
    contextMessage += `\n\nLatest code submission (${latestSubmission.language}):\n${latestSubmission.code}`;
    
    if (latestSubmission.result) {
      contextMessage += `\n\nExecution result: ${JSON.stringify(latestSubmission.result)}`;
    }
  }

  messages.push({ role: 'user', content: contextMessage });

  return messages;
}

function parseAIResponse(response: string): {
  response: string;
  followUpQuestions?: string[];
  codeChallenge?: any;
} {
  // Try to extract structured data from response
  // This is a simple implementation - could be enhanced with more sophisticated parsing
  
  const followUpMatch = response.match(/Follow-up questions?:\s*\n((?:[-*]\s*.+\n?)+)/i);
  const followUpQuestions = followUpMatch ? 
    followUpMatch[1].split('\n')
      .filter(line => line.trim())
      .map(line => line.replace(/^[-*]\s*/, '').trim()) :
    undefined;

  // Remove structured sections from main response
  const cleanResponse = response
    .replace(/Follow-up questions?:\s*\n((?:[-*]\s*.+\n?)+)/i, '')
    .trim();

  return {
    response: cleanResponse,
    followUpQuestions
  };
}

async function updateSessionConversation(sessionId: string, userMessage: string, aiResponse: string) {
  try {
    const timestamp = new Date().toISOString();
    
    await dynamodb.update({
      TableName: process.env.SESSIONS_TABLE || 'voice-interview-ai-sessions-dev',
      Key: { sessionId },
      UpdateExpression: 'SET conversationHistory = list_append(if_not_exists(conversationHistory, :empty_list), :new_messages), updatedAt = :timestamp',
      ExpressionAttributeValues: {
        ':empty_list': [],
        ':new_messages': [
          { role: 'user', content: userMessage, timestamp },
          { role: 'assistant', content: aiResponse, timestamp }
        ],
        ':timestamp': timestamp
      }
    }).promise();
  } catch (error) {
    console.error('Error updating session conversation:', error);
  }
}

async function analyzePerformance(codeSubmissions: any[], userMessage: string): Promise<any> {
  // Simple performance analysis - could be enhanced with more sophisticated metrics
  const latestSubmission = codeSubmissions[codeSubmissions.length - 1];
  
  // Basic heuristics for code quality
  const codeLength = latestSubmission.code.length;
  const hasComments = latestSubmission.code.includes('//') || latestSubmission.code.includes('/*');
  const hasProperVariableNames = !/\b[a-z]\b/.test(latestSubmission.code); // No single letter variables
  
  return {
    technicalAccuracy: latestSubmission.result?.success ? 85 : 45,
    communicationSkills: userMessage.length > 50 ? 80 : 60, // Based on explanation length
    problemSolvingApproach: 75, // Would need more sophisticated analysis
    codeQuality: (hasComments ? 20 : 0) + (hasProperVariableNames ? 20 : 0) + (codeLength > 100 ? 20 : 10),
    overallScore: 0 // Will be calculated as average
  };
}
