#!/bin/bash

BASE_URL="http://localhost:3000/api"
ENDPOINT="$BASE_URL/shorten"
TOTAL_REQUESTS=15

echo "========================================="
echo " Rate Limit Test"
echo " Firing $TOTAL_REQUESTS requests at $ENDPOINT"
echo " Expect: 201 for first 10, 429 from 11th onwards"
echo "========================================="
echo ""

for i in $(seq 1 $TOTAL_REQUESTS); do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$ENDPOINT" \
    -H "Content-Type: application/json" \
    -d '{"longUrl": "https://google.com"}')

  if [ "$STATUS" -eq 429 ]; then
    echo "Request $i: $STATUS ← BLOCKED"
  else
    echo "Request $i: $STATUS"
  fi
done

echo ""
echo "========================================="
echo " Test complete"
echo "========================================="