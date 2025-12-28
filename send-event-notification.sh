#!/bin/bash

# Script to send event notifications to all approved attendees
# Usage: 
#   ./send-event-notification.sh                    # Send to all approved attendees
#   ./send-event-notification.sh TEST_DISCORD_ID    # Send test to specific Discord ID

# Load environment variables
set -a
source .env.local
set +a

# Check if SUPABASE_URL and ANON_KEY are set
if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ] || [ -z "$NEXT_PUBLIC_SUPABASE_ANON_KEY" ]; then
    echo "Error: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set in .env.local"
    exit 1
fi

EVENT_SLUG="ados-2025"
FUNCTION_URL="${NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-event-notification"

# Check if we're in test mode (Discord ID provided)
if [ -n "$1" ]; then
    echo "🧪 TEST MODE: Sending to Discord ID $1"
    BODY="{\"event_slug\":\"$EVENT_SLUG\",\"test_discord_id\":\"$1\"}"
else
    echo "📨 PRODUCTION MODE: Sending to ALL approved attendees"
    read -p "Are you sure you want to send to ALL approved attendees? (yes/no): " CONFIRM
    if [ "$CONFIRM" != "yes" ]; then
        echo "Cancelled."
        exit 0
    fi
    BODY="{\"event_slug\":\"$EVENT_SLUG\"}"
fi

echo ""
echo "Sending request..."
echo ""

# Make the request
RESPONSE=$(curl -s --location --request POST "$FUNCTION_URL" \
  --header "Authorization: Bearer $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  --header 'Content-Type: application/json' \
  --data "$BODY")

# Pretty print the response
echo "$RESPONSE" | jq '.'

echo ""
echo "✅ Done!"







