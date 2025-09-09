import { APIGatewayEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { DynamoDB, S3 } from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';

// Initialize AWS services
const dynamodb = new DynamoDB.DocumentClient();
const s3 = new S3();

const SESSIONS_TABLE = process.env.SESSIONS_TABLE || 'interview-sessions';
const FILES_TABLE = process.env.FILES_TABLE || 'session-files';
const S3_BUCKET = process.env.S3_BUCKET || 'voice-interview-platform-storage';

interface FileOperation {
  action: 'CREATE_FILE' | 'READ_FILE' | 'UPDATE_FILE' | 'LIST_FILES' | 'DELETE_FILE';
  sessionId: string;
  filePath?: string;
  content?: string;
}

export const handler = async (
  event: APIGatewayEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  try {
    console.log('File operations event:', JSON.stringify(event, null, 2));
    
    const operation: FileOperation = JSON.parse(event.body || '{}');
    const { action, sessionId, filePath, content } = operation;

    // Validate session exists
    await validateSession(sessionId);

    let result;
    switch (action) {
      case 'CREATE_FILE':
        result = await createFile(sessionId, filePath!, content || '');
        break;
      case 'READ_FILE':
        result = await readFile(sessionId, filePath!);
        break;
      case 'UPDATE_FILE':
        result = await updateFile(sessionId, filePath!, content!);
        break;
      case 'LIST_FILES':
        result = await listFiles(sessionId);
        break;
      case 'DELETE_FILE':
        result = await deleteFile(sessionId, filePath!);
        break;
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: JSON.stringify({
        success: true,
        data: result
      })
    };

  } catch (error) {
    console.error('File operation error:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};

async function validateSession(sessionId: string): Promise<void> {
  const params = {
    TableName: SESSIONS_TABLE,
    Key: {
      sessionId: sessionId,
      type: 'METADATA'
    }
  };

  const result = await dynamodb.get(params).promise();
  if (!result.Item) {
    throw new Error(`Session ${sessionId} not found`);
  }
}

async function createFile(sessionId: string, filePath: string, content: string) {
  const fileKey = `interview-sessions/${sessionId}/files${filePath}`;
  const timestamp = new Date().toISOString();

  // Upload to S3
  await s3.putObject({
    Bucket: S3_BUCKET,
    Key: fileKey,
    Body: content,
    ContentType: getContentType(filePath)
  }).promise();

  // Store metadata in DynamoDB
  await dynamodb.put({
    TableName: FILES_TABLE,
    Item: {
      sessionId,
      filePath,
      s3Key: fileKey,
      lastModified: timestamp,
      fileType: getFileExtension(filePath),
      size: Buffer.byteLength(content, 'utf8')
    }
  }).promise();

  return {
    path: filePath,
    created: timestamp,
    size: Buffer.byteLength(content, 'utf8')
  };
}

async function readFile(sessionId: string, filePath: string) {
  // Get file metadata from DynamoDB
  const fileResult = await dynamodb.get({
    TableName: FILES_TABLE,
    Key: { sessionId, filePath }
  }).promise();

  if (!fileResult.Item) {
    throw new Error(`File ${filePath} not found`);
  }

  // Get file content from S3
  const s3Result = await s3.getObject({
    Bucket: S3_BUCKET,
    Key: fileResult.Item.s3Key
  }).promise();

  return {
    path: filePath,
    content: s3Result.Body?.toString('utf-8') || '',
    lastModified: fileResult.Item.lastModified,
    fileType: fileResult.Item.fileType,
    size: fileResult.Item.size
  };
}

async function updateFile(sessionId: string, filePath: string, content: string) {
  // Check if file exists
  const existingFile = await dynamodb.get({
    TableName: FILES_TABLE,
    Key: { sessionId, filePath }
  }).promise();

  if (!existingFile.Item) {
    throw new Error(`File ${filePath} not found`);
  }

  const fileKey = existingFile.Item.s3Key;
  const timestamp = new Date().toISOString();

  // Update S3
  await s3.putObject({
    Bucket: S3_BUCKET,
    Key: fileKey,
    Body: content,
    ContentType: getContentType(filePath)
  }).promise();

  // Update DynamoDB
  await dynamodb.update({
    TableName: FILES_TABLE,
    Key: { sessionId, filePath },
    UpdateExpression: 'SET lastModified = :timestamp, #size = :size',
    ExpressionAttributeNames: { '#size': 'size' },
    ExpressionAttributeValues: {
      ':timestamp': timestamp,
      ':size': Buffer.byteLength(content, 'utf8')
    }
  }).promise();

  return {
    path: filePath,
    updated: timestamp,
    size: Buffer.byteLength(content, 'utf8')
  };
}

async function listFiles(sessionId: string) {
  const result = await dynamodb.query({
    TableName: FILES_TABLE,
    KeyConditionExpression: 'sessionId = :sessionId',
    ExpressionAttributeValues: {
      ':sessionId': sessionId
    }
  }).promise();

  return {
    files: result.Items?.map(item => ({
      path: item.filePath,
      lastModified: item.lastModified,
      fileType: item.fileType,
      size: item.size
    })) || []
  };
}

async function deleteFile(sessionId: string, filePath: string) {
  // Get file metadata
  const fileResult = await dynamodb.get({
    TableName: FILES_TABLE,
    Key: { sessionId, filePath }
  }).promise();

  if (!fileResult.Item) {
    throw new Error(`File ${filePath} not found`);
  }

  // Delete from S3
  await s3.deleteObject({
    Bucket: S3_BUCKET,
    Key: fileResult.Item.s3Key
  }).promise();

  // Delete from DynamoDB
  await dynamodb.delete({
    TableName: FILES_TABLE,
    Key: { sessionId, filePath }
  }).promise();

  return {
    path: filePath,
    deleted: new Date().toISOString()
  };
}

function getContentType(filePath: string): string {
  const extension = getFileExtension(filePath);
  const contentTypes: { [key: string]: string } = {
    'py': 'text/x-python',
    'js': 'application/javascript',
    'ts': 'application/typescript',
    'java': 'text/x-java-source',
    'cpp': 'text/x-c++src',
    'c': 'text/x-csrc',
    'html': 'text/html',
    'css': 'text/css',
    'json': 'application/json',
    'md': 'text/markdown',
    'txt': 'text/plain'
  };
  
  return contentTypes[extension] || 'text/plain';
}

function getFileExtension(filePath: string): string {
  return filePath.split('.').pop()?.toLowerCase() || '';
}
