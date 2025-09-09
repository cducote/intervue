import { APIGatewayEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { S3, ECS } from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';
import { spawn } from 'child_process';

const s3 = new S3();
const ecs = new ECS();

const S3_BUCKET = process.env.S3_BUCKET || 'voice-interview-platform-storage';
const ECS_CLUSTER = process.env.ECS_CLUSTER || 'interview-execution-cluster';
const EXECUTION_TIMEOUT = parseInt(process.env.EXECUTION_TIMEOUT || '30000'); // 30 seconds

interface CodeExecutionRequest {
  sessionId: string;
  fileName: string;
  language: string;
  testCases?: any[];
  timeout?: number;
}

interface ExecutionResult {
  success: boolean;
  output: string;
  errors: string;
  exitCode: number;
  executionTime: number;
  testResults?: TestResult[];
}

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  expected?: any;
  actual?: any;
}

export const handler = async (
  event: APIGatewayEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  try {
    console.log('Code executor event:', JSON.stringify(event, null, 2));
    
    const request: CodeExecutionRequest = JSON.parse(event.body || '{}');
    const { sessionId, fileName, language, testCases, timeout } = request;

    // Validate inputs
    if (!sessionId || !fileName || !language) {
      throw new Error('Missing required parameters: sessionId, fileName, or language');
    }

    const supportedLanguages = ['python', 'javascript', 'java', 'cpp'];
    if (!supportedLanguages.includes(language)) {
      throw new Error(`Unsupported language: ${language}. Supported: ${supportedLanguages.join(', ')}`);
    }

    // Execute code
    const result = await executeCode(sessionId, fileName, language, testCases, timeout);

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
    console.error('Code execution error:', error);
    
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

async function executeCode(
  sessionId: string,
  fileName: string,
  language: string,
  testCases?: any[],
  timeout?: number
): Promise<ExecutionResult> {
  const executionId = uuidv4();
  const startTime = Date.now();

  try {
    // Download file from S3
    const fileContent = await downloadFileFromS3(sessionId, fileName);
    
    // Create execution container
    const containerConfig = getContainerConfig(language, fileContent, testCases);
    
    // Run container with security constraints
    const executionResult = await runSecureContainer(containerConfig, timeout || EXECUTION_TIMEOUT);
    
    // Store execution results
    await storeExecutionResults(sessionId, executionId, executionResult);
    
    const executionTime = Date.now() - startTime;
    
    return {
      success: executionResult.exitCode === 0,
      output: executionResult.stdout,
      errors: executionResult.stderr,
      exitCode: executionResult.exitCode,
      executionTime,
      testResults: parseTestResults(executionResult.stdout, testCases)
    };

  } catch (error) {
    const executionTime = Date.now() - startTime;
    throw new Error(`Execution failed after ${executionTime}ms: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function downloadFileFromS3(sessionId: string, fileName: string): Promise<string> {
  const key = `interview-sessions/${sessionId}/files${fileName}`;
  
  try {
    const result = await s3.getObject({
      Bucket: S3_BUCKET,
      Key: key
    }).promise();

    return result.Body?.toString('utf-8') || '';
  } catch (error) {
    throw new Error(`Failed to download file ${fileName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function getContainerConfig(language: string, code: string, testCases?: any[]) {
  const configs = {
    python: {
      image: 'interview-executor:python',
      command: ['python', '/app/main.py'],
      runtime: 'python3'
    },
    javascript: {
      image: 'interview-executor:node',
      command: ['node', '/app/main.js'],
      runtime: 'node'
    },
    java: {
      image: 'interview-executor:java',
      command: ['java', 'Main'],
      runtime: 'java'
    },
    cpp: {
      image: 'interview-executor:cpp',
      command: ['./main'],
      runtime: 'cpp'
    }
  };

  const config = configs[language as keyof typeof configs];
  if (!config) {
    throw new Error(`Unsupported language: ${language}`);
  }

  return {
    ...config,
    code,
    testCases: testCases || [],
    environment: {
      LANGUAGE: language,
      EXECUTION_MODE: 'interview'
    }
  };
}

async function runSecureContainer(config: any, timeout: number): Promise<any> {
  console.log(`Executing ${config.runtime} code with timeout ${timeout}ms`);
  
  const startTime = Date.now();
  
  return new Promise((resolve, reject) => {
    const containerImage = config.image;
    const inputData = JSON.stringify({
      code: config.code,
      test_cases: config.testCases
    });

    // Docker run command with security constraints
    const dockerArgs = [
      'run', '--rm', '-i',
      '--network', 'none',
      '--memory', '128m',
      '--cpus', '0.5',
      '--read-only',
      '--tmpfs', '/tmp:rw,noexec,nosuid,size=50m',
      '--security-opt', 'no-new-privileges:true',
      containerImage
    ];

    const dockerProcess = spawn('docker', dockerArgs, {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';
    let isResolved = false;

    // Set timeout
    const timeoutId = setTimeout(() => {
      if (!isResolved) {
        isResolved = true;
        dockerProcess.kill('SIGKILL');
        resolve({
          stdout: '',
          stderr: `Execution timed out after ${timeout}ms`,
          exitCode: -1,
          duration: timeout
        });
      }
    }, timeout);

    // Send input data
    dockerProcess.stdin.write(inputData);
    dockerProcess.stdin.end();

    // Collect output
    dockerProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    dockerProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    dockerProcess.on('close', (code) => {
      if (!isResolved) {
        isResolved = true;
        clearTimeout(timeoutId);
        
        resolve({
          stdout,
          stderr,
          exitCode: code || 0,
          duration: Date.now() - startTime
        });
      }
    });

    dockerProcess.on('error', (error) => {
      if (!isResolved) {
        isResolved = true;
        clearTimeout(timeoutId);
        
        resolve({
          stdout: '',
          stderr: `Docker execution error: ${error.message}`,
          exitCode: -1,
          duration: 0
        });
      }
    });
  });
}

function simulateExecution(code: string, runtime: string, testCases: any[]): string {
  // This is a mock simulation - in production, this would be real execution
  let output = `=== ${runtime.toUpperCase()} Execution Results ===\n`;
  
  // Simulate running test cases
  if (testCases && testCases.length > 0) {
    output += 'Running test cases...\n';
    testCases.forEach((testCase, index) => {
      const passed = Math.random() > 0.3; // 70% pass rate for simulation
      output += `Test ${index + 1}: ${passed ? 'PASS' : 'FAIL'}\n`;
      if (!passed) {
        output += `  Expected: ${JSON.stringify(testCase.expected)}\n`;
        output += `  Got: [simulated different result]\n`;
      }
    });
  } else {
    // Simulate basic output
    output += 'Code executed successfully\n';
    if (code.includes('print') || code.includes('console.log')) {
      output += 'Hello World\n';
    }
  }
  
  output += '\nExecution completed.';
  return output;
}

function parseTestResults(output: string, testCases?: any[]): TestResult[] | undefined {
  if (!testCases || testCases.length === 0) {
    return undefined;
  }

  // Parse the simulated test results
  const testResults: TestResult[] = [];
  const lines = output.split('\n');
  
  let testIndex = 0;
  for (const line of lines) {
    if (line.startsWith('Test ') && testIndex < testCases.length) {
      const passed = line.includes('PASS');
      testResults.push({
        name: `Test Case ${testIndex + 1}`,
        passed,
        expected: testCases[testIndex].expected,
        error: passed ? undefined : 'Output did not match expected result'
      });
      testIndex++;
    }
  }

  return testResults;
}

async function storeExecutionResults(sessionId: string, executionId: string, result: any): Promise<void> {
  const key = `interview-sessions/${sessionId}/outputs/execution-${executionId}.json`;
  
  await s3.putObject({
    Bucket: S3_BUCKET,
    Key: key,
    Body: JSON.stringify({
      executionId,
      timestamp: new Date().toISOString(),
      result
    }),
    ContentType: 'application/json'
  }).promise();
}
