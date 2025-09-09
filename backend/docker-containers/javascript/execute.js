#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const os = require('os');

class CodeExecutor {
    constructor() {
        this.timeout = parseInt(process.env.EXECUTION_TIMEOUT || '30000'); // ms
        this.maxMemory = process.env.MAX_MEMORY || '128m';
        this.tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'execution-'));
    }

    async executeCode(code, testCases = []) {
        try {
            // Write code to temporary file
            const codeFile = path.join(this.tempDir, 'main.js');
            fs.writeFileSync(codeFile, code);

            // Execute with timeout
            const startTime = Date.now();
            
            const result = await this.runWithTimeout(codeFile);
            const executionTime = Date.now() - startTime;

            return {
                success: result.exitCode === 0,
                stdout: result.stdout,
                stderr: result.stderr,
                exit_code: result.exitCode,
                execution_time: executionTime
            };

        } catch (error) {
            return {
                success: false,
                stdout: '',
                stderr: `Execution error: ${error.message}`,
                exit_code: -1,
                execution_time: 0
            };
        } finally {
            this.cleanup();
        }
    }

    runWithTimeout(codeFile) {
        return new Promise((resolve) => {
            const child = spawn('node', [codeFile], {
                cwd: this.tempDir,
                stdio: ['pipe', 'pipe', 'pipe']
            });

            let stdout = '';
            let stderr = '';
            let timedOut = false;

            // Set timeout
            const timer = setTimeout(() => {
                timedOut = true;
                child.kill('SIGKILL');
            }, this.timeout);

            child.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            child.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            child.on('close', (code) => {
                clearTimeout(timer);
                
                if (timedOut) {
                    resolve({
                        exitCode: -1,
                        stdout: '',
                        stderr: `Execution timed out after ${this.timeout}ms`
                    });
                } else {
                    resolve({
                        exitCode: code || 0,
                        stdout,
                        stderr
                    });
                }
            });

            child.on('error', (error) => {
                clearTimeout(timer);
                resolve({
                    exitCode: -1,
                    stdout: '',
                    stderr: `Process error: ${error.message}`
                });
            });
        });
    }

    cleanup() {
        try {
            const fs = require('fs');
            fs.rmSync(this.tempDir, { recursive: true, force: true });
        } catch (error) {
            // Ignore cleanup errors
        }
    }
}

async function main() {
    try {
        let inputData = '';
        
        // Read from stdin
        process.stdin.setEncoding('utf8');
        
        for await (const chunk of process.stdin) {
            inputData += chunk;
        }

        const data = inputData.trim() ? JSON.parse(inputData) : {};
        const code = data.code || '';
        const testCases = data.test_cases || [];

        if (!code) {
            console.log(JSON.stringify({
                success: false,
                error: 'No code provided'
            }));
            return;
        }

        const executor = new CodeExecutor();
        const result = await executor.executeCode(code, testCases);
        
        console.log(JSON.stringify(result));

    } catch (error) {
        console.log(JSON.stringify({
            success: false,
            error: `Executor error: ${error.message}`
        }));
    }
}

main().catch(console.error);
