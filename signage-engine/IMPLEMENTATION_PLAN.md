# Signage Engine Design Implementation Plan

> Comprehensive plan to align all slides with [DESIGN.md](./DESIGN.md) guidelines
> Created: January 27, 2026 | Target: AmiDash Signage Engine v1.1

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current State Analysis](#current-state-analysis)
3. [Phase 1: Foundation & Performance](#phase-1-foundation--performance)
4. [Phase 2: Safe Area & Boundary System](#phase-2-safe-area--boundary-system)
5. [Phase 3: Typography Enforcement](#phase-3-typography-enforcement)
6. [Phase 4: Color Palette Alignment](#phase-4-color-palette-alignment)
7. [Phase 5: Layout & Space Optimization](#phase-5-layout--space-optimization)
8. [Phase 6: Slide-Specific Fixes](#phase-6-slide-specific-fixes)
9. [Phase 7: Animation & Polish](#phase-7-animation--polish)
10. [Testing & Validation](#testing--validation)
11. [File Change Summary](#file-change-summary)

---

## Executive Summary

### Issues Identified from Screenshot Review

| Issue Category | Severity | DESIGN.md Reference | Slides Affected |
|----------------|----------|---------------------|-----------------|
| Element clipping/overflow | **Critical** | [Layout & Grid: Screen Zones](#layout--grid) | Revenue, Velocity, Alerts |
| Massive empty space | **High** | [Core Principles: Less is More](#core-principles) | Team Schedule, POs, Alerts, Active Projects |
| Typography below 36px minimum | **High** | [Typography: Font Sizes](#typography) | All slides (various labels) |
| Color palette mismatch | **Medium** | [Color System: Chart Color Palette](#color-system) | Revenue Dashboard (pink bars) |
| Inconsistent spacing | **Medium** | [Layout & Grid: Spacing Scale](#layout--grid) | Multiple slides |
| FPS at 30 (should be 60) | **Low** | [Animation: Performance matters](#animation--motion) | Engine config |

### Success Metrics

After implementation, every slide must pass:
- [ ] Zero elements clipped at screen edges
- [ ] All text ≥ 36px (DESIGN.md minimum)
- [ ] Hero numbers 72-120px per DESIGN.md
- [ ] Content fills safe area effectively (no >30% empty space)
- [ ] Connection banner never overlaps content
- [ ] FPS running at 60

---

## Current State Analysis

### Screenshot-by-Screenshot Audit

#### 1. Team Schedule (`qpwm.png`, `qutm.png`)
```
DESIGN.md Reference: "Schedule/Timeline" (lines 379-394)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Guideline: "Maximum 8-10 people visible"
Current:   Only 3 rows shown, ~70% screen empty

Guideline: "Show dates/week prominently"
Current:   ✓ Date headers are visible at 40-48px

Guideline: "Truncate names if needed"
Current:   ✓ Using truncateText() function

ISSUE: Weekend columns (Sat/Sun) displayed but dimmed, wasting ~30% horizontal space
ISSUE: No dynamic row height calculation to fill vertical space
ISSUE: Content area calculation doesn't account for safe bottom margin
```

#### 2. Alerts Dashboard (`qqbc.png`)
```
DESIGN.md Reference: "Alert/Status Dashboard" (lines 357-376)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Guideline: "Priority list with status indicators"
Current:   Split into overdue/stuck sections ✓

Guideline: "Maximum 5-6 items visible"
Current:   Only showing 1-2 items, rest is empty

Guideline: "Pulse animation for critical only"
Current:   Animation disabled (drawAmbientEffects is no-op)

ISSUE: Alert cards tiny relative to screen (80%+ empty)
ISSUE: "+X more" text at 32px - below 36px minimum (line 185, 310)
ISSUE: Connection banner clips at bottom edge
```

#### 3. Velocity Chart (`qufl-2.png`)
```
DESIGN.md Reference: "Data Visualization: Bar Charts" (lines 216-221)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Guideline: "Maximum 8-10 bars visible"
Current:   6 month pairs shown ✓

Guideline: "Always include value labels ON or NEAR bars"
Current:   ✓ Values on top of bars at 40px

Guideline: "Bar width: minimum 40px"
Current:   ✓ Using 35% of group width

ISSUE: Summary card title at 36px, value at 52px (should be 72px per DESIGN.md KPI Cards)
ISSUE: Month labels may be obscured by connection banner
ISSUE: "Oct" label missing in middle (spacing issue)
```

#### 4. Status Pipeline (`quhu.png`)
```
DESIGN.md Reference: "Project Status Pipeline" (lines 419-436)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Guideline: "Show counts prominently per stage"
Current:   Numbers visible but could be larger

Guideline: "Highlight bottlenecks"
Current:   ✓ Yellow highlight on bottleneck stages

ISSUE: Stage count numbers should be hero-sized (72-96px)
ISSUE: Dollar amounts below numbers hard to read
ISSUE: "Bottleneck" indicator text small
```

#### 5. Recent POs (`qujl.png`)
```
DESIGN.md Reference: "KPI Cards" (lines 234-239)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Guideline: "Large central number (72-120px)"
Current:   ✓ PO amounts appear to be ~72px+

Guideline: "Consistent card sizes across slide"
Current:   ✓ 3 equal cards

ISSUE: Bottom 50% of screen completely empty
ISSUE: Cards should be vertically centered OR show more POs
```

#### 6. Cycle Time (`quky.png`)
```
DESIGN.md Reference: "Data Visualization" (lines 201-252)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Guideline: "Always label directly"
Current:   ✓ Stage names on left, days on right

ISSUE: Stage labels (New, Planning, etc.) appear smaller than 48px
ISSUE: Legend at bottom potentially below safe area
ISSUE: "Potential bottleneck status" text small
```

#### 7. Business Health (`qumu.png`)
```
DESIGN.md Reference: "Data Visualization" (lines 201-252)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Guideline: "Large central number (72-120px)"
Current:   ✓ Gauge percentages are large

ISSUE: Status badges (Procurement: X, Engineering: X) are small pills
ISSUE: "All systems healthy" section cramped at bottom
```

#### 8. Revenue Dashboard (`quoi.png`)
```
DESIGN.md Reference: "Revenue/Metrics Chart" (lines 397-416)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Guideline: "Bar chart for discrete periods" ✓
Guideline: "Include goal line for context" ✓

Guideline: "Chart Color Palette" (line 117-126)
  "1. #3B82F6 Blue" for primary data series
Current:   Using PINK (#EC4899 or similar) - WRONG

ISSUE: Pink/magenta bars violate color palette - should be Blue
ISSUE: Progress bars appear thin (<40px) - DESIGN.md says "40-60px minimum"
ISSUE: Chart extends too close to bottom edge
```

#### 9. Active Projects (`quqt.png`)
```
DESIGN.md Reference: "KPI Cards" (lines 234-239)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Guideline: "Consistent card sizes across slide"
Current:   2x2 grid but only 3 projects

ISSUE: Bottom-right quadrant completely empty
ISSUE: Should dynamically adjust grid or center content
```

#### 10. Performance Metrics (`qury.png`)
```
DESIGN.md Reference: "KPI Dashboard" (lines 339-355)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Guideline: "Hero number: 72-120px"
Current:   ✓ Large numbers in each quadrant

Guideline: "Labels: 40-48px"
Current:   Status labels at 32px (line 89, 149, 205)

ISSUE: Customer concentration section has small text
ISSUE: Company names at ~36px minimum, but percentages hard to read
ISSUE: Progress bars in concentration section are 12px (line 332) - should be larger
```

---

## Phase 1: Foundation & Performance

> **Goal:** Establish baseline performance and configuration
> **DESIGN.md Reference:** [Animation & Motion: Performance matters](./DESIGN.md#animation--motion) - "Maintain 60fps"

### 1.1 Increase Frame Rate to 60 FPS

**Files to modify:**

#### `config/default.yaml`
```yaml
# Before
ndi:
  name: "Amidash Signage"
  frameRate: 30

# After
ndi:
  name: "Amidash Signage"
  frameRate: 60
```

#### `src/config/defaults.ts`
```typescript
// Before (line 6)
frameRate: 30,

// After
frameRate: 60,
```

#### `src/config/loader.ts`
```typescript
// Before (line 15)
ndi: { name: 'Amidash Signage', frameRate: 30 },

// After
ndi: { name: 'Amidash Signage', frameRate: 60 },
```

### 1.2 Update Test Expectations

#### `src/config/schema.test.ts`
```typescript
// Update tests that expect 30fps default to expect 60fps
// Lines 70, 77: expect(config.frameRate).toBe(60);
```

### 1.3 Performance Verification

After changes, verify:
- [ ] Engine starts without errors
- [ ] API returns `fps: 60` in status endpoint
- [ ] No frame drops in extended operation (monitor CPU)

---

## Phase 2: Safe Area & Boundary System

> **Goal:** Prevent element clipping and ensure consistent margins
> **DESIGN.md Reference:** [Layout & Grid: Screen Zones](./DESIGN.md#layout--grid)

### 2.1 Define Safe Area Constants

**DESIGN.md specifies:**
```
┌─────────────────────────────────────────────────────────────┐
│ HEADER ZONE (180px)                                         │
├─────────────────────────────────────────────────────────────┤
│                    PRIMARY CONTENT ZONE                     │
│                        (1740px)                             │
├─────────────────────────────────────────────────────────────┤
│ FOOTER ZONE (240px)                                         │
└─────────────────────────────────────────────────────────────┘
Safe Margins: 140px on all sides
```

#### `src/renderer/slides/base-slide.ts`

Add new constants and helper methods:

```typescript
// Add after line 27 (after FONT_SIZE definition)

// Safe area constants per DESIGN.md "Layout & Grid: Screen Zones"
protected readonly SAFE_AREA = {
  top: 180,      // Header zone height
  bottom: 240,   // Footer zone height (for banners, legends)
  left: 140,     // SCREEN_MARGIN
  right: 140,    // SCREEN_MARGIN
} as const;

// Spacing scale per DESIGN.md "Layout & Grid: Spacing Scale"
protected readonly SPACING = {
  xs: 20,   // Tight internal padding
  sm: 40,   // Standard gaps between elements
  md: 60,   // Section separation
  lg: 80,   // Major section breaks
  xl: 120,  // Header/footer separation
} as const;
```

Add helper method:

```typescript
// Add after drawConnectionStatus method (around line 216)

/**
 * Get the safe content bounds per DESIGN.md "Layout & Grid: Screen Zones"
 * Returns the area where content should be rendered to avoid clipping
 */
protected getContentBounds(): {
  x: number;
  y: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
} {
  const x = this.SAFE_AREA.left;
  const y = this.SAFE_AREA.top;
  const width = this.displayConfig.width - this.SAFE_AREA.left - this.SAFE_AREA.right;
  const height = this.displayConfig.height - this.SAFE_AREA.top - this.SAFE_AREA.bottom;

  return {
    x,
    y,
    width,
    height,
    centerX: x + width / 2,
    centerY: y + height / 2,
  };
}

/**
 * Check if a rectangle would be clipped by safe area bounds
 * Use this to validate element positioning
 */
protected isWithinSafeArea(
  elementX: number,
  elementY: number,
  elementWidth: number,
  elementHeight: number
): boolean {
  const bounds = this.getContentBounds();
  return (
    elementX >= bounds.x &&
    elementY >= bounds.y &&
    elementX + elementWidth <= bounds.x + bounds.width &&
    elementY + elementHeight <= bounds.y + bounds.height
  );
}
```

### 2.2 Fix Connection Banner Position

**Current issue:** Banner renders at `height - boxHeight - 20` which overlaps content.

#### `src/renderer/slides/base-slide.ts`

```typescript
// In drawConnectionStatus method, change line 169:

// Before
const y = this.displayConfig.height - boxHeight - padding;

// After - position in footer zone, not overlapping content
const y = this.displayConfig.height - this.SAFE_AREA.bottom / 2 - boxHeight / 2;
```

### 2.3 Create Boundary Validation Helper

Add debug helper for development:

```typescript
/**
 * Debug helper: Draw safe area boundaries
 * Call this in render() during development to visualize safe areas
 */
protected drawSafeAreaDebug(ctx: SKRSContext2D): void {
  const bounds = this.getContentBounds();

  // Draw safe area rectangle
  ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 5]);
  ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
  ctx.setLineDash([]);

  // Draw center crosshairs
  ctx.beginPath();
  ctx.moveTo(bounds.centerX - 20, bounds.centerY);
  ctx.lineTo(bounds.centerX + 20, bounds.centerY);
  ctx.moveTo(bounds.centerX, bounds.centerY - 20);
  ctx.lineTo(bounds.centerX, bounds.centerY + 20);
  ctx.stroke();
}
```

---

## Phase 3: Typography Enforcement

> **Goal:** Ensure all text meets DESIGN.md minimum sizes
> **DESIGN.md Reference:** [Typography: Font Sizes for 4K](./DESIGN.md#typography)

### 3.1 Typography Scale Reference

From DESIGN.md:
```
| Use Case        | Size  | Weight | Constant to Use    |
|-----------------|-------|--------|-------------------|
| Hero numbers    | 120px | 700    | FONT_SIZE.HERO    |
| Primary values  | 72px  | 600    | FONT_SIZE.LARGE   |
| Section headers | 56px  | 700    | FONT_SIZE.HEADER  |
| Card text       | 48px  | 400-600| FONT_SIZE.BODY    |
| Labels          | 40px  | 400    | FONT_SIZE.LABEL   |
| **Minimum**     | 36px  | 400    | FONT_SIZE.MINIMUM |
```

**Critical rule from DESIGN.md:** "Nothing below 36px. Ever."

### 3.2 Typography Violations to Fix

#### `src/renderer/slides/alerts-dashboard.ts`

```typescript
// Line 185 - "+X more" text
// Before
size: 32,

// After (use FONT_SIZE.MINIMUM)
size: this.FONT_SIZE.MINIMUM,

// Line 310 - Same issue
// Before
size: 32,

// After
size: this.FONT_SIZE.MINIMUM,
```

#### `src/renderer/slides/performance-metrics.ts`

```typescript
// Lines 89, 149, 205 - Status labels ("Healthy", "Needs Attention", etc.)
// Before
size: 32,

// After (should be at least FONT_SIZE.MINIMUM)
size: this.FONT_SIZE.MINIMUM,
```

#### `src/renderer/slides/velocity-chart.ts`

```typescript
// Line 159 - Summary card value
// Before
size: 52,

// After (KPI values should be FONT_SIZE.LARGE per DESIGN.md)
size: this.FONT_SIZE.LARGE,  // 72px
```

### 3.3 Typography Audit Checklist

Run through each slide file and verify:

| File | Issue | Line | Current | Should Be |
|------|-------|------|---------|-----------|
| alerts-dashboard.ts | "+X more" text | 185, 310 | 32px | 36px (MINIMUM) |
| performance-metrics.ts | Status labels | 89, 149, 205 | 32px | 36px (MINIMUM) |
| velocity-chart.ts | Card values | 159 | 52px | 72px (LARGE) |
| cycle-time.ts | Stage labels | TBD | TBD | 48px (BODY) |
| status-pipeline.ts | Stage numbers | TBD | TBD | 72-96px |

---

## Phase 4: Color Palette Alignment

> **Goal:** Align colors with DESIGN.md semantic usage
> **DESIGN.md Reference:** [Color System](./DESIGN.md#color-system)

### 4.1 Current vs. DESIGN.md Colors

**Current `colors.ts` (brand colors):**
```typescript
success: '#C2E0AD',  // Light green
warning: '#F59F43',  // Amber
error: '#DE3829',    // Coral/Red
info: '#C67CA8',     // Mauve/PINK ← Problem!
```

**DESIGN.md Chart Color Palette:**
```
1. #3B82F6  Blue     ← Should be primary data series
2. #22C55E  Green
3. #F59E0B  Amber
4. #8B5CF6  Purple
5. #EC4899  Pink     ← Only 5th in sequence, not primary
6. #06B6D4  Cyan
```

### 4.2 Color Palette Update

**Decision:** Keep Amitrace brand colors for status indicators, but add new chart-specific colors.

#### `src/renderer/components/colors.ts`

```typescript
// Add after line 21 (after info definition)

// Chart data series colors per DESIGN.md "Chart Color Palette"
// Use these for bar charts, line charts, data visualization
chartPrimary: '#3B82F6',     // Blue - primary data series
chartSecondary: '#22C55E',   // Green - secondary series
chartTertiary: '#F59E0B',    // Amber - tertiary series
chartQuaternary: '#8B5CF6',  // Purple
chartQuinary: '#EC4899',     // Pink
chartSenary: '#06B6D4',      // Cyan

// Ordered array for easy iteration
chartPalette: [
  '#3B82F6',  // Blue
  '#22C55E',  // Green
  '#F59E0B',  // Amber
  '#8B5CF6',  // Purple
  '#EC4899',  // Pink
  '#06B6D4',  // Cyan
] as const,
```

### 4.3 Fix Revenue Dashboard Bar Colors

#### `src/renderer/slides/revenue-dashboard.ts`

```typescript
// Around line 135-141, in chartData mapping
// Before
const chartData = revenue.monthlyData.map((m) => ({
  label: m.month,
  value: m.revenue,
  color: colors.info,  // This is PINK (#C67CA8)
  ...
}));

// After
const chartData = revenue.monthlyData.map((m) => ({
  label: m.month,
  value: m.revenue,
  color: colors.chartPrimary,  // Blue (#3B82F6) per DESIGN.md
  ...
}));
```

### 4.4 Verify Semantic Color Usage

Per DESIGN.md:

| Status | Color | Use For | Current Usage |
|--------|-------|---------|---------------|
| Positive | Green | Goals met, on-track | ✓ Correct |
| Neutral | Blue | Standard data | ✗ Using pink - FIX |
| Attention | Amber | Behind target | ✓ Correct |
| Critical | Red | Alerts, blockers | ✓ Correct |

---

## Phase 5: Layout & Space Optimization

> **Goal:** Eliminate excessive empty space while maintaining visual hierarchy
> **DESIGN.md Reference:** [Layout & Grid](./DESIGN.md#layout--grid)

### 5.1 Space Utilization Principles

From DESIGN.md:
- "White space is content - don't fill every pixel"
- BUT also "7-8 visual elements maximum"

**Balance:** Content should fill safe area purposefully. Empty space should be intentional padding, not unused screen real estate.

### 5.2 Team Schedule - Fill Vertical Space

#### `src/renderer/slides/team-schedule.ts`

**Problem:** Only 3 rows with ~70% screen empty.

**Solution:** Dynamic row height with maximum, vertical centering.

```typescript
// Replace lines 18-24 with improved calculation

// Calculate how much vertical space we have
const bounds = this.getContentBounds();
const headerAreaHeight = 100; // Day labels area
const availableHeight = bounds.height - headerAreaHeight;

// Dynamic row height based on team size
const minRowHeight = 180;  // Increased from 140
const maxRowHeight = 320;  // Increased from 280
const numRows = Math.max(schedule.length, 1);

// Calculate ideal row height to fill space
let rowHeight = Math.floor(availableHeight / numRows);

// Clamp to min/max
rowHeight = Math.min(maxRowHeight, Math.max(minRowHeight, rowHeight));

// If we have few rows, calculate vertical offset to center
const totalRowsHeight = rowHeight * numRows;
const verticalOffset = Math.max(0, (availableHeight - totalRowsHeight) / 2);
```

**Add config option to hide weekends:**

```typescript
// Check config for weekend display (default: hide weekends for efficiency)
const showWeekends = this.config.showWeekends ?? false;

// Filter days if not showing weekends
const daysToRender = showWeekends
  ? daysToShow
  : Array.from({ length: daysToShow }, (_, i) => addDays(startDate, i))
      .filter(d => d.getDay() !== 0 && d.getDay() !== 6);
```

### 5.3 Alerts Dashboard - Hero Treatment

#### `src/renderer/slides/alerts-dashboard.ts`

**Problem:** Tiny alert cards with 80%+ screen empty.

**Solution:** Much larger cards, hero-sized numbers.

```typescript
// In drawOverdueSection, increase card sizes

// Before (line 175-176)
const itemHeight = 120;
const maxItems = Math.min(projects.length, 4);

// After - larger items, more visual impact
const itemHeight = 200;  // Much larger items
const maxItems = Math.min(projects.length, 3);  // Show fewer but bigger
```

**Increase header section:**

```typescript
// Before (line 132) - Header background height
ctx.roundRect(x, y, width, 120, 12);

// After - larger header with hero numbers
ctx.roundRect(x, y, width, 180, 12);

// Update count badge size (line 151-164)
const badgeRadius = 70;  // Was 50
// Update font size for count
size: 72,  // Was 56, now hero-sized
```

### 5.4 Recent POs - Vertical Centering

#### `src/renderer/slides/po-ticker.ts`

**Problem:** Bottom 50% empty.

**Solution:** Vertically center cards OR show more POs.

```typescript
// Calculate vertical centering
const bounds = this.getContentBounds();
const totalCardsHeight = cardHeight * Math.ceil(ordersToShow.length / 3) + gaps;
const verticalOffset = (bounds.height - totalCardsHeight) / 2;

// Use verticalOffset when positioning cards
const cardY = bounds.y + verticalOffset + row * (cardHeight + gap);
```

### 5.5 Active Projects - Dynamic Grid

#### `src/renderer/slides/active-projects.ts`

**Problem:** 2x2 grid with only 3 projects leaves empty quadrant.

**Solution:** Dynamic grid based on count.

```typescript
// Dynamic grid logic
const projectCount = projects.length;

let cols: number;
let rows: number;

if (projectCount <= 2) {
  cols = projectCount;
  rows = 1;
} else if (projectCount <= 4) {
  cols = 2;
  rows = 2;
} else if (projectCount <= 6) {
  cols = 3;
  rows = 2;
} else {
  cols = 3;
  rows = Math.ceil(projectCount / 3);
}

// Calculate card dimensions based on grid
const cardWidth = (bounds.width - gap * (cols - 1)) / cols;
const cardHeight = (bounds.height - gap * (rows - 1)) / rows;
```

---

## Phase 6: Slide-Specific Fixes

### 6.1 Velocity Chart

#### `src/renderer/slides/velocity-chart.ts`

**Issues:**
1. Summary card values too small (52px → 72px)
2. Content may extend into footer zone

**Fixes:**

```typescript
// Line 25 - Increase bottom margin for chart
const contentHeight = height - contentY - this.SAFE_AREA.bottom;

// Line 159 - Increase card value size
size: this.FONT_SIZE.LARGE,  // 72px instead of 52px
```

### 6.2 Status Pipeline

**Issues:**
1. Stage numbers should be hero-sized
2. Dollar amounts hard to read

**Fixes:**

```typescript
// Stage count numbers - use hero sizing
size: this.FONT_SIZE.LARGE,  // 72px minimum

// Dollar amounts
size: this.FONT_SIZE.BODY,  // 48px
```

### 6.3 Cycle Time

**Issues:**
1. Stage labels potentially too small
2. Legend in footer zone

**Fixes:**

```typescript
// Stage labels (New, Planning, etc.)
size: this.FONT_SIZE.BODY,  // 48px

// Day values on right
size: this.FONT_SIZE.BODY,  // 48px

// Ensure legend is within safe area
const legendY = bounds.y + bounds.height - 60;  // Within content bounds
```

### 6.4 Business Health

**Issues:**
1. Status badges at bottom too small
2. Department pills hard to read

**Fixes:**

```typescript
// Department status badges
size: this.FONT_SIZE.MINIMUM,  // 36px minimum
// Increase badge padding for better visibility
const badgePadding = 20;  // More generous padding
```

### 6.5 Performance Metrics

**Issues:**
1. Customer concentration text small
2. Progress bars in concentration section too thin (12px)

**Fixes:**

```typescript
// Line 332 - Progress bar height
const barHeight = 24;  // Was 12px, increased for visibility

// Company names
size: this.FONT_SIZE.LABEL,  // 40px

// Percentages
size: this.FONT_SIZE.BODY,  // 48px
weight: 700,
```

### 6.6 Revenue Dashboard

**Issues:**
1. Pink bars (fix in Phase 4)
2. Progress bars too thin
3. Chart close to bottom

**Fixes:**

```typescript
// Progress bar height (around line 99-107)
const progressHeight = 50;  // Was 40, per DESIGN.md "40-60px minimum"

// Chart bottom margin
const chartHeight = this.displayConfig.height - chartY - this.SAFE_AREA.bottom;
```

---

## Phase 7: Animation & Polish

> **DESIGN.md Reference:** [Animation & Motion](./DESIGN.md#animation--motion)

### 7.1 Animation Principles Review

From DESIGN.md:
```
Data Updates:
- Number counters: Animate value changes smoothly
- Progress bars: Ease to new position over 500ms
- Easing: ease-out for entering, ease-in-out for updates
```

### 7.2 Re-enable Selective Ambient Effects

Current `drawAmbientEffects()` is disabled. Consider enabling subtle effects per DESIGN.md:

```typescript
// In base-slide.ts, update drawAmbientEffects

protected drawAmbientEffects(ctx: SKRSContext2D): void {
  // Only draw very subtle gradient - per DESIGN.md "Very slow (30-60s cycle)"
  if (this.displayConfig.enableAmbientEffects) {
    drawAmbientGradient(ctx, this.animationState, this.displayConfig);
  }
  // Particles disabled per DESIGN.md - "Only for celebration/achievement states"
}
```

### 7.3 Timing Standards

Ensure all animations follow DESIGN.md timing:

```
Micro-interactions:  150-250ms
Standard transitions: 300-500ms
Data animations:      500-800ms
```

---

## Testing & Validation

### Pre-Implementation Checklist

- [ ] Backup current configuration
- [ ] Note current screenshot baseline
- [ ] Run existing tests: `npm test`

### Post-Implementation Validation

For each slide, verify against DESIGN.md:

#### Typography Validation
```bash
# Search for any font size below 36
grep -rn "size: [0-3][0-5]" src/renderer/slides/
# Should return no results after fixes
```

#### Visual Validation Checklist

| Slide | No Clipping | Min 36px Text | Hero Numbers | Space Used | Colors Correct |
|-------|-------------|---------------|--------------|------------|----------------|
| Team Schedule | [ ] | [ ] | N/A | [ ] | [ ] |
| Alerts | [ ] | [ ] | [ ] | [ ] | [ ] |
| Velocity | [ ] | [ ] | [ ] | [ ] | [ ] |
| Status Pipeline | [ ] | [ ] | [ ] | [ ] | [ ] |
| Recent POs | [ ] | [ ] | [ ] | [ ] | [ ] |
| Cycle Time | [ ] | [ ] | [ ] | [ ] | [ ] |
| Business Health | [ ] | [ ] | [ ] | [ ] | [ ] |
| Revenue Dashboard | [ ] | [ ] | [ ] | [ ] | [ ] |
| Active Projects | [ ] | [ ] | N/A | [ ] | [ ] |
| Performance Metrics | [ ] | [ ] | [ ] | [ ] | [ ] |

### Performance Validation

```bash
# Start engine and verify FPS
curl http://localhost:3001/status | jq '.fps'
# Expected: 60

# Monitor CPU during operation
top -pid $(pgrep -f "signage")
# Ensure < 50% CPU sustained
```

---

## File Change Summary

| File | Phase | Changes |
|------|-------|---------|
| `config/default.yaml` | 1 | FPS 30→60 |
| `src/config/defaults.ts` | 1 | FPS 30→60 |
| `src/config/loader.ts` | 1 | FPS 30→60 |
| `src/config/schema.test.ts` | 1 | Update test expectations |
| `src/renderer/slides/base-slide.ts` | 2 | Add SAFE_AREA, SPACING, helper methods |
| `src/renderer/components/colors.ts` | 4 | Add chart palette colors |
| `src/renderer/slides/alerts-dashboard.ts` | 3,5,6 | Typography, larger cards |
| `src/renderer/slides/velocity-chart.ts` | 3,6 | Typography, spacing |
| `src/renderer/slides/performance-metrics.ts` | 3,6 | Typography, progress bars |
| `src/renderer/slides/team-schedule.ts` | 5 | Dynamic rows, centering |
| `src/renderer/slides/po-ticker.ts` | 5 | Vertical centering |
| `src/renderer/slides/active-projects.ts` | 5 | Dynamic grid |
| `src/renderer/slides/revenue-dashboard.ts` | 4,6 | Blue bars, progress bar height |
| `src/renderer/slides/status-pipeline.ts` | 3,6 | Hero numbers |
| `src/renderer/slides/cycle-time.ts` | 3,6 | Typography |
| `src/renderer/slides/health-dashboard.ts` | 3,6 | Badge sizes |

---

## Implementation Priority Order

1. **Phase 1** - FPS increase (quick win, immediate performance benefit)
2. **Phase 2** - Safe area system (foundational for all other fixes)
3. **Phase 4** - Color palette (fixes most visible issue - pink bars)
4. **Phase 3** - Typography (systematic audit and fix)
5. **Phase 5** - Layout optimization (requires safe area system)
6. **Phase 6** - Slide-specific fixes (detailed work)
7. **Phase 7** - Animation polish (final refinement)

---

## Appendix: DESIGN.md Quick Reference

```
┌─────────────────────────────────────────────────────────┐
│  DIGITAL SIGNAGE DESIGN QUICK REFERENCE                 │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  FONT SIZES              SPACING                        │
│  Hero:    120px          xs: 20px                       │
│  Large:    72px          sm: 40px                       │
│  Header:   56px          md: 60px                       │
│  Body:     48px          lg: 80px                       │
│  Label:    40px          xl: 120px                      │
│  Minimum:  36px          Margin: 140px                  │
│                                                         │
│  COLORS (Charts)         RULES                          │
│  Primary:  #3B82F6       • Max 10-18 words              │
│  Success:  #22C55E       • Max 7-8 visual elements      │
│  Warning:  #F59E0B       • 5-second comprehension       │
│  Error:    #EF4444       • 4.5:1 contrast minimum       │
│                          • Never color-only meaning     │
│  SAFE AREA                                              │
│  Header:  180px          Bottom: 240px                  │
│  Margins: 140px all sides                               │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

*Plan created: January 27, 2026*
*Target completion: Implement in order of priority*
*Reference document: [DESIGN.md](./DESIGN.md)*
