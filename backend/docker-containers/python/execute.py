#!/usr/bin/env python3
import sys
import os
import json
import subprocess
import time
import tempfile
import signal
from pathlib import Path

class CodeExecutor:
    def __init__(self):
        self.timeout = int(os.environ.get('EXECUTION_TIMEOUT', '30'))
        self.max_memory = os.environ.get('MAX_MEMORY', '128m')
        self.temp_dir = tempfile.mkdtemp(prefix='execution_')
        
    def execute_code(self, code, test_cases=None):
        """Execute Python code safely with timeout and resource limits"""
        try:
            # Write code to temporary file
            code_file = Path(self.temp_dir) / 'main.py'
            with open(code_file, 'w') as f:
                f.write(code)
            
            # Set up execution environment
            env = os.environ.copy()
            env['PYTHONPATH'] = str(self.temp_dir)
            
            # Execute with timeout
            start_time = time.time()
            try:
                result = subprocess.run(
                    [sys.executable, str(code_file)],
                    cwd=self.temp_dir,
                    capture_output=True,
                    text=True,
                    timeout=self.timeout,
                    env=env
                )
                
                execution_time = (time.time() - start_time) * 1000  # ms
                
                return {
                    'success': result.returncode == 0,
                    'stdout': result.stdout,
                    'stderr': result.stderr,
                    'exit_code': result.returncode,
                    'execution_time': execution_time
                }
                
            except subprocess.TimeoutExpired:
                return {
                    'success': False,
                    'stdout': '',
                    'stderr': f'Execution timed out after {self.timeout} seconds',
                    'exit_code': -1,
                    'execution_time': self.timeout * 1000
                }
                
        except Exception as e:
            return {
                'success': False,
                'stdout': '',
                'stderr': f'Execution error: {str(e)}',
                'exit_code': -1,
                'execution_time': 0
            }
        finally:
            self.cleanup()
    
    def cleanup(self):
        """Clean up temporary files"""
        try:
            import shutil
            shutil.rmtree(self.temp_dir, ignore_errors=True)
        except:
            pass

def main():
    """Main execution entry point"""
    try:
        # Read input from stdin or environment
        input_data = sys.stdin.read() if not sys.stdin.isatty() else '{}'
        data = json.loads(input_data) if input_data.strip() else {}
        
        code = data.get('code', '')
        test_cases = data.get('test_cases', [])
        
        if not code:
            print(json.dumps({
                'success': False,
                'error': 'No code provided'
            }))
            return
        
        executor = CodeExecutor()
        result = executor.execute_code(code, test_cases)
        
        print(json.dumps(result))
        
    except Exception as e:
        print(json.dumps({
            'success': False,
            'error': f'Executor error: {str(e)}'
        }))

if __name__ == '__main__':
    main()
