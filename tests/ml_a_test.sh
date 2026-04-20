#!/bin/bash

# ============================================================
# ML Model Accuracy Test - FIXED VERSION
# Trains on NORMAL traffic first, then tests
# ============================================================

echo "╔══════════════════════════════════════════════════════════╗"
echo "║      ML Model Accuracy Test (FIXED VERSION)             ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

BASE_URL="http://localhost:3000"
RESULTS_DIR="./test-results/ml-accuracy"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RESULTS_FILE="${RESULTS_DIR}/accuracy_${TIMESTAMP}.csv"

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

ml_curl() {
    local client_id="$1"
    local url="$2"
    curl -s -H "X-Client-Id: $client_id" "$url"
}

read_ml_status() {
    local client_id="$1"
    local response body http_status classification anomaly_score

    response=$(curl -s -w '\n%{http_code}' -H "X-Client-Id: $client_id" "${BASE_URL}/api/ml/status")
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
        echo "scale=4; $numerator * 100 / $denominator" | bc -l
    fi
}

safe_f1() {
    local precision="$1"
    local recall="$2"

    if [ "$(echo "$precision + $recall == 0" | bc -l)" -eq 1 ]; then
        echo "0"
    else
        echo "scale=4; 2 * $precision * $recall / ($precision + $recall)" | bc -l
    fi
}

echo "Test Configuration:"
echo "  Phase 1: Train on 75 normal users"
echo "  Phase 2: Test 75 normal users"
echo "  Phase 3: Test 75 bot traffic"
echo ""

# CSV Header
echo "sample_id,type,requests_sent,classification,anomaly_score,expected,correct" > "$RESULTS_FILE"

# Counters
total_samples=0
correct_predictions=0
tp=0  # True Positive
tn=0  # True Negative
fp=0  # False Positive
fn=0  # False Negative

# ============================================================
# Phase 1: TRAIN MODEL ON NORMAL TRAFFIC (CRITICAL!)
# ============================================================
echo "═══════════════════════════════════════════════════════════"
echo "PHASE 1: TRAINING ON NORMAL TRAFFIC"
echo "═══════════════════════════════════════════════════════════"
echo "Generating 75 normal user samples for training..."
echo ""

endpoints=("/api/ml/data" "/api/ml/search?q=product" "/api/ml/users/123")

for i in {1..75}; do
    # Simulate normal user with varied behavior
    client_ip="192.168.1.$((i % 254 + 1))"
    
    # Send 12-16 requests so the model sees a realistic "normal" profile
    num_requests=$((RANDOM % 5 + 12))
    
    for j in $(seq 1 $num_requests); do
        endpoint=${endpoints[$((RANDOM % 3))]}
        ml_curl "$client_ip" "${BASE_URL}${endpoint}" > /dev/null
        
        # Human-like delay (1-2 seconds)
        sleep $((RANDOM % 2 + 1))
    done
    
    if [ $((i % 50)) -eq 0 ]; then
        echo "  Training progress: $i/75"
    fi
done

echo ""
echo "✅ Training phase complete! Model should be trained now."
echo "Waiting 5 seconds for model to stabilize..."
sleep 5
echo ""

# ============================================================
# Phase 2: TEST NORMAL USERS
# ============================================================
echo "═══════════════════════════════════════════════════════════"
echo "PHASE 2: TESTING NORMAL USERS"
echo "═══════════════════════════════════════════════════════════"

for i in {1..75}; do
    ((total_samples++))
    
    # New clients for testing
    client_ip="10.10.10.$((i % 254 + 1))"
    
    # Normal behavior: short session, but enough to build an initial profile
    num_requests=$((RANDOM % 5 + 6))
    
    for j in $(seq 1 $num_requests); do
        endpoint=${endpoints[$((RANDOM % 3))]}
        ml_curl "$client_ip" "${BASE_URL}${endpoint}" > /dev/null
        sleep $((RANDOM % 2 + 1))
    done
    
    # Get classification from either the normal status payload or a rate-limit payload
    IFS='|' read -r http_status classification anomaly_score <<< "$(read_ml_status "$client_ip")"
    
    # Expected: NORMAL or TRUSTED
    if [ "$classification" = "NORMAL" ] || [ "$classification" = "TRUSTED" ]; then
        expected="NORMAL"
        correct="TRUE"
        ((correct_predictions++))
        ((tn++))
        echo -n "✓"
    else
        expected="NORMAL"
        correct="FALSE"
        ((fp++))
        echo -n "✗"
    fi
    
    echo "$i,normal,$num_requests,$classification,$anomaly_score,$expected,$correct" >> "$RESULTS_FILE"
    
    if [ $((i % 50)) -eq 0 ]; then
        echo " $i/75"
    fi
done

echo "Complete!"
echo "Normal users tested: 75"
echo "Correct classifications: $tn"
echo "False positives: $fp"
echo ""

# ============================================================
# Phase 3: TEST BOT TRAFFIC
# ============================================================
echo "═══════════════════════════════════════════════════════════"
echo "PHASE 3: TESTING BOT TRAFFIC"
echo "═══════════════════════════════════════════════════════════"

for i in {1..75}; do
    ((total_samples++))
    
    # Bot behavior
    client_ip="20.20.20.$((i % 254 + 1))"
    
    # Rapid requests to same endpoint (30-60 requests)
    num_requests=$((RANDOM % 31 + 30))
    
    for j in $(seq 1 $num_requests); do
        ml_curl "$client_ip" "${BASE_URL}/api/ml/data" > /dev/null
        sleep 0.05  # 50ms = very fast, bot-like
    done
    
    # Status can be 200 or 429; either way the classification is useful
    IFS='|' read -r http_status classification anomaly_score <<< "$(read_ml_status "$client_ip")"
    
    # Expected: SUSPICIOUS or THREAT
    if [ "$classification" = "SUSPICIOUS" ] || [ "$classification" = "THREAT" ]; then
        expected="ATTACK"
        correct="TRUE"
        ((correct_predictions++))
        ((tp++))
        echo -n "✓"
    else
        expected="ATTACK"
        correct="FALSE"
        ((fn++))
        echo -n "✗"
    fi
    
    echo "$((500 + i)),bot,$num_requests,$classification,$anomaly_score,$expected,$correct" >> "$RESULTS_FILE"
    
    if [ $((i % 50)) -eq 0 ]; then
        echo " $i/75"
    fi
done

echo " Complete!"
echo "Bot traffic tested: 75"
echo "Correct classifications (detected): $tp"
echo "False negatives (missed): $fn"
echo ""

# ============================================================
# Calculate Metrics
# ============================================================
echo "═══════════════════════════════════════════════════════════"
echo "CALCULATING ACCURACY METRICS"
echo "═══════════════════════════════════════════════════════════"

accuracy=$(safe_percent "$correct_predictions" "$total_samples")
precision=$(safe_percent "$tp" "$((tp + fp))")
recall=$(safe_percent "$tp" "$((tp + fn))")
f1_score=$(safe_f1 "$precision" "$recall")
fpr=$(safe_percent "$fp" "$((fp + tn))")
fnr=$(safe_percent "$fn" "$((fn + tp))")

# Generate report
cat > "${RESULTS_DIR}/confusion_matrix_${TIMESTAMP}.txt" << EOF
ML Model Accuracy Report (FIXED TEST)
======================================
Date: $(date)
Total Samples: $total_samples

Training:
---------
Phase 1: Trained on 75 normal users (clean data)

Testing:
--------
Phase 2: 75 normal users
Phase 3: 75 bot users

Confusion Matrix:
                 Predicted
               Normal  Attack
Actual Normal   $tn      $fp
       Attack   $fn      $tp

Metrics:
--------
Overall Accuracy:    ${accuracy}%
Precision:           ${precision}%
Recall:              ${recall}%
F1-Score:            ${f1_score}%
False Positive Rate: ${fpr}%
False Negative Rate: ${fnr}%

Breakdown:
----------
True Negatives (Normal correctly classified):  $tn / 75
False Positives (Normal wrongly flagged):      $fp / 75
True Positives (Attack correctly detected):    $tp / 75
False Negatives (Attack missed):               $fn / 75

Expected Results:
-----------------
✅ Accuracy > 85%:  GOOD (realistic for production)
✅ FPR < 15%:       Acceptable (some false alarms OK)
✅ FNR < 20%:       Good attack detection

Interpretation:
---------------
This test now trains on CLEAN normal traffic first,
then tests the model. Much more realistic than the
previous test that mixed training data!
EOF

cat "${RESULTS_DIR}/confusion_matrix_${TIMESTAMP}.txt"

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "✅ ML ACCURACY TEST COMPLETE"
echo "═══════════════════════════════════════════════════════════"
echo "Results saved to:"
echo "  📊 Raw Data: $RESULTS_FILE"
echo "  📄 Confusion Matrix: ${RESULTS_DIR}/confusion_matrix_${TIMESTAMP}.txt"
echo ""

if (( $(echo "$accuracy > 85" | bc -l) )); then
    echo "🎉 EXCELLENT! Accuracy > 85%"
    echo "   This is production-ready performance!"
elif (( $(echo "$accuracy > 75" | bc -l) )); then
    echo "✅ GOOD! Accuracy > 75%"
    echo "   Acceptable for most use cases"
else
    echo "⚠️  Needs improvement (Accuracy < 75%)"
    echo ""
    echo "Possible issues:"
    echo "1. Model not trained yet (need 200+ normal samples)"
    echo "2. recordRequest() not being called properly"
    echo "3. Server integration issues"
    echo ""
    echo "Debug: Check server logs for training messages"
    echo "Expected: '🎓 Training ML model on XXX CLEAN samples...'"
fi
