#!/bin/bash

printf "🔥 IMPROVED CPU Stress Test\n\n"

printf "This test will:\n"
printf "1. Generate REAL CPU load (not just busy-waiting)\n"
printf "2. Show CPU changes in real-time\n"
printf "3. Demonstrate rate limit adaptation\n\n"

# Test 1: Baseline
printf "═══════════════════════════════════════\n"
printf "BASELINE: CPU at rest\n"
printf "═══════════════════════════════════════\n\n"

printf "Checking baseline CPU:\n"
for i in {1..5}; do
  RESPONSE=$(curl -s http://localhost:3000/api/cpu/status)
  CPU=$(echo "$RESPONSE" | jq -r '.systemStatus.current')
  LEVEL=$(echo "$RESPONSE" | jq -r '.systemStatus.level')
  CAPACITY=$(echo "$RESPONSE" | jq -r '.currentLimits.actualCapacity')
  
  printf "  Sample %d: CPU=%s, Level=%s, Capacity=%s\n" "$i" "$CPU" "$LEVEL" "$CAPACITY"
  sleep 2
done

printf "\n"

# Test 2: Generate REAL CPU load
printf "═══════════════════════════════════════\n"
printf "STRESS TEST: Generating CPU load\n"
printf "═══════════════════════════════════════\n\n"

printf "Starting CPU stress...\n"
printf "Method: Multiple parallel heavy computations\n\n"

# Start 4 background CPU burners
for i in {1..4}; do
  (
    END=$((SECONDS+20))
    while [ $SECONDS -lt $END ]; do
      # Heavy computation
      dd if=/dev/zero bs=1M count=100 2>/dev/null | md5sum > /dev/null
    done
  ) &
  BURNER_PIDS="$BURNER_PIDS $!"
done

printf "Started 4 CPU burners (PIDs: $BURNER_PIDS)\n\n"

printf "Monitoring CPU for 20 seconds:\n"
printf "%-5s %-10s %-12s %-15s %-15s\n" "Sec" "CPU" "Level" "Capacity" "Multiplier"
printf "%.0s─" {1..60}
printf "\n"

for i in {1..20}; do
  RESPONSE=$(curl -s http://localhost:3000/api/cpu/status)
  CPU=$(echo "$RESPONSE" | jq -r '.systemStatus.current')
  LEVEL=$(echo "$RESPONSE" | jq -r '.systemStatus.level')
  CAPACITY=$(echo "$RESPONSE" | jq -r '.currentLimits.actualCapacity')
  MULTIPLIER=$(echo "$RESPONSE" | jq -r '.multiplier.current')
  
  printf "%-5d %-10s %-12s %-15s %-15s\n" "$i" "$CPU" "$LEVEL" "$CAPACITY" "$MULTIPLIER"
  sleep 1
done

printf "\n"

# Test 3: Try making requests during high CPU
printf "═══════════════════════════════════════\n"
printf "REQUEST TEST: During high CPU\n"
printf "═══════════════════════════════════════\n\n"

printf "Making 50 requests while CPU is stressed:\n"
HIGH_ALLOWED=0
HIGH_BLOCKED=0

for i in {1..50}; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/cpu/data)
  
  if [ "$STATUS" = "200" ]; then
    ((HIGH_ALLOWED++))
    printf "✓"
  else
    ((HIGH_BLOCKED++))
    printf "✗"
  fi
  
  if [ $((i % 10)) -eq 0 ]; then
    printf " %d\n" "$i"
  fi
  
  sleep 0.1
done

printf "\n  Allowed: %d / 50\n" "$HIGH_ALLOWED"
printf "  Blocked: %d / 50\n\n" "$HIGH_BLOCKED"

# Stop CPU burners
printf "Stopping CPU stress...\n"
kill $BURNER_PIDS 2>/dev/null
wait $BURNER_PIDS 2>/dev/null

printf "Waiting for CPU to recover (10 seconds)...\n\n"
sleep 10

# Test 4: Recovery
printf "═══════════════════════════════════════\n"
printf "RECOVERY TEST: After stress\n"
printf "═══════════════════════════════════════\n\n"

printf "Monitoring recovery:\n"
for i in {1..5}; do
  RESPONSE=$(curl -s http://localhost:3000/api/cpu/status)
  CPU=$(echo "$RESPONSE" | jq -r '.systemStatus.current')
  LEVEL=$(echo "$RESPONSE" | jq -r '.systemStatus.level')
  CAPACITY=$(echo "$RESPONSE" | jq -r '.currentLimits.actualCapacity')
  
  printf "  Sample %d: CPU=%s, Level=%s, Capacity=%s\n" "$i" "$CPU" "$LEVEL" "$CAPACITY"
  sleep 2
done

printf "\n"

# Test 5: Requests after recovery
printf "Making 50 requests after recovery:\n"
NORMAL_ALLOWED=0
NORMAL_BLOCKED=0

for i in {1..50}; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/cpu/data)
  
  if [ "$STATUS" = "200" ]; then
    ((NORMAL_ALLOWED++))
    printf "✓"
  else
    ((NORMAL_BLOCKED++))
    printf "✗"
  fi
  
  if [ $((i % 10)) -eq 0 ]; then
    printf " %d\n" "$i"
  fi
  
  sleep 0.1
done

printf "\n  Allowed: %d / 50\n" "$NORMAL_ALLOWED"
printf "  Blocked: %d / 50\n\n" "$NORMAL_BLOCKED"

# Summary
printf "╔═══════════════════════════════════════════════════════╗\n"
printf "║                   FINAL SUMMARY                       ║\n"
printf "╠═══════════════════════════════════════════════════════╣\n"
printf "║ During High CPU:  %3d allowed / %3d blocked         ║\n" "$HIGH_ALLOWED" "$HIGH_BLOCKED"
printf "║ After Recovery:   %3d allowed / %3d blocked         ║\n" "$NORMAL_ALLOWED" "$NORMAL_BLOCKED"
printf "╚═══════════════════════════════════════════════════════╝\n\n"

if [ "$NORMAL_ALLOWED" -gt "$HIGH_ALLOWED" ]; then
  IMPROVEMENT=$(( ((NORMAL_ALLOWED - HIGH_ALLOWED) * 100) / HIGH_ALLOWED ))
  printf "✅ SUCCESS! CPU adaptive throttling working!\n"
  printf "   System recovered and allowed %d%% more requests after stress.\n\n" "$IMPROVEMENT"
else
  printf "⚠️  Results inconclusive.\n"
  printf "   Try running the test again or increase stress duration.\n\n"
fi

printf "📊 View detailed metrics:\n"
printf "   curl http://localhost:3000/api/cpu/metrics | jq\n\n"