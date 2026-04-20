#!/bin/bash

# ============================================================
# Full Algorithm Load Test for API Rate Limiter
# Defaults to 1,000,000 requests per algorithm.
# Override with:
#   TOTAL_REQUESTS=1000 CONCURRENT_USERS=20 tests/test_1m.sh
# ============================================================

echo "╔══════════════════════════════════════════════════════════╗"
echo "║        API Rate Limiter - All Algorithm Load Test       ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

BASE_URL="${BASE_URL:-http://localhost:3000}"
TOTAL_REQUESTS="${TOTAL_REQUESTS:-1000000}"
CONCURRENT_USERS="${CONCURRENT_USERS:-100}"
COOLDOWN_SECONDS="${COOLDOWN_SECONDS:-10}"
RESULTS_DIR="${RESULTS_DIR:-./test-results}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RUN_ID="load-${TIMESTAMP}-$$"
RESULTS_FILE="${RESULTS_DIR}/load_test_${TIMESTAMP}.csv"
SUMMARY_FILE="${RESULTS_DIR}/summary_${TIMESTAMP}.txt"

mkdir -p "$RESULTS_DIR"

# Format: slug|display name|path|x-forwarded-for|extra header
ALGORITHM_TESTS=(
  "fixed|Fixed Window|/api/fixed/data|10.255.1.10|"
  "token|Token Bucket|/api/token/data|10.255.1.11|"
  "leaky|Leaky Bucket|/api/leaky/data|10.255.1.12|"
  "sliding|Sliding Window Log|/api/sliding/data|10.255.1.13|"
  "counter|Sliding Window Counter|/api/counter/data|10.255.1.14|"
  "priority|Priority Token Bucket|/api/priority/data|10.255.1.15|X-User-Tier: free"
  "reputation|Reputation Based|/api/reputation/data|10.255.1.16|"
  "hybrid|Hybrid Adaptive|/api/hybrid/data|10.255.1.17|X-User-Tier: free"
  "cpu|CPU Adaptive|/api/cpu/data|10.255.1.18|"
  "ml|ML Assisted|/api/ml/data|10.255.1.19|"
)

print_system_information() {
  echo "═══════════════════════════════════════════════════════════"
  echo "SYSTEM INFORMATION"
  echo "═══════════════════════════════════════════════════════════"
  echo "Date: $(date)"
  echo "Hostname: $(hostname)"
  echo "OS: $(uname -s) $(uname -r)"
  echo "Architecture: $(uname -m)"
  echo "CPU: $(sysctl -n machdep.cpu.brand_string 2>/dev/null || grep 'model name' /proc/cpuinfo 2>/dev/null | head -1 | cut -d: -f2 || echo 'N/A')"
  echo "RAM: $(sysctl -n hw.memsize 2>/dev/null | awk '{printf "%.2f GB", $1/1024/1024/1024}' || free -h 2>/dev/null | awk '/Mem:/ {print $2}' || echo 'N/A')"
  echo ""
}

require_command() {
  local cmd="$1"
  local install_hint="$2"

  if ! command -v "$cmd" > /dev/null 2>&1; then
    echo "Missing dependency: $cmd"
    echo "$install_hint"
    exit 1
  fi
}

validate_config() {
  case "$TOTAL_REQUESTS" in
    ""|*[!0-9]*)
      echo "TOTAL_REQUESTS must be a positive integer. Current value: $TOTAL_REQUESTS"
      exit 1
      ;;
  esac

  case "$CONCURRENT_USERS" in
    ""|*[!0-9]*)
      echo "CONCURRENT_USERS must be a positive integer. Current value: $CONCURRENT_USERS"
      exit 1
      ;;
  esac

  case "$COOLDOWN_SECONDS" in
    ""|*[!0-9]*)
      echo "COOLDOWN_SECONDS must be a non-negative integer. Current value: $COOLDOWN_SECONDS"
      exit 1
      ;;
  esac

  if [ "$TOTAL_REQUESTS" -le 0 ]; then
    echo "TOTAL_REQUESTS must be greater than 0."
    exit 1
  fi

  if [ "$CONCURRENT_USERS" -le 0 ]; then
    echo "CONCURRENT_USERS must be greater than 0."
    exit 1
  fi

  if [ "$CONCURRENT_USERS" -gt "$TOTAL_REQUESTS" ]; then
    echo "CONCURRENT_USERS cannot be greater than TOTAL_REQUESTS for ApacheBench."
    echo "Current values: TOTAL_REQUESTS=$TOTAL_REQUESTS, CONCURRENT_USERS=$CONCURRENT_USERS"
    exit 1
  fi
}

check_server() {
  echo "Checking if server is running..."

  if ! curl -fsS "${BASE_URL}/health" > /dev/null 2>&1; then
    echo "Server is not running at $BASE_URL"
    echo "Start it with: npm run dev"
    exit 1
  fi

  echo "Server is running"
  echo ""
}

safe_percent() {
  local numerator="$1"
  local denominator="$2"

  if [ "$denominator" -eq 0 ]; then
    echo "0.00"
  else
    echo "scale=2; $numerator * 100 / $denominator" | bc
  fi
}

to_int() {
  case "$1" in
    ""|*[!0-9]*) echo "0" ;;
    *) echo "$1" ;;
  esac
}

parse_metric_number() {
  local output="$1"
  local label="$2"
  local occurrence="${3:-1}"

  printf '%s\n' "$output" | awk -F: -v label="$label" -v occurrence="$occurrence" '
    index($0, label) {
      count++
      if (count == occurrence) {
        value = $2
        gsub(/^[ \t]+|[ \t]+$/, "", value)
        split(value, parts, /[ \t]+/)
        print parts[1]
        found = 1
        exit
      }
    }
    END {
      if (!found) print "0"
    }
  '
}

parse_percentile() {
  local output="$1"
  local percentile="$2"

  printf '%s\n' "$output" | awk -v target="${percentile}%" '
    $1 == target {
      print $2
      found = 1
      exit
    }
    END {
      if (!found) print "0"
    }
  '
}

run_preflight() {
  local slug="$1"
  local url="$2"
  local client_ip="$3"
  local extra_header="$4"
  local client_id="${RUN_ID}-${slug}-preflight"
  local preflight_ip="10.254.0.$((RANDOM % 250 + 1))"
  local code

  if [ -n "$extra_header" ]; then
    code=$(curl -s -o /dev/null -w "%{http_code}" \
      -H "X-Client-Id: $client_id" \
      -H "X-Forwarded-For: $preflight_ip" \
      -H "$extra_header" \
      "$url")
  else
    code=$(curl -s -o /dev/null -w "%{http_code}" \
      -H "X-Client-Id: $client_id" \
      -H "X-Forwarded-For: $preflight_ip" \
      "$url")
  fi

  printf '%s' "$code"
}

run_ab_test() {
  local slug="$1"
  local url="$2"
  local client_ip="$3"
  local extra_header="$4"
  local gnuplot_file="$5"
  local client_id="${RUN_ID}-${slug}"
  local -a ab_cmd

  ab_cmd=(
    ab
    -n "$TOTAL_REQUESTS"
    -c "$CONCURRENT_USERS"
    -g "$gnuplot_file"
    -H "X-Client-Id: $client_id"
    -H "X-Forwarded-For: $client_ip"
  )

  if [ -n "$extra_header" ]; then
    ab_cmd+=(-H "$extra_header")
  fi

  ab_cmd+=("$url")

  "${ab_cmd[@]}" 2>&1
}

write_csv_header() {
  echo "timestamp,algorithm,algorithm_name,endpoint,total_requests,concurrency,completed_requests,http_ok,rate_limited_or_non_2xx,ab_failed,time_taken_s,requests_per_sec,mean_ms,median_ms,p95_ms,p99_ms,max_ms,success_percent,rate_limited_percent,result,gnuplot_file,ab_output_file" > "$RESULTS_FILE"
}

append_result() {
  local slug="$1"
  local name="$2"
  local endpoint="$3"
  local completed="$4"
  local http_ok="$5"
  local non_2xx="$6"
  local failed="$7"
  local time_taken="$8"
  local rps="$9"
  local mean="${10}"
  local median="${11}"
  local p95="${12}"
  local p99="${13}"
  local max="${14}"
  local success_percent="${15}"
  local limited_percent="${16}"
  local result="${17}"
  local gnuplot_file="${18}"
  local ab_output_file="${19}"

  echo "$TIMESTAMP,$slug,\"$name\",$endpoint,$TOTAL_REQUESTS,$CONCURRENT_USERS,$completed,$http_ok,$non_2xx,$failed,$time_taken,$rps,$mean,$median,$p95,$p99,$max,$success_percent,$limited_percent,$result,$gnuplot_file,$ab_output_file" >> "$RESULTS_FILE"
}

print_system_information

require_command "curl" "Install curl for HTTP checks."
require_command "awk" "Install awk for output parsing."
require_command "bc" "Install bc for percentage calculations."
require_command "ab" "Install ApacheBench: brew install httpd (macOS) or apt-get install apache2-utils (Linux)."

validate_config
check_server
write_csv_header

echo "═══════════════════════════════════════════════════════════"
echo "LOAD TEST CONFIGURATION"
echo "═══════════════════════════════════════════════════════════"
echo "Base URL: $BASE_URL"
echo "Requests per algorithm: $TOTAL_REQUESTS"
echo "Concurrent users: $CONCURRENT_USERS"
echo "Cooldown between algorithms: ${COOLDOWN_SECONDS}s"
echo "Algorithms: ${#ALGORITHM_TESTS[@]}"
echo "Run ID: $RUN_ID"
echo ""

printf "%-10s %-26s %-9s %-10s %-10s %-10s %-10s %-9s\n" \
  "Slug" "Algorithm" "OK" "429/Non2xx" "Failed" "Req/sec" "Mean(ms)" "Result"
echo "------------------------------------------------------------------------------------------------"

for test_entry in "${ALGORITHM_TESTS[@]}"; do
  IFS='|' read -r slug name path client_ip extra_header <<< "$test_entry"
  endpoint="${BASE_URL}${path}"
  gnuplot_file="${RESULTS_DIR}/gnuplot_${slug}_${TIMESTAMP}.tsv"
  ab_output_file="${RESULTS_DIR}/ab_${slug}_${TIMESTAMP}.log"

  echo ""
  echo "─────────────────────────────────────────────────────────"
  echo "Testing: $name"
  echo "Endpoint: $endpoint"
  echo "Client ID: ${RUN_ID}-${slug}"
  echo "Client IP: $client_ip"
  if [ -n "$extra_header" ]; then
    echo "Extra header: $extra_header"
  fi

  preflight_code=$(run_preflight "$slug" "$endpoint" "$client_ip" "$extra_header")
  if [ "$preflight_code" != "200" ]; then
    echo "Preflight failed for $name. HTTP status: $preflight_code"
    append_result "$slug" "$name" "$path" 0 0 0 0 0 0 0 0 0 0 0 "0.00" "0.00" "SKIPPED_HTTP_${preflight_code}" "$gnuplot_file" "$ab_output_file"
    printf "%-10s %-26s %-9s %-10s %-10s %-10s %-10s %-9s\n" "$slug" "$name" "0" "0" "0" "0" "0" "SKIPPED"
    continue
  fi

  echo "Running ApacheBench..."
  ab_output=$(run_ab_test "$slug" "$endpoint" "$client_ip" "$extra_header" "$gnuplot_file")
  ab_exit_code=$?
  printf '%s\n' "$ab_output" > "$ab_output_file"

  completed=$(to_int "$(parse_metric_number "$ab_output" "Complete requests:")")
  failed=$(to_int "$(parse_metric_number "$ab_output" "Failed requests:")")
  non_2xx=$(to_int "$(parse_metric_number "$ab_output" "Non-2xx responses:")")
  time_taken=$(parse_metric_number "$ab_output" "Time taken for tests:")
  rps=$(parse_metric_number "$ab_output" "Requests per second:")
  mean=$(parse_metric_number "$ab_output" "Time per request:" 1)
  median=$(parse_percentile "$ab_output" "50")
  p95=$(parse_percentile "$ab_output" "95")
  p99=$(parse_percentile "$ab_output" "99")
  max=$(parse_percentile "$ab_output" "100")

  if [ "$completed" -ge "$non_2xx" ]; then
    http_ok=$((completed - non_2xx))
  else
    http_ok=0
  fi

  success_percent=$(safe_percent "$http_ok" "$completed")
  limited_percent=$(safe_percent "$non_2xx" "$completed")

  result="PASS"
  if [ "$ab_exit_code" -ne 0 ]; then
    result="AB_EXIT_${ab_exit_code}"
  elif [ "$completed" -lt "$TOTAL_REQUESTS" ]; then
    result="INCOMPLETE"
  fi

  append_result "$slug" "$name" "$path" "$completed" "$http_ok" "$non_2xx" "$failed" "$time_taken" "$rps" "$mean" "$median" "$p95" "$p99" "$max" "$success_percent" "$limited_percent" "$result" "$gnuplot_file" "$ab_output_file"

  printf "%-10s %-26s %-9s %-10s %-10s %-10s %-10s %-9s\n" \
    "$slug" "$name" "$http_ok" "$non_2xx" "$failed" "$rps" "$mean" "$result"

  echo "Results:"
  echo "  Completed: $completed / $TOTAL_REQUESTS"
  echo "  HTTP OK: $http_ok (${success_percent}%)"
  echo "  429/Non-2xx: $non_2xx (${limited_percent}%)"
  echo "  ApacheBench failed requests: $failed"
  echo "  Requests/sec: $rps"
  echo "  Mean latency: ${mean}ms"
  echo "  Median / P95 / P99 / Max: ${median}ms / ${p95}ms / ${p99}ms / ${max}ms"
  echo "  Raw AB output: $ab_output_file"
  echo "  Gnuplot data: $gnuplot_file"

  if [ "$COOLDOWN_SECONDS" -gt 0 ]; then
    echo "Cooling down for ${COOLDOWN_SECONDS}s..."
    sleep "$COOLDOWN_SECONDS"
  fi
done

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "GENERATING SUMMARY REPORT"
echo "═══════════════════════════════════════════════════════════"

cat > "$SUMMARY_FILE" << SUMMARY_EOF
API Rate Limiter - All Algorithm Load Test Summary
==================================================
Date: $(date)
Base URL: $BASE_URL
Requests per Algorithm: $TOTAL_REQUESTS
Concurrent Users: $CONCURRENT_USERS
Cooldown Between Algorithms: ${COOLDOWN_SECONDS}s
Run ID: $RUN_ID

System Information:
-------------------
OS: $(uname -s) $(uname -r)
Architecture: $(uname -m)
CPU: $(sysctl -n machdep.cpu.brand_string 2>/dev/null || echo "N/A")
RAM: $(sysctl -n hw.memsize 2>/dev/null | awk '{printf "%.2f GB", $1/1024/1024/1024}' || echo "N/A")

Results by Algorithm:
---------------------
SUMMARY_EOF

printf "%-10s %-26s %-11s %-11s %-11s %-11s %-10s %-10s %-10s %-10s\n" \
  "Slug" "Algorithm" "OK" "429/Non2xx" "Failed" "Req/sec" "Mean" "P95" "P99" "Result" >> "$SUMMARY_FILE"
echo "------------------------------------------------------------------------------------------------------------------------" >> "$SUMMARY_FILE"

tail -n +2 "$RESULTS_FILE" | while IFS=, read -r ts slug name endpoint total concurrency completed ok non2xx failed time rps mean median p95 p99 max success_pct limited_pct result gnuplot raw; do
  clean_name=$(printf '%s' "$name" | sed 's/^"//;s/"$//')
  printf "%-10s %-26s %-11s %-11s %-11s %-11s %-10s %-10s %-10s %-10s\n" \
    "$slug" "$clean_name" "$ok" "$non2xx" "$failed" "$rps" "$mean" "$p95" "$p99" "$result" >> "$SUMMARY_FILE"
done

cat >> "$SUMMARY_FILE" << SUMMARY_EOF

Files:
------
CSV Data: $RESULTS_FILE
ApacheBench logs: ${RESULTS_DIR}/ab_*_${TIMESTAMP}.log
Gnuplot data: ${RESULTS_DIR}/gnuplot_*_${TIMESTAMP}.tsv

Notes:
------
- 429/Non2xx is parsed from ApacheBench "Non-2xx responses". In these endpoints that normally means rate-limited responses.
- Each algorithm uses a unique X-Client-Id and X-Forwarded-For value for this run.
- Priority and Hybrid tests use X-User-Tier: free so their tier-aware behavior is explicit.
- For a quick smoke test, run:
  TOTAL_REQUESTS=1000 CONCURRENT_USERS=20 COOLDOWN_SECONDS=1 tests/test_1m.sh
SUMMARY_EOF

cat "$SUMMARY_FILE"

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "LOAD TEST COMPLETE"
echo "═══════════════════════════════════════════════════════════"
echo "Results saved to:"
echo "  CSV Data: $RESULTS_FILE"
echo "  Summary: $SUMMARY_FILE"
echo "  ApacheBench logs: ${RESULTS_DIR}/ab_*_${TIMESTAMP}.log"
echo "  Gnuplot data: ${RESULTS_DIR}/gnuplot_*_${TIMESTAMP}.tsv"
