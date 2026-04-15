#!/bin/bash

# ============================================================
# Real-World Attack Simulation Test
# Tests: DDoS, Bot, Scraper, Credential Stuffing
# ============================================================

echo "╔══════════════════════════════════════════════════════════╗"
echo "║         Real-World Attack Simulation Test               ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

BASE_URL="http://localhost:3000"
RESULTS_DIR="./test-results/attack-simulation"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

mkdir -p "$RESULTS_DIR"

# ============================================================
# Attack 1: DDoS Simulation
# ============================================================
echo "═══════════════════════════════════════════════════════════"
echo "ATTACK 1: DDoS SIMULATION"
echo "═══════════════════════════════════════════════════════════"
echo "Simulating: 1000 requests/minute from single IP"
echo ""

ATTACK_LOG="${RESULTS_DIR}/ddos_attack_${TIMESTAMP}.log"
ML_ENDPOINT="${BASE_URL}/api/ml/data"

echo "Starting DDoS attack..." | tee "$ATTACK_LOG"
start_time=$(date +%s)
successful=0
blocked=0

for i in {1..1000}; do
    response=$(curl -s -o /dev/null -w "%{http_code}" "$ML_ENDPOINT" 2>&1)
    
    if [ "$response" = "200" ]; then
        ((successful++))
        echo -n "✓"
    elif [ "$response" = "429" ]; then
        ((blocked++))
        echo -n "✗"
    fi
    
    if [ $((i % 50)) -eq 0 ]; then
        echo " $i"
    fi
    
    sleep 0.06  # ~1000 req/min
done

end_time=$(date +%s)
duration=$((end_time - start_time))

echo "" | tee -a "$ATTACK_LOG"
echo "DDoS Attack Results:" | tee -a "$ATTACK_LOG"
echo "  Duration: ${duration}s" | tee -a "$ATTACK_LOG"
echo "  Total Requests: 1000" | tee -a "$ATTACK_LOG"
echo "  Successful: $successful" | tee -a "$ATTACK_LOG"
echo "  Blocked (429): $blocked" | tee -a "$ATTACK_LOG"
echo "  Block Rate: $(echo "scale=2; $blocked * 100 / 1000" | bc)%" | tee -a "$ATTACK_LOG"

# Check ML classification
classification=$(curl -s "${BASE_URL}/api/ml/status" | jq -r '.clientState.classification')
anomaly_score=$(curl -s "${BASE_URL}/api/ml/status" | jq -r '.clientState.anomalyScore')

echo "  ML Classification: $classification" | tee -a "$ATTACK_LOG"
echo "  Anomaly Score: $anomaly_score" | tee -a "$ATTACK_LOG"
echo ""

# ============================================================
# Attack 2: Bot/Scraper Simulation
# ============================================================
echo "═══════════════════════════════════════════════════════════"
echo "ATTACK 2: BOT/SCRAPER SIMULATION"
echo "═══════════════════════════════════════════════════════════"
echo "Simulating: Rapid requests to same endpoint"
echo ""

ATTACK_LOG="${RESULTS_DIR}/bot_attack_${TIMESTAMP}.log"

# Use different IP (simulate different client)
sleep 5  # Cool down

echo "Starting Bot attack..." | tee "$ATTACK_LOG"
start_time=$(date +%s)
successful=0
blocked=0

for i in {1..200}; do
    response=$(curl -s -o /dev/null -w "%{http_code}" \
        -H "X-Forwarded-For: 10.0.0.2" \
        "${ML_ENDPOINT}" 2>&1)
    
    if [ "$response" = "200" ]; then
        ((successful++))
        echo -n "✓"
    elif [ "$response" = "429" ]; then
        ((blocked++))
        echo -n "✗"
    fi
    
    if [ $((i % 20)) -eq 0 ]; then
        echo " $i"
    fi
    
    sleep 0.1  # Very fast, bot-like
done

end_time=$(date +%s)
duration=$((end_time - start_time))

echo "" | tee -a "$ATTACK_LOG"
echo "Bot Attack Results:" | tee -a "$ATTACK_LOG"
echo "  Duration: ${duration}s" | tee -a "$ATTACK_LOG"
echo "  Total Requests: 200" | tee -a "$ATTACK_LOG"
echo "  Successful: $successful" | tee -a "$ATTACK_LOG"
echo "  Blocked (429): $blocked" | tee -a "$ATTACK_LOG"
echo "  Block Rate: $(echo "scale=2; $blocked * 100 / 200" | bc)%" | tee -a "$ATTACK_LOG"

classification=$(curl -s -H "X-Forwarded-For: 10.0.0.2" "${BASE_URL}/api/ml/status" | jq -r '.clientState.classification')
anomaly_score=$(curl -s -H "X-Forwarded-For: 10.0.0.2" "${BASE_URL}/api/ml/status" | jq -r '.clientState.anomalyScore')

echo "  ML Classification: $classification" | tee -a "$ATTACK_LOG"
echo "  Anomaly Score: $anomaly_score" | tee -a "$ATTACK_LOG"
echo ""

# ============================================================
# Attack 3: API Enumeration
# ============================================================
echo "═══════════════════════════════════════════════════════════"
echo "ATTACK 3: API ENUMERATION"
echo "═══════════════════════════════════════════════════════════"
echo "Simulating: Sequential ID enumeration"
echo ""

ATTACK_LOG="${RESULTS_DIR}/enumeration_attack_${TIMESTAMP}.log"

sleep 5  # Cool down

echo "Starting Enumeration attack..." | tee "$ATTACK_LOG"
start_time=$(date +%s)
successful=0
blocked=0

for i in {1..150}; do
    response=$(curl -s -o /dev/null -w "%{http_code}" \
        -H "X-Forwarded-For: 10.0.0.3" \
        "${BASE_URL}/api/ml/users/$i" 2>&1)
    
    if [ "$response" = "200" ] || [ "$response" = "404" ]; then
        ((successful++))
        echo -n "."
    elif [ "$response" = "429" ]; then
        ((blocked++))
        echo -n "✗"
    fi
    
    if [ $((i % 20)) -eq 0 ]; then
        echo " $i"
    fi
    
    sleep 0.2  # Sequential, consistent timing
done

end_time=$(date +%s)
duration=$((end_time - start_time))

echo "" | tee -a "$ATTACK_LOG"
echo "Enumeration Attack Results:" | tee -a "$ATTACK_LOG"
echo "  Duration: ${duration}s" | tee -a "$ATTACK_LOG"
echo "  Total Requests: 150" | tee -a "$ATTACK_LOG"
echo "  Successful: $successful" | tee -a "$ATTACK_LOG"
echo "  Blocked (429): $blocked" | tee -a "$ATTACK_LOG"
echo "  Block Rate: $(echo "scale=2; $blocked * 100 / 150" | bc)%" | tee -a "$ATTACK_LOG"

classification=$(curl -s -H "X-Forwarded-For: 10.0.0.3" "${BASE_URL}/api/ml/status" | jq -r '.clientState.classification')
anomaly_score=$(curl -s -H "X-Forwarded-For: 10.0.0.3" "${BASE_URL}/api/ml/status" | jq -r '.clientState.anomalyScore')

echo "  ML Classification: $classification" | tee -a "$ATTACK_LOG"
echo "  Anomaly Score: $anomaly_score" | tee -a "$ATTACK_LOG"
echo ""

# ============================================================
# Normal User (Control Group)
# ============================================================
echo "═══════════════════════════════════════════════════════════"
echo "CONTROL: NORMAL USER BEHAVIOR"
echo "═══════════════════════════════════════════════════════════"
echo "Simulating: Legitimate user traffic"
echo ""

ATTACK_LOG="${RESULTS_DIR}/normal_user_${TIMESTAMP}.log"

sleep 5  # Cool down

echo "Starting Normal user simulation..." | tee "$ATTACK_LOG"
start_time=$(date +%s)
successful=0
blocked=0

# Varied endpoints
endpoints=("${BASE_URL}/api/ml/data" "${BASE_URL}/api/ml/search?q=test" "${BASE_URL}/api/ml/users/123")

for i in {1..30}; do
    # Random endpoint
    endpoint=${endpoints[$((RANDOM % 3))]}
    
    response=$(curl -s -o /dev/null -w "%{http_code}" \
        -H "X-Forwarded-For: 10.0.0.4" \
        "$endpoint" 2>&1)
    
    if [ "$response" = "200" ]; then
        ((successful++))
        echo -n "✓"
    elif [ "$response" = "429" ]; then
        ((blocked++))
        echo -n "✗"
    fi
    
    if [ $((i % 10)) -eq 0 ]; then
        echo " $i"
    fi
    
    # Human-like delay (2-8 seconds)
    sleep $((2 + RANDOM % 6))
done

end_time=$(date +%s)
duration=$((end_time - start_time))

echo "" | tee -a "$ATTACK_LOG"
echo "Normal User Results:" | tee -a "$ATTACK_LOG"
echo "  Duration: ${duration}s" | tee -a "$ATTACK_LOG"
echo "  Total Requests: 30" | tee -a "$ATTACK_LOG"
echo "  Successful: $successful" | tee -a "$ATTACK_LOG"
echo "  Blocked (429): $blocked" | tee -a "$ATTACK_LOG"
echo "  Block Rate: $(echo "scale=2; $blocked * 100 / 30" | bc)%" | tee -a "$ATTACK_LOG"

classification=$(curl -s -H "X-Forwarded-For: 10.0.0.4" "${BASE_URL}/api/ml/status" | jq -r '.clientState.classification')
anomaly_score=$(curl -s -H "X-Forwarded-For: 10.0.0.4" "${BASE_URL}/api/ml/status" | jq -r '.clientState.anomalyScore')

echo "  ML Classification: $classification" | tee -a "$ATTACK_LOG"
echo "  Anomaly Score: $anomaly_score" | tee -a "$ATTACK_LOG"
echo ""

# ============================================================
# Summary Report
# ============================================================
echo "═══════════════════════════════════════════════════════════"
echo "ATTACK SIMULATION SUMMARY"
echo "═══════════════════════════════════════════════════════════"

cat > "${RESULTS_DIR}/summary_${TIMESTAMP}.txt" << EOF
Attack Simulation Summary
=========================
Date: $(date)

Attack Results:
---------------
Attack Type         | Requests | Blocked | Block% | ML Classification | Anomaly Score
--------------------|----------|---------|--------|-------------------|---------------
DDoS                | 1000     | $(cat ${RESULTS_DIR}/ddos_attack_${TIMESTAMP}.log | grep "Blocked" | awk '{print $2}') | $(cat ${RESULTS_DIR}/ddos_attack_${TIMESTAMP}.log | grep "Block Rate" | awk '{print $3}') | $(cat ${RESULTS_DIR}/ddos_attack_${TIMESTAMP}.log | grep "ML Classification" | awk '{print $3}') | $(cat ${RESULTS_DIR}/ddos_attack_${TIMESTAMP}.log | grep "Anomaly Score" | awk '{print $3}')
Bot/Scraper         | 200      | $(cat ${RESULTS_DIR}/bot_attack_${TIMESTAMP}.log | grep "Blocked" | awk '{print $2}') | $(cat ${RESULTS_DIR}/bot_attack_${TIMESTAMP}.log | grep "Block Rate" | awk '{print $3}') | $(cat ${RESULTS_DIR}/bot_attack_${TIMESTAMP}.log | grep "ML Classification" | awk '{print $3}') | $(cat ${RESULTS_DIR}/bot_attack_${TIMESTAMP}.log | grep "Anomaly Score" | awk '{print $3}')
API Enumeration     | 150      | $(cat ${RESULTS_DIR}/enumeration_attack_${TIMESTAMP}.log | grep "Blocked" | awk '{print $2}') | $(cat ${RESULTS_DIR}/enumeration_attack_${TIMESTAMP}.log | grep "Block Rate" | awk '{print $3}') | $(cat ${RESULTS_DIR}/enumeration_attack_${TIMESTAMP}.log | grep "ML Classification" | awk '{print $3}') | $(cat ${RESULTS_DIR}/enumeration_attack_${TIMESTAMP}.log | grep "Anomaly Score" | awk '{print $3}')
Normal User         | 30       | $(cat ${RESULTS_DIR}/normal_user_${TIMESTAMP}.log | grep "Blocked" | awk '{print $2}') | $(cat ${RESULTS_DIR}/normal_user_${TIMESTAMP}.log | grep "Block Rate" | awk '{print $3}') | $(cat ${RESULTS_DIR}/normal_user_${TIMESTAMP}.log | grep "ML Classification" | awk '{print $3}') | $(cat ${RESULTS_DIR}/normal_user_${TIMESTAMP}.log | grep "Anomaly Score" | awk '{print $3}')

Expected Behavior:
- DDoS: Should be classified as THREAT (score > 0.75)
- Bot: Should be classified as SUSPICIOUS/THREAT (score > 0.55)
- Enumeration: Should be classified as SUSPICIOUS (score > 0.55)
- Normal: Should be classified as NORMAL/TRUSTED (score < 0.55)

All logs saved in: $RESULTS_DIR
EOF

cat "${RESULTS_DIR}/summary_${TIMESTAMP}.txt"

echo ""
echo "✅ Attack simulation complete!"
echo "Results saved in: $RESULTS_DIR"