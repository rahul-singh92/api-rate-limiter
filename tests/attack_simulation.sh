#!/bin/bash

# ============================================================
# Real-World Attack Simulation Test
# Tests: DDoS, Bot, Enumeration, Normal Control Traffic
# ============================================================

echo "╔══════════════════════════════════════════════════════════╗"
echo "║         Real-World Attack Simulation Test               ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

BASE_URL="http://localhost:3000"
RESULTS_DIR="./test-results/attack-simulation"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

ML_DATA_ENDPOINT="${BASE_URL}/api/ml/data"
ML_BOT_ENDPOINT="${BASE_URL}/api/ml/simulate/bot"
ML_STATUS_ENDPOINT="${BASE_URL}/api/ml/status"
ML_RETRAIN_ENDPOINT="${BASE_URL}/api/ml/retrain"

mkdir -p "$RESULTS_DIR"

for cmd in curl jq bc; do
    if ! command -v "$cmd" > /dev/null 2>&1; then
        echo "Missing dependency: $cmd"
        exit 1
    fi
done

if ! curl -fsS "${BASE_URL}/health" > /dev/null 2>&1; then
    echo "Server is not reachable at ${BASE_URL}. Start it before running this test."
    exit 1
fi

ml_code() {
    local client_id="$1"
    local url="$2"
    curl -s -o /dev/null -w "%{http_code}" -H "X-Client-Id: $client_id" "$url"
}

ml_get() {
    local client_id="$1"
    local url="$2"
    curl -s -H "X-Client-Id: $client_id" "$url"
}

read_ml_status() {
    local client_id="$1"
    local response body http_status classification anomaly_score

    response=$(curl -s -w '\n%{http_code}' -H "X-Client-Id: $client_id" "$ML_STATUS_ENDPOINT")
    http_status=$(printf '%s\n' "$response" | tail -n 1)
    body=$(printf '%s\n' "$response" | sed '$d')

    classification=$(printf '%s' "$body" | jq -r '.clientState.classification // .ml.classification // "UNKNOWN"')
    anomaly_score=$(printf '%s' "$body" | jq -r '.clientState.anomalyScore // .ml.anomalyScore // 0.5')

    printf '%s|%s|%s\n' "$http_status" "$classification" "$anomaly_score"
}

safe_percent() {
    local numerator="$1"
    local denominator="$2"

    if [ "$denominator" -eq 0 ]; then
        echo "0"
    else
        echo "scale=2; $numerator * 100 / $denominator" | bc -l
    fi
}

warm_up_model() {
    if [ "${SKIP_ML_WARMUP:-0}" = "1" ]; then
        echo "Skipping ML warm-up because SKIP_ML_WARMUP=1"
        echo ""
        return
    fi

    echo "═══════════════════════════════════════════════════════════"
    echo "PREPARATION: WARMING UP ML MODEL"
    echo "═══════════════════════════════════════════════════════════"
    echo "Sending clean normal traffic so attack classifications are based on a stable baseline..."
    echo ""

    local endpoints
    local client_id
    local endpoint
    local num_requests
    endpoints=("${ML_DATA_ENDPOINT}" "${BASE_URL}/api/ml/search?q=product" "${BASE_URL}/api/ml/users/123")

    for client_index in {1..7}; do
        client_id="warmup-${client_index}"
        num_requests=$((RANDOM % 3 + 12))

        for j in $(seq 1 "$num_requests"); do
            endpoint=${endpoints[$((RANDOM % 3))]}
            ml_get "$client_id" "$endpoint" > /dev/null
            sleep $((RANDOM % 2 + 1))
        done

        if [ $((client_index % 2)) -eq 0 ]; then
            echo "  Warm-up progress: $client_index/7 clients"
        fi
    done

    echo ""
    retrain_response=$(curl -s -X POST -H "X-Client-Id: warmup-admin" "$ML_RETRAIN_ENDPOINT")
    retrain_message=$(printf '%s' "$retrain_response" | jq -r '.message // .error // "Retrain response unavailable"')
    retrain_rounds=$(printf '%s' "$retrain_response" | jq -r '.trainingRounds // "n/a"')

    echo "Warm-up retrain result: $retrain_message"
    echo "Training rounds: $retrain_rounds"
    echo ""
}

warm_up_model

# ============================================================
# Attack 1: DDoS Simulation
# ============================================================
echo "═══════════════════════════════════════════════════════════"
echo "ATTACK 1: DDoS SIMULATION"
echo "═══════════════════════════════════════════════════════════"
echo "Simulating: 1000 requests/minute from a single client"
echo ""

DDOS_CLIENT_ID="attack-ddos"
DDOS_LOG="${RESULTS_DIR}/ddos_attack_${TIMESTAMP}.log"

echo "Starting DDoS attack..." | tee "$DDOS_LOG"
start_time=$(date +%s)
ddos_successful=0
ddos_blocked=0

for i in {1..1000}; do
    response=$(ml_code "$DDOS_CLIENT_ID" "$ML_DATA_ENDPOINT")

    if [ "$response" = "200" ]; then
        ((ddos_successful++))
        echo -n "✓"
    elif [ "$response" = "429" ]; then
        ((ddos_blocked++))
        echo -n "✗"
    fi

    if [ $((i % 50)) -eq 0 ]; then
        echo " $i"
    fi

    sleep 0.06
done

end_time=$(date +%s)
ddos_duration=$((end_time - start_time))
ddos_block_rate=$(safe_percent "$ddos_blocked" 1000)
IFS='|' read -r ddos_status_http ddos_classification ddos_anomaly_score <<< "$(read_ml_status "$DDOS_CLIENT_ID")"

echo "" | tee -a "$DDOS_LOG"
echo "DDoS Attack Results:" | tee -a "$DDOS_LOG"
echo "  Duration: ${ddos_duration}s" | tee -a "$DDOS_LOG"
echo "  Total Requests: 1000" | tee -a "$DDOS_LOG"
echo "  Successful: $ddos_successful" | tee -a "$DDOS_LOG"
echo "  Blocked (429): $ddos_blocked" | tee -a "$DDOS_LOG"
echo "  Block Rate: ${ddos_block_rate}%" | tee -a "$DDOS_LOG"
echo "  Status Response: $ddos_status_http" | tee -a "$DDOS_LOG"
echo "  ML Classification: $ddos_classification" | tee -a "$DDOS_LOG"
echo "  Anomaly Score: $ddos_anomaly_score" | tee -a "$DDOS_LOG"
echo ""

# ============================================================
# Attack 2: Bot/Scraper Simulation
# ============================================================
echo "═══════════════════════════════════════════════════════════"
echo "ATTACK 2: BOT/SCRAPER SIMULATION"
echo "═══════════════════════════════════════════════════════════"
echo "Simulating: Rapid repeated hits to the bot endpoint"
echo ""

BOT_CLIENT_ID="attack-bot"
BOT_LOG="${RESULTS_DIR}/bot_attack_${TIMESTAMP}.log"

sleep 5

echo "Starting Bot attack..." | tee "$BOT_LOG"
start_time=$(date +%s)
bot_successful=0
bot_blocked=0

for i in {1..200}; do
    response=$(ml_code "$BOT_CLIENT_ID" "$ML_BOT_ENDPOINT")

    if [ "$response" = "200" ]; then
        ((bot_successful++))
        echo -n "✓"
    elif [ "$response" = "429" ]; then
        ((bot_blocked++))
        echo -n "✗"
    fi

    if [ $((i % 20)) -eq 0 ]; then
        echo " $i"
    fi

    sleep 0.1
done

end_time=$(date +%s)
bot_duration=$((end_time - start_time))
bot_block_rate=$(safe_percent "$bot_blocked" 200)
IFS='|' read -r bot_status_http bot_classification bot_anomaly_score <<< "$(read_ml_status "$BOT_CLIENT_ID")"

echo "" | tee -a "$BOT_LOG"
echo "Bot Attack Results:" | tee -a "$BOT_LOG"
echo "  Duration: ${bot_duration}s" | tee -a "$BOT_LOG"
echo "  Total Requests: 200" | tee -a "$BOT_LOG"
echo "  Successful: $bot_successful" | tee -a "$BOT_LOG"
echo "  Blocked (429): $bot_blocked" | tee -a "$BOT_LOG"
echo "  Block Rate: ${bot_block_rate}%" | tee -a "$BOT_LOG"
echo "  Status Response: $bot_status_http" | tee -a "$BOT_LOG"
echo "  ML Classification: $bot_classification" | tee -a "$BOT_LOG"
echo "  Anomaly Score: $bot_anomaly_score" | tee -a "$BOT_LOG"
echo ""

# ============================================================
# Attack 3: API Enumeration
# ============================================================
echo "═══════════════════════════════════════════════════════════"
echo "ATTACK 3: API ENUMERATION"
echo "═══════════════════════════════════════════════════════════"
echo "Simulating: Sequential probing of non-existent user IDs"
echo ""

ENUM_CLIENT_ID="attack-enumeration"
ENUM_LOG="${RESULTS_DIR}/enumeration_attack_${TIMESTAMP}.log"

sleep 5

echo "Starting Enumeration attack..." | tee "$ENUM_LOG"
start_time=$(date +%s)
enum_successful=0
enum_blocked=0

for i in {1001..1150}; do
    response=$(ml_code "$ENUM_CLIENT_ID" "${BASE_URL}/api/ml/users/$i")

    if [ "$response" = "200" ] || [ "$response" = "404" ]; then
        ((enum_successful++))
        echo -n "."
    elif [ "$response" = "429" ]; then
        ((enum_blocked++))
        echo -n "✗"
    fi

    progress=$((i - 1000))
    if [ $((progress % 20)) -eq 0 ]; then
        echo " $progress"
    fi

    sleep 0.2
done

end_time=$(date +%s)
enum_duration=$((end_time - start_time))
enum_block_rate=$(safe_percent "$enum_blocked" 150)
IFS='|' read -r enum_status_http enum_classification enum_anomaly_score <<< "$(read_ml_status "$ENUM_CLIENT_ID")"

echo "" | tee -a "$ENUM_LOG"
echo "Enumeration Attack Results:" | tee -a "$ENUM_LOG"
echo "  Duration: ${enum_duration}s" | tee -a "$ENUM_LOG"
echo "  Total Requests: 150" | tee -a "$ENUM_LOG"
echo "  Successful: $enum_successful" | tee -a "$ENUM_LOG"
echo "  Blocked (429): $enum_blocked" | tee -a "$ENUM_LOG"
echo "  Block Rate: ${enum_block_rate}%" | tee -a "$ENUM_LOG"
echo "  Status Response: $enum_status_http" | tee -a "$ENUM_LOG"
echo "  ML Classification: $enum_classification" | tee -a "$ENUM_LOG"
echo "  Anomaly Score: $enum_anomaly_score" | tee -a "$ENUM_LOG"
echo ""

# ============================================================
# Normal User (Control Group)
# ============================================================
echo "═══════════════════════════════════════════════════════════"
echo "CONTROL: NORMAL USER BEHAVIOR"
echo "═══════════════════════════════════════════════════════════"
echo "Simulating: Legitimate user traffic across varied endpoints"
echo ""

NORMAL_CLIENT_ID="control-normal"
NORMAL_LOG="${RESULTS_DIR}/normal_user_${TIMESTAMP}.log"

sleep 5

echo "Starting Normal user simulation..." | tee "$NORMAL_LOG"
start_time=$(date +%s)
normal_successful=0
normal_blocked=0
normal_endpoints=("${ML_DATA_ENDPOINT}" "${BASE_URL}/api/ml/search?q=test" "${BASE_URL}/api/ml/users/123")

for i in {1..30}; do
    endpoint=${normal_endpoints[$((RANDOM % 3))]}
    response=$(ml_code "$NORMAL_CLIENT_ID" "$endpoint")

    if [ "$response" = "200" ]; then
        ((normal_successful++))
        echo -n "✓"
    elif [ "$response" = "429" ]; then
        ((normal_blocked++))
        echo -n "✗"
    fi

    if [ $((i % 10)) -eq 0 ]; then
        echo " $i"
    fi

    sleep $((2 + RANDOM % 6))
done

end_time=$(date +%s)
normal_duration=$((end_time - start_time))
normal_block_rate=$(safe_percent "$normal_blocked" 30)
IFS='|' read -r normal_status_http normal_classification normal_anomaly_score <<< "$(read_ml_status "$NORMAL_CLIENT_ID")"

echo "" | tee -a "$NORMAL_LOG"
echo "Normal User Results:" | tee -a "$NORMAL_LOG"
echo "  Duration: ${normal_duration}s" | tee -a "$NORMAL_LOG"
echo "  Total Requests: 30" | tee -a "$NORMAL_LOG"
echo "  Successful: $normal_successful" | tee -a "$NORMAL_LOG"
echo "  Blocked (429): $normal_blocked" | tee -a "$NORMAL_LOG"
echo "  Block Rate: ${normal_block_rate}%" | tee -a "$NORMAL_LOG"
echo "  Status Response: $normal_status_http" | tee -a "$NORMAL_LOG"
echo "  ML Classification: $normal_classification" | tee -a "$NORMAL_LOG"
echo "  Anomaly Score: $normal_anomaly_score" | tee -a "$NORMAL_LOG"
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
Attack Type         | Requests | Blocked | Block%  | ML Classification | Anomaly Score
--------------------|----------|---------|---------|-------------------|---------------
DDoS                | 1000     | $ddos_blocked     | ${ddos_block_rate}% | $ddos_classification | $ddos_anomaly_score
Bot/Scraper         | 200      | $bot_blocked      | ${bot_block_rate}% | $bot_classification | $bot_anomaly_score
API Enumeration     | 150      | $enum_blocked      | ${enum_block_rate}% | $enum_classification | $enum_anomaly_score
Normal User         | 30       | $normal_blocked       | ${normal_block_rate}%  | $normal_classification | $normal_anomaly_score

Notes:
- Status is read from /api/ml/status using the same X-Client-Id as the simulated traffic.
- If the status request itself is rate-limited, the script still reads classification from the 429 response body.
- Enumeration now probes non-existent IDs (1001-1150) so the model sees the suspicious error-heavy pattern.

Expected Behavior:
- DDoS: Should be classified as THREAT or strong SUSPICIOUS
- Bot: Should be classified as SUSPICIOUS/THREAT
- Enumeration: Should be classified as SUSPICIOUS/THREAT
- Normal: Should be classified as NORMAL/TRUSTED

All logs saved in: $RESULTS_DIR
EOF

cat "${RESULTS_DIR}/summary_${TIMESTAMP}.txt"

echo ""
echo "✅ Attack simulation complete!"
echo "Results saved in: $RESULTS_DIR"
