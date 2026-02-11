# Digital Signage Visual Design Recommendations

> Comprehensive audit of 10 slides with prioritized fixes based on DESIGN.md guidelines
> **Target:** 4K displays (3840x2160) | **Viewing distance:** 10-20 feet

---

## Executive Summary

This document catalogs visual issues observed across 10 digital signage slides, organized by severity. The most common issues are:

1. **Text overlapping** - Elements positioned too close without proper spacing calculations
2. **Icon rendering failures** - Unicode characters not rendering in canvas context
3. **Poor space utilization** - Content not filling available screen real estate
4. **Banner/footer conflicts** - Connection status banner overlapping slide content

---

## 1. Critical Priority (Text Overlap / Unreadable Content)

These issues make content unreadable and must be fixed immediately.

### 1.1 Performance Metrics - Customer Concentration Overlap

| Attribute | Value |
|-----------|-------|
| **Slide** | Slide 3 - Performance Metrics |
| **Issue** | "58% from top 3" text and "Medium Risk" badge overlap with the numbered client list on the right side |
| **Root Cause** | The left section (`leftSectionWidth = 200`) and right section (`listX = x + leftSectionWidth + 80`) have insufficient separation when card width is narrow |
| **DESIGN.md Violation** | "Align elements to the grid - no arbitrary positioning" |
| **File** | `/Users/faraz/Desktop/1_amidash-wt3/signage-engine/src/renderer/slides/performance-metrics.ts` |
| **Lines** | 252-286 (left section), 288-345 (right section) |

**Recommended Fix:**
```typescript
// Increase left section width and add proper separation
const leftSectionWidth = 300; // Increase from 200
const listX = x + leftSectionWidth + 100; // Increase gap from 80
// OR use proportional widths based on card width
const leftSectionWidth = width * 0.35;
const listX = x + leftSectionWidth + width * 0.05;
```

### 1.2 Alerts Dashboard - Value and Days Overlap

| Attribute | Value |
|-----------|-------|
| **Slide** | Slide 5 - Alerts Dashboard |
| **Issue** | "$45K" amount and "18d" days badge overlap on the right side of alert items |
| **Root Cause** | The amount text at `x + width - 30` and days badge at `x + width - badgeWidth - 20` can collide when amount text is wide |
| **DESIGN.md Violation** | "Group related information visually" with proper spacing |
| **File** | `/Users/faraz/Desktop/1_amidash-wt3/signage-engine/src/renderer/slides/alerts-dashboard.ts` |
| **Lines** | 346-379 (`drawStuckItem` method) |

**Recommended Fix:**
```typescript
// Stack the amount above the days badge vertically instead of side-by-side
// Amount at top right
drawText(ctx, `$${this.formatNumber(project.salesAmount)}`, x + width - 30, y + 25, {
  // ... positioned at top
});

// Days badge below amount
const badgeY = y + 55; // Move below amount
ctx.roundRect(x + width - badgeWidth - 20, badgeY, badgeWidth, badgeHeight, 8);
```

### 1.3 Status Pipeline - Summary Text Overlap

| Attribute | Value |
|-----------|-------|
| **Slide** | Slide 7 - Status Pipeline |
| **Issue** | "20 Active Projects" and "$678K Pipeline Value" subtitle text appears cut off or overlapping |
| **Root Cause** | Text positioned at `centerX - 250` and `centerX + 250` can overlap when display is narrower than expected |
| **DESIGN.md Violation** | "Safe Margins: 140px on all sides" |
| **File** | `/Users/faraz/Desktop/1_amidash-wt3/signage-engine/src/renderer/slides/status-pipeline.ts` |
| **Lines** | 54-95 (`drawSummary` method) |

**Recommended Fix:**
```typescript
// Use proportional spacing based on width
const leftCenterX = x + width * 0.25;
const rightCenterX = x + width * 0.75;
// OR reduce font size if content doesn't fit
const summaryFontSize = Math.min(96, width / 20);
```

---

## 2. High Priority (Layout Issues / Poor Space Utilization)

These issues affect usability and visual polish.

### 2.1 Active Projects - Empty Grid Cell

| Attribute | Value |
|-----------|-------|
| **Slide** | Slide 2 - Active Projects |
| **Issue** | Only 3 projects shown but uses 2x2 grid leaving bottom-right cell empty |
| **Root Cause** | Grid logic at lines 36-51 forces 2x2 for 3-4 projects without considering odd counts |
| **DESIGN.md Violation** | "White space is content - don't fill every pixel" but empty grid cells look broken |
| **File** | `/Users/faraz/Desktop/1_amidash-wt3/signage-engine/src/renderer/slides/active-projects.ts` |
| **Lines** | 36-51 (grid logic) |

**Recommended Fix:**
```typescript
// Add special case for 3 projects - use 3x1 layout
if (projectCount === 3) {
  cols = 3;
  rows = 1;
} else if (projectCount <= 4) {
  cols = 2;
  rows = 2;
}
```

### 2.2 Alerts Dashboard - Excessive Empty Space

| Attribute | Value |
|-----------|-------|
| **Slide** | Slide 5 - Alerts Dashboard |
| **Issue** | When there are few alerts, excessive empty space remains below the alert items |
| **Root Cause** | `maxItems = 4` is hardcoded, and content doesn't expand to fill available space |
| **DESIGN.md Violation** | Alert slides should "Maximum 5-6 items visible" and fill screen appropriately |
| **File** | `/Users/faraz/Desktop/1_amidash-wt3/signage-engine/src/renderer/slides/alerts-dashboard.ts` |
| **Lines** | 176-189, 303-316 |

**Recommended Fix:**
```typescript
// Dynamically calculate itemHeight to fill available space
const availableHeight = height - 150; // Below header
const itemHeight = Math.min(150, availableHeight / Math.min(projects.length, 5));
const maxItems = Math.min(projects.length, Math.floor(availableHeight / 100));
```

### 2.3 Velocity Chart - Month Labels Hidden by Banner

| Attribute | Value |
|-----------|-------|
| **Slide** | Slide 6 - Velocity Chart |
| **Issue** | "Oct" and "Nov" month labels at chart bottom are partially hidden behind the red "NOT CONNECTED" banner |
| **Root Cause** | Chart height calculation `height - contentY - padding - 100` doesn't account for banner height |
| **DESIGN.md Violation** | "Footer Zone (240px)" should be reserved for banners/legends |
| **File** | `/Users/faraz/Desktop/1_amidash-wt3/signage-engine/src/renderer/slides/velocity-chart.ts` |
| **Lines** | 25-26 |

**Recommended Fix:**
```typescript
// Use SAFE_AREA.bottom instead of hardcoded padding
const contentHeight = height - contentY - this.SAFE_AREA.bottom;
// Legend should be positioned within safe area
const legendY = chartY + chartHeight - 60; // Keep above banner zone
```

### 2.4 Cycle Time - Legend Overlaps Banner

| Attribute | Value |
|-----------|-------|
| **Slide** | Slide 9 - Cycle Time |
| **Issue** | Legend text "= Potential bottleneck status" overlaps with the "NOT CONNECTED" banner |
| **Root Cause** | Legend positioned at `y + height - 20` without accounting for banner height |
| **DESIGN.md Violation** | "Footer Zone (240px)" for secondary elements |
| **File** | `/Users/faraz/Desktop/1_amidash-wt3/signage-engine/src/renderer/slides/cycle-time.ts` |
| **Lines** | 215-230 |

**Recommended Fix:**
```typescript
// Position legend above the footer zone
const legendY = y + height - this.SAFE_AREA.bottom + 60;
// OR move legend to top-right of chart area
const legendY = y + 20;
const legendX = x + width - 300;
```

### 2.5 Velocity Chart - Bar Value Labels Overlap Bar Tops

| Attribute | Value |
|-----------|-------|
| **Slide** | Slide 6 - Velocity Chart |
| **Issue** | Bar value labels (8, 9, 10, etc.) positioned at `barY - 20` can overlap with bar tops when bars are near maximum height |
| **Root Cause** | Fixed offset doesn't account for bar height variation |
| **DESIGN.md Violation** | "Position labels on or very near the data" without overlap |
| **File** | `/Users/faraz/Desktop/1_amidash-wt3/signage-engine/src/renderer/slides/velocity-chart.ts` |
| **Lines** | 238-246, 263-272 |

**Recommended Fix:**
```typescript
// Ensure minimum spacing above bar
const labelOffset = Math.max(30, 50 - (barY - y) / 10);
drawText(ctx, value.toString(), barX + barWidth / 2, barY - labelOffset, {...});
```

---

## 3. Medium Priority (Visual Polish / Sizing)

These issues affect visual quality but content is still readable.

### 3.1 Health Dashboard - Icon Rendering Failure

| Attribute | Value |
|-----------|-------|
| **Slide** | Slide 0 - Business Health |
| **Issue** | Checkmark icon in "ALL SYSTEMS HEALTHY" shows as empty box instead of checkmark |
| **Root Cause** | Unicode character `\u2713` (checkmark) may not be available in the canvas font |
| **DESIGN.md Violation** | "Never use color alone to convey meaning" - icon is needed |
| **File** | `/Users/faraz/Desktop/1_amidash-wt3/signage-engine/src/renderer/slides/health-dashboard.ts` |
| **Lines** | 92-113 (statusIcon assignment) |

**Recommended Fix:**
```typescript
// Option 1: Use a web-safe Unicode character
statusIcon = '\u2714'; // Heavy check mark (more likely to render)

// Option 2: Draw the checkmark programmatically
private drawCheckmark(ctx: SKRSContext2D, x: number, y: number, size: number, color: string) {
  ctx.beginPath();
  ctx.moveTo(x - size/2, y);
  ctx.lineTo(x - size/6, y + size/3);
  ctx.lineTo(x + size/2, y - size/3);
  ctx.strokeStyle = color;
  ctx.lineWidth = size / 6;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
}
```

### 3.2 Health Dashboard - Gauge Needle/Text Overlap

| Attribute | Value |
|-----------|-------|
| **Slide** | Slide 0 - Business Health |
| **Issue** | Gauge needles overlap with the percentage text inside the gauges |
| **Root Cause** | Needle length at `radius * 0.7` extends into the center circle where percentage is displayed |
| **DESIGN.md Violation** | "Include value labels ON or NEAR bars" - not overlapping |
| **File** | `/Users/faraz/Desktop/1_amidash-wt3/signage-engine/src/renderer/components/gauge.ts` |
| **Lines** | 163-207 (`drawNeedle` function) |

**Recommended Fix:**
```typescript
// Shorten needle to stop before center circle
const needleLength = radius * 0.55; // Reduce from 0.7
// OR move percentage text below center
drawText(ctx, `${Math.round(displayValue)}%`, centerX, centerY + radius * 0.5, {...});
```

### 3.3 Health Dashboard - Small Bottleneck Badges

| Attribute | Value |
|-----------|-------|
| **Slide** | Slide 0 - Business Health |
| **Issue** | "Procurement: 3" and "Engineering: 2" badges are small and hard to read from distance |
| **Root Cause** | Badge dimensions `280x70` and `FONT_SIZE.MINIMUM` may be too small for 4K at distance |
| **DESIGN.md Violation** | "Body text: 48px" for card text |
| **File** | `/Users/faraz/Desktop/1_amidash-wt3/signage-engine/src/renderer/slides/health-dashboard.ts` |
| **Lines** | 159-207 (`drawBottleneckIndicators`) |

**Recommended Fix:**
```typescript
// Increase badge size and text
const badgeWidth = 350;  // Increase from 280
const badgeHeight = 90;  // Increase from 70
// Use BODY size instead of MINIMUM
size: this.FONT_SIZE.BODY,  // 48px instead of 36px
```

### 3.4 Revenue Dashboard - Small Goal Text

| Attribute | Value |
|-----------|-------|
| **Slide** | Slide 1 - Revenue Dashboard |
| **Issue** | Goal text under progress bars is quite small (36px) |
| **Root Cause** | Hardcoded `size: 36` in drawText calls |
| **DESIGN.md Violation** | "Minimum: 36px" - while compliant, could be larger for emphasis |
| **File** | `/Users/faraz/Desktop/1_amidash-wt3/signage-engine/src/renderer/slides/revenue-dashboard.ts` |
| **Lines** | 93-97, 109-113 |

**Recommended Fix:**
```typescript
// Use FONT_SIZE.LABEL (40px) for progress labels
size: this.FONT_SIZE.LABEL,
```

### 3.5 Status Pipeline - Small Stage Labels

| Attribute | Value |
|-----------|-------|
| **Slide** | Slide 7 - Status Pipeline |
| **Issue** | Pipeline stage labels at top are small and hard to read |
| **Root Cause** | `size: this.FONT_SIZE.LABEL` (40px) may be too small for stage headers |
| **DESIGN.md Violation** | "Section headers: 56px" |
| **File** | `/Users/faraz/Desktop/1_amidash-wt3/signage-engine/src/renderer/slides/status-pipeline.ts` |
| **Lines** | 239-246 |

**Recommended Fix:**
```typescript
// Use HEADER size for stage names
size: this.FONT_SIZE.BODY, // 48px, or HEADER (56px) if space allows
```

### 3.6 Cycle Time - Stage Duration Values

| Attribute | Value |
|-----------|-------|
| **Slide** | Slide 9 - Cycle Time |
| **Issue** | Stage duration values (12d, 8d, etc.) could be more prominent |
| **Root Cause** | Currently 44px which is acceptable but could be larger |
| **DESIGN.md Violation** | "Primary values: 72px" for important metrics |
| **File** | `/Users/faraz/Desktop/1_amidash-wt3/signage-engine/src/renderer/slides/cycle-time.ts` |
| **Lines** | 187-194 |

**Recommended Fix:**
```typescript
// Increase duration value size
size: this.FONT_SIZE.HEADER, // 56px instead of 44px
```

### 3.7 Active Projects - Card Vertical Space

| Attribute | Value |
|-----------|-------|
| **Slide** | Slide 2 - Active Projects |
| **Issue** | Cards have excessive empty vertical space between content elements |
| **Root Cause** | Fixed pixel offsets don't scale with card height |
| **DESIGN.md Violation** | "Spacing Scale" should be used consistently |
| **File** | `/Users/faraz/Desktop/1_amidash-wt3/signage-engine/src/renderer/slides/active-projects.ts` |
| **Lines** | 82-202 (`drawProjectCard`) |

**Recommended Fix:**
```typescript
// Use proportional spacing based on card height
const verticalSpacing = height * 0.08;
const nameY = y + padding + 130 + verticalSpacing;
```

---

## 4. Low Priority (Minor Enhancements)

These are nice-to-have improvements.

### 4.1 Team Schedule - Day Header Size

| Attribute | Value |
|-----------|-------|
| **Slide** | Slide 4 - Team Schedule |
| **Issue** | Day headers (Mon, Tue, etc.) could be slightly larger |
| **Current** | `FONT_SIZE.LABEL` (40px) for day, `FONT_SIZE.BODY` (48px) for date |
| **File** | `/Users/faraz/Desktop/1_amidash-wt3/signage-engine/src/renderer/slides/team-schedule.ts` |
| **Lines** | 73-86 |

**Recommended Fix:**
```typescript
// Increase day label size
size: this.FONT_SIZE.BODY, // 48px for day name
size: this.FONT_SIZE.HEADER, // 56px for date number
```

### 4.2 Recent POs - Visual Hierarchy

| Attribute | Value |
|-----------|-------|
| **Slide** | Slide 8 - Recent POs |
| **Issue** | Cards look good but could use more visual hierarchy |
| **Suggestion** | Add subtle gradient backgrounds or accent colors to differentiate cards |
| **File** | `/Users/faraz/Desktop/1_amidash-wt3/signage-engine/src/renderer/slides/po-ticker.ts` |

**Recommended Fix:**
```typescript
// Add gradient background to cards
const gradient = ctx.createLinearGradient(x, y, x, y + height);
gradient.addColorStop(0, hexToRgba(rankColor, 0.15));
gradient.addColorStop(1, hexToRgba(rankColor, 0.05));
ctx.fillStyle = gradient;
```

### 4.3 Active Projects - Project Value Size

| Attribute | Value |
|-----------|-------|
| **Slide** | Slide 2 - Active Projects |
| **Issue** | Project value text could be larger for emphasis |
| **Current** | 72px |
| **DESIGN.md** | "Hero numbers: 120px" for primary values |
| **File** | `/Users/faraz/Desktop/1_amidash-wt3/signage-engine/src/renderer/slides/active-projects.ts` |
| **Lines** | 161-169 |

**Recommended Fix:**
```typescript
// Increase value size based on card size
size: Math.min(96, cardHeight * 0.15), // Scale with card
```

---

## 5. Global Issues (Across All Slides)

### 5.1 Connection Banner Overlap

| Attribute | Value |
|-----------|-------|
| **Affected Slides** | All slides with charts/legends at bottom (6, 7, 9) |
| **Issue** | "NOT CONNECTED TO DATABASE - SHOWING DEMO DATA" banner overlaps content |
| **Root Cause** | Banner positioned at `height - SAFE_AREA.bottom / 2` but slides don't account for this |
| **File** | `/Users/faraz/Desktop/1_amidash-wt3/signage-engine/src/renderer/slides/base-slide.ts` |
| **Lines** | 227-280 (`drawConnectionStatus`) |

**Recommended Fix - Option A (Slides Account for Banner):**
```typescript
// In each slide, use getContentBounds() which already accounts for SAFE_AREA
const bounds = this.getContentBounds();
// All content should stay within bounds.y to bounds.y + bounds.height
```

**Recommended Fix - Option B (Move Banner Higher):**
```typescript
// Position banner at very bottom, below all content
const y = this.displayConfig.height - boxHeight - 20;
```

### 5.2 Icon Character Rendering

| Attribute | Value |
|-----------|-------|
| **Affected Slides** | 0, 5, 7, 9 (any using Unicode symbols) |
| **Issue** | Some icon characters don't render properly (showing as boxes) |
| **Root Cause** | Canvas font doesn't include all Unicode glyphs |
| **File** | Multiple files |

**Recommended Fix:**
```typescript
// Create a utility function for drawing common icons programmatically
// /src/renderer/components/icons.ts
export function drawCheckIcon(ctx, x, y, size, color) { ... }
export function drawWarningIcon(ctx, x, y, size, color) { ... }
export function drawArrowIcon(ctx, x, y, size, color, direction) { ... }
```

---

## Implementation Priority Order

### Phase 1 - Critical (Fix Immediately)
1. Performance Metrics concentration card overlap
2. Alerts Dashboard value/days overlap
3. Status Pipeline summary text overlap

### Phase 2 - High Priority (Fix This Sprint)
4. Banner overlap issues (implement SAFE_AREA properly)
5. Active Projects 3-item layout
6. Velocity/Cycle Time legend positioning

### Phase 3 - Medium Priority (Next Sprint)
7. Icon rendering fallbacks
8. Gauge needle positioning
9. Font size increases for readability

### Phase 4 - Low Priority (Backlog)
10. Visual hierarchy enhancements
11. Dynamic spacing improvements

---

## Testing Checklist

After implementing fixes, verify:

- [ ] View slides from 10-20 feet distance on 4K display
- [ ] Test with actual data and mock data (banner visible)
- [ ] Verify no text overlaps in any state
- [ ] Check all icons render correctly
- [ ] Confirm legend/footer elements don't overlap banner
- [ ] Test with minimum and maximum data scenarios
- [ ] Verify contrast ratios meet WCAG AA (4.5:1)

---

*Generated: January 2026*
*Based on DESIGN.md v1.0 and slide audit of signage-engine*
