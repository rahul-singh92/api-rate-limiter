#!/bin/bash

printf "📊 CPU Adaptive Monitor\n"
printf "Monitoring CPU and rate limits in real-time\n"
printf "Press Ctrl+C to stop\n\n"

while true; do
  clear
  printf "═══════════════════════════════════════════════════════════\n"
  printf "           CPU ADAPTIVE RATE LIMITER - LIVE MONITOR        \n"
  printf "═══════════════════════════════════════════════════════════\n\n"
  
  RESPONSE=$(curl -s http://localhost:3000/api/cpu/status)
  
  # Extract data
  CPU_LEVEL=$(echo "$RESPONSE" | jq -r '.systemStatus.level')
  CPU_USAGE=$(echo "$RESPONSE" | jq -r '.systemStatus.current')
  CPU_AVG=$(echo "$RESPONSE" | jq -r '.systemStatus.average')
  BASE_CAPACITY=$(echo "$RESPONSE" | jq -r '.currentLimits.baseCapacity')
  ACTUAL_CAPACITY=$(echo "$RESPONSE" | jq -r '.currentLimits.actualCapacity')
  BASE_RATE=$(echo "$RESPONSE" | jq -r '.currentLimits.baseRefillRate')
  ACTUAL_RATE=$(echo "$RESPONSE" | jq -r '.currentLimits.actualRefillRate')
  MULTIPLIER=$(echo "$RESPONSE" | jq -r '.multiplier.current')
  ADJUSTMENT=$(echo "$RESPONSE" | jq -r '.multiplier.adjustment')
  
  # Display
  printf "Current Time: %s\n\n" "$(date '+%H:%M:%S')"
  
  printf "CPU Status:\n"
  printf "  Level:       %s\n" "$CPU_LEVEL"
  printf "  Current:     %s\n" "$CPU_USAGE"
  printf "  Average:     %s\n\n" "$CPU_AVG"
  
  printf "Rate Limits:\n"
  printf "  Base Capacity:     %s\n" "$BASE_CAPACITY"
  printf "  Actual Capacity:   %s\n" "$ACTUAL_CAPACITY"
  printf "  Base Refill:       %s\n" "$BASE_RATE"
  printf "  Actual Refill:     %s\n\n" "$ACTUAL_RATE"
  
  printf "Adjustment:\n"
  printf "  Multiplier:  %s\n" "$MULTIPLIER"
  printf "  Change:      %s\n\n" "$ADJUSTMENT"
  
  printf "═══════════════════════════════════════════════════════════\n"
  printf "Tip: Run 'curl -X POST http://localhost:3000/api/cpu/simulate-load'\n"
  printf "     in another terminal to see limits adjust\n"
  printf "═══════════════════════════════════════════════════════════\n"
  
  sleep 2
done