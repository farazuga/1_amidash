#!/bin/bash
# Capture current signage preview to temp file
# Usage: ./capture-preview.sh [slide_index] [output_file]

SLIDE_INDEX=${1:-0}
OUTPUT_FILE=${2:-"/tmp/signage-preview.png"}

# Check if engine is running
if ! curl -s http://127.0.0.1:3001/health > /dev/null 2>&1; then
  echo "Error: Signage engine is not running on port 3001"
  exit 1
fi

# Jump to specific slide if provided
if [ "$SLIDE_INDEX" != "0" ]; then
  curl -s -X POST "http://127.0.0.1:3001/control/slide/$SLIDE_INDEX" > /dev/null
  sleep 0.5
fi

# Capture preview
curl -s "http://127.0.0.1:3001/preview" -o "$OUTPUT_FILE"

if [ -f "$OUTPUT_FILE" ]; then
  echo "Preview saved to: $OUTPUT_FILE"
else
  echo "Error: Failed to capture preview"
  exit 1
fi
