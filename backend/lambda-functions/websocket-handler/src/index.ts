import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { DynamoDB, ApiGatewayManagementApi } from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';

const dynamodb = new DynamoDB.DocumentClient();

interface WebSocketMessage {
  action: string;
  sessionId?: string;
  data?: any;
}

interface ConnectionInfo {
  connectionId: string;
  sessionId?: string;
  connectedAt: string;
  lastActivity: string;
}

export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  console.log('WebSocket handler triggered:', JSON.stringify(event, null, 2));

  const { requestContext } = event;
  const connectionId = requestContext.connectionId!;
  const routeKey = requestContext.routeKey!;

  try {
    switch (routeKey) {
      case '$connect':
        return await handleConnect(connectionId);
      
      case '$disconnect':
        return await handleDisconnect(connectionId);
      
      case '$default':
        return await handleMessage(connectionId, event.body || '{}', requestContext);
      
      default:
        console.error('Unknown route:', routeKey);
        return { statusCode: 400, body: 'Unknown route' };
    }
  } catch (error) {
    console.error('WebSocket handler error:', error);
    return { 
      statusCode: 500, 
      body: JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Internal server error' 
      })
    };
  }
};

async function handleConnect(connectionId: string): Promise<APIGatewayProxyResult> {
  console.log(`New WebSocket connection: ${connectionId}`);

  const connectionInfo: ConnectionInfo = {
    connectionId,
    connectedAt: new Date().toISOString(),
    lastActivity: new Date().toISOString()
  };

  try {
    // Store connection info in DynamoDB
    await dynamodb.put({
      TableName: process.env.CONNECTIONS_TABLE || 'voice-interview-ai-connections-dev',
      Item: connectionInfo,
      ConditionExpression: 'attribute_not_exists(connectionId)'
    }).promise();

    console.log(`Connection stored: ${connectionId}`);
    return { statusCode: 200, body: 'Connected' };
  } catch (error) {
    console.error('Error storing connection:', error);
    return { statusCode: 500, body: 'Failed to connect' };
  }
}

async function handleDisconnect(connectionId: string): Promise<APIGatewayProxyResult> {
  console.log(`WebSocket disconnection: ${connectionId}`);

  try {
    // Remove connection from DynamoDB
    await dynamodb.delete({
      TableName: process.env.CONNECTIONS_TABLE || 'voice-interview-ai-connections-dev',
      Key: { connectionId }
    }).promise();

    console.log(`Connection removed: ${connectionId}`);
    return { statusCode: 200, body: 'Disconnected' };
  } catch (error) {
    console.error('Error removing connection:', error);
    return { statusCode: 500, body: 'Failed to disconnect' };
  }
}

async function handleMessage(
  connectionId: string, 
  body: string, 
  requestContext: any
): Promise<APIGatewayProxyResult> {
  console.log(`WebSocket message from ${connectionId}: ${body}`);

  try {
    const message: WebSocketMessage = JSON.parse(body);
    
    // Update last activity
    await updateLastActivity(connectionId);

    // Create API Gateway Management API client
    const apiGateway = new ApiGatewayManagementApi({
      endpoint: `https://${requestContext.domainName}/${requestContext.stage}`
    });

    switch (message.action) {
      case 'join-session':
        return await handleJoinSession(connectionId, message, apiGateway);
      
      case 'leave-session':
        return await handleLeaveSession(connectionId, message);
      
      case 'voice-status':
        return await handleVoiceStatus(connectionId, message, apiGateway);
      
      case 'chat-message':
        return await handleChatMessage(connectionId, message, apiGateway);
      
      case 'typing-indicator':
        return await handleTypingIndicator(connectionId, message, apiGateway);
      
      case 'session-update':
        return await handleSessionUpdate(connectionId, message, apiGateway);
      
      default:
        console.log(`Unknown action: ${message.action}`);
        await sendToConnection(apiGateway, connectionId, {
          type: 'error',
          message: `Unknown action: ${message.action}`
        });
        return { statusCode: 400, body: 'Unknown action' };
    }
  } catch (error) {
    console.error('Error handling message:', error);
    return { statusCode: 500, body: 'Failed to handle message' };
  }
}

async function handleJoinSession(
  connectionId: string, 
  message: WebSocketMessage, 
  apiGateway: ApiGatewayManagementApi
): Promise<APIGatewayProxyResult> {
  const { sessionId } = message;
  
  if (!sessionId) {
    await sendToConnection(apiGateway, connectionId, {
      type: 'error',
      message: 'sessionId is required for join-session'
    });
    return { statusCode: 400, body: 'sessionId required' };
  }

  try {
    // Update connection with session ID
    await dynamodb.update({
      TableName: process.env.CONNECTIONS_TABLE || 'voice-interview-ai-connections-dev',
      Key: { connectionId },
      UpdateExpression: 'SET sessionId = :sessionId, lastActivity = :now',
      ExpressionAttributeValues: {
        ':sessionId': sessionId,
        ':now': new Date().toISOString()
      }
    }).promise();

    // Send confirmation
    await sendToConnection(apiGateway, connectionId, {
      type: 'session-joined',
      sessionId,
      connectionId
    });

    // Notify other participants in the session (if any)
    await broadcastToSession(apiGateway, sessionId, connectionId, {
      type: 'participant-joined',
      sessionId,
      participantId: connectionId
    });

    console.log(`Connection ${connectionId} joined session ${sessionId}`);
    return { statusCode: 200, body: 'Session joined' };
  } catch (error) {
    console.error('Error joining session:', error);
    await sendToConnection(apiGateway, connectionId, {
      type: 'error',
      message: 'Failed to join session'
    });
    return { statusCode: 500, body: 'Failed to join session' };
  }
}

async function handleLeaveSession(
  connectionId: string, 
  message: WebSocketMessage
): Promise<APIGatewayProxyResult> {
  try {
    // Get current session ID
    const connection = await dynamodb.get({
      TableName: process.env.CONNECTIONS_TABLE || 'voice-interview-ai-connections-dev',
      Key: { connectionId }
    }).promise();

    if (connection.Item?.sessionId) {
      // Remove session ID from connection
      await dynamodb.update({
        TableName: process.env.CONNECTIONS_TABLE || 'voice-interview-ai-connections-dev',
        Key: { connectionId },
        UpdateExpression: 'REMOVE sessionId SET lastActivity = :now',
        ExpressionAttributeValues: {
          ':now': new Date().toISOString()
        }
      }).promise();

      console.log(`Connection ${connectionId} left session ${connection.Item.sessionId}`);
    }

    return { statusCode: 200, body: 'Session left' };
  } catch (error) {
    console.error('Error leaving session:', error);
    return { statusCode: 500, body: 'Failed to leave session' };
  }
}

async function handleVoiceStatus(
  connectionId: string, 
  message: WebSocketMessage, 
  apiGateway: ApiGatewayManagementApi
): Promise<APIGatewayProxyResult> {
  const { sessionId, data } = message;
  
  if (!sessionId) {
    return { statusCode: 400, body: 'sessionId required' };
  }

  try {
    // Broadcast voice status to other participants
    await broadcastToSession(apiGateway, sessionId, connectionId, {
      type: 'voice-status-update',
      sessionId,
      participantId: connectionId,
      status: data.status, // 'speaking', 'muted', 'listening'
      timestamp: new Date().toISOString()
    });

    return { statusCode: 200, body: 'Voice status broadcast' };
  } catch (error) {
    console.error('Error broadcasting voice status:', error);
    return { statusCode: 500, body: 'Failed to broadcast voice status' };
  }
}

async function handleChatMessage(
  connectionId: string, 
  message: WebSocketMessage, 
  apiGateway: ApiGatewayManagementApi
): Promise<APIGatewayProxyResult> {
  const { sessionId, data } = message;
  
  if (!sessionId || !data?.text) {
    return { statusCode: 400, body: 'sessionId and text required' };
  }

  try {
    const chatMessage = {
      type: 'chat-message',
      sessionId,
      senderId: connectionId,
      text: data.text,
      timestamp: new Date().toISOString(),
      messageId: uuidv4()
    };

    // Broadcast chat message to all participants
    await broadcastToSession(apiGateway, sessionId, null, chatMessage);

    return { statusCode: 200, body: 'Chat message sent' };
  } catch (error) {
    console.error('Error sending chat message:', error);
    return { statusCode: 500, body: 'Failed to send chat message' };
  }
}

async function handleTypingIndicator(
  connectionId: string, 
  message: WebSocketMessage, 
  apiGateway: ApiGatewayManagementApi
): Promise<APIGatewayProxyResult> {
  const { sessionId, data } = message;
  
  if (!sessionId) {
    return { statusCode: 400, body: 'sessionId required' };
  }

  try {
    // Broadcast typing indicator to other participants
    await broadcastToSession(apiGateway, sessionId, connectionId, {
      type: 'typing-indicator',
      sessionId,
      participantId: connectionId,
      isTyping: data.isTyping || false,
      timestamp: new Date().toISOString()
    });

    return { statusCode: 200, body: 'Typing indicator sent' };
  } catch (error) {
    console.error('Error sending typing indicator:', error);
    return { statusCode: 500, body: 'Failed to send typing indicator' };
  }
}

async function handleSessionUpdate(
  connectionId: string, 
  message: WebSocketMessage, 
  apiGateway: ApiGatewayManagementApi
): Promise<APIGatewayProxyResult> {
  const { sessionId, data } = message;
  
  if (!sessionId) {
    return { statusCode: 400, body: 'sessionId required' };
  }

  try {
    // Broadcast session update to all participants
    await broadcastToSession(apiGateway, sessionId, null, {
      type: 'session-update',
      sessionId,
      updateType: data.updateType, // 'status-change', 'problem-change', 'timer-update'
      data: data,
      timestamp: new Date().toISOString()
    });

    return { statusCode: 200, body: 'Session update broadcast' };
  } catch (error) {
    console.error('Error broadcasting session update:', error);
    return { statusCode: 500, body: 'Failed to broadcast session update' };
  }
}

async function updateLastActivity(connectionId: string): Promise<void> {
  try {
    await dynamodb.update({
      TableName: process.env.CONNECTIONS_TABLE || 'voice-interview-ai-connections-dev',
      Key: { connectionId },
      UpdateExpression: 'SET lastActivity = :now',
      ExpressionAttributeValues: {
        ':now': new Date().toISOString()
      }
    }).promise();
  } catch (error) {
    console.error('Error updating last activity:', error);
  }
}

async function sendToConnection(
  apiGateway: ApiGatewayManagementApi,
  connectionId: string,
  data: any
): Promise<void> {
  try {
    await apiGateway.postToConnection({
      ConnectionId: connectionId,
      Data: JSON.stringify(data)
    }).promise();
  } catch (error: any) {
    if (error.statusCode === 410) {
      console.log(`Connection ${connectionId} is stale, removing from database`);
      await dynamodb.delete({
        TableName: process.env.CONNECTIONS_TABLE || 'voice-interview-ai-connections-dev',
        Key: { connectionId }
      }).promise();
    } else {
      console.error('Error sending message to connection:', error);
    }
  }
}

async function broadcastToSession(
  apiGateway: ApiGatewayManagementApi,
  sessionId: string,
  excludeConnectionId: string | null,
  data: any
): Promise<void> {
  try {
    // Get all connections for this session
    const result = await dynamodb.scan({
      TableName: process.env.CONNECTIONS_TABLE || 'voice-interview-ai-connections-dev',
      FilterExpression: 'sessionId = :sessionId',
      ExpressionAttributeValues: {
        ':sessionId': sessionId
      }
    }).promise();

    const connections = result.Items || [];
    
    // Send message to all connections in the session (except excluded one)
    const sendPromises = connections
      .filter((conn: any) => conn.connectionId !== excludeConnectionId)
      .map((conn: any) => sendToConnection(apiGateway, conn.connectionId, data));

    await Promise.all(sendPromises);
    
    console.log(`Broadcast to ${sendPromises.length} connections in session ${sessionId}`);
  } catch (error) {
    console.error('Error broadcasting to session:', error);
  }
}
