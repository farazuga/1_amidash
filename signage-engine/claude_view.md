# Claude-Viewable Digital Signage Preview

This document describes how Claude can view signage output programmatically to verify visual changes after making code modifications.

## Quick Reference

```bash
# Capture current slide
curl -s http://127.0.0.1:3001/preview -o /tmp/signage-preview.png

# Jump to specific slide and capture
curl -s -X POST http://127.0.0.1:3001/control/slide/0
sleep 0.5
curl -s http://127.0.0.1:3001/preview -o /tmp/signage-preview.png

# View with Claude's Read tool
# Read /tmp/signage-preview.png
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Check if engine is running |
| `/status` | GET | Get engine status including slide types |
| `/preview` | GET | Get current frame as PNG |
| `/control/slide/:index` | POST | Jump to specific slide |

## Status Response

The `/status` endpoint returns detailed slide information:

```json
{
  "isRunning": true,
  "currentSlide": 0,
  "currentSlideType": "active-projects",
  "totalSlides": 10,
  "slides": [
    { "index": 0, "type": "active-projects", "enabled": true, "title": "Active Projects" },
    { "index": 1, "type": "po-ticker", "enabled": true, "title": "Purchase Orders" }
  ],
  "fps": 30,
  "dataStale": false
}
```

## Scripts

### capture-preview.sh

Capture a single slide to a temp file:

```bash
# Usage: ./scripts/capture-preview.sh [slide_index] [output_file]

# Capture current slide
./scripts/capture-preview.sh

# Capture slide 2 to specific file
./scripts/capture-preview.sh 2 /tmp/slide-2.png
```

### capture-all-slides.sh

Capture all slides to a directory:

```bash
# Usage: ./scripts/capture-all-slides.sh [output_directory]

# Capture all slides to default location
./scripts/capture-all-slides.sh

# Capture to specific directory
./scripts/capture-all-slides.sh /tmp/my-slides
```

## Workflow for Making Visual Changes

1. **Make code changes** to slide files in `src/renderer/slides/`

2. **Build the project:**
   ```bash
   npm run build
   ```

3. **Ensure engine is running:**
   ```bash
   # Check if running
   curl -s http://127.0.0.1:3001/health

   # If not running, start it
   npm run dev &
   ```

4. **Capture the slide you modified:**
   ```bash
   # Find slide index from status
   curl -s http://127.0.0.1:3001/status | jq '.slides'

   # Jump to that slide and capture
   curl -s -X POST http://127.0.0.1:3001/control/slide/0
   sleep 0.5
   curl -s http://127.0.0.1:3001/preview -o /tmp/signage-preview.png
   ```

5. **View the screenshot** using Claude's Read tool on `/tmp/signage-preview.png`

6. **Verify changes** are visible and correct

## Example: Changing Header Color

```
User: "Change the header color on the active-projects slide to red"

Claude:
1. Read src/renderer/slides/active-projects.ts
2. Edit the header color value
3. Run: npm run build
4. Run: curl -s -X POST http://127.0.0.1:3001/control/slide/0
5. Run: curl -s http://127.0.0.1:3001/preview -o /tmp/preview.png
6. Read /tmp/preview.png to verify the header is now red
7. Report to user with description of what's visible
```

## Slide Types

| Type | Description |
|------|-------------|
| `active-projects` | Grid of active project cards |
| `po-ticker` | Purchase order ticker/list |
| `revenue-dashboard` | Revenue metrics and charts |
| `team-schedule` | Team availability schedule |
| `health-dashboard` | Business health gauges |
| `alerts-dashboard` | System alerts display |
| `performance-metrics` | Performance KPIs |
| `velocity-chart` | Project velocity chart |
| `status-pipeline` | Status pipeline view |
| `cycle-time` | Cycle time metrics |

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Engine not running | Run `npm run dev` or check port 3001 |
| Preview returns 503 | Engine is stopped, start it first |
| Slide shows old content | Run `npm run build` after code changes |
| "SHOWING DEMO DATA" banner | Supabase not configured, expected in dev |
| Slide transition in progress | Wait 500ms after jumping slides |
