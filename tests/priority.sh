#!/bin/bash

printf "🧪 Priority Token Bucket Test (Fixed)\n\n"

# IMPORTANT: Different client identifiers for each tier
# Using X-Forwarded-For to simulate different clients

# Test 1: Anonymous User
printf "═══════════════════════════════════════\n"
printf "TEST 1: Anonymous User (10 tokens)\n"
printf "═══════════════════════════════════════\n"
printf "Making 15 requests:\n  "

ANON_ALLOWED=0
for i in {1..15}; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "X-Forwarded-For: 10.0.0.1" \
    http://localhost:3000/api/priority/data)
  
  if [ "$STATUS" = "200" ]; then
    printf "✓"
    ((ANON_ALLOWED++))
  else
    printf "✗"
  fi
done

printf "\n\n"
printf "Results:\n"
printf "  ✅ Allowed:  %d / 15\n" "$ANON_ALLOWED"
printf "  ❌ Blocked:  %d / 15\n" "$((15 - ANON_ALLOWED))"
printf "  📊 Expected: 10 allowed\n"

if [ "$ANON_ALLOWED" -eq 10 ]; then
  printf "  ✅ TEST PASSED!\n"
else
  printf "  ❌ TEST FAILED!\n"
fi

printf "\n"
sleep 3

# Test 2: Free User
printf "═══════════════════════════════════════\n"
printf "TEST 2: Free User (50 tokens)\n"
printf "═══════════════════════════════════════\n"
printf "Making 60 requests:\n  "

FREE_ALLOWED=0
for i in {1..60}; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "X-User-Tier: free" \
    -H "X-Forwarded-For: 10.0.0.2" \
    http://localhost:3000/api/priority/data)
  
  if [ "$STATUS" = "200" ]; then
    printf "✓"
    ((FREE_ALLOWED++))
  else
    printf "✗"
  fi
  
  if [ $((i % 20)) -eq 0 ]; then
    printf " %d\n  " "$i"
  fi
done

printf "\n\n"
printf "Results:\n"
printf "  ✅ Allowed:  %d / 60\n" "$FREE_ALLOWED"
printf "  ❌ Blocked:  %d / 60\n" "$((60 - FREE_ALLOWED))"
printf "  📊 Expected: 50 allowed\n"

if [ "$FREE_ALLOWED" -eq 50 ]; then
  printf "  ✅ TEST PASSED!\n"
else
  printf "  ❌ TEST FAILED!\n"
fi

printf "\n"
sleep 3

# Test 3: Premium User
printf "═══════════════════════════════════════\n"
printf "TEST 3: Premium User (200 tokens)\n"
printf "═══════════════════════════════════════\n"
printf "Making 210 requests:\n  "

PREMIUM_ALLOWED=0
for i in {1..210}; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "X-User-Tier: premium" \
    -H "X-Forwarded-For: 10.0.0.3" \
    http://localhost:3000/api/priority/data)
  
  if [ "$STATUS" = "200" ]; then
    printf "✓"
    ((PREMIUM_ALLOWED++))
  else
    printf "✗"
  fi
  
  if [ $((i % 50)) -eq 0 ]; then
    printf " %d\n  " "$i"
  fi
done

printf "\n\n"
printf "Results:\n"
printf "  ✅ Allowed:  %d / 210\n" "$PREMIUM_ALLOWED"
printf "  ❌ Blocked:  %d / 210\n" "$((210 - PREMIUM_ALLOWED))"
printf "  📊 Expected: 200 allowed\n"

if [ "$PREMIUM_ALLOWED" -eq 200 ]; then
  printf "  ✅ TEST PASSED!\n"
else
  printf "  ❌ TEST FAILED!\n"
fi

printf "\n"
sleep 3

# Test 4: Enterprise User
printf "═══════════════════════════════════════\n"
printf "TEST 4: Enterprise User (1000 tokens)\n"
printf "═══════════════════════════════════════\n"
printf "Making 50 requests (sample):\n  "

ENTERPRISE_ALLOWED=0
for i in {1..50}; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "X-User-Tier: enterprise" \
    -H "X-Forwarded-For: 10.0.0.4" \
    http://localhost:3000/api/priority/data)
  
  if [ "$STATUS" = "200" ]; then
    printf "✓"
    ((ENTERPRISE_ALLOWED++))
  else
    printf "✗"
  fi
  
  if [ $((i % 25)) -eq 0 ]; then
    printf " %d\n  " "$i"
  fi
done

printf "\n\n"
printf "Results:\n"
printf "  ✅ Allowed:  %d / 50\n" "$ENTERPRISE_ALLOWED"
printf "  📊 Expected: 50 allowed (has 1000 capacity)\n"

if [ "$ENTERPRISE_ALLOWED" -eq 50 ]; then
  printf "  ✅ TEST PASSED!\n"
else
  printf "  ❌ TEST FAILED!\n"
fi

printf "\n"

# Final Summary
printf "╔═══════════════════════════════════════╗\n"
printf "║        FINAL SUMMARY                  ║\n"
printf "╠═══════════════════════════════════════╣\n"
printf "║ Anonymous:   %3d / 15  (10 expected) ║\n" "$ANON_ALLOWED"
printf "║ Free:        %3d / 60  (50 expected) ║\n" "$FREE_ALLOWED"
printf "║ Premium:     %3d / 210 (200 expected)║\n" "$PREMIUM_ALLOWED"
printf "║ Enterprise:  %3d / 50  (50 expected) ║\n" "$ENTERPRISE_ALLOWED"
printf "╚═══════════════════════════════════════╝\n"

printf "\n"

# Calculate pass/fail
TOTAL_TESTS=4
PASSED_TESTS=0

[ "$ANON_ALLOWED" -eq 10 ] && ((PASSED_TESTS++))
[ "$FREE_ALLOWED" -eq 50 ] && ((PASSED_TESTS++))
[ "$PREMIUM_ALLOWED" -eq 200 ] && ((PASSED_TESTS++))
[ "$ENTERPRISE_ALLOWED" -eq 50 ] && ((PASSED_TESTS++))

if [ "$PASSED_TESTS" -eq "$TOTAL_TESTS" ]; then
  printf "🎉 ALL TESTS PASSED! (%d/%d)\n\n" "$PASSED_TESTS" "$TOTAL_TESTS"
else
  printf "⚠️  SOME TESTS FAILED (%d/%d)\n\n" "$PASSED_TESTS" "$TOTAL_TESTS"
fi