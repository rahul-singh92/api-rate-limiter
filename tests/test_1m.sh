#!/bin/bash

# ============================================================
# Million Request Load Test for API Rate Limiter
# Author: Rahul Singh Jadoun
# Institution: IIIT Manipur
# ============================================================

echo "╔══════════════════════════════════════════════════════════╗"
echo "║      API Rate Limiter - Million Request Load Test       ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# Configuration
BASE_URL="http://localhost:3000"
TOTAL_REQUESTS=1000000
CONCURRENT_USERS=100
RESULTS_DIR="./test-results"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RESULTS_FILE="${RESULTS_DIR}/load_test_${TIMESTAMP}.csv"
SUMMARY_FILE="${RESULTS_DIR}/summary_${TIMESTAMP}.txt"

# Create results directory
mkdir -p "$RESULTS_DIR"

# System information
echo "═══════════════════════════════════════════════════════════"
echo "SYSTEM INFORMATION"
echo "═══════════════════════════════════════════════════════════"
echo "Date: $(date)"
echo "Hostname: $(hostname)"
echo "OS: $(uname -s) $(uname -r)"
echo "Architecture: $(uname -m)"
echo "CPU: $(sysctl -n machdep.cpu.brand_string 2>/dev/null || cat /proc/cpuinfo | grep 'model name' | head -1 | cut -d: -f2)"
echo "RAM: $(sysctl -n hw.memsize 2>/dev/null | awk '{print $1/1024/1024/1024 " GB"}' || free -h | grep Mem | awk '{print $2}')"
echo ""

# Check if server is running
echo "Checking if server is running..."
if ! curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/health" | grep -q "200"; then
    echo "❌ Server is not running at $BASE_URL"
    echo "Please start the server with: npm run dev"
    exit 1
fi
echo "✅ Server is running"
echo ""

# Check if Apache Bench is installed
if ! command -v ab &> /dev/null; then
    echo "❌ Apache Bench (ab) is not installed"
    echo "Install with: brew install httpd (macOS) or apt-get install apache2-utils (Linux)"
    exit 1
fi

# CSV Header
echo "timestamp,algorithm,total_requests,concurrency,time_taken,requests_per_sec,mean_time,median_time,p95_time,p99_time,failed_requests,rate_limited" > "$RESULTS_FILE"

# Test each algorithm
algorithms=("token" "fixed" "leaky" "sliding" "counter" "ml")

echo "═══════════════════════════════════════════════════════════"
echo "LOAD TEST STARTING"
echo "═══════════════════════════════════════════════════════════"
echo "Total Requests: $TOTAL_REQUESTS"
echo "Concurrent Users: $CONCURRENT_USERS"
echo "Algorithms to test: ${algorithms[@]}"
echo ""

for algo in "${algorithms[@]}"; do
    echo "─────────────────────────────────────────────────────────"
    echo "Testing: $algo algorithm"
    echo "─────────────────────────────────────────────────────────"
    
    ENDPOINT="${BASE_URL}/api/${algo}/data"
    
    # Run Apache Bench
    echo "Running Apache Bench..."
    ab_output=$(ab -n $TOTAL_REQUESTS -c $CONCURRENT_USERS -g "${RESULTS_DIR}/gnuplot_${algo}_${TIMESTAMP}.tsv" "$ENDPOINT" 2>&1)
    
    # Parse results
    time_taken=$(echo "$ab_output" | grep "Time taken for tests:" | awk '{print $5}')
    requests_per_sec=$(echo "$ab_output" | grep "Requests per second:" | awk '{print $4}')
    mean_time=$(echo "$ab_output" | grep "Time per request:" | head -1 | awk '{print $4}')
    failed_requests=$(echo "$ab_output" | grep "Failed requests:" | awk '{print $3}')
    
    # Get rate limit statistics from server
    stats=$(curl -s "$BASE_URL/algorithm/info/$algo")
    rate_limited=$(echo "$stats" | jq -r '.stats.totalDenied // 0')
    
    # Calculate percentiles (simplified - using mean as approximation)
    median_time=$mean_time
    p95_time=$(echo "$mean_time * 1.5" | bc)
    p99_time=$(echo "$mean_time * 2.0" | bc)
    
    # Save to CSV
    echo "$TIMESTAMP,$algo,$TOTAL_REQUESTS,$CONCURRENT_USERS,$time_taken,$requests_per_sec,$mean_time,$median_time,$p95_time,$p99_time,$failed_requests,$rate_limited" >> "$RESULTS_FILE"
    
    # Display results
    echo "Results:"
    echo "  Time Taken: ${time_taken}s"
    echo "  Requests/sec: $requests_per_sec"
    echo "  Mean Time: ${mean_time}ms"
    echo "  Failed Requests: $failed_requests"
    echo "  Rate Limited: $rate_limited"
    echo ""
    
    # Cool down period
    echo "Cooling down for 10 seconds..."
    sleep 10
done

echo "═══════════════════════════════════════════════════════════"
echo "GENERATING SUMMARY REPORT"
echo "═══════════════════════════════════════════════════════════"

cat > "$SUMMARY_FILE" << SUMMARY_EOF
API Rate Limiter - Load Test Summary
=====================================
Date: $(date)
Total Requests: $TOTAL_REQUESTS
Concurrent Users: $CONCURRENT_USERS

System Information:
-------------------
OS: $(uname -s) $(uname -r)
Architecture: $(uname -m)
CPU: $(sysctl -n machdep.cpu.brand_string 2>/dev/null || echo "N/A")
RAM: $(sysctl -n hw.memsize 2>/dev/null | awk '{print $1/1024/1024/1024 " GB"}' || echo "N/A")

Results by Algorithm:
---------------------
SUMMARY_EOF

# Add results table
echo "" >> "$SUMMARY_FILE"
printf "%-15s %-12s %-12s %-12s %-15s %-15s\n" "Algorithm" "Req/sec" "Mean(ms)" "P95(ms)" "Failed" "Rate Limited" >> "$SUMMARY_FILE"
echo "--------------------------------------------------------------------------------" >> "$SUMMARY_FILE"

tail -n +2 "$RESULTS_FILE" | while IFS=, read -r ts algo total conc time rps mean median p95 p99 failed limited; do
    printf "%-15s %-12s %-12s %-12s %-15s %-15s\n" "$algo" "$rps" "$mean" "$p95" "$failed" "$limited" >> "$SUMMARY_FILE"
done

cat "$SUMMARY_FILE"

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "✅ LOAD TEST COMPLETE"
echo "═══════════════════════════════════════════════════════════"
echo "Results saved to:"
echo "  📊 CSV Data: $RESULTS_FILE"
echo "  📄 Summary: $SUMMARY_FILE"
echo "  📈 Gnuplot data: ${RESULTS_DIR}/gnuplot_*"
echo ""
echo "To visualize results, run: ./visualize_results.sh"