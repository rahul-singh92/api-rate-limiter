#!/bin/bash

printf "🎯 Reputation System Demo\n\n"

CLIENT="10.0.2.1"

printf "Step 1: Check initial reputation\n"
curl -s -H "X-Forwarded-For: $CLIENT" \
  http://localhost:3000/api/reputation/status | jq

printf "\n\nStep 2: Make 10 good requests\n"
for i in {1..10}; do
  curl -s -H "X-Forwarded-For: $CLIENT" \
    http://localhost:3000/api/reputation/data > /dev/null
  printf "."
done

printf "\n\nStep 3: Check reputation (should improve)\n"
curl -s -H "X-Forwarded-For: $CLIENT" \
  http://localhost:3000/api/reputation/status | jq '{
    tier: .reputation.tier,
    score: .reputation.reputationScore,
    capacity: .reputation.capacity
  }'

printf "\n\nStep 4: Make 15 bad requests\n"
for i in {1..15}; do
  curl -s -H "X-Forwarded-For: $CLIENT" \
    http://localhost:3000/api/reputation/bad > /dev/null
  printf "."
done

printf "\n\nStep 5: Check reputation (should degrade)\n"
curl -s -H "X-Forwarded-For: $CLIENT" \
  http://localhost:3000/api/reputation/status | jq '{
    tier: .reputation.tier,
    score: .reputation.reputationScore,
    capacity: .reputation.capacity,
    recentHistory: .reputation.statistics.recentHistory
  }'

printf "\n\n✨ Demo complete!\n\n"