#!/bin/bash

printf "🤖 ML Test: Bot Behavior Detection\n\n"

CLIENT_IP="10.0.10.2"

printf "Simulating bot behavior:\n"
printf "  - Rapid requests (100ms intervals)\n"
printf "  - Same endpoint repeatedly\n"
printf "  - Perfect timing (no human variance)\n"
printf "  - No diversity\n\n"

printf "═══════════════════════════════════════\n"
printf "Phase 1: Rapid Fire Requests\n"
printf "═══════════════════════════════════════\n\n"

printf "Making 50 rapid requests to same endpoint:\n"

TOTAL_REQUESTS=0
ALLOWED_REQUESTS=0
BLOCKED_REQUESTS=0

for i in {1..50}; do
  ((TOTAL_REQUESTS++))
  
    # -H "X-Forwarded-For: $CLIENT_IP" \
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "X-Client-Id: bot-test" \
    "http://localhost:3000/api/ml/simulate/bot")
  
  if [ "$STATUS" = "200" ]; then
    ((ALLOWED_REQUESTS++))
    printf "✓"
  else
    ((BLOCKED_REQUESTS++))
    printf "✗"
  fi
  
  if [ $((i % 10)) -eq 0 ]; then
    printf " %d\n" "$i"
  fi
  
  # Bot-like delay (very consistent, fast)
  sleep 0.1
done

printf "\n\n"

printf "═══════════════════════════════════════\n"
printf "Phase 2: Check ML Classification\n"
printf "═══════════════════════════════════════\n\n"

# STATUS=$(curl -s -H "X-Forwarded-For: $CLIENT_IP" \
STATUS=$(curl -s -H "X-Client-Id: bot-test" \
  http://localhost:3000/api/ml/status)

printf "ML Classification:\n"
echo "$STATUS" | jq '{
  classification: .clientState.classification,
  anomalyScore: .clientState.anomalyScore,
  totalRequests: .clientState.totalRequests,
  multiplier: .clientState.multiplier,
  meaning: .explanation.meaning
}'

printf "\n"

printf "═══════════════════════════════════════\n"
printf "Phase 3: Continued Bot Activity\n"
printf "═══════════════════════════════════════\n\n"

printf "Making 30 more rapid requests:\n"

for i in {1..30}; do
  ((TOTAL_REQUESTS++))
  
    # -H "X-Forwarded-For: $CLIENT_IP" \
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "X-Client-Id: bot-test" \
    "http://localhost:3000/api/ml/simulate/bot")
  
  if [ "$STATUS" = "200" ]; then
    ((ALLOWED_REQUESTS++))
    printf "✓"
  else
    ((BLOCKED_REQUESTS++))
    printf "✗"
  fi
  
  if [ $((i % 10)) -eq 0 ]; then
    printf " %d\n" "$i"
  fi
  
  sleep 0.1
done

printf "\n\n"

printf "═══════════════════════════════════════\n"
printf "Final Bot Classification\n"
printf "═══════════════════════════════════════\n\n"

# STATUS=$(curl -s -H "X-Forwarded-For: $CLIENT_IP" \
STATUS=$(curl -s -H "X-Client-Id: bot-test" \
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
printf "║ Blocked:         %3d                                 ║\n" "$BLOCKED_REQUESTS"
printf "╚═══════════════════════════════════════════════════════╝\n\n"

CLASSIFICATION=$(echo "$STATUS" | jq -r '.clientState.classification')
ANOMALY=$(echo "$STATUS" | jq -r '.clientState.anomalyScore')

if [ "$CLASSIFICATION" = "SUSPICIOUS" ] || [ "$CLASSIFICATION" = "THREAT" ]; then
  printf "✅ SUCCESS! Bot correctly detected as %s\n" "$CLASSIFICATION"
  printf "   Anomaly Score: %s (high = bot-like)\n" "$ANOMALY"
  printf "   ML model successfully identified bot behavior!\n\n"
else
  printf "⚠️  Bot classified as %s (Anomaly: %s)\n" "$CLASSIFICATION" "$ANOMALY"
  printf "   Model may need more training data to detect this pattern.\n\n"
fi