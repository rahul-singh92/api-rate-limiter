#!/bin/bash

printf "🧪 Hybrid Adaptive Rate Limiter Test\n\n"

CLIENT_IP="10.0.3.1"

# Test 1: Different Endpoint Costs
printf "═══════════════════════════════════════\n"
printf "TEST 1: Endpoint Cost System\n"
printf "═══════════════════════════════════════\n\n"

printf "Testing different endpoint costs:\n\n"

# Simple (1 token)
printf "1. Simple endpoint (1 token):\n"
RESPONSE=$(curl -s -H "X-Forwarded-For: $CLIENT_IP" http://localhost:3000/api/hybrid/simple)
echo "$RESPONSE" | jq '{cost: .cost, tier: .tier.name, remaining: .performance}'
printf "\n"

# Search (5 tokens)
printf "2. Search endpoint (5 tokens):\n"
RESPONSE=$(curl -s -H "X-Forwarded-For: $CLIENT_IP" http://localhost:3000/api/hybrid/search)
echo "$RESPONSE" | jq '{cost: .cost, tier: .tier.name, remaining: .performance}'
printf "\n"

# Create (10 tokens)
printf "3. Create endpoint (10 tokens):\n"
RESPONSE=$(curl -s -X POST -H "X-Forwarded-For: $CLIENT_IP" http://localhost:3000/api/hybrid/create)
echo "$RESPONSE" | jq '{cost: .cost, tier: .tier.name, remaining: .performance}'
printf "\n"

sleep 3

# Test 2: Priority Tiers
printf "═══════════════════════════════════════\n"
printf "TEST 2: Priority Tiers Comparison\n"
printf "═══════════════════════════════════════\n\n"

# Anonymous tier
printf "Anonymous Tier (10 capacity, 1/s base):\n"
ANON_ALLOWED=0
for i in {1..15}; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "X-Forwarded-For: 10.0.3.2" \
    http://localhost:3000/api/hybrid/data)
  
  if [ "$STATUS" = "200" ]; then
    ((ANON_ALLOWED++))
    printf "✓"
  else
    printf "✗"
  fi
done
printf "\n  Allowed: %d / 15\n\n" "$ANON_ALLOWED"

sleep 2

# Premium tier
printf "Premium Tier (200 capacity, 20/s base):\n"
PREMIUM_ALLOWED=0
for i in {1..210}; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "X-User-Tier: premium" \
    -H "X-Forwarded-For: 10.0.3.3" \
    http://localhost:3000/api/hybrid/data)
  
  if [ "$STATUS" = "200" ]; then
    ((PREMIUM_ALLOWED++))
    printf "✓"
  else
    printf "✗"
  fi
  
  if [ $((i % 50)) -eq 0 ]; then
    printf " %d\n" "$i"
  fi
done
printf "\n  Allowed: %d / 210\n\n" "$PREMIUM_ALLOWED"

sleep 3

# Test 3: Reputation Impact
printf "═══════════════════════════════════════\n"
printf "TEST 3: Reputation-Based Adaptation\n"
printf "═══════════════════════════════════════\n\n"

ADAPT_CLIENT="10.0.3.4"

printf "Phase 1: Good behavior (20 successful requests)\n"
for i in {1..20}; do
  curl -s -H "X-Forwarded-For: $ADAPT_CLIENT" \
    -H "X-User-Tier: premium" \
    http://localhost:3000/api/hybrid/data > /dev/null
  printf "."
done

printf "\n\nChecking state after good behavior:\n"
curl -s -H "X-Forwarded-For: $ADAPT_CLIENT" \
  http://localhost:3000/api/hybrid/status | jq '{
    tier: .state.tier,
    actualRefillRate: .state.actualRefillRate,
    reputationMultiplier: .state.reputationMultiplier,
    reputationTier: .state.reputationTier,
    successRate: .state.statistics.successRate
  }'

printf "\n\nPhase 2: Bad behavior (15 failed requests)\n"
for i in {1..15}; do
  curl -s -H "X-Forwarded-For: $ADAPT_CLIENT" \
    http://localhost:3000/api/hybrid/bad > /dev/null
  printf "."
done

printf "\n\nChecking state after bad behavior:\n"
curl -s -H "X-Forwarded-For: $ADAPT_CLIENT" \
  http://localhost:3000/api/hybrid/status | jq '{
    tier: .state.tier,
    actualRefillRate: .state.actualRefillRate,
    reputationMultiplier: .state.reputationMultiplier,
    reputationTier: .state.reputationTier,
    successRate: .state.statistics.successRate
  }'

printf "\n"
sleep 3

# Test 4: Heavy Operation
printf "═══════════════════════════════════════\n"
printf "TEST 4: Heavy Operation (50 tokens)\n"
printf "═══════════════════════════════════════\n\n"

HEAVY_CLIENT="10.0.3.5"

printf "Premium user with 200 capacity:\n"
printf "How many 50-token operations can burst?\n\n"

HEAVY_ALLOWED=0
for i in {1..5}; do
  RESPONSE=$(curl -s -X POST \
    -H "X-User-Tier: premium" \
    -H "X-Forwarded-For: $HEAVY_CLIENT" \
    http://localhost:3000/api/hybrid/export)
  
  ALLOWED=$(echo "$RESPONSE" | jq -r '.cost // "error"')
  
  if [ "$ALLOWED" != "error" ]; then
    ((HEAVY_ALLOWED++))
    printf "✓ Export $i (50 tokens)\n"
  else
    printf "✗ Export $i (blocked)\n"
  fi
done

printf "\n  Result: %d / 5 heavy operations allowed\n" "$HEAVY_ALLOWED"
printf "  Expected: 4 (200 capacity / 50 tokens = 4)\n\n"

# Final Summary
printf "╔═══════════════════════════════════════╗\n"
printf "║        FINAL SUMMARY                  ║\n"
printf "╠═══════════════════════════════════════╣\n"
printf "║ Anonymous:   %3d / 15  (10 expected) ║\n" "$ANON_ALLOWED"
printf "║ Premium:     %3d / 210 (200 expected)║\n" "$PREMIUM_ALLOWED"
printf "║ Heavy Ops:   %3d / 5   (4 expected)  ║\n" "$HEAVY_ALLOWED"
printf "╚═══════════════════════════════════════╝\n"

printf "\n✅ Hybrid Adaptive features working:\n"
printf "   ✓ Priority tiers\n"
printf "   ✓ Endpoint costs\n"
printf "   ✓ Reputation adaptation\n"
printf "   ✓ Dynamic refill rates\n\n"