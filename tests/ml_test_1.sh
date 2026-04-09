#!/bin/bash

printf "👤 ML Test: Normal User Behavior\n\n"

CLIENT_IP="10.0.10.1"

printf "Simulating normal user behavior:\n"
printf "  - Varied requests (search, browse, data)\n"
printf "  - Human-like timing (2-10 seconds between requests)\n"
printf "  - Diverse endpoints\n"
printf "  - High success rate\n\n"

printf "═══════════════════════════════════════\n"
printf "Phase 1: Initial Requests (Building Profile)\n"
printf "═══════════════════════════════════════\n\n"

# Simulate normal browsing
endpoints=(
  "/api/ml/data"
  "/api/ml/search?q=laptop"
  "/api/ml/users/123"
  "/api/ml/search?q=mouse"
  "/api/ml/data"
  "/api/ml/users/456"
  "/api/ml/search?q=keyboard"
  "/api/ml/data"
)

TOTAL_REQUESTS=0
ALLOWED_REQUESTS=0

printf "Making varied requests with human-like timing:\n"
for endpoint in "${endpoints[@]}"; do
  ((TOTAL_REQUESTS++))
  
  RESPONSE=$(curl -s -w "\n%{http_code}" \
    -H "X-Forwarded-For: $CLIENT_IP" \
    "http://localhost:3000${endpoint}")
  
  STATUS=$(echo "$RESPONSE" | tail -1)
  
  if [ "$STATUS" = "200" ]; then
    ((ALLOWED_REQUESTS++))
    printf "✓ %s\n" "$endpoint"
  else
    printf "✗ %s (blocked)\n" "$endpoint"
  fi
  
  # Human-like delay (2-10 seconds)
  sleep $(awk -v min=2 -v max=10 'BEGIN{srand(); print min+rand()*(max-min)}')
done

printf "\n"

printf "═══════════════════════════════════════\n"
printf "Phase 2: Check ML Classification\n"
printf "═══════════════════════════════════════\n\n"

STATUS=$(curl -s -H "X-Forwarded-For: $CLIENT_IP" \
  http://localhost:3000/api/ml/status)

printf "ML Classification:\n"
echo "$STATUS" | jq '{
  classification: .clientState.classification,
  anomalyScore: .clientState.anomalyScore,
  successRate: .clientState.successRate,
  multiplier: .clientState.multiplier,
  meaning: .explanation.meaning
}'

printf "\n"

printf "═══════════════════════════════════════\n"
printf "Phase 3: Continued Normal Usage\n"
printf "═══════════════════════════════════════\n\n"

printf "Making 10 more requests with normal patterns:\n"

for i in {1..10}; do
  ((TOTAL_REQUESTS++))
  
  # Random endpoint
  RAND=$((RANDOM % 3))
  case $RAND in
    0) ENDPOINT="/api/ml/data" ;;
    1) ENDPOINT="/api/ml/search?q=product$i" ;;
    2) ENDPOINT="/api/ml/users/$((100 + RANDOM % 100))" ;;
  esac
  
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "X-Forwarded-For: $CLIENT_IP" \
    "http://localhost:3000${ENDPOINT}")
  
  if [ "$STATUS" = "200" ]; then
    ((ALLOWED_REQUESTS++))
    printf "✓"
  else
    printf "✗"
  fi
  
  if [ $((i % 10)) -eq 0 ]; then
    printf " %d\n" "$i"
  fi
  
  # Human-like delay
  sleep $(awk -v min=2 -v max=8 'BEGIN{srand(); print min+rand()*(max-min)}')
done

printf "\n\n"

printf "═══════════════════════════════════════\n"
printf "Final Classification\n"
printf "═══════════════════════════════════════\n\n"

STATUS=$(curl -s -H "X-Forwarded-For: $CLIENT_IP" \
  http://localhost:3000/api/ml/status)

echo "$STATUS" | jq '{
  classification: .clientState.classification,
  anomalyScore: .clientState.anomalyScore,
  totalRequests: .clientState.totalRequests,
  successRate: .clientState.successRate,
  capacity: .clientState.capacity,
  multiplier: .clientState.multiplier
}'

printf "\n"

printf "╔═══════════════════════════════════════════════════════╗\n"
printf "║                   SUMMARY                             ║\n"
printf "╠═══════════════════════════════════════════════════════╣\n"
printf "║ Total Requests:  %3d                                 ║\n" "$TOTAL_REQUESTS"
printf "║ Allowed:         %3d                                 ║\n" "$ALLOWED_REQUESTS"
printf "║ Blocked:         %3d                                 ║\n" "$((TOTAL_REQUESTS - ALLOWED_REQUESTS))"
printf "╚═══════════════════════════════════════════════════════╝\n\n"

CLASSIFICATION=$(echo "$STATUS" | jq -r '.clientState.classification')

if [ "$CLASSIFICATION" = "TRUSTED" ] || [ "$CLASSIFICATION" = "NORMAL" ]; then
  printf "✅ SUCCESS! Normal user correctly classified as %s\n" "$CLASSIFICATION"
  printf "   ML model recognized legitimate behavior pattern.\n\n"
else
  printf "⚠️  User classified as %s\n" "$CLASSIFICATION"
  printf "   This might indicate the model needs more training data.\n\n"
fi