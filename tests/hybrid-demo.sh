#!/bin/bash

printf "🎯 Hybrid Adaptive Demo\n\n"

CLIENT="10.0.4.1"

printf "═══════════════════════════════════════\n"
printf "Demo: Premium User Journey\n"
printf "═══════════════════════════════════════\n\n"

printf "Step 1: Check endpoint costs\n"
curl -s http://localhost:3000/api/hybrid/costs | jq '.endpointCosts | to_entries[] | {path: .value.path, cost: .value.cost}'

printf "\n\nStep 2: Make mix of requests\n"
printf "  - 5 simple (1 token each)\n"
printf "  - 2 search (5 tokens each)\n"
printf "  - 1 create (10 tokens)\n"
printf "Total: 5 + 10 + 10 = 25 tokens\n\n"

for i in {1..5}; do
  curl -s -H "X-User-Tier: premium" -H "X-Forwarded-For: $CLIENT" \
    http://localhost:3000/api/hybrid/simple > /dev/null
  printf "✓ Simple request $i\n"
done

for i in {1..2}; do
  curl -s -H "X-User-Tier: premium" -H "X-Forwarded-For: $CLIENT" \
    "http://localhost:3000/api/hybrid/search?q=test" > /dev/null
  printf "✓ Search request $i\n"
done

curl -s -X POST -H "X-User-Tier: premium" -H "X-Forwarded-For: $CLIENT" \
  http://localhost:3000/api/hybrid/create > /dev/null
printf "✓ Create request\n"

printf "\n\nStep 3: Check status\n"
curl -s -H "X-Forwarded-For: $CLIENT" \
  http://localhost:3000/api/hybrid/status | jq '{
    tier: .state.tier,
    tokensRemaining: .state.tokens,
    capacity: .state.capacity,
    actualRefillRate: .state.actualRefillRate,
    formula: .formula
  }'

printf "\n\n✨ Demo complete!\n\n"chmod +x tests/hybrid-demo.sh