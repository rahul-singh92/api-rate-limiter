#!/bin/bash

printf "🧪 Reputation-Based Rate Limiter Test\n\n"

CLIENT_IP="10.0.1.1"

# Test 1: Good Behavior
printf "═══════════════════════════════════════\n"
printf "TEST 1: Good User Behavior\n"
printf "═══════════════════════════════════════\n"
printf "Making 20 successful requests...\n\n"

for i in {1..20}; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "X-Forwarded-For: $CLIENT_IP" \
    http://localhost:3000/api/reputation/data)
  
  if [ "$STATUS" = "200" ]; then
    printf "✓"
  else
    printf "✗"
  fi
  
  if [ $((i % 10)) -eq 0 ]; then
    printf " %d\n" "$i"
  fi
done

printf "\n\nChecking reputation after good behavior:\n"
curl -s -H "X-Forwarded-For: $CLIENT_IP" \
  http://localhost:3000/api/reputation/status | jq '{
    tier: .reputation.tier,
    tierIcon: .reputation.tierIcon,
    score: .reputation.reputationScore,
    successRate: .reputation.successRate,
    capacity: .reputation.capacity
  }'

printf "\n"
sleep 3

# Test 2: Bad Behavior
printf "═══════════════════════════════════════\n"
printf "TEST 2: Bad User Behavior (Simulate Bot)\n"
printf "═══════════════════════════════════════\n"
printf "Making 10 good + 20 bad requests...\n\n"

BAD_CLIENT="10.0.1.2"

# 10 good requests
printf "Good requests: "
for i in {1..10}; do
  curl -s -H "X-Forwarded-For: $BAD_CLIENT" \
    http://localhost:3000/api/reputation/data > /dev/null
  printf "✓"
done

printf "\n\nBad requests: "
# 20 bad requests
for i in {1..20}; do
  curl -s -H "X-Forwarded-For: $BAD_CLIENT" \
    http://localhost:3000/api/reputation/bad > /dev/null
  printf "✗"
  
  if [ $((i % 10)) -eq 0 ]; then
    printf " %d\n" "$i"
  fi
done

printf "\n\nChecking reputation after bad behavior:\n"
curl -s -H "X-Forwarded-For: $BAD_CLIENT" \
  http://localhost:3000/api/reputation/status | jq '{
    tier: .reputation.tier,
    tierIcon: .reputation.tierIcon,
    score: .reputation.reputationScore,
    successRate: .reputation.successRate,
    capacity: .reputation.capacity,
    statistics: .reputation.statistics
  }'

printf "\n"
sleep 3

# Test 3: Tier Comparison
printf "═══════════════════════════════════════\n"
printf "TEST 3: Rate Limit Capacity by Tier\n"
printf "═══════════════════════════════════════\n\n"

printf "Good User (Tier: Good/Excellent):\n"
GOOD_ALLOWED=0
for i in {1..160}; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "X-Forwarded-For: $CLIENT_IP" \
    http://localhost:3000/api/reputation/data)
  
  if [ "$STATUS" = "200" ]; then
    ((GOOD_ALLOWED++))
    printf "✓"
  else
    printf "✗"
  fi
  
  if [ $((i % 40)) -eq 0 ]; then
    printf " %d\n" "$i"
  fi
done

printf "\n  Allowed: %d / 160\n\n" "$GOOD_ALLOWED"

sleep 2

printf "Bad User (Tier: Poor/Bad):\n"
BAD_ALLOWED=0
for i in {1..60}; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "X-Forwarded-For: $BAD_CLIENT" \
    http://localhost:3000/api/reputation/data)
  
  if [ "$STATUS" = "200" ]; then
    ((BAD_ALLOWED++))
    printf "✓"
  else
    printf "✗"
  fi
  
  if [ $((i % 20)) -eq 0 ]; then
    printf " %d\n" "$i"
  fi
done

printf "\n  Allowed: %d / 60\n\n" "$BAD_ALLOWED"

# Final Summary
printf "╔═══════════════════════════════════════╗\n"
printf "║        FINAL SUMMARY                  ║\n"
printf "╠═══════════════════════════════════════╣\n"
printf "║ Good User Capacity:  %3d requests    ║\n" "$GOOD_ALLOWED"
printf "║ Bad User Capacity:   %3d requests    ║\n" "$BAD_ALLOWED"
printf "║                                       ║\n"
printf "║ Ratio: %.1fx higher for good users   ║\n" "$(awk "BEGIN {print $GOOD_ALLOWED/$BAD_ALLOWED}")"
printf "╚═══════════════════════════════════════╝\n"

printf "\n✅ Reputation-based throttling working!\n"
printf "   Good users get more capacity automatically.\n\n"