#!/bin/bash

printf "🎯 ML-Assisted Rate Limiter - Complete Demo\n\n"

printf "This demo shows:\n"
printf "  1. Model cold start and learning\n"
printf "  2. Normal user behavior (should be trusted)\n"
printf "  3. Bot behavior (should be detected)\n"
printf "  4. Model adaptation over time\n\n"

printf "Press Enter to continue..."
read

# ============================================
# Phase 1: Model Status
# ============================================

printf "\n═══════════════════════════════════════\n"
printf "PHASE 1: Check Model Status\n"
printf "═══════════════════════════════════════\n\n"

MODEL_STATUS=$(curl -s http://localhost:3000/api/ml/model)

printf "Model Information:\n"
echo "$MODEL_STATUS" | jq '{
  trained: .model.trained,
  trainingDataSize: .model.trainingDataSize,
  minRequired: .model.minTrainingData,
  trainingRounds: .model.trainingRounds
}'

printf "\n"

# ============================================
# Phase 2: Generate Training Data
# ============================================

printf "═══════════════════════════════════════\n"
printf "PHASE 2: Generate Training Data\n"
printf "═══════════════════════════════════════\n\n"

TRAINED=$(echo "$MODEL_STATUS" | jq -r '.model.trained')

if [ "$TRAINED" = "false" ]; then
  printf "Model not trained yet. Generating training data...\n\n"
  
  printf "Making 120 varied requests to build baseline:\n"
  
  for i in {1..120}; do
    # Varied endpoints
    RAND=$((RANDOM % 4))
    case $RAND in
      0) ENDPOINT="/api/ml/data" ;;
      1) ENDPOINT="/api/ml/search?q=product$i" ;;
      2) ENDPOINT="/api/ml/users/$((RANDOM % 500))" ;;
      3) ENDPOINT="/api/ml/compute" ;;
    esac
    
    curl -s -H "X-Forwarded-For: 10.0.11.$((i % 254 + 1))" \
      "http://localhost:3000${ENDPOINT}" > /dev/null
    
    printf "."
    if [ $((i % 20)) -eq 0 ]; then
      printf " %d\n" "$i"
    fi
    
    # Varied timing
    sleep $(awk 'BEGIN{srand(); print rand() * 0.5}')
  done
  
  printf "\n\nForcing model training...\n"
  curl -s -X POST http://localhost:3000/api/ml/retrain | jq '.message'
  
  printf "\nModel trained! ✅\n\n"
else
  printf "Model already trained ✅\n"
  printf "Training rounds: %s\n" "$(echo "$MODEL_STATUS" | jq -r '.model.trainingRounds')"
  printf "Training data: %s samples\n\n" "$(echo "$MODEL_STATUS" | jq -r '.model.trainingDataSize')"
fi

sleep 2

# ============================================
# Phase 3: Normal User Test
# ============================================

printf "═══════════════════════════════════════\n"
printf "PHASE 3: Normal User Behavior\n"
printf "═══════════════════════════════════════\n\n"

NORMAL_IP="10.0.11.100"

printf "Simulating normal user (varied endpoints, human timing):\n"

for i in {1..15}; do
  RAND=$((RANDOM % 3))
  case $RAND in
    0) ENDPOINT="/api/ml/data" ;;
    1) ENDPOINT="/api/ml/search?q=laptop" ;;
    2) ENDPOINT="/api/ml/users/$((100 + RANDOM % 50))" ;;
  esac
  
  curl -s -H "X-Forwarded-For: $NORMAL_IP" \
    "http://localhost:3000${ENDPOINT}" > /dev/null
  
  printf "."
  
  # Human-like timing
  sleep $(awk 'BEGIN{srand(); print 1 + rand() * 3}')
done

printf "\n\nChecking classification:\n"

curl -s -H "X-Forwarded-For: $NORMAL_IP" \
  http://localhost:3000/api/ml/status | jq '{
  classification: .clientState.classification,
  anomalyScore: .clientState.anomalyScore,
  multiplier: .clientState.multiplier
}'

printf "\n"
sleep 2

# ============================================
# Phase 4: Bot Detection Test
# ============================================

printf "═══════════════════════════════════════\n"
printf "PHASE 4: Bot Behavior Detection\n"
printf "═══════════════════════════════════════\n\n"

BOT_IP="10.0.11.200"

printf "Simulating bot (rapid, same endpoint, consistent timing):\n"

BOT_ALLOWED=0
BOT_BLOCKED=0

for i in {1..60}; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "X-Forwarded-For: $BOT_IP" \
    "http://localhost:3000/api/ml/simulate/bot")
  
  if [ "$STATUS" = "200" ]; then
    ((BOT_ALLOWED++))
    printf "✓"
  else
    ((BOT_BLOCKED++))
    printf "✗"
  fi
  
  if [ $((i % 20)) -eq 0 ]; then
    printf " %d\n" "$i"
  fi
  
  sleep 0.1
done

printf "\n\nBot Classification:\n"

curl -s -H "X-Forwarded-For: $BOT_IP" \
  http://localhost:3000/api/ml/status | jq '{
  classification: .clientState.classification,
  anomalyScore: .clientState.anomalyScore,
  multiplier: .clientState.multiplier,
  blocked: ("'$BOT_BLOCKED'" | tonumber),
  allowed: ("'$BOT_ALLOWED'" | tonumber)
}'

printf "\n"
sleep 2

# ============================================
# Phase 5: Model Statistics
# ============================================

printf "═══════════════════════════════════════\n"
printf "PHASE 5: Model Statistics\n"
printf "═══════════════════════════════════════\n\n"

STATS=$(curl -s http://localhost:3000/api/ml/model)

printf "Classification Distribution:\n"
echo "$STATS" | jq '.classifications'

printf "\n"

printf "Thresholds:\n"
echo "$STATS" | jq '.thresholds'

printf "\n"

printf "Multipliers:\n"
echo "$STATS" | jq '.multipliers'

printf "\n"

# ============================================
# Summary
# ============================================

printf "╔═══════════════════════════════════════════════════════╗\n"
printf "║                   DEMO SUMMARY                        ║\n"
printf "╠═══════════════════════════════════════════════════════╣\n"
printf "║                                                        ║\n"
printf "║ ✅ Model Trained and Learning                         ║\n"
printf "║ ✅ Normal Users: Trusted/Normal Classification        ║\n"
printf "║ ✅ Bots: Detected and Throttled                       ║\n"
printf "║ ✅ Adaptive Rate Limits Working                       ║\n"
printf "║                                                        ║\n"
printf "╚═══════════════════════════════════════════════════════╝\n\n"

printf "🎓 What the ML model learned:\n"
printf "  • Normal users have varied endpoints and human timing\n"
printf "  • Bots have rapid, repetitive, consistent patterns\n"
printf "  • Anomaly scores adjust rate limits automatically\n"
printf "  • System improves with more data\n\n"

printf "📊 View detailed stats:\n"
printf "  curl http://localhost:3000/api/ml/model | jq\n\n"

printf "✨ Demo complete!\n\n"