#!/bin/bash
# Capture all slides to temp directory
# Usage: ./capture-all-slides.sh [output_directory]

OUTPUT_DIR=${1:-"/tmp/signage-slides"}
mkdir -p "$OUTPUT_DIR"

# Check if engine is running
if ! curl -s http://127.0.0.1:3001/health > /dev/null 2>&1; then
  echo "Error: Signage engine is not running on port 3001"
  exit 1
fi

# Get slide count from status
STATUS=$(curl -s http://127.0.0.1:3001/status)
SLIDE_COUNT=$(echo "$STATUS" | grep -o '"totalSlides":[0-9]*' | cut -d':' -f2)

if [ -z "$SLIDE_COUNT" ] || [ "$SLIDE_COUNT" -eq 0 ]; then
  echo "Error: Could not determine slide count"
  exit 1
fi

echo "Capturing $SLIDE_COUNT slides..."

for i in $(seq 0 $((SLIDE_COUNT - 1))); do
  curl -s -X POST "http://127.0.0.1:3001/control/slide/$i" > /dev/null
  sleep 0.5
  curl -s "http://127.0.0.1:3001/preview" -o "$OUTPUT_DIR/slide-$i.png"

  # Get slide type from status for naming
  STATUS=$(curl -s http://127.0.0.1:3001/status)
  SLIDE_TYPE=$(echo "$STATUS" | grep -o '"currentSlideType":"[^"]*"' | cut -d'"' -f4)

  if [ -n "$SLIDE_TYPE" ]; then
    echo "Captured slide $i ($SLIDE_TYPE)"
  else
    echo "Captured slide $i"
  fi
done

echo ""
echo "All slides saved to: $OUTPUT_DIR"
ls -la "$OUTPUT_DIR"
