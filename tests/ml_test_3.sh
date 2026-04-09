# #!/bin/bash

# printf "🕷️  ML Test: Scraper Detection\n\n"

# CLIENT_IP="10.0.10.3"

# printf "Simulating scraper behavior:\n"
# printf "  - Sequential ID enumeration\n"
# printf "  - Consistent timing\n"
# printf "  - Same endpoint pattern\n"
# printf "  - Data extraction pattern\n\n"

# printf "═══════════════════════════════════════\n"
# printf "Phase 1: Sequential User Enumeration\n"
# printf "═══════════════════════════════════════\n\n"

# printf "Enumerating users 1-100:\n"

# TOTAL_REQUESTS=0
# ALLOWED_REQUESTS=0
# BLOCKED_REQUESTS=0

# for i in {1..100}; do
#   ((TOTAL_REQUESTS++))
  
#   STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
#     -H "X-Forwarded-For: $CLIENT_IP" \
#     "http://localhost:3000/api/ml/users/$i")
  
#   if [ "$STATUS" = "200" ] || [ "$STATUS" = "404" ]; then
#     ((ALLOWED_REQUESTS++))
#     printf "."
#   else
#     ((BLOCKED_REQUESTS++))
#     printf "✗"
#   fi
  
#   if [ $((i % 20)) -eq 0 ]; then
#     printf " %d\n" "$i"
#   fi
  
#   # Scraper-like delay (consistent, automated)
#   sleep 0.2
# done

# printf "\n\n"

# printf "═══════════════════════════════════════\n"
# printf "Phase 2: Check ML Classification\n"
# printf "═══════════════════════════════════════\n\n"

# STATUS=$(curl -s -H "X-Forwarded-For: $CLIENT_IP" \
#   http://localhost:3000/api/ml/status)

# printf "ML Classification:\n"
# echo "$STATUS" | jq '{
#   classification: .clientState.classification,
#   anomalyScore: .clientState.anomalyScore,
#   totalRequests: .clientState.totalRequests,
#   multiplier: .clientState.multiplier,
#   meaning: .explanation.meaning
# }'

# printf "\n"

# printf "═══════════════════════════════════════\n"
# printf "Phase 3: Page Scraping Pattern\n"
# printf "═══════════════════════════════════════\n\n"

# printf "Scraping pages 1-50:\n"

# for i in {1..50}; do
#   ((TOTAL_REQUESTS++))
  
#   STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
#     -H "X-Forwarded-For: $CLIENT_IP" \
#     "http://localhost:3000/api/ml/simulate/scraper/$i")
  
#   if [ "$STATUS" = "200" ]; then
#     ((ALLOWED_REQUESTS++))
#     printf "."
#   else
#     ((BLOCKED_REQUESTS++))
#     printf "✗"
#   fi
  
#   if [ $((i % 20)) -eq 0 ]; then
#     printf " %d\n" "$i"
#   fi
  
#   sleep 0.2
# done

# printf "\n\n"

# printf "═══════════════════════════════════════\n"
# printf "Final Scraper Classification\n"
# printf "═══════════════════════════════════════\n\n"

# STATUS=$(curl -s -H "X-Forwarded-For: $CLIENT_IP" \
#   http://localhost:3000/api/ml/status)

# echo "$STATUS" | jq '{
#   classification: .clientState.classification,
#   anomalyScore: .clientState.anomalyScore,
#   totalRequests: .clientState.totalRequests,
#   successRate: .clientState.successRate,
#   capacity: .clientState.capacity,
#   multiplier: .clientState.multiplier
# }'

# printf "\n"

# printf "╔═══════════════════════════════════════════════════════╗\n"
# printf "║                   SUMMARY                             ║\n"
# printf "╠═══════════════════════════════════════════════════════╣\n"
# printf "║ Total Requests:  %3d                                 ║\n" "$TOTAL_REQUESTS"
# printf "║ Allowed:         %3d                                 ║\n" "$ALLOWED_REQUESTS"
# printf "║ Blocked:         %3d                                 ║\n" "$BLOCKED_REQUESTS"
# printf "╚═══════════════════════════════════════════════════════╝\n\n"

# CLASSIFICATION=$(echo "$STATUS" | jq -r '.clientState.classification')
# ANOMALY=$(echo "$STATUS" | jq -r '.clientState.anomalyScore')

# if [ "$CLASSIFICATION" = "SUSPICIOUS" ] || [ "$CLASSIFICATION" = "THREAT" ]; then
#   printf "✅ SUCCESS! Scraper detected as %s\n" "$CLASSIFICATION"
#   printf "   Anomaly Score: %s\n" "$ANOMALY"
#   printf "   ML model identified scraping pattern!\n\n"
# else
#   printf "⚠️  Scraper classified as %s (Anomaly: %s)\n" "$CLASSIFICATION" "$ANOMALY"
#   printf "   Model may need adjustment for scraper detection.\n\n"
# fi

#!/bin/bash

printf "🕷️  ML Test: Scraper Detection\n\n"

CLIENT_ID="scraper-test"

printf "Simulating scraper behavior:\n"
printf "  - Sequential ID enumeration\n"
printf "  - Consistent timing\n"
printf "  - Same endpoint pattern\n"
printf "  - Data extraction pattern\n\n"

printf "═══════════════════════════════════════\n"
printf "Phase 1: Sequential User Enumeration\n"
printf "═══════════════════════════════════════\n\n"

printf "Enumerating users 1-100:\n"

TOTAL_REQUESTS=0
ALLOWED_REQUESTS=0
BLOCKED_REQUESTS=0

for i in {1..100}; do
  ((TOTAL_REQUESTS++))
  
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "X-Client-Id: $CLIENT_ID" \
    "http://localhost:3000/api/ml/users/$i")
  
  if [ "$STATUS" = "200" ] || [ "$STATUS" = "404" ]; then
    ((ALLOWED_REQUESTS++))
    printf "."
  else
    ((BLOCKED_REQUESTS++))
    printf "✗"
  fi
  
  if [ $((i % 20)) -eq 0 ]; then
    printf " %d\n" "$i"
  fi
  
  # Scraper-like delay (consistent, automated)
  sleep 0.2
done

printf "\n\n"

printf "═══════════════════════════════════════\n"
printf "Phase 2: Check ML Classification\n"
printf "═══════════════════════════════════════\n\n"

STATUS=$(curl -s -H "X-Client-Id: $CLIENT_ID" \
  http://localhost:3000/api/ml/status)

printf "ML Classification:\n"
echo "$STATUS" | jq '{
  classification: .clientState.classification,
  anomalyScore: .clientState.anomalyScore,
  totalRequests: .clientState.totalRequests,
  multiplier: .clientState.multiplier,
  meaning: .explanation.meaning
}'

printf "\n"

printf "═══════════════════════════════════════\n"
printf "Phase 3: Page Scraping Pattern\n"
printf "═══════════════════════════════════════\n\n"

printf "Scraping pages 1-50:\n"

for i in {1..50}; do
  ((TOTAL_REQUESTS++))
  
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "X-Client-Id: $CLIENT_ID" \
    "http://localhost:3000/api/ml/simulate/scraper/$i")
  
  if [ "$STATUS" = "200" ]; then
    ((ALLOWED_REQUESTS++))
    printf "."
  else
    ((BLOCKED_REQUESTS++))
    printf "✗"
  fi
  
  if [ $((i % 20)) -eq 0 ]; then
    printf " %d\n" "$i"
  fi
  
  sleep 0.2
done

printf "\n\n"

printf "═══════════════════════════════════════\n"
printf "Final Scraper Classification\n"
printf "═══════════════════════════════════════\n\n"

STATUS=$(curl -s -H "X-Client-Id: $CLIENT_ID" \
  http://localhost:3000/api/ml/status)

echo "$STATUS" | jq '{
  classification: .clientState.classification,
  anomalyScore: .clientState.anomalyScore,
  totalRequests: .clientState.totalRequests,
  successRate: .clientState.successRate,
  capacity: .clientState.capacity,
  multiplier: .clientState.multiplier
}'

printf "\n"

printf "╔═══════════════════════════════════════════════════════╗\n"
printf "║                   SUMMARY                             ║\n"
printf "╠═══════════════════════════════════════════════════════╣\n"
printf "║ Total Requests:  %3d                                 ║\n" "$TOTAL_REQUESTS"
printf "║ Allowed:         %3d                                 ║\n" "$ALLOWED_REQUESTS"
printf "║ Blocked:         %3d                                 ║\n" "$BLOCKED_REQUESTS"
printf "╚═══════════════════════════════════════════════════════╝\n\n"

CLASSIFICATION=$(echo "$STATUS" | jq -r '.clientState.classification')
ANOMALY=$(echo "$STATUS" | jq -r '.clientState.anomalyScore')

if [ "$CLASSIFICATION" = "SUSPICIOUS" ] || [ "$CLASSIFICATION" = "THREAT" ]; then
  printf "✅ SUCCESS! Scraper detected as %s\n" "$CLASSIFICATION"
  printf "   Anomaly Score: %s\n" "$ANOMALY"
  printf "   ML model identified scraping pattern!\n\n"
else
  printf "⚠️  Scraper classified as %s (Anomaly: %s)\n" "$CLASSIFICATION" "$ANOMALY"
  printf "   Model may need adjustment for scraper detection.\n\n"
fi