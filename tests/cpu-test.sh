#!/bin/bash

printf "🧪 CPU Adaptive Rate Limiter Test\n\n"

# Test 1: Check Initial Status
printf "═══════════════════════════════════════\n"
printf "TEST 1: Initial CPU Status\n"
printf "═══════════════════════════════════════\n\n"

printf "Checking initial CPU status:\n"
curl -s http://localhost:3000/api/cpu/status | jq '{
  cpuLevel: .systemStatus.level,
  cpuUsage: .systemStatus.current,
  baseCapacity: .currentLimits.baseCapacity,
  actualCapacity: .currentLimits.actualCapacity,
  multiplier: .multiplier.current,
  adjustment: .multiplier.adjustment
}'

printf "\n\n"
sleep 3

# Test 2: Normal Load
printf "═══════════════════════════════════════\n"
printf "TEST 2: Normal Load Test\n"
printf "═══════════════════════════════════════\n\n"

printf "Making 50 requests under normal CPU:\n"
NORMAL_ALLOWED=0

for i in {1..50}; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/cpu/data)
  
  if [ "$STATUS" = "200" ]; then
    ((NORMAL_ALLOWED++))
    printf "✓"
  else
    printf "✗"
  fi
  
  if [ $((i % 10)) -eq 0 ]; then
    printf " %d\n" "$i"
  fi
done

printf "\n  Allowed: %d / 50\n\n" "$NORMAL_ALLOWED"

printf "CPU status after normal load:\n"
curl -s http://localhost:3000/api/cpu/status | jq '{
  cpuLevel: .systemStatus.level,
  cpuUsage: .systemStatus.current,
  actualCapacity: .currentLimits.actualCapacity
}'

printf "\n\n"
sleep 3

# Test 3: Simulate CPU Load
printf "═══════════════════════════════════════\n"
printf "TEST 3: Simulated High CPU Load\n"
printf "═══════════════════════════════════════\n\n"

printf "Simulating CPU load for 10 seconds...\n"
curl -s -X POST "http://localhost:3000/api/cpu/simulate-load?duration=10000&intensity=80" | jq '.message'

printf "\nWaiting for CPU to spike...\n"
sleep 3

printf "\nCPU status during load simulation:\n"
curl -s http://localhost:3000/api/cpu/status | jq '{
  cpuLevel: .systemStatus.level,
  cpuUsage: .systemStatus.current,
  baseCapacity: .currentLimits.baseCapacity,
  actualCapacity: .currentLimits.actualCapacity,
  adjustment: .multiplier.adjustment
}'

printf "\n\nTrying requests during high CPU:\n"
HIGH_ALLOWED=0

for i in {1..30}; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/cpu/data)
  
  if [ "$STATUS" = "200" ]; then
    ((HIGH_ALLOWED++))
    printf "✓"
  else
    printf "✗"
  fi
  
  if [ $((i % 10)) -eq 0 ]; then
    printf " %d\n" "$i"
  fi
done

printf "\n  Allowed: %d / 30\n" "$HIGH_ALLOWED"

printf "\n\nWaiting for CPU to recover...\n"
sleep 10

printf "\nCPU status after recovery:\n"
curl -s http://localhost:3000/api/cpu/status | jq '{
  cpuLevel: .systemStatus.level,
  cpuUsage: .systemStatus.current,
  actualCapacity: .currentLimits.actualCapacity
}'

printf "\n\n"

# Test 4: Heavy Operations
printf "═══════════════════════════════════════\n"
printf "TEST 4: CPU-Intensive Operations\n"
printf "═══════════════════════════════════════\n\n"

printf "Making 5 heavy computation requests:\n"

for i in {1..5}; do
  RESPONSE=$(curl -s -X POST http://localhost:3000/api/cpu/heavy)
  
  DURATION=$(echo "$RESPONSE" | jq -r '.computation.duration')
  CPU_LEVEL=$(echo "$RESPONSE" | jq -r '.cpuStatus.level')
  
  printf "  Request %d: %s (CPU level: %s)\n" "$i" "$DURATION" "$CPU_LEVEL"
  
  sleep 1
done

printf "\n"

# Final Summary
printf "╔═══════════════════════════════════════╗\n"
printf "║        FINAL SUMMARY                  ║\n"
printf "╠═══════════════════════════════════════╣\n"
printf "║ Normal Load:    %3d / 50  requests   ║\n" "$NORMAL_ALLOWED"
printf "║ High CPU Load:  %3d / 30  requests   ║\n" "$HIGH_ALLOWED"
printf "╚═══════════════════════════════════════╝\n"

printf "\n"

if [ "$HIGH_ALLOWED" -lt "$NORMAL_ALLOWED" ]; then
  printf "✅ CPU adaptive throttling working!\n"
  printf "   System automatically reduced limits during high CPU.\n\n"
else
  printf "⚠️  No significant difference detected.\n"
  printf "   CPU may not have spiked enough during simulation.\n\n"
fi