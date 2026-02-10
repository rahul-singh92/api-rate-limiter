#!/bin/bash

echo "=========================================="
echo "  API Rate Limiter - Load Test Suite"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if server is running
echo -n "Checking if server is running... "
if curl -s http://localhost:3000/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗${NC}"
    echo "Please start the server first: npm run dev"
    exit 1
fi

echo ""
echo "Running tests..."
echo ""

# Test 1: Normal Traffic
echo -e "${YELLOW}Test 1: Normal Traffic Pattern${NC}"
echo "This simulates legitimate API usage"
node tests/load/normal-traffic-test.js
echo ""
echo "Press Enter to continue..."
read

# Test 2: Boundary Problem
echo -e "${YELLOW}Test 2: Fixed Window Boundary Problem${NC}"
echo "This demonstrates the boundary attack vulnerability"
node tests/load/boundary-problem-demo.js
echo ""

echo -e "${GREEN}All tests completed!${NC}"
