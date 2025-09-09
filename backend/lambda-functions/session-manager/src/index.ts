import { APIGatewayEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { DynamoDB } from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';

const dynamodb = new DynamoDB.DocumentClient();

const SESSIONS_TABLE = process.env.SESSIONS_TABLE || 'interview-sessions';

interface SessionOperation {
  action: 'CREATE_SESSION' | 'GET_SESSION' | 'UPDATE_SESSION' | 'END_SESSION';
  sessionId?: string;
  templateId?: string;
  updates?: any;
}

interface InterviewTemplate {
  id: string;
  title: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  description: string;
  starterCode: { [language: string]: string };
  testCases: any[];
  hints: string[];
}

const INTERVIEW_TEMPLATES: { [key: string]: InterviewTemplate } = {
  'two-sum': {
    id: 'two-sum',
    title: 'Two Sum Problem',
    difficulty: 'Easy',
    description: 'Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.',
    starterCode: {
      python: `def two_sum(nums, target):
    # Your solution here
    pass

# Test cases
print(two_sum([2,7,11,15], 9))  # Expected: [0,1]
print(two_sum([3,2,4], 6))      # Expected: [1,2]`,
      javascript: `function twoSum(nums, target) {
    // Your solution here
}

// Test cases
console.log(twoSum([2,7,11,15], 9));  // Expected: [0,1]
console.log(twoSum([3,2,4], 6));      // Expected: [1,2]`
    },
    testCases: [
      { input: [[2,7,11,15], 9], expected: [0,1] },
      { input: [[3,2,4], 6], expected: [1,2] },
      { input: [[3,3], 6], expected: [0,1] }
    ],
    hints: [
      "Think about what information you need to store as you iterate through the array",
      "Consider using a hash map to store values you've seen",
      "What's the complement of each number that you need to find?"
    ]
  },
  'reverse-linked-list': {
    id: 'reverse-linked-list',
    title: 'Reverse Linked List',
    difficulty: 'Easy',
    description: 'Given the head of a singly linked list, reverse the list, and return the reversed list.',
    starterCode: {
      python: `class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next

def reverse_list(head):
    # Your solution here
    pass

# Helper function to create test cases
def create_linked_list(vals):
    if not vals:
        return None
    head = ListNode(vals[0])
    current = head
    for val in vals[1:]:
        current.next = ListNode(val)
        current = current.next
    return head

# Test case
head = create_linked_list([1, 2, 3, 4, 5])
reversed_head = reverse_list(head)`,
      javascript: `class ListNode {
    constructor(val = 0, next = null) {
        this.val = val;
        this.next = next;
    }
}

function reverseList(head) {
    // Your solution here
}

// Helper function to create test cases
function createLinkedList(vals) {
    if (!vals.length) return null;
    let head = new ListNode(vals[0]);
    let current = head;
    for (let i = 1; i < vals.length; i++) {
        current.next = new ListNode(vals[i]);
        current = current.next;
    }
    return head;
}

// Test case
let head = createLinkedList([1, 2, 3, 4, 5]);
let reversedHead = reverseList(head);`
    },
    testCases: [
      { input: [[1,2,3,4,5]], expected: [5,4,3,2,1] },
      { input: [[1,2]], expected: [2,1] },
      { input: [[]], expected: [] }
    ],
    hints: [
      "Think about the pointers you need to keep track of",
      "Can you solve this iteratively?",
      "Can you solve this recursively?",
      "What's the time and space complexity of your solution?"
    ]
  }
};

export const handler = async (
  event: APIGatewayEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  try {
    console.log('Session manager event:', JSON.stringify(event, null, 2));
    
    const operation: SessionOperation = JSON.parse(event.body || '{}');
    const { action, sessionId, templateId, updates } = operation;

    let result;
    switch (action) {
      case 'CREATE_SESSION':
        result = await createSession(templateId);
        break;
      case 'GET_SESSION':
        result = await getSession(sessionId!);
        break;
      case 'UPDATE_SESSION':
        result = await updateSession(sessionId!, updates);
        break;
      case 'END_SESSION':
        result = await endSession(sessionId!);
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
    console.error('Session manager error:', error);
    
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

async function createSession(templateId?: string) {
  const sessionId = uuidv4();
  const timestamp = new Date().toISOString();
  const template = templateId ? INTERVIEW_TEMPLATES[templateId] : null;

  if (templateId && !template) {
    throw new Error(`Template ${templateId} not found`);
  }

  // Create session metadata
  await dynamodb.put({
    TableName: SESSIONS_TABLE,
    Item: {
      sessionId,
      type: 'METADATA',
      createdAt: timestamp,
      status: 'active',
      templateId: templateId || null,
      phase: 'introduction',
      currentFile: null
    }
  }).promise();

  // Create session configuration
  await dynamodb.put({
    TableName: SESSIONS_TABLE,
    Item: {
      sessionId,
      type: 'CONFIG',
      template: template,
      settings: {
        voiceEnabled: true,
        codeExecution: true,
        hints: true,
        maxDuration: 3600000 // 1 hour in milliseconds
      }
    }
  }).promise();

  return {
    sessionId,
    created: timestamp,
    template: template,
    status: 'active'
  };
}

async function getSession(sessionId: string) {
  // Get metadata
  const metadataResult = await dynamodb.get({
    TableName: SESSIONS_TABLE,
    Key: {
      sessionId,
      type: 'METADATA'
    }
  }).promise();

  if (!metadataResult.Item) {
    throw new Error(`Session ${sessionId} not found`);
  }

  // Get configuration
  const configResult = await dynamodb.get({
    TableName: SESSIONS_TABLE,
    Key: {
      sessionId,
      type: 'CONFIG'
    }
  }).promise();

  return {
    metadata: metadataResult.Item,
    config: configResult.Item || {}
  };
}

async function updateSession(sessionId: string, updates: any) {
  const timestamp = new Date().toISOString();

  // Validate session exists
  const session = await getSession(sessionId);
  if (!session.metadata) {
    throw new Error(`Session ${sessionId} not found`);
  }

  // Update metadata
  let updateExpression = 'SET lastUpdated = :timestamp';
  const expressionAttributeValues: any = { ':timestamp': timestamp };
  const expressionAttributeNames: any = {};

  // Build dynamic update expression
  Object.keys(updates).forEach((key, index) => {
    const placeholder = `:val${index}`;
    const namePlaceholder = `#attr${index}`;
    updateExpression += `, ${namePlaceholder} = ${placeholder}`;
    expressionAttributeValues[placeholder] = updates[key];
    expressionAttributeNames[namePlaceholder] = key;
  });

  await dynamodb.update({
    TableName: SESSIONS_TABLE,
    Key: {
      sessionId,
      type: 'METADATA'
    },
    UpdateExpression: updateExpression,
    ExpressionAttributeValues: expressionAttributeValues,
    ExpressionAttributeNames: expressionAttributeNames
  }).promise();

  return {
    sessionId,
    updated: timestamp,
    updates
  };
}

async function endSession(sessionId: string) {
  const timestamp = new Date().toISOString();

  await dynamodb.update({
    TableName: SESSIONS_TABLE,
    Key: {
      sessionId,
      type: 'METADATA'
    },
    UpdateExpression: 'SET #status = :status, endedAt = :timestamp',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: {
      ':status': 'completed',
      ':timestamp': timestamp
    }
  }).promise();

  return {
    sessionId,
    ended: timestamp,
    status: 'completed'
  };
}
