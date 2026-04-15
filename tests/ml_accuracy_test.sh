#!/bin/bash

# ============================================================
# ML Model Accuracy Measurement
# Generates confusion matrix and accuracy metrics
# ============================================================

echo "╔══════════════════════════════════════════════════════════╗"
echo "║         ML Model Accuracy Measurement Test              ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

BASE_URL="http://localhost:3000"
RESULTS_DIR="./test-results/ml-accuracy"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RESULTS_FILE="${RESULTS_DIR}/accuracy_${TIMESTAMP}.csv"

mkdir -p "$RESULTS_DIR"

echo "Test Configuration:"
echo "  Normal Users: 500 samples"
echo "  Bot Traffic: 500 samples"
echo "  Total Samples: 1000"
echo ""

# CSV Header
echo "sample_id,type,requests_sent,classification,anomaly_score,expected,correct" > "$RESULTS_FILE"

# Counters
total_samples=0
correct_predictions=0
tp=0  # True Positive (attack detected)
tn=0  # True Negative (normal allowed)
fp=0  # False Positive (normal blocked)
fn=0  # False Negative (attack allowed)

# ============================================================
# Phase 1: Train the model with mixed traffic
# ============================================================
echo "═══════════════════════════════════════════════════════════"
echo "PHASE 1: MODEL TRAINING"
echo "═══════════════════════════════════════════════════════════"
echo "Generating training data (300 requests)..."

for i in {1..300}; do
    # Mix of normal and attack traffic
    if [ $((i % 3)) -eq 0 ]; then
        # Normal traffic
        curl -s -H "X-Forwarded-For: 192.168.1.$((RANDOM % 254 + 1))" \
            "${BASE_URL}/api/ml/data" > /dev/null
        sleep $((RANDOM % 5 + 1))
    else
        # Attack traffic
        curl -s -H "X-Forwarded-For: 10.0.1.$((RANDOM % 254 + 1))" \
            "${BASE_URL}/api/ml/simulate/bot" > /dev/null
        sleep 0.1
    fi
    
    if [ $((i % 30)) -eq 0 ]; then
        echo "  Training progress: $i/300"
    fi
done

echo "Training complete! Model ready for testing."
echo ""

# ============================================================
# Phase 2: Test Normal Users (500 samples)
# ============================================================
echo "═══════════════════════════════════════════════════════════"
echo "PHASE 2: TESTING NORMAL USERS"
echo "═══════════════════════════════════════════════════════════"

endpoints=("/api/ml/data" "/api/ml/search?q=product" "/api/ml/users/123")

for i in {1..500}; do
    ((total_samples++))
    
    # Simulate normal user
    client_ip="192.168.100.$((i % 254 + 1))"
    endpoint=${endpoints[$((RANDOM % 3))]}
    
    # Make varied requests (human-like)
    num_requests=$((RANDOM % 5 + 1))  # 1-5 requests
    
    for j in $(seq 1 $num_requests); do
        curl -s -H "X-Forwarded-For: $client_ip" \
            "${BASE_URL}${endpoint}" > /dev/null
        sleep $((RANDOM % 3 + 2))  # 2-5 seconds (human-like)
    done
    
    # Get classification
    result=$(curl -s -H "X-Forwarded-For: $client_ip" "${BASE_URL}/api/ml/status")
    classification=$(echo "$result" | jq -r '.clientState.classification // "UNKNOWN"')
    anomaly_score=$(echo "$result" | jq -r '.clientState.anomalyScore // 0')
    
    # Expected: NORMAL or TRUSTED
    if [ "$classification" = "NORMAL" ] || [ "$classification" = "TRUSTED" ]; then
        expected="NORMAL"
        correct="TRUE"
        ((correct_predictions++))
        ((tn++))  # True Negative
        echo -n "✓"
    else
        expected="NORMAL"
        correct="FALSE"
        ((fp++))  # False Positive
        echo -n "✗"
    fi
    
    echo "$i,normal,$num_requests,$classification,$anomaly_score,$expected,$correct" >> "$RESULTS_FILE"
    
    if [ $((i % 50)) -eq 0 ]; then
        echo " $i/500"
    fi
done

echo " Complete!"
echo "Normal users tested: 500"
echo "Correct classifications: $tn"
echo "False positives: $fp"
echo ""

# ============================================================
# Phase 3: Test Bot Traffic (500 samples)
# ============================================================
echo "═══════════════════════════════════════════════════════════"
echo "PHASE 3: TESTING BOT TRAFFIC"
echo "═══════════════════════════════════════════════════════════"

for i in {1..500}; do
    ((total_samples++))
    
    # Simulate bot
    client_ip="10.0.200.$((i % 254 + 1))"
    
    # Make rapid requests to same endpoint (bot-like)
    num_requests=$((RANDOM % 30 + 20))  # 20-50 rapid requests
    
    for j in $(seq 1 $num_requests); do
        curl -s -H "X-Forwarded-For: $client_ip" \
            "${BASE_URL}/api/ml/simulate/bot" > /dev/null
        sleep 0.1  # Very fast (bot-like)
    done
    
    # Get classification
    result=$(curl -s -H "X-Forwarded-For: $client_ip" "${BASE_URL}/api/ml/status")
    classification=$(echo "$result" | jq -r '.clientState.classification // "UNKNOWN"')
    anomaly_score=$(echo "$result" | jq -r '.clientState.anomalyScore // 0')
    
    # Expected: SUSPICIOUS or THREAT
    if [ "$classification" = "SUSPICIOUS" ] || [ "$classification" = "THREAT" ]; then
        expected="ATTACK"
        correct="TRUE"
        ((correct_predictions++))
        ((tp++))  # True Positive
        echo -n "✓"
    else
        expected="ATTACK"
        correct="FALSE"
        ((fn++))  # False Negative
        echo -n "✗"
    fi
    
    echo "$((500 + i)),bot,$num_requests,$classification,$anomaly_score,$expected,$correct" >> "$RESULTS_FILE"
    
    if [ $((i % 50)) -eq 0 ]; then
        echo " $i/500"
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
ML Model Accuracy Report
========================
Date: $(date)
Total Samples: $total_samples

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
True Negatives (Normal correctly classified):  $tn / 500
False Positives (Normal wrongly flagged):      $fp / 500
True Positives (Attack correctly detected):    $tp / 500
False Negatives (Attack missed):               $fn / 500

Interpretation:
---------------
- Accuracy > 90%:  Excellent
- Accuracy 80-90%: Good
- Accuracy < 80%:  Needs improvement

- FPR < 10%:       Acceptable for production
- FPR > 20%:       Too many false alarms

- FNR < 10%:       Good attack detection
- FNR > 20%:       Missing too many attacks
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

if (( $(echo "$accuracy > 90" | bc -l) )); then
    echo "🎉 EXCELLENT! Accuracy > 90%"
elif (( $(echo "$accuracy > 80" | bc -l) )); then
    echo "✅ GOOD! Accuracy > 80%"
else
    echo "⚠️  Needs improvement. Consider:"
    echo "   - Increasing training data"
    echo "   - Tuning thresholds"
    echo "   - Adjusting features"
fi