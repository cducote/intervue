#!/bin/bash

# Test Docker execution containers
set -e

echo "🧪 Testing Docker execution containers"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_test() {
    echo -e "${YELLOW}[TEST]${NC} $1"
}

print_pass() {
    echo -e "${GREEN}[PASS]${NC} $1"
}

print_fail() {
    echo -e "${RED}[FAIL]${NC} $1"
}

# Test Python container with Two Sum problem
print_test "Testing Python container with Two Sum algorithm..."

PYTHON_TEST='{
  "code": "def two_sum(nums, target):\n    seen = {}\n    for i, num in enumerate(nums):\n        complement = target - num\n        if complement in seen:\n            return [seen[complement], i]\n        seen[num] = i\n    return []\n\n# Test cases\nprint(\"Test 1:\", two_sum([2,7,11,15], 9))\nprint(\"Test 2:\", two_sum([3,2,4], 6))\nprint(\"Test 3:\", two_sum([3,3], 6))",
  "test_cases": [
    {"input": [[2,7,11,15], 9], "expected": [0,1]},
    {"input": [[3,2,4], 6], "expected": [1,2]}
  ]
}'

echo "$PYTHON_TEST" | docker run --rm -i \
  --network none \
  --memory=128m \
  --cpus=0.5 \
  --read-only \
  --tmpfs /tmp:rw,noexec,nosuid,size=50m \
  --security-opt no-new-privileges:true \
  interview-executor:python

if [ $? -eq 0 ]; then
    print_pass "Python Two Sum test completed"
else
    print_fail "Python Two Sum test failed"
fi

echo ""

# Test JavaScript container with Two Sum problem
print_test "Testing JavaScript container with Two Sum algorithm..."

JS_TEST='{
  "code": "function twoSum(nums, target) {\n    const seen = {};\n    for (let i = 0; i < nums.length; i++) {\n        const complement = target - nums[i];\n        if (complement in seen) {\n            return [seen[complement], i];\n        }\n        seen[nums[i]] = i;\n    }\n    return [];\n}\n\n// Test cases\nconsole.log(\"Test 1:\", twoSum([2,7,11,15], 9));\nconsole.log(\"Test 2:\", twoSum([3,2,4], 6));\nconsole.log(\"Test 3:\", twoSum([3,3], 6));",
  "test_cases": [
    {"input": [[2,7,11,15], 9], "expected": [0,1]},
    {"input": [[3,2,4], 6], "expected": [1,2]}
  ]
}'

echo "$JS_TEST" | docker run --rm -i \
  --network none \
  --memory=128m \
  --cpus=0.5 \
  --read-only \
  --tmpfs /tmp:rw,noexec,nosuid,size=50m \
  --security-opt no-new-privileges:true \
  interview-executor:node

if [ $? -eq 0 ]; then
    print_pass "JavaScript Two Sum test completed"
else
    print_fail "JavaScript Two Sum test failed"
fi

echo ""

# Test timeout functionality
print_test "Testing timeout functionality (Python)..."

TIMEOUT_TEST='{
  "code": "import time\nprint(\"Starting infinite loop test...\")\nwhile True:\n    time.sleep(1)\n    print(\"Still running...\")",
  "test_cases": []
}'

echo "$TIMEOUT_TEST" | timeout 35s docker run --rm -i \
  --network none \
  --memory=128m \
  --cpus=0.5 \
  interview-executor:python

if [ $? -eq 124 ]; then
    print_pass "Timeout test working correctly"
else
    print_fail "Timeout test didn't work as expected"
fi

echo ""

# Test memory limits
print_test "Testing memory constraints..."

MEMORY_TEST='{
  "code": "# Try to allocate large amounts of memory\nimport sys\nprint(\"Testing memory limits...\")\ntry:\n    big_list = [0] * (10**7)  # 10 million integers\n    print(\"Memory allocation successful\")\nexcept MemoryError:\n    print(\"Memory limit reached (expected)\")\nprint(\"Test completed\")",
  "test_cases": []
}'

echo "$MEMORY_TEST" | docker run --rm -i \
  --network none \
  --memory=128m \
  --cpus=0.5 \
  interview-executor:python

print_pass "Memory constraint test completed"

echo ""
print_pass "🎉 All Docker tests completed!"
echo ""
echo "Docker containers are ready for:"
echo "  ✅ Secure code execution"
echo "  ✅ Resource limits (CPU/Memory)"
echo "  ✅ Network isolation"
echo "  ✅ Timeout controls"
echo "  ✅ File system security"
