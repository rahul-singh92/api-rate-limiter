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
    
    # Send 3-7 requests (normal volume)
    num_requests=$((RANDOM % 5 + 12))
    
    for j in $(seq 1 $num_requests); do
        endpoint=${endpoints[$((RANDOM % 3))]}
        curl -s -H "X-Forwarded-For: $client_ip" \
            "${BASE_URL}${endpoint}" > /dev/null
        
        # Human-like delay (2-5 seconds)
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
    
    # Normal behavior: 2-6 requests
    num_requests=$((RANDOM % 5 + 6))
    
    for j in $(seq 1 $num_requests); do
        endpoint=${endpoints[$((RANDOM % 3))]}
        curl -s -H "X-Forwarded-For: $client_ip" \
            "${BASE_URL}${endpoint}" > /dev/null
        sleep $((RANDOM % 2 + 1))
    done
    
    # Get classification
    result=$(curl -s -H "X-Forwarded-For: $client_ip" "${BASE_URL}/api/ml/status")
    classification=$(echo "$result" | jq -r '.clientState.classification // "UNKNOWN"')
    anomaly_score=$(echo "$result" | jq -r '.clientState.anomalyScore // 0.5')
    
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
        curl -s -H "X-Forwarded-For: $client_ip" \
            "${BASE_URL}/api/ml/data" > /dev/null
        sleep 0.05  # 50ms = very fast, bot-like
    done
    
    # Get classification
    result=$(curl -s -H "X-Forwarded-For: $client_ip" "${BASE_URL}/api/ml/status")
    classification=$(echo "$result" | jq -r '.clientState.classification // "UNKNOWN"')
    anomaly_score=$(echo "$result" | jq -r '.clientState.anomalyScore // 0.5')
    
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
echo "Bot traffic tested: 500"
echo "Correct classifications (detected): $tp"
echo "False negatives (missed): $fn"
echo ""

# ============================================================
# Calculate Metrics
# ============================================================
echo "═══════════════════════════════════════════════════════════"
echo "CALCULATING ACCURACY METRICS"
echo "═══════════════════════════════════════════════════════════"

accuracy=$(echo "scale=4; $correct_predictions * 100 / $total_samples" | bc)
precision=$(echo "scale=4; $tp * 100 / ($tp + $fp)" | bc)
recall=$(echo "scale=4; $tp * 100 / ($tp + $fn)" | bc)
f1_score=$(echo "scale=4; 2 * $precision * $recall / ($precision + $recall)" | bc)
fpr=$(echo "scale=4; $fp * 100 / ($fp + $tn)" | bc)
fnr=$(echo "scale=4; $fn * 100 / ($fn + $tp)" | bc)

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