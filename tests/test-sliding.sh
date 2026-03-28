#!/bin/bash

echo "🧪 TEST 2: Header Evolution (20 requests)"
echo "Watch how remaining requests decrease"
echo ""

# Add small delay between requests to avoid race conditions
for i in {1..20}; do
  # Use GET instead of HEAD, and add small delay
  RESPONSE=$(curl -s -i http://localhost:3000/api/counter/data)
  
  REMAINING=$(echo "$RESPONSE" | grep -i "x-ratelimit-remaining" | cut -d' ' -f2 | tr -d '\r')
  LIMIT=$(echo "$RESPONSE" | grep -i "x-ratelimit-limit" | cut -d' ' -f2 | tr -d '\r')
  STATUS=$(echo "$RESPONSE" | grep -i "^HTTP" | awk '{print $2}')
  
  printf "Request %2d: Status=%s, Remaining=%3s / %s\n" "$i" "$STATUS" "$REMAINING" "$LIMIT"
  
  # Small delay to avoid race conditions (50ms)
  sleep 0.05
done

echo ""
echo "✓ Test complete"
echo ""